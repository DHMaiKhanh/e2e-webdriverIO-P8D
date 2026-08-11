/**
 * docs/payment-test-cases.md §8.3 (GC-*) — the Gift card tender, run BY CODE via
 * deep-link (Đường A2). No wizard, no [Redeem] (never finalizes, never touches a
 * real card balance).
 *
 * Gate: ANDROID_WEBVIEW_READY=1 (npm run test:android:emu).
 */
import { expect } from "@wdio/globals"
import { giftCardPaymentPage } from "@pages"
import { expectMoneyEqual } from "../../../utils/currency.js"
import { ensureLoggedIn } from "../../../utils/ensure-logged-in.js"
import { openTender } from "../../../utils/payment-fixture.js"
import { hasSummaryRows, readSummaryCents } from "../../../utils/tender-webview.js"

const suite = process.env.ANDROID_WEBVIEW_READY === "1" ? describe : describe.skip

suite("Gift card · by code (deep-link, no finalize)", () => {
  before(async () => {
    await ensureLoggedIn()
  })

  beforeEach(async () => {
    await openTender("gift_card")
    await giftCardPaymentPage.waitForLoaded()
  })

  it("GC-01 @smoke · dual pricing: Amount due = base (fee cancelled like cash)", async () => {
    // Gift card cancels the 10% service fee with a 10% discount, so the AMOUNT
    // DUE figure equals the Subtotal breakdown row (the base price).
    const due = await giftCardPaymentPage.getAmountDueCents()
    const subtotal = await readSummaryCents(/^Subtotal/i)
    expect(expectMoneyEqual(due, subtotal)).toBe(true)
  })

  it("GC-02 @regression · breakdown rows present (Subtotal / Service fee / Cash discount)", async () => {
    expect(await hasSummaryRows([/^Subtotal/i, /service fee/i, /cash discount/i])).toBe(true)
  })

  it("GC-03 @regression · Redeem is disabled until a card code is entered", async () => {
    expect(await giftCardPaymentPage.isRedeemEnabled()).toBe(false)
  })

  it("GC-06 @regression · an invalid card code never resolves or enables Redeem", async () => {
    // A code that matches no card must not resolve a balance nor enable the
    // finalize button — no shared-card data is touched (see doc §GC-12/§10).
    await giftCardPaymentPage.enterCode("0000000000000000")
    expect(await giftCardPaymentPage.isCardResolved()).toBe(false)
    expect(await giftCardPaymentPage.isRedeemEnabled()).toBe(false)
  })
})
