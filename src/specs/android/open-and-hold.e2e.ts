/**
 * Minimal "open the app and hold the session" spec.
 *
 * Purpose: launch/attach to the P8D Android app through the real Appium
 * pipeline, prove the session is actually driving the device (current
 * package/activity + context list + screenshot), then hold the session open
 * for a visible window so a human watching the physical device can confirm
 * the app is open and under our control.
 *
 * Unlike app-launch.e2e.ts this makes NO assumption about which screen renders
 * and runs NO assertions — it never fails the run for app-state reasons. It
 * only demonstrates control and leaves the app open on-screen.
 *
 * Run just this spec:
 *   npm run android:open
 * Tune how long the session is held open (default 20s):
 *   HOLD_MS=60000 npm run android:open
 */
import { androidAppShellPage } from "@pages"
import { logger } from "../../utils/logger.js"

const HOLD_MS = Number(process.env.HOLD_MS ?? 20_000)

describe("Android open app (manual control demo)", () => {
  it("launches the app and holds the session open", async () => {
    // 1. Which app is actually in the foreground right now? Proves the session
    //    attached to the intended package, not the launcher or another app.
    try {
      const pkg = await browser.execute("mobile: getCurrentPackage")
      const act = await browser.execute("mobile: getCurrentActivity")
      logger.info(`[open-hold] foreground package=${pkg} activity=${act}`)
    } catch (err) {
      logger.warn(`[open-hold] could not read current package/activity: ${(err as Error).message}`)
    }

    // 2. Native screenshot — works even if the webview isn't ready yet.
    try {
      const file = `./reports/screenshots/android-open-native-${Date.now()}.png`
      await browser.saveScreenshot(file)
      logger.info(`[open-hold] native screenshot → ${file}`)
    } catch (err) {
      logger.warn(`[open-hold] native screenshot failed: ${(err as Error).message}`)
    }

    // 3. Best-effort: switch into the app's webview and read the DOM. This is
    //    the strongest proof of control, but the demo must not fail if the
    //    webview is blocked/slow, so it's wrapped and non-fatal.
    try {
      await androidAppShellPage.switchToWebview(30_000)
      const body = await androidAppShellPage.getBodyText()
      logger.info(`[open-hold] webview DOM body (first 300): ${body.slice(0, 300)}`)
      await androidAppShellPage.screenshot("open-webview")
    } catch (err) {
      logger.warn(`[open-hold] webview step skipped (app still controlled natively): ${(err as Error).message}`)
    }

    // 4. Hold the session open so the app stays on-screen for manual inspection.
    logger.info(`[open-hold] holding session open for ${HOLD_MS}ms — app is on-screen and under control`)
    await browser.pause(HOLD_MS)
    logger.info("[open-hold] hold window elapsed — session ending, app left running")
  })
})
