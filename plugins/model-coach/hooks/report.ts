// The pit report: token use per model, estimated cost, cache hit rate, and
// what the subagents would have cost one family down. Pure.

import type { Ledger, Totals } from '../types'
import { type Catalog, familyOf, modelOf } from './catalog'
import { type Lang, t } from './i18n'
import { kTokens } from './rules'

export type Usage = {
  model: string
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

export const EMPTY_LEDGER: Ledger = { main: {}, sub: {} }

const ZERO: Totals = { turns: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

export function addUsage(ledger: Ledger, usage: Usage, isSub: boolean): Ledger {
  const side = isSub ? 'sub' : 'main'
  const prev = ledger[side][usage.model] ?? ZERO
  const next: Totals = {
    turns: prev.turns + 1,
    input: prev.input + usage.input_tokens,
    output: prev.output + usage.output_tokens,
    cacheRead: prev.cacheRead + usage.cache_read_input_tokens,
    cacheWrite: prev.cacheWrite + usage.cache_creation_input_tokens,
  }
  return { ...ledger, [side]: { ...ledger[side], [usage.model]: next } }
}

/** Estimated USD for some totals on a model, at list price; null when unpriced. */
export function costOf(totals: Totals, model: string, catalog: Catalog): number | null {
  const price = modelOf(model, catalog)?.price
  if (!price) return null
  return (
    (totals.input * price.input +
      totals.output * price.output +
      totals.cacheRead * price.cacheRead +
      totals.cacheWrite * price.cacheWrite5m) /
    1_000_000
  )
}

export const hitRate = (x: Totals) => {
  const all = x.input + x.cacheRead + x.cacheWrite
  return all === 0 ? 0 : Math.round((x.cacheRead / all) * 100)
}

const usd = (n: number) => `$${n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2)}`

export function renderReport(ledger: Ledger, sessionUsd: number | undefined, catalog: Catalog, lang: Lang): string {
  const rows: string[] = []
  let estimated = 0
  for (const side of ['main', 'sub'] as const) {
    for (const [model, x] of Object.entries(ledger[side])) {
      const cost = costOf(x, model, catalog)
      estimated += cost ?? 0
      rows.push(
        t(lang, 'ui.reportRow', {
          who: t(lang, side === 'main' ? 'ui.reportMain' : 'ui.reportSub'),
          model,
          turns: x.turns,
          inTok: kTokens(x.input + x.cacheRead + x.cacheWrite),
          outTok: kTokens(x.output),
          hit: hitRate(x),
          cost: cost === null ? '?' : usd(cost),
        }),
      )
    }
  }
  const total = sessionUsd !== undefined ? usd(sessionUsd) : usd(estimated)
  const lines = [
    t(lang, 'ui.reportHead', { total, estimated: sessionUsd !== undefined ? '' : t(lang, 'ui.estimated') }),
    ...(rows.length ? rows : [t(lang, 'ui.reportEmpty')]),
  ]
  const save = subagentSavings(ledger, catalog)
  if (save) lines.push(t(lang, 'ui.reportSave', { spent: usd(save.spent), target: save.target, would: usd(save.would), save: usd(save.spent - save.would) }))
  lines.push(t(lang, 'ui.reportNote'))
  return lines.join('\n')
}

/** What the non-Haiku subagent turns cost, and what they would on Haiku. */
export function subagentSavings(ledger: Ledger, catalog: Catalog) {
  const haiku = catalog.families.haiku.latest
  let spent = 0
  let would = 0
  for (const [model, x] of Object.entries(ledger.sub)) {
    if (familyOf(model, catalog) === 'haiku') continue
    const a = costOf(x, model, catalog)
    const b = costOf(x, haiku, catalog)
    if (a === null || b === null) continue
    spent += a
    would += b
  }
  if (spent - would < 0.01) return null
  return { spent, would, target: catalog.families.haiku.label }
}
