/**
 * docs/payment-test-cases.md §8.1 (PM-01 … PM-08) — the "Payment method" screen
 * after [Charge $X]: four tenders (Card / Cash / Gift card / Other), dual-pricing
 * amounts, and routing. This screen finalizes nothing, so every case is safe.
 *
 * GATING — the §9 data-testid selectors these rely on don't exist in the WebView
 * yet, so the suite is skipped until BOTH:
 *   • ANDROID_WEBVIEW_READY=1   (webview-capable target, i.e. the emulator), and
 *   • VOLT_PAYMENT_TESTIDS=1     (set once the app ships the §9 testids).
 * A skipped-until-ready suite is honest; a red one blamed on the product is not.
 *
 * Tags live on each `it` (mocha greps the full title) so `test:smoke` /
 * `test:regression` filter per case, matching the doc's P/Loại columns.
 */
import { expect } from "@wdio/globals"
import { cashPaymentPage, paymentMethodPage } from "@pages"
import { checkoutFlow } from "../../utils/checkout-flow.js"
import { expectMoneyEqual } from "../../utils/currency.js"

const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
const TESTIDS_LANDED = process.env.VOLT_PAYMENT_TESTIDS === "1"
const suite = WEBVIEW_READY && TESTIDS_LANDED ? describe : describe.skip

suite("Payment method", () => {
  beforeEach(async () => {
    // Authenticated session → New Sale → Review order → [Charge $X].
    // ⚠️ Leaves a draft order behind (doc §10) — dev shop only.
    await checkoutFlow.reachPaymentMethod()
  })

  it("PM-01 @smoke · Charge opens the Payment method screen", async () => {
    expect(await paymentMethodPage.isOnScreen()).toBe(true)
  })

  it("PM-02 @smoke · shows all four tenders", async () => {
    expect(await paymentMethodPage.hasAllMethods()).toBe(true)
  })

  it("PM-03/PM-04 @smoke · Card carries the fee, Cash is base (Card > Cash)", async () => {
    const card = await paymentMethodPage.getMethodAmountCents("card")
    const cash = await paymentMethodPage.getMethodAmountCents("cash")
    // Relationship computed from the order — never hard-code the fee % or $.
    expect(card).toBeGreaterThan(cash)
  })

  it("PM-05 @regression · Gift card equals Cash (both base price)", async () => {
    const gift = await paymentMethodPage.getMethodAmountCents("gift-card")
    const cash = await paymentMethodPage.getMethodAmountCents("cash")
    expect(expectMoneyEqual(gift, cash)).toBe(true)
  })

  it("PM-06 @regression · Other equals Card (both base + fee)", async () => {
    const other = await paymentMethodPage.getMethodAmountCents("other")
    const card = await paymentMethodPage.getMethodAmountCents("card")
    expect(expectMoneyEqual(other, card)).toBe(true)
  })

  it("PM-07 @smoke · selecting Cash opens the Cash payment screen", async () => {
    await paymentMethodPage.selectMethod("cash")
    expect(await cashPaymentPage.isOnScreen()).toBe(true)
    expect(await paymentMethodPage.isOnScreen()).toBe(false)
  })

  it("PM-08 @regression · Back from a tender returns to Payment method, order unchanged", async () => {
    const before = await paymentMethodPage.getMethodAmountCents("cash")
    await paymentMethodPage.selectMethod("cash")
    await browser.back()
    expect(await paymentMethodPage.isOnScreen()).toBe(true)
    const after = await paymentMethodPage.getMethodAmountCents("cash")
    expect(expectMoneyEqual(before, after)).toBe(true)
  })
})
