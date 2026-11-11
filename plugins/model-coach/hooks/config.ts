// Every threshold and switch model-coach uses, in one place.

export const CONFIG = {
  /** A /model switch with more context than this suggests /compact first. */
  switchCompactTokens: 50_000,
  /** Context past this suggests keeping the main thread lean. */
  leanContextTokens: 150_000,
  /** Effort levels above this one suggest a bigger model at lower effort. */
  maxComfortEffort: 'high' as const,
  /** Idle this long after a turn (with context past switchCompactTokens) means the cache went cold. */
  cacheTtlMs: 5 * 60_000,
  /** How often the idle check runs. */
  idleCheckMs: 30_000,
  /** A rate-limit window at or past this percent suggests a smaller model. */
  rateLimitPercent: 80,
  /** This many failing tool calls in a row on the main loop suggest the escalation ladder. */
  errorStreak: 3,
  /** Compaction is assumed at this share of the context window. */
  compactAtPercent: 90,
  /** Warn when compaction is this many turns away or fewer. */
  forecastTurns: 3,
  /** Turns of context growth averaged for the forecast. */
  forecastWindow: 3,
  /** Most tips kept in the band's queue at once. */
  maxQueued: 5,
  /** Where subagent definitions are looked up (relative to the project root and home). */
  agentDirs: ['.claude/agents'],
  /** Where a fresh catalog is fetched from, at most once per catalogMaxAgeMs. */
  catalogUrl: 'https://raw.githubusercontent.com/ilkayGkbdk/pitstop/main/plugins/model-coach/catalog.json',
  catalogMaxAgeMs: 24 * 60 * 60_000,
} as const

export type Config = typeof CONFIG
