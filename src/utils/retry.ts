import { logger } from "./logger.js"
import { sleep } from "./wait.js"

export interface RetryOptions {
  /** Max attempts including the first. Default 3. */
  attempts?: number
  /** Delay between attempts in ms. Default 500. */
  delayMs?: number
  /** Multiply the delay after each failure. Default 1 (constant). */
  backoff?: number
  /** Label for logging. */
  label?: string
}

/**
 * Retry an async operation that may be transiently flaky (network, timing).
 * Throws the last error if all attempts fail.
 *
 *   await retry(() => api.fetchOrder(id), { attempts: 5, label: "fetchOrder" })
 */
export const retry = async <T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> => {
  const { attempts = 3, delayMs = 500, backoff = 1, label = "operation" } = options
  let lastError: unknown
  let delay = delayMs

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      logger.warn(`[retry] ${label} failed (attempt ${attempt}/${attempts}): ${(err as Error).message}`)
      if (attempt < attempts) {
        await sleep(delay)
        delay *= backoff
      }
    }
  }
  throw lastError
}
