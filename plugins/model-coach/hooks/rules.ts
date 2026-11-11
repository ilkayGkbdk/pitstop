// Pure rule logic: signals in, tips out. No `$`, so tests call it directly.

import type { Hint, RuleId } from '../types'
import { type Catalog, familyBelow, familyOf, rankOf } from './catalog'
import { CONFIG, type Config } from './config'
import { LANG_NAME, type Lang } from './i18n'

export const ALL_RULES: RuleId[] = [
  'switch-compact',
  'fable-downgrade',
  'context-lean',
  'effort-high',
  'agent-no-model',
  'explore-session-model',
  'opusplan',
  'fallback',
  'cache-cold',
  'rate-limit',
  'error-streak',
  'compact-forecast',
]

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

export const isOpusplan = (model: string | null | undefined) => (model ?? '').toLowerCase().includes('opusplan')

export const kTokens = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}K`)

const minutes = (ms: number) => `${Math.round(ms / 60_000)}m`

export type SwitchSignal = { from: string; to: string; contextTokens: number; estimatedCacheWriteUsd?: number }

export function onModelSwitch(s: SwitchSignal, catalog: Catalog, cfg: Config = CONFIG): Hint[] {
  const out: Hint[] = []
  if (s.contextTokens > cfg.switchCompactTokens) {
    const usd = s.estimatedCacheWriteUsd
    out.push({
      rule: 'switch-compact',
      vars: { k: kTokens(s.contextTokens), cost: usd && usd > 0 ? ` (~$${usd.toFixed(2)})` : '' },
    })
  }
  const from = familyOf(s.from, catalog)
  const to = familyOf(s.to, catalog)
  if (from === 'fable' && to !== 'unknown' && rankOf(to, catalog) < rankOf('fable', catalog)) {
    out.push({ rule: 'fable-downgrade', vars: { to } })
  }
  return out
}

export function onContext(tokens: number | undefined, cfg: Config = CONFIG): Hint | null {
  if (tokens === undefined || tokens <= cfg.leanContextTokens) return null
  return { rule: 'context-lean', vars: { k: kTokens(tokens) } }
}

export function onEffort(effort: string | number | undefined, cfg: Config = CONFIG): Hint | null {
  if (typeof effort !== 'string') return null
  const at = EFFORTS.indexOf(effort as (typeof EFFORTS)[number])
  if (at <= EFFORTS.indexOf(cfg.maxComfortEffort)) return null
  return { rule: 'effort-high', vars: { effort } }
}

/** Frontmatter `model:` of an agent file, or null when it has none. */
export function agentModel(text: string): string | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!m) return null
  const line = /^model\s*:\s*(.*)$/m.exec(m[1] ?? '')
  const value = line?.[1]?.trim().replace(/^["']|["']$/g, '')
  return value ? value : null
}

export function onAgentFiles(files: { name: string; text: string }[], defaultSubagentModel: string | undefined): Hint | null {
  if (defaultSubagentModel) return null
  const missing = files.filter(f => agentModel(f.text) === null).map(f => f.name)
  if (missing.length === 0) return null
  const list = missing.slice(0, 3).join(', ') + (missing.length > 3 ? ` +${missing.length - 3}` : '')
  return { rule: 'agent-no-model', vars: { list } }
}

export function onExploreSpawn(agentModelId: string, sessionModel: string, catalog: Catalog): Hint | null {
  const a = familyOf(agentModelId, catalog)
  if (a === 'haiku' || a === 'unknown' || a !== familyOf(sessionModel, catalog)) return null
  return { rule: 'explore-session-model', vars: { family: a } }
}

export function onOpusplan(model: string | null | undefined): Hint | null {
  return isOpusplan(model) ? { rule: 'opusplan', vars: {} } : null
}

/** A main-loop step on another family than the session's: a fallback. */
export function onStepModel(stepModel: string, sessionModel: string, catalog: Catalog): Hint | null {
  if (isOpusplan(sessionModel)) return null
  const step = familyOf(stepModel, catalog)
  const session = familyOf(sessionModel, catalog)
  if (step === 'unknown' || session === 'unknown' || step === session) return null
  return fallbackHint(sessionModel, stepModel)
}

export const fallbackHint = (from: string, to: string): Hint => ({ rule: 'fallback', vars: { from, to } })

/** Idle past the cache TTL with a big context: switching is free right now. */
export function onIdle(idleMs: number, contextTokens: number | undefined, ttlMs: number, cfg: Config = CONFIG): Hint | null {
  if (contextTokens === undefined || contextTokens <= cfg.switchCompactTokens || idleMs < ttlMs) return null
  return { rule: 'cache-cold', vars: { idle: minutes(idleMs), k: kTokens(contextTokens) } }
}

export type RateLimit = { kind: string; percentUsed: number; resetsAt?: string }

const WINDOW_LABEL: Record<string, string> = { five_hour: '5h', seven_day: '7d' }

export function onRateLimits(limits: readonly RateLimit[], sessionModel: string, catalog: Catalog, cfg: Config = CONFIG): Hint | null {
  const hot = [...limits].sort((a, b) => b.percentUsed - a.percentUsed).find(l => l.percentUsed >= cfg.rateLimitPercent)
  if (!hot) return null
  const below = familyBelow(familyOf(sessionModel, catalog), catalog)
  if (!below) return null
  const reset = hot.resetsAt ? ` (→ ${hot.resetsAt.slice(11, 16)})` : ''
  return {
    rule: 'rate-limit',
    vars: { window: WINDOW_LABEL[hot.kind] ?? hot.kind, pct: Math.round(hot.percentUsed), reset, below: catalog.families[below].label },
  }
}

export function onErrorStreak(streak: number, cfg: Config = CONFIG): Hint | null {
  return streak >= cfg.errorStreak ? { rule: 'error-streak', vars: { n: streak } } : null
}

/** Context fill per finished turn, oldest first → compaction in ~N turns. */
export function onGrowth(history: readonly number[], window: number, cfg: Config = CONFIG): Hint | null {
  const recent = history.slice(-(cfg.forecastWindow + 1))
  if (recent.length < cfg.forecastWindow + 1 || window <= 0) return null
  const deltas = recent.slice(1).map((n, i) => n - (recent[i] ?? n))
  if (deltas.some(d => d <= 0)) return null // a compaction or a shrink resets the trend
  const growth = deltas.reduce((a, b) => a + b, 0) / deltas.length
  const last = recent[recent.length - 1] ?? 0
  const room = (window * cfg.compactAtPercent) / 100 - last
  if (room <= 0) return null
  const turns = Math.ceil(room / growth)
  if (turns > cfg.forecastTurns) return null
  return { rule: 'compact-forecast', vars: { growth: kTokens(growth), turns } }
}

/** The cooldown and the mutes: tips whose rule has not fired yet and is not muted, one per rule. */
export function fresh(hints: (Hint | null)[], fired: readonly RuleId[], muted: readonly RuleId[] = []): Hint[] {
  const seen = new Set<RuleId>([...fired, ...muted])
  return hints.filter((h): h is Hint => h !== null && (seen.has(h.rule) ? false : (seen.add(h.rule), true)))
}

/** Layer 2: the routing rules, naming the catalog's current models. */
export function routingRules(catalog: Catalog, lang: Lang): string {
  const f = catalog.families
  return `# model-coach (pitstop)
The user wants a one-line model tip only when the kind of work clearly changes. When it does, start your reply with one line: "🏁 pitstop: <tip>" written in ${LANG_NAME[lang]}, then answer normally. Do not repeat a tip for the same kind of work; most replies carry none.
- Classification/routing/extraction, log reading, file search → ${f.haiku.label}
- Well-scoped bug fix, feature to spec, chat → ${f.sonnet.label}
- Everyday engineering, multi-PR feature → ${f.opus.label} medium
- Large refactor/migration, architecture planning, orchestrating many subagents, work ${f.opus.label} high could not finish → ${f.fable.label}
- When the model falls short, in order: (1) give it a verification path (test/build/script), (2) raise effort one level, (3) move one model up at lower effort.
- Automatically verifiable batch work: run at low effort, retry only the failures at high effort.`
}
