// Every threshold and switch model-coach uses, in one place.

export const CONFIG = {
  /** A /model switch with more context than this suggests /compact first. */
  switchCompactTokens: 50_000,
  /** Context past this suggests keeping the main thread lean. */
  leanContextTokens: 150_000,
  /** Effort levels above this one suggest a bigger model at lower effort. */
  maxComfortEffort: 'high' as const,
  /** Most tips kept in the band's queue at once. */
  maxQueued: 5,
  /** Inject the layer-2 routing rules into the system prompt. */
  injectRouting: true,
  /** Where subagent definitions are looked up (relative to the project root / home). */
  agentDirs: ['.claude/agents'],
} as const

export type Config = typeof CONFIG
