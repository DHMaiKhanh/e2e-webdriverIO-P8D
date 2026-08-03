/**
 * P8D Android — staff-token login FORM behaviour (functional DOM tests).
 *
 * Companion to staff-token-login.e2e.ts. That file asserts the AUTH *outcome*
 * (valid / invalid / empty token → does the app let you in?). This file asserts
 * the FORM itself — structure, input handling, client-side validation and
 * resilience — none of which need a real STAFF_TOKEN, so every case here
 * actually RUNS on the emulator (nothing is token-gated).
 *
 * ⚠️ Same preconditions & gating as staff-token-login.e2e.ts:
 *   1. ANDROID_UDID=emulator-5554 (the P8_Dual emulator) in .env.
 *   2. P8D dev server up:   TAURI_DEV_HOST=127.0.0.1 npm run dev:android   (in D:\Project\P8D\P8D)
 *   3. adb reverse:         npm run android:reverse
 *   4. Run with the gate:   npm run test:android:emu   (sets ANDROID_WEBVIEW_READY=1)
 *
 * The whole suite is GATED behind ANDROID_WEBVIEW_READY because the physical
 * MDM-locked P8D kills its WebView renderer, which hangs any context switch
 * (see device-smoke.e2e.ts). Unlike staff-token-login.e2e.ts, NO case here
 * needs STAFF_TOKEN — these are all form / negative-path checks.
 */
import { expect } from "@wdio/globals"
import { androidAppShellPage, staffTokenLoginPage } from "@pages"
import { ROUTES } from "../../constants/routes.js"
import { SELECTORS } from "../../constants/selectors.js"
import { TIMEOUTS } from "../../constants/timeouts.js"

const APP_ID = "com.fastboy.volt_pos"

// ⛔ LOGIN TEST CASES DISABLED — by project decision, every run goes STRAIGHT
//    into the app on the already-authenticated session (appium:noReset keeps the
//    session alive; see src/specs/android/app-home.e2e.ts + utils/ensure-logged-in.ts).
//    These cases are kept for reference but never run. To re-enable, restore:
//      const suite = process.env.ANDROID_WEBVIEW_READY === "1" ? describe : describe.skip
const suite = describe.skip

suite("P8D Android — staff token login form @regression", () => {
  before(async () => {
    await browser.execute("mobile: activateApp", { appId: APP_ID })
    await androidAppShellPage.switchToWebview()
  })

  // Re-mount a clean login screen before each case so every test starts from a
  // known state regardless of where the previous one navigated. Hard navigation
  // reloads the whole SPA over the dev tunnel — slow on the ARM-translated
  // emulator — so wait generously for the token field to paint.
  beforeEach(async () => {
    await browser.url(ROUTES.LOGIN_STAFF_TOKEN)
    await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).waitForDisplayed({ timeout: TIMEOUTS.EXTRA_LONG })
  })

  it("renders the token input, submit button and Staff Token label", async () => {
    await androidAppShellPage.screenshot("login-form-structure")

    expect(await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).isDisplayed()).toBe(true)
    expect(await $(SELECTORS.LOGIN_STAFF_TOKEN.SUBMIT_BTN).isExisting()).toBe(true)
    expect(await $("body").getText()).toContain("Staff Token")
  })

  it("starts with an empty token field on a fresh visit", async () => {
    // beforeEach just hard-navigated here, so the field must be blank — no value
    // leaked from a previous case and no browser autofill pre-populating it.
    expect(await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).getValue()).toBe("")
  })

  it("reflects a typed token in the field", async () => {
    // Typing into the field must be captured by the (React-controlled) input —
    // proves the form is interactive, not a dead render.
    const sample = "sample-token-1234"
    await staffTokenLoginPage.enterToken(sample)
    expect(await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).getValue()).toBe(sample)
  })

  it("does not authenticate a whitespace-only token", async () => {
    // A blank-but-non-empty token must never reach the authenticated app. The
    // submit button may stay disabled once the value is trimmed to nothing; if
    // so, that alone satisfies the invariant, so only click when it's actionable.
    await staffTokenLoginPage.enterToken("   ")
    const submitBtn = $(SELECTORS.LOGIN_STAFF_TOKEN.SUBMIT_BTN)
    if (await submitBtn.isClickable()) {
      await submitBtn.click()
      await browser.pause(TIMEOUTS.LONG)
    }
    await androidAppShellPage.screenshot("login-whitespace-token")

    // Safety invariant: we stay somewhere in the login flow.
    expect(await browser.getUrl()).toContain("login")
  })

  it("lets the operator retry after a rejected token", async () => {
    // A rejected token must not lock the flow up — the operator has to be able
    // to fix a typo and try again.
    await staffTokenLoginPage.signIn("00000000-invalid-token")
    await browser.pause(TIMEOUTS.LONG)
    expect(await browser.getUrl()).toContain("login")

    // Re-open the form and prove a fresh attempt is accepted into the field,
    // whatever screen the rejected submit left us on.
    await browser.url(ROUTES.LOGIN_STAFF_TOKEN)
    await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).waitForDisplayed({ timeout: TIMEOUTS.EXTRA_LONG })
    await staffTokenLoginPage.enterToken("second-attempt")
    expect(await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).getValue()).toBe("second-attempt")
  })
})
