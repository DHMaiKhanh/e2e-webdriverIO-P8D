import { androidAppShellPage, staffTokenLoginPage } from "@pages"
import { ROUTES } from "../constants/routes.js"
import { SELECTORS } from "../constants/selectors.js"
import { TIMEOUTS } from "../constants/timeouts.js"
import { recoverAppConnection } from "./ensure-network.js"
import { ENV } from "./env.js"
import { logger } from "./logger.js"

const APP_ID = "com.fastboy.volt_pos.debug"

/**
 * "Login once, stay logged in."
 *
 * Ensures the P8D Android app is authenticated, running the staff-token login
 * ONLY when the current session isn't already signed in.
 *
 * Why this is enough to log in a single time and never again:
 * the Android config runs with `appium:noReset = true`
 * (config/wdio.android.conf.ts), so Appium never wipes the app's data between
 * sessions. The Tauri WebView therefore keeps the auth session that the
 * `exchangeImpersonationToken` mutation established — across specs, across full
 * `npm run test:android` runs, and across reboots — until the session actually
 * expires. After the first successful login this function is a no-op on every
 * later run: it navigates to the app root, sees it is NOT on a `/login*` screen,
 * and returns immediately.
 *
 * Usage in an authenticated spec:
 *   before(async () => { await ensureLoggedIn() })
 *
 * Preconditions are the same as the other Android specs (emulator up, dev
 * server + `adb reverse`, ANDROID_WEBVIEW_READY=1) and `STAFF_TOKEN` set in .env.
 */
export async function ensureLoggedIn(): Promise<void> {
  await browser.execute("mobile: activateApp", { appId: APP_ID })
  await androidAppShellPage.switchToWebview()

  // Land on the app root and let the SPA router decide where we belong: an
  // authenticated session settles on a real screen, a logged-out one is
  // bounced to /login (QR) — either way `splashscreen` is only ever transient.
  await browser.url(ROUTES.ROOT)
  await browser.pause(TIMEOUTS.ANIMATION)

  const alreadyAuthenticated = await browser
    .waitUntil(
      async () => {
        const url = await browser.getUrl()
        return !url.includes("login") && !url.includes("splashscreen")
      },
      { timeout: TIMEOUTS.SHORT }
    )
    .then(() => true)
    .catch(() => false)

  if (alreadyAuthenticated) {
    logger.info("[ensureLoggedIn] session already authenticated — skipping login")
    // Heal the "Couldn't load … / Please check your connection" screen so the
    // app is actually showing live data before the spec asserts against it.
    await recoverAppConnection().catch(() => {})
    return
  }

  const settledUrl = await browser.getUrl()
  if (!settledUrl.includes("login")) {
    // Neither settled on a real screen nor bounced to login — don't force a
    // needless login; the router is likely mid-transition on an authed session.
    logger.info(`[ensureLoggedIn] not on a login screen (url=${settledUrl}) — assuming authenticated`)
    await recoverAppConnection().catch(() => {})
    return
  }

  const token = ENV.testUser.staffToken
  if (!token) {
    throw new Error("[ensureLoggedIn] STAFF_TOKEN is empty — set it in .env before running authenticated specs")
  }

  logger.info("[ensureLoggedIn] not authenticated — performing one-time staff-token login")
  await browser.url(ROUTES.LOGIN_STAFF_TOKEN)
  await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).waitForDisplayed({ timeout: TIMEOUTS.EXTRA_LONG })
  await staffTokenLoginPage.signIn(token)

  // A successful auth routes the SPA away from any `/login*` screen. Wait for
  // that navigation rather than a fixed pause — startup + first data sync is
  // slow on the ARM-translated emulator.
  await browser.waitUntil(async () => !(await browser.getUrl()).includes("login"), {
    timeout: TIMEOUTS.EXTRA_LONG,
    timeoutMsg: "[ensureLoggedIn] expected to leave the /login flow after a valid staff token"
  })
  // Fresh login lands on the app but the first data sync can still race the
  // backend bridge — recover the offline screen before handing back to the spec.
  await recoverAppConnection().catch(() => {})
  logger.info("[ensureLoggedIn] login complete — session now persists via noReset:true")
}
