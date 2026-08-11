/**
 * ⛔ DISABLED — this login-setup spec is EXCLUDED from every run in
 *    config/wdio.shared.conf.ts (`exclude`), so `npm run android:login` no longer
 *    runs it. Login is no longer exercised via specs; the persisted session
 *    (appium:noReset) + ensureLoggedIn() in the real app specs cover auth. Kept
 *    for reference. To re-enable, remove this file's entry from the `exclude` array.
 *
 * P8D Android — one-time login ("login once, stay logged in").
 *
 * Run this ONCE to establish an authenticated session on the emulator:
 *   npm run android:login
 *
 * Because the Android config uses `appium:noReset = true`, the Tauri WebView
 * keeps that session across every later run — so you never have to log in
 * again until the session expires. `ensureLoggedIn()` is idempotent: if the
 * app is already signed in it does nothing, so this spec is safe to re-run and
 * safe to keep in the normal suite (it just no-ops once you're in).
 *
 * ⚠️ Preconditions (same as the other Android specs):
 *   1. ANDROID_UDID=emulator-5554 in .env.
 *   2. P8D dev server up:   TAURI_DEV_HOST=127.0.0.1 npm run dev:android   (in D:\Project\P8D\P8D)
 *   3. adb reverse:         npm run android:reverse
 *   4. STAFF_TOKEN set in .env (currently 14ea0a94).
 *   5. Run with the gate:   npm run android:login   (sets ANDROID_WEBVIEW_READY=1)
 */
import { expect } from "@wdio/globals"
import { ensureLoggedIn } from "../../utils/ensure-logged-in.js"

// One-time login is OPT-IN setup, not part of every run. It only runs when you
// invoke it explicitly with `npm run android:login` (which sets
// ANDROID_LOGIN_SETUP=1). Thanks to `appium:noReset = true` the session
// established here persists, so every later run goes straight into the app with
// NO login — see src/specs/android/app-home.e2e.ts.
const RUN_LOGIN_SETUP = process.env.ANDROID_LOGIN_SETUP === "1"
const suite = RUN_LOGIN_SETUP ? describe : describe.skip

suite("P8D Android — login once @setup", () => {
  it("signs in (or confirms an existing session) so later runs skip login", async () => {
    await ensureLoggedIn()

    // Proof of the invariant: after this we are NOT parked on a login screen.
    expect(await browser.getUrl()).not.toContain("login")
  })
})
