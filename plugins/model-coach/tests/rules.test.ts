import { expect, test } from 'claude-code/testing'

import {
  agentModel,
  family,
  fresh,
  onAgentFiles,
  onContext,
  onEffort,
  onExploreSpawn,
  onModelSwitch,
  onOpusplan,
  onStepModel,
} from '../hooks/rules'

test('family reads aliases and full ids', () => {
  expect(family('claude-fable-5-2')).toBe('fable')
  expect(family('Opus 5.5')).toBe('opus')
  expect(family('haiku')).toBe('haiku')
  expect(family('gpt-x')).toBe('unknown')
})

test('model switch over 50K suggests /compact; under it stays quiet', () => {
  const big = onModelSwitch({ from: 'claude-opus-5-5', to: 'claude-sonnet-5-5', contextTokens: 80_000 })
  expect(big.map(h => h.rule)).toEqual(['switch-compact'])
  expect(onModelSwitch({ from: 'opus', to: 'sonnet', contextTokens: 10_000 })).toEqual([])
})

test('leaving Fable for a lower model warns about thinking', () => {
  const hints = onModelSwitch({ from: 'claude-fable-5-2', to: 'claude-opus-5-5', contextTokens: 0 })
  expect(hints.map(h => h.rule)).toEqual(['fable-downgrade'])
  expect(onModelSwitch({ from: 'opus', to: 'fable', contextTokens: 0 })).toEqual([])
})

test('context and effort thresholds', () => {
  expect(onContext(150_000)).toBeNull()
  expect(onContext(150_001)?.rule).toBe('context-lean')
  expect(onEffort('high')).toBeNull()
  expect(onEffort('xhigh')?.rule).toBe('effort-high')
  expect(onEffort('max')?.rule).toBe('effort-high')
  expect(onEffort(undefined)).toBeNull()
})

test('agent files without model: are listed unless a default is set', () => {
  const files = [
    { name: 'reviewer', text: '---\nname: reviewer\nmodel: sonnet\n---\nbody' },
    { name: 'scout', text: '---\nname: scout\ndescription: x\n---\nbody' },
  ]
  expect(agentModel(files[0]!.text)).toBe('sonnet')
  expect(onAgentFiles(files, undefined)?.text).toContain('scout')
  expect(onAgentFiles(files, 'haiku')).toBeNull()
})

test('Explore on the session model, opusplan, fallback', () => {
  expect(onExploreSpawn('claude-opus-5-5', 'claude-opus-5-5')?.rule).toBe('explore-session-model')
  expect(onExploreSpawn('claude-haiku-5-5', 'claude-opus-5-5')).toBeNull()
  expect(onOpusplan('opusplan')?.rule).toBe('opusplan')
  expect(onStepModel('claude-sonnet-5-5', 'claude-opus-5-5')?.rule).toBe('fallback')
  expect(onStepModel('claude-sonnet-5-5', 'opusplan')).toBeNull()
})

test('cooldown keeps one tip per rule', () => {
  const a = { rule: 'context-lean' as const, text: 'a' }
  expect(fresh([a, a], [])).toEqual([a])
  expect(fresh([a], ['context-lean'])).toEqual([])
})
