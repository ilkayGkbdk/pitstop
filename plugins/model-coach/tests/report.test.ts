import { expect, test } from 'claude-code/testing'

import { BUNDLED_CATALOG as C } from '../hooks/catalog-data'
import { addUsage, costOf, EMPTY_LEDGER, hitRate, renderReport, subagentSavings } from '../hooks/report'

const u = (model: string, input: number, output: number, read = 0, write = 0) => ({
  model,
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: read,
  cache_creation_input_tokens: write,
})

test('ledger sums per model and side', () => {
  let l = addUsage(EMPTY_LEDGER, u('claude-opus-5-5', 1000, 100, 9000), false)
  l = addUsage(l, u('claude-opus-5-5', 1000, 100, 9000), false)
  l = addUsage(l, u('claude-opus-5-5', 500, 50), true)
  expect(l.main['claude-opus-5-5']?.turns).toBe(2)
  expect(l.main['claude-opus-5-5']?.cacheRead).toBe(18_000)
  expect(l.sub['claude-opus-5-5']?.input).toBe(500)
  expect(hitRate(l.main['claude-opus-5-5']!)).toBe(90)
})

test('cost at list price: 1M input + 1M output on Opus 5.5 is $24', () => {
  const totals = { turns: 1, input: 1_000_000, output: 1_000_000, cacheRead: 0, cacheWrite: 0 }
  expect(costOf(totals, 'claude-opus-5-5', C)).toBe(24)
  expect(costOf(totals, 'gpt-x', C)).toBeNull()
})

test('subagent savings: Opus subagents priced again on Haiku', () => {
  const l = addUsage(EMPTY_LEDGER, u('claude-opus-5-5', 1_000_000, 100_000), true)
  const save = subagentSavings(l, C)
  expect(save?.target).toBe('Haiku 5.5')
  expect(Math.round(save!.spent * 100)).toBe(600) // $4 + $2
  expect(Math.round(save!.would * 100)).toBe(15) // $0.10 + $0.05
  expect(subagentSavings(addUsage(EMPTY_LEDGER, u('claude-haiku-5-5', 1000, 10), true), C)).toBeNull()
})

test('the report renders in both languages', () => {
  const l = addUsage(EMPTY_LEDGER, u('claude-opus-5-5', 1_000_000, 100_000), true)
  const en = renderReport(l, 7.5, C, 'en')
  expect(en).toContain('Pit report · session cost $7.50')
  expect(en).toContain('Haiku 5.5')
  const tr = renderReport(EMPTY_LEDGER, undefined, C, 'tr')
  expect(tr).toContain('(tahmini)')
  expect(tr).toContain('Henüz sayılan turn yok.')
})
