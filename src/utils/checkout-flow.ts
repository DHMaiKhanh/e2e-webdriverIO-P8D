/**
 * checkoutFlow — the shared on-ramp the payment specs use to reach the screens
 * under test (Review order, Payment method). Encapsulates the create-order
 * wizard so no spec inlines it (see the volt-e2e-spec skill + template).
 *
 * ⚠️ DRAFT ORDER LEAK: reaching Review order persists an Open/"In Use" draft
 * order BEFORE Charge (docs/payment-test-cases.md §10). Specs that call these
 * helpers create real draft orders on the dev shop — run only against the
 * isolated `Volt POS 14 Dev` shop and clean up leftover drafts.
 *
 * ⚠️ WebView not debuggable + §9 testids not shipped yet → these helpers only
 * run when the payment suite is un-gated (ANDROID_WEBVIEW_READY=1 +
 * VOLT_PAYMENT_TESTIDS=1). Until then every payment `describe` is `.skip`, so
 * these never execute; they are written testid-first for the day the hooks land.
 */
import { androidAppShellPage, reviewOrderPage, saleFlowPage } from "@pages"
import { ROUTES } from "../constants/routes.js"
import { ensureLoggedIn } from "./ensure-logged-in.js"
import { logger } from "./logger.js"

export const checkoutFlow = {
  /**
   * Authenticated session → New Sale → pick first staff → pick first service →
   * Review order. Leaves the app on the Review order screen.
   */
  async reachReviewOrder(): Promise<void> {
    await ensureLoggedIn()
    await androidAppShellPage.switchToWebview()

    await browser.url(ROUTES.APP.NEW_SALE)
    await saleFlowPage.waitForLoaded()
    await saleFlowPage.selectStaff(0)

    if (!(await saleFlowPage.isOnAddService())) {
      throw new Error("[checkoutFlow] did not advance to Step 2 (Add service) after selecting a staff")
    }
    await saleFlowPage.selectService(0)
    await saleFlowPage.reviewOrder()

    await reviewOrderPage.waitForLoaded()
    logger.info("[checkoutFlow] reached Review order")
  },

  /**
   * As reachReviewOrder(), then [Charge $X] → Payment method. Leaves the app on
   * the Payment method screen (no tender selected, nothing finalized).
   */
  async reachPaymentMethod(): Promise<void> {
    await this.reachReviewOrder()
    await reviewOrderPage.charge()
    logger.info("[checkoutFlow] charged → Payment method")
  }
}
