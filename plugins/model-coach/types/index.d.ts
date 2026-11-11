export type RuleId =
  | 'switch-compact'
  | 'fable-downgrade'
  | 'context-lean'
  | 'effort-high'
  | 'agent-no-model'
  | 'explore-session-model'
  | 'opusplan'
  | 'fallback'

export type Hint = { rule: RuleId; text: string }

declare module 'claude-code' {
  interface PluginState {
    'model-coach': {
      /** Tips waiting in the band, oldest first. */
      queue: Hint[]
      /** Rules that already fired this session (the cooldown). */
      fired: RuleId[]
      /** Whether the coach is on (mirrors $.store 'enabled'). */
      isEnabled: boolean
    }
  }
}
