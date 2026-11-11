// Pure rule logic: signals in, tips out. No `$`, so tests call it directly.

import type { Hint, RuleId } from '../types'
import { CONFIG, type Config } from './config'

export type Family = 'haiku' | 'sonnet' | 'opus' | 'fable' | 'unknown'

const RANK: Record<Family, number> = { unknown: 0, haiku: 1, sonnet: 2, opus: 3, fable: 4 }
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

export function family(model: string | null | undefined): Family {
  const m = (model ?? '').toLowerCase()
  for (const f of ['fable', 'opus', 'sonnet', 'haiku'] as const) {
    if (m.includes(f)) return f
  }
  return 'unknown'
}

export const isOpusplan = (model: string | null | undefined) =>
  (model ?? '').toLowerCase().includes('opusplan')

const k = (n: number) => `${Math.round(n / 1000)}K`

export type SwitchSignal = {
  from: string
  to: string
  contextTokens: number
  estimatedCacheWriteUsd?: number
}

export function onModelSwitch(s: SwitchSignal, cfg: Config = CONFIG): Hint[] {
  const out: Hint[] = []
  if (s.contextTokens > cfg.switchCompactTokens) {
    const usd = s.estimatedCacheWriteUsd
    const cost = usd && usd > 0 ? ` (~$${usd.toFixed(2)})` : ''
    out.push({
      rule: 'switch-compact',
      text: `Context ${k(s.contextTokens)}: önce /compact yap; yeni model tüm geçmiş için cache-write öder${cost}.`,
    })
  }
  const from = family(s.from)
  const to = family(s.to)
  if (from === 'fable' && to !== 'unknown' && RANK[to] < RANK.fable) {
    out.push({
      rule: 'fable-downgrade',
      text: `Fable → ${to}: önceki thinking/reasoning düşecek.`,
    })
  }
  return out
}

export function onContext(tokens: number | undefined, cfg: Config = CONFIG): Hint | null {
  if (tokens === undefined || tokens <= cfg.leanContextTokens) return null
  return {
    rule: 'context-lean',
    text: `Context ${k(tokens)}: ana context'i yalın tut; log/dosya okumayı Haiku subagent'a ver.`,
  }
}

export function onEffort(effort: string | number | undefined, cfg: Config = CONFIG): Hint | null {
  if (typeof effort !== 'string') return null
  const at = EFFORTS.indexOf(effort as (typeof EFFORTS)[number])
  if (at <= EFFORTS.indexOf(cfg.maxComfortEffort)) return null
  return {
    rule: 'effort-high',
    text: `Effort ${effort}: bunun yerine bir üst modeli daha düşük effort'ta dene.`,
  }
}

/** Frontmatter `model:` of an agent file, or null when it has none. */
export function agentModel(text: string): string | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!m) return null
  const line = /^model\s*:\s*(.*)$/m.exec(m[1] ?? '')
  const value = line?.[1]?.trim().replace(/^["']|["']$/g, '')
  return value ? value : null
}

export function onAgentFiles(
  files: { name: string; text: string }[],
  defaultSubagentModel: string | undefined,
): Hint | null {
  if (defaultSubagentModel) return null
  const missing = files.filter(f => agentModel(f.text) === null).map(f => f.name)
  if (missing.length === 0) return null
  const list = missing.slice(0, 3).join(', ') + (missing.length > 3 ? ` +${missing.length - 3}` : '')
  return {
    rule: 'agent-no-model',
    text: `${list}: model: haiku veya sonnet ekle (CLAUDE_CODE_SUBAGENT_MODEL ile varsayılan da verilebilir).`,
  }
}

export function onExploreSpawn(agentModelId: string, sessionModel: string): Hint | null {
  const a = family(agentModelId)
  if (a === 'haiku' || a === 'unknown' || a !== family(sessionModel)) return null
  return {
    rule: 'explore-session-model',
    text: `Explore oturum modelinde (${a}) çalışıyor: model: haiku ile kendi Explore subagent'ını tanımla.`,
  }
}

export function onOpusplan(model: string | null | undefined): Hint | null {
  if (!isOpusplan(model)) return null
  return { rule: 'opusplan', text: 'opusplan aktif: kod düzenlemeleri Sonnet\'te; kendi işinde ölç.' }
}

/** A main-loop step on another family than the session's: a fallback. */
export function onStepModel(stepModel: string, sessionModel: string): Hint | null {
  if (isOpusplan(sessionModel)) return null
  const step = family(stepModel)
  const session = family(sessionModel)
  if (step === 'unknown' || session === 'unknown' || step === session) return null
  return fallbackHint(sessionModel, stepModel)
}

export const fallbackHint = (from: string, to: string): Hint => ({
  rule: 'fallback',
  text: `Fallback: ${from} → ${to} modeline düşüldü.`,
})

/** The cooldown: tips whose rule has not fired yet, one per rule. */
export function fresh(hints: Hint[], fired: readonly RuleId[]): Hint[] {
  const seen = new Set(fired)
  return hints.filter(h => (seen.has(h.rule) ? false : (seen.add(h.rule), true)))
}

export const ROUTING_RULES = `# model-coach (pitstop)
The user wants a one-line model tip only when the kind of work clearly changes. When it does, start your reply with one line: "🏁 pitstop: <öneri>" in Turkish, then answer normally. Do not repeat a tip for the same kind of work; most replies carry none.
- Classification/routing/extraction, log reading, file search → Haiku 5.5
- Well-scoped bug fix, feature to spec, chat → Sonnet 5.5
- Everyday engineering, multi-PR feature → Opus 5.5 medium
- Large refactor/migration, architecture planning, orchestrating many subagents, work Opus high could not finish → Fable 5.2
- When the model falls short, in order: (1) give it a verification path (test/build/script), (2) raise effort one level, (3) move one model up at lower effort.
- Automatically verifiable batch work: run at low effort, retry only the failures at high effort.`
