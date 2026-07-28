import { TIMEOUTS } from "../../constants/timeouts.js"
import { logger } from "../../utils/logger.js"
import { sleep, withTimeout } from "../../utils/wait.js"

/** Each chromedriver call gets this long before we give up and retry — the
 * webview devtools attach can hang indefinitely on a dead handshake instead
 * of erroring, so a per-attempt timeout is required to make retries fire. */
const CONTEXT_ATTEMPT_TIMEOUT = 15_000

/**
 * AndroidAppShellPage — entry point for native Android runs.
 *
 * The app under test is a Tauri webview wrapped as a native Android app, so
 * every DOM selector (SELECTORS.*) only resolves once WebdriverIO switches
 * out of the `NATIVE_APP` context into the app's `WEBVIEW_*` context. Page
 * objects built for the web/desktop configs (LoginPage, StaffTokenLoginPage,
 * ...) can be reused as-is on Android as long as `switchToWebview()` ran first.
 */
export class AndroidAppShellPage {
  /** Switch the session into the app's webview context. Retries while the
   * webview is still attaching (common right after app launch). */
  async switchToWebview(timeout = TIMEOUTS.LONG): Promise<void> {
    const deadline = Date.now() + timeout
    let lastContexts: string[] = []
    while (Date.now() < deadline) {
      try {
        const contexts = (await withTimeout(
          browser.getContexts() as Promise<string[]>,
          CONTEXT_ATTEMPT_TIMEOUT,
          "getContexts"
        )) as string[]
        lastContexts = contexts
        const webview = contexts.find((c) => c.toString().startsWith("WEBVIEW"))
        if (webview) {
          await withTimeout(browser.switchContext(webview), CONTEXT_ATTEMPT_TIMEOUT, "switchContext")
          logger.info(`[AndroidAppShell] switched to context ${webview}`)
          return
        }
      } catch (err) {
        logger.warn(`[AndroidAppShell] context attempt failed, retrying: ${(err as Error).message}`)
      }
      await sleep(500)
    }
    throw new Error(
      `[AndroidAppShell] no WEBVIEW context appeared within ${timeout}ms (saw: ${JSON.stringify(lastContexts)})`
    )
  }

  /** Raw text of whatever screen is currently showing — used for diagnostics
   * when the app lands somewhere unexpected (e.g. an error/support screen). */
  async getBodyText(): Promise<string> {
    return $("body").getText()
  }

  /** Best-effort diagnostic screenshot. The webview screenshot handshake can
   * hang indefinitely on a dead handshake just like getContexts/switchContext,
   * so it's timeout-guarded; failure here is logged, not thrown, since a
   * missing screenshot shouldn't take down the rest of the test. */
  async screenshot(label: string): Promise<string | undefined> {
    const safe = label.replace(/[^a-z0-9]/gi, "_").toLowerCase()
    const file = `./reports/screenshots/android-${safe}-${Date.now()}.png`
    try {
      await withTimeout(browser.saveScreenshot(file), CONTEXT_ATTEMPT_TIMEOUT, "saveScreenshot")
      logger.info(`[AndroidAppShell] screenshot → ${file}`)
      return file
    } catch (err) {
      logger.warn(`[AndroidAppShell] screenshot failed, continuing: ${(err as Error).message}`)
      return undefined
    }
  }
}

export const androidAppShellPage = new AndroidAppShellPage()
