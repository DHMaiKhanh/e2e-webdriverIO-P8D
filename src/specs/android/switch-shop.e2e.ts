/**
 * ⛔ DISABLED — this token/login-based ops spec is EXCLUDED from every run in
 *    config/wdio.shared.conf.ts (`exclude`). Anything driving the login/token flow
 *    is no longer used. Kept for reference. To re-enable, remove this file's entry
 *    from the `exclude` array in the shared config.
 *
 * P8D Android — switch shop by re-authenticating with a different Staff Token.
 *
 * One-off OPERATIONAL spec (not part of the normal suite) to move the emulator
 * session from whatever merchant it's on onto the shop identified by
 * `STAFF_TOKEN` in .env. Because the previous session stays authenticated
 * (`appium:noReset = true`), `ensureLoggedIn()` would no-op here — so this
 * navigates straight to the token form and re-exchanges the impersonation token,
 * which switches the active merchant.
 *
 * Gated behind ANDROID_SWITCH_SHOP=1 so a normal `test:android` run skips it.
 *
 * Run:
 *   TEST_ENV=android ANDROID_WEBVIEW_READY=1 ANDROID_SWITCH_SHOP=1 \
 *     npx wdio run ./config/wdio.android.conf.ts \
 *     --spec ./src/specs/android/switch-shop.e2e.ts
 */
import { expect } from "@wdio/globals"
import { androidAppShellPage, staffTokenLoginPage } from "@pages"
import { ROUTES } from "../../constants/routes.js"
import { SELECTORS } from "../../constants/selectors.js"
import { TIMEOUTS } from "../../constants/timeouts.js"
import { recoverAppConnection } from "../../utils/ensure-network.js"
import { ENV } from "../../utils/env.js"
import { logger } from "../../utils/logger.js"

const APP_ID = "com.fastboy.volt_pos"
const TOKEN = ENV.testUser.staffToken

const suite = process.env.ANDROID_SWITCH_SHOP === "1" ? describe : describe.skip

/** First ~200 chars of the current screen, whitespace-collapsed — enough to see
 * the shop name (merchant.businessName, or the "Your store" fallback). */
const snapshotBody = async (): Promise<string> =>
  (await androidAppShellPage.getBodyText()).replace(/\s+/g, " ").trim().slice(0, 200)

suite("P8D Android — switch shop via staff token @ops", () => {
  before(async () => {
    await browser.execute("mobile: activateApp", { appId: APP_ID })
    await androidAppShellPage.switchToWebview()
  })

  it("re-authenticates with STAFF_TOKEN and lands on that shop's home", async () => {
    if (!TOKEN) throw new Error("[switch-shop] STAFF_TOKEN is empty — set it in .env first")

    // BEFORE: record which shop we're currently on for a clear before/after.
    await browser.url(ROUTES.ROOT)
    await browser.pause(TIMEOUTS.ANIMATION)
    logger.info(`[switch-shop] BEFORE  url=${await browser.getUrl()}  body="${await snapshotBody()}"`)
    await androidAppShellPage.screenshot("switch-shop-before")

    // Force the token form even on an authenticated session, then re-exchange.
    await browser.url(ROUTES.LOGIN_STAFF_TOKEN)
    await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).waitForDisplayed({ timeout: TIMEOUTS.EXTRA_LONG })
    logger.info(`[switch-shop] token form up — signing in with STAFF_TOKEN (…${TOKEN.slice(-4)})`)
    await staffTokenLoginPage.signIn(TOKEN)

    // A successful exchange routes the SPA away from any /login* screen.
    await browser.waitUntil(async () => !(await browser.getUrl()).includes("login"), {
      timeout: TIMEOUTS.EXTRA_LONG,
      timeoutMsg: "[switch-shop] still on /login after submitting the token — token rejected or form errored"
    })

    // Heal a transient offline screen, then settle on home and capture proof.
    await recoverAppConnection().catch(() => {})
    await browser.url(ROUTES.ROOT)
    await browser.pause(TIMEOUTS.SHORT)

    logger.info(`[switch-shop] AFTER   url=${await browser.getUrl()}  body="${await snapshotBody()}"`)
    await androidAppShellPage.screenshot("switch-shop-after")

    expect(await browser.getUrl()).not.toContain("login")
  })
})
