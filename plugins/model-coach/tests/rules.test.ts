import { expect, test } from 'claude-code/testing'

import { familyBelow, familyOf, modelOf, parseCatalog } from '../hooks/catalog'
import { BUNDLED_CATALOG as C } from '../hooks/catalog-data'
import { detectLang, t } from '../hooks/i18n'
import {
  agentModel,
  ALL_RULES,
  fresh,
  onAgentFiles,
  onContext,
  onEffort,
  onErrorStreak,
  onExploreSpawn,
  onGrowth,
  onIdle,
  onModelSwitch,
  onOpusplan,
  onRateLimits,
  onStepModel,
  routingRules,
} from '../hooks/rules'

test('catalog: families, lookup, the family below', () => {
  expect(familyOf('claude-fable-5-2', C)).toBe('fable')
  expect(familyOf('Opus 5.5', C)).toBe('opus')
  expect(familyOf('gpt-x', C)).toBe('unknown')
  expect(modelOf('claude-opus-5-5[1m]', C)?.id).toBe('claude-opus-5-5')
  expect(modelOf('sonnet', C)?.id).toBe('claude-sonnet-5-5')
  expect(familyBelow('opus', C)).toBe('sonnet')
  expect(familyBelow('haiku', C)).toBeNull()
})

test('catalog: a fetched catalog is checked before it is trusted', () => {
  expect(parseCatalog(JSON.parse(JSON.stringify(C)))?.asOf).toBe(C.asOf)
  expect(parseCatalog({ schemaVersion: 2 })).toBeNull()
  expect(parseCatalog({ ...C, models: [{ id: 'x', family: 'gpt', label: 'x' }] })).toBeNull()
  expect(parseCatalog('nope')).toBeNull()
})

test('model switch over 50K suggests /compact; under it stays quiet', () => {
  const big = onModelSwitch({ from: 'claude-opus-5-5', to: 'claude-sonnet-5-5', contextTokens: 80_000 }, C)
  expect(big.map(h => h.rule)).toEqual(['switch-compact'])
  expect(onModelSwitch({ from: 'opus', to: 'sonnet', contextTokens: 10_000 }, C)).toEqual([])
})

test('leaving Fable for a lower model warns about thinking', () => {
  const hints = onModelSwitch({ from: 'claude-fable-5-2', to: 'claude-opus-5-5', contextTokens: 0 }, C)
  expect(hints.map(h => h.rule)).toEqual(['fable-downgrade'])
  expect(onModelSwitch({ from: 'opus', to: 'fable', contextTokens: 0 }, C)).toEqual([])
})

test('context and effort thresholds', () => {
  expect(onContext(150_000)).toBeNull()
  expect(onContext(150_001)?.rule).toBe('context-lean')
  expect(onEffort('high')).toBeNull()
  expect(onEffort('xhigh')?.rule).toBe('effort-high')
  expect(onEffort(undefined)).toBeNull()
})

test('agent files without model: are listed unless a default is set', () => {
  const files = [
    { name: 'reviewer', text: '---\nname: reviewer\nmodel: sonnet\n---\nbody' },
    { name: 'scout', text: '---\nname: scout\ndescription: x\n---\nbody' },
  ]
  expect(agentModel(files[0]!.text)).toBe('sonnet')
  expect(onAgentFiles(files, undefined)?.vars.list).toBe('scout')
  expect(onAgentFiles(files, 'haiku')).toBeNull()
})

test('Explore on the session model, opusplan, fallback', () => {
  expect(onExploreSpawn('claude-opus-5-5', 'claude-opus-5-5', C)?.rule).toBe('explore-session-model')
  expect(onExploreSpawn('claude-haiku-5-5', 'claude-opus-5-5', C)).toBeNull()
  expect(onOpusplan('opusplan')?.rule).toBe('opusplan')
  expect(onStepModel('claude-sonnet-5-5', 'claude-opus-5-5', C)?.rule).toBe('fallback')
  expect(onStepModel('claude-sonnet-5-5', 'opusplan', C)).toBeNull()
})

test('cold cache: only past the TTL and with a big context', () => {
  expect(onIdle(6 * 60_000, 80_000, 5 * 60_000)?.vars.idle).toBe('6m')
  expect(onIdle(4 * 60_000, 80_000, 5 * 60_000)).toBeNull()
  expect(onIdle(6 * 60_000, 10_000, 5 * 60_000)).toBeNull()
})

test('rate limit: the hottest window past 80% names the family below', () => {
  const limits = [
    { kind: 'seven_day', percentUsed: 40 },
    { kind: 'five_hour', percentUsed: 86, resetsAt: '2026-11-11T16:00:00Z' },
  ]
  const hint = onRateLimits(limits, 'claude-opus-5-5', C)
  expect(hint?.vars).toEqual({ window: '5h', pct: 86, reset: ' (→ 16:00)', below: 'Sonnet 5.5' })
  expect(onRateLimits([{ kind: 'five_hour', percentUsed: 50 }], 'claude-opus-5-5', C)).toBeNull()
  expect(onRateLimits(limits, 'claude-haiku-5-5', C)).toBeNull()
})

test('error streak and compaction forecast', () => {
  expect(onErrorStreak(2)).toBeNull()
  expect(onErrorStreak(3)?.vars.n).toBe(3)
  // 1M window, compaction at 90%: 840K + 3 × 20K/turn → 3 turns left
  expect(onGrowth([780_000, 800_000, 820_000, 840_000], 1_000_000)?.vars).toEqual({ growth: '20K', turns: 3 })
  expect(onGrowth([100_000, 120_000, 140_000, 160_000], 1_000_000)).toBeNull()
  expect(onGrowth([800_000, 820_000, 300_000, 320_000], 1_000_000)).toBeNull() // a compaction resets it
})

test('cooldown and mutes keep one tip per rule', () => {
  const a = { rule: 'context-lean' as const, vars: {} }
  expect(fresh([a, a, null], [])).toEqual([a])
  expect(fresh([a], ['context-lean'])).toEqual([])
  expect(fresh([a], [], ['context-lean'])).toEqual([])
})

test('i18n: every rule has both languages; detection order', () => {
  for (const rule of ALL_RULES) {
    expect(t('en', rule, {}).length).toBeGreaterThan(10)
    expect(t('tr', rule, {}).length).toBeGreaterThan(10)
    expect(t('en', rule, {})).not.toBe(t('tr', rule, {}))
  }
  expect(detectLang('tr', 'english', 'en_US')).toBe('tr')
  expect(detectLang('auto', 'Türkçe', 'en_US')).toBe('tr')
  expect(detectLang('auto', 'english', 'tr_TR.UTF-8')).toBe('en')
  expect(detectLang('auto', undefined, 'tr_TR.UTF-8')).toBe('tr')
  expect(detectLang('auto', undefined, undefined)).toBe('en')
})

test('routing rules name the catalog models and the tip language', () => {
  const text = routingRules(C, 'tr')
  expect(text).toContain('Haiku 5.5')
  expect(text).toContain('Fable 5.2')
  expect(text).toContain('written in Turkish')
})
