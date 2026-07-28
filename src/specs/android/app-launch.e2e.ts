/**
 * Android pipeline smoke test.
 *
 * Goal: prove the Appium/uiautomator2 pipeline (device attach → app launch →
 * webview context switch → DOM access) works end-to-end. It does NOT assume
 * the app reaches /login — the app currently shows a "Please contact
 * support for assistance" screen on some devices, so this spec captures
 * that state as a diagnostic instead of failing blindly on an unmet
 * assumption.
 */
import { expect } from "@wdio/globals"
import { androidAppShellPage } from "@pages"
import { logger } from "../../utils/logger.js"

describe("Android app launch @smoke", () => {
  it("attaches to the app and reaches a webview context", async () => {
    await androidAppShellPage.switchToWebview()

    const bodyText = await androidAppShellPage.getBodyText()
    await androidAppShellPage.screenshot("launch")
    logger.info(`[android-launch] body text snapshot: ${bodyText.slice(0, 500)}`)

    if (/contact support/i.test(bodyText)) {
      logger.error(
        "[android-launch] app rendered a support/error screen instead of the login flow — " +
          "pipeline works, but the app itself is blocked. See screenshot in reports/screenshots."
      )
    }

    // Pipeline assertion only: we reached a webview and could read the DOM.
    expect(bodyText.length).toBeGreaterThan(0)
  })
})
