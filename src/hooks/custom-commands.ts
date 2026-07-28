import { TIMEOUTS } from "../constants/timeouts.js"
import { logger } from "../utils/logger.js"

/**
 * Custom WebdriverIO commands.
 *
 * Registered once per session via `before` in the shared config. Adding a
 * command here is preferable to a free-standing helper when:
 *   - It reads naturally as `browser.X()` or `el.X()`
 *   - It's used by 3+ page objects
 *
 * Anything more specific lives in src/utils/. Declare new command signatures
 * in src/types/wdio.d.ts so they are type-checked.
 */
export const registerCustomCommands = (): void => {
  /** `browser.gotoRoute("/settings")` — navigate while logging the transition. */
  browser.addCommand("gotoRoute", async function (this: WebdriverIO.Browser, route: string) {
    logger.info(`→ navigate ${route}`)
    await this.url(route)
  })

  /** `el.waitAndClick()` — combined wait-for-clickable + click. */
  browser.addCommand(
    "waitAndClick",
    async function (this: WebdriverIO.Element, timeout = TIMEOUTS.MEDIUM) {
      await this.waitForClickable({ timeout })
      await this.click()
    },
    true
  )

  /**
   * `browser.softAssert(fn, message)` — runs an assertion without throwing,
   * captures the failure, returns it. Useful in specs that verify many
   * independent things in one test.
   */
  browser.addCommand(
    "softAssert",
    async function (this: WebdriverIO.Browser, fn: () => Promise<void>, message: string) {
      try {
        await fn()
        return null
      } catch (err) {
        const e = err as Error
        logger.warn(`[softAssert] ${message} — ${e.message}`)
        return { message, error: e.message }
      }
    }
  )

  logger.debug("Custom WDIO commands registered")
}
