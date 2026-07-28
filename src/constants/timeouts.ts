/**
 * Centralized timeouts. Prefer these named constants over magic numbers
 * in spec/page code. Tune by category, not per-call-site.
 */
export const TIMEOUTS = {
  /** Element appearance / disappearance — most common */
  SHORT: 5_000,
  /** Default WDIO `waitFor*` budget */
  MEDIUM: 15_000,
  /** Network requests, API responses */
  LONG: 30_000,
  /** App startup, splash → home, large data sync */
  EXTRA_LONG: 60_000,
  /** Animation / transition delays. Avoid using — prefer waitForStable. */
  ANIMATION: 500
} as const

export type TimeoutKey = keyof typeof TIMEOUTS
