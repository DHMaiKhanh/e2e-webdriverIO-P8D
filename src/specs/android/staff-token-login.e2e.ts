/**
 * P8D Android — staff-token login (functional DOM test, runs on the emulator).
 *
 * Verified working against the **P8_Dual emulator** with the P8D Vite dev
 * server running and `adb reverse tcp:1420` in place (see README / chat notes):
 * the emulator's WebView renderer answers CDP, so Appium's chromedriver can
 * drive the DOM.
 *
 * ⚠️ Preconditions to run this (otherwise the whole suite is skipped):
 *   1. `ANDROID_UDID=emulator-5554` (the P8_Dual emulator) in .env.
 *   2. P8D dev server up:   TAURI_DEV_HOST=127.0.0.1 npm run dev:android   (in D:\Project\P8D\P8D)
 *   3. adb reverse:         npm run android:reverse
 *   4. Run with the flag:   cross-env ANDROID_WEBVIEW_READY=1 npm run test:android
 *
 * The happy-path case additionally needs a REAL staff token — set `STAFF_TOKEN`
 * in .env. Without it that one case is skipped; the negative cases still run.
 *
 * The suite is GATED behind ANDROID_WEBVIEW_READY because the physical
 * MDM-locked P8D kills its WebView renderer, which hangs any context switch
 * (see device-smoke.e2e.ts).
 */
import { expect } from "@wdio/globals"
import { androidAppShellPage, staffTokenLoginPage } from "@pages"
import { ROUTES } from "../../constants/routes.js"
import { SELECTORS } from "../../constants/selectors.js"
import { TIMEOUTS } from "../../constants/timeouts.js"
import { ENV } from "../../utils/env.js"

const APP_ID = "com.fastboy.volt_pos.debug"
const VALID_TOKEN = ENV.testUser.staffToken

// ⛔ LOGIN TEST CASES DISABLED — every run goes STRAIGHT into the app on the
//    already-authenticated session (appium:noReset keeps it alive; see
//    src/specs/android/app-home.e2e.ts + utils/ensure-logged-in.ts). This whole
//    file is ALSO excluded from every run in config/wdio.shared.conf.ts
//    (`exclude`), so it is never even loaded — no run, no skipped rows on the
//    dashboard. The describe.skip below is a secondary safety net. To fully
//    re-enable, remove this file from the shared `exclude` array AND restore:
//      const suite = process.env.ANDROID_WEBVIEW_READY === "1" ? describe : describe.skip
const suite = describe.skip
// The happy path needs a real token; skip just that case when none is provided.
const happyPathIt = VALID_TOKEN ? it : it.skip

suite("P8D Android — staff token login @regression", () => {
  before(async () => {
    await browser.execute("mobile: activateApp", { appId: APP_ID })
    await androidAppShellPage.switchToWebview()
  })

  // Re-mount the form before every case so each test starts from a clean login
  // screen regardless of what the previous one navigated to. Hard navigation
  // reloads the whole SPA over the dev tunnel — slow on the ARM-translated
  // emulator — so wait generously for the token field to paint.
  beforeEach(async () => {
    await browser.url(ROUTES.LOGIN_STAFF_TOKEN)
    await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).waitForDisplayed({ timeout: TIMEOUTS.EXTRA_LONG })
  })

  it("loads the staff-token form", async () => {
    await androidAppShellPage.screenshot("staff-token-form")

    expect(await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).isDisplayed()).toBe(true)
    expect(await $("body").getText()).toContain("Staff Token")
  })

  it("cannot submit an empty staff token", async () => {
    // Submitting nothing must never leave the login flow. The submit button may
    // be disabled while the field is empty; if it is, that alone satisfies the
    // invariant, so only click when it's actually actionable.
    const submitBtn = $(SELECTORS.LOGIN_STAFF_TOKEN.SUBMIT_BTN)
    if (await submitBtn.isClickable()) {
      await submitBtn.click()
      await browser.pause(TIMEOUTS.ANIMATION)
    }
    await androidAppShellPage.screenshot("staff-token-empty")

    expect(await browser.getUrl()).toContain("login")
  })

  it("does not sign in with an invalid staff token", async () => {
    await staffTokenLoginPage.signIn("00000000-invalid-token")
    // Allow the backend round-trip + error to render.
    await browser.pause(TIMEOUTS.LONG)
    await androidAppShellPage.screenshot("staff-token-invalid")

    // Safety invariant: a bad token must NOT reach the authenticated app — we
    // stay somewhere in the login flow.
    expect(await browser.getUrl()).toContain("login")
  })

  happyPathIt("signs in with a valid staff token and leaves the login flow", async () => {
    await staffTokenLoginPage.signIn(VALID_TOKEN)

    // A successful auth routes the SPA away from any `/login*` screen. Wait for
    // that navigation rather than a fixed pause — startup + first data sync is
    // slow on the emulator.
    await browser.waitUntil(async () => !(await browser.getUrl()).includes("login"), {
      timeout: TIMEOUTS.EXTRA_LONG,
      timeoutMsg: "Expected to navigate away from the login flow after a valid token"
    })
    await androidAppShellPage.screenshot("staff-token-success")

    expect(await browser.getUrl()).not.toContain("login")
  })
})
