import { TIMEOUTS } from "../constants/timeouts.js"
import { logger } from "./logger.js"

/**
 * Wait helpers tuned for a modern SPA / desktop WebView app.
 *
 * Prefer these to raw `browser.pause()` calls — pauses are the #1 source
 * of flake. Each helper expresses *why* it's waiting, which makes failures
 * legible and lets us swap the implementation later.
 */

export interface WaitOptions {
  timeout?: number
  interval?: number
  timeoutMsg?: string
}

/** Generic predicate-based wait. Returns the awaited value. */
export const waitUntil = async <T>(
  predicate: () => Promise<T | false | null | undefined>,
  options: WaitOptions = {}
): Promise<T> => {
  const { timeout = TIMEOUTS.MEDIUM, interval = 250, timeoutMsg = "waitUntil timed out" } = options
  const deadline = Date.now() + timeout
  let lastResult: T | false | null | undefined
  while (Date.now() < deadline) {
    lastResult = await predicate()
    if (lastResult) return lastResult as T
    await sleep(interval)
  }
  throw new Error(`${timeoutMsg} (after ${timeout}ms)`)
}

/** Wait for a UI region to be "stable" — useful after route transitions. */
export const waitForStable = async (selector: string, options: WaitOptions = {}): Promise<void> => {
  const { timeout = TIMEOUTS.SHORT, interval = 200 } = options
  const deadline = Date.now() + timeout
  let prevHtml = ""
  let stableSince = 0
  while (Date.now() < deadline) {
    const el = await $(selector)
    const exists = await el.isExisting()
    if (exists) {
      const html = await el.getHTML(false)
      if (html === prevHtml) {
        if (stableSince === 0) stableSince = Date.now()
        if (Date.now() - stableSince >= interval * 2) return
      } else {
        prevHtml = html
        stableSince = 0
      }
    }
    await sleep(interval)
  }
  logger.warn(`waitForStable: ${selector} did not stabilize within ${timeout}ms`)
}

/**
 * Promise-resolving sleep. Use sparingly — prefer waitUntil/waitForStable.
 * The only legitimate use is for animation timing where the DOM doesn't
 * actually change but a transition is mid-flight.
 */
export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Race a promise against a timeout — rejects instead of hanging forever.
 * Needed for Appium/chromedriver calls that can hang on a dead HTTP request
 * (e.g. webview devtools attach) without ever rejecting on their own. */
export const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

/** Wait for the page to reach the given URL fragment. */
export const waitForRoute = async (fragment: string, options: WaitOptions = {}): Promise<void> => {
  const { timeout = TIMEOUTS.MEDIUM } = options
  await browser.waitUntil(
    async () => {
      const url = await browser.getUrl()
      return url.includes(fragment)
    },
    {
      timeout,
      timeoutMsg: `Expected URL to contain "${fragment}" within ${timeout}ms`
    }
  )
}
