/**
 * P8D Android — real app test cases (runs STRAIGHT into the app).
 *
 * This is the entry point for actual product tests. It assumes the app is
 * ALREADY authenticated:
 *
 *   • `ensureLoggedIn()` performs the staff-token login only the FIRST time (or
 *     after the session expires) and is a pure no-op on every run after that,
 *     because the Android config uses `appium:noReset = true` (the Tauri WebView
 *     keeps its auth session across runs). See utils/ensure-logged-in.ts.
 *   • So day-to-day this spec just walks straight into the app and runs your
 *     cases — no login screen, no login assertions, no login test cases.
 *
 * First-time setup (once per emulator): `npm run android:login`. After that,
 * normal runs go straight in.
 *
 * ⚠️ Preconditions (same as the other emulator specs):
 *   1. ANDROID_UDID=emulator-5554 in .env.
 *   2. P8D dev server up:   TAURI_DEV_HOST=127.0.0.1 npm run dev:android   (in D:\Project\P8D\P8D)
 *   3. adb reverse:         npm run android:reverse
 *   4. Run with the gate:   npm run test:android:emu   (sets ANDROID_WEBVIEW_READY=1)
 */
import { expect } from "@wdio/globals"
import { ensureLoggedIn } from "../../utils/ensure-logged-in.js"

// Driving the DOM needs a webview-capable target (the emulator). Gated like the
// other webview specs so it's skipped on the physical MDM device that can't
// drive its WebView. `npm run test:android:emu` sets this flag.
const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
const suite = WEBVIEW_READY ? describe : describe.skip

suite("P8D Android — app @regression", () => {
  before(async () => {
    // Straight into the app. Logs in ONCE only if the session isn't established
    // yet (or expired); otherwise a pure no-op. This is the guard that gets us
    // in — never a login *test*.
    await ensureLoggedIn()
  })

  it("is inside the authenticated app (not parked on a login screen)", async () => {
    expect(await browser.getUrl()).not.toContain("login")
  })

  // 👉 Add your real app test cases below. The session is authenticated and
  //    you're on the app root — navigate with `browser.url(ROUTES.APP.*)` and
  //    assert against the screen. Example:
  //
  //  it("opens settings", async () => {
  //    await browser.url(ROUTES.APP.SETTINGS)
  //    expect(await browser.getUrl()).toContain("/settings")
  //  })
})
