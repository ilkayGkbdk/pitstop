export type RuleId =
  | 'switch-compact'
  | 'fable-downgrade'
  | 'context-lean'
  | 'effort-high'
  | 'agent-no-model'
  | 'explore-session-model'
  | 'opusplan'
  | 'fallback'
  | 'cache-cold'
  | 'rate-limit'
  | 'error-streak'
  | 'compact-forecast'

/** A tip: its rule and the values its message is filled with, so it can be drawn in any language. */
export type Hint = { rule: RuleId; vars: Record<string, string | number> }

/** Token counts summed per model. */
export type Totals = {
  turns: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export type Ledger = {
  main: Record<string, Totals>
  sub: Record<string, Totals>
}

declare module 'claude-code' {
  interface PluginState {
    'model-coach': {
      /** Tips waiting in the band, oldest first; the band shows the newest. */
      queue: Hint[]
      /** Rules that already fired this session (the cooldown). */
      fired: RuleId[]
      /** Whether the coach is on (mirrors $.store 'enabled'). */
      isEnabled: boolean
      /** 'en' or 'tr', resolved from the language option. */
      lang: string
      /** Rules muted across sessions (mirrors $.store 'muted'). */
      muted: RuleId[]
      /** Token use per model this session, for /model-coach report. */
      ledger: Ledger
    }
  }
}
