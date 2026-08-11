/**
 * docs/payment-test-cases.md §8.9 (IDISC-01 … IDISC-11) — per-line-item discount
 * from Review order: tap a service → item sheet → Apply discount → keypad
 * (% or $, mode "$" entered in cents: "1" → $0.01) → OK → Save.
 *
 * ✅ Unlike reward, item discount really reduces Total and is reversible — safe
 * to assert both. Amounts computed from the order (never hard-coded).
 * GATING: skipped until ANDROID_WEBVIEW_READY=1 && VOLT_PAYMENT_TESTIDS=1.
 */
import { expect } from "@wdio/globals"
import { itemDiscountPage, reviewOrderPage } from "@pages"
import { checkoutFlow } from "../../utils/checkout-flow.js"
import { expectMoneyEqual, subtractCents } from "../../utils/currency.js"

const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
const TESTIDS_LANDED = process.env.VOLT_PAYMENT_TESTIDS === "1"
const suite = WEBVIEW_READY && TESTIDS_LANDED ? describe : describe.skip

/** Apply a $0.01 (1-cent) discount to the first line item, then Save. */
async function applyOneCentDiscount(): Promise<void> {
  await reviewOrderPage.tapItem(0)
  await itemDiscountPage.waitForLoaded()
  await itemDiscountPage.toggleApplyDiscount()
  await itemDiscountPage.selectMode("amount")
  await itemDiscountPage.typeDiscount("1") // $0.01
  await itemDiscountPage.confirmDiscount()
  await itemDiscountPage.save()
  await reviewOrderPage.waitForLoaded()
}

suite("Item discount", () => {
  beforeEach(async () => {
    // ⚠️ Reaching Review order leaves a draft order behind (doc §10) — dev shop only.
    await checkoutFlow.reachReviewOrder()
  })

  it("IDISC-01 @smoke · tapping a service opens the item sheet", async () => {
    await reviewOrderPage.tapItem(0)
    expect(await itemDiscountPage.isItemSheetOpen()).toBe(true)
  })

  it("IDISC-02 @smoke · Apply discount toggle opens the Discount keypad", async () => {
    await reviewOrderPage.tapItem(0)
    await itemDiscountPage.waitForLoaded()
    await itemDiscountPage.toggleApplyDiscount()
    expect(await itemDiscountPage.isDiscountSheetOpen()).toBe(true)
  })

  it("IDISC-03 @regression · percent mode shows an 'N%' value", async () => {
    await reviewOrderPage.tapItem(0)
    await itemDiscountPage.waitForLoaded()
    await itemDiscountPage.toggleApplyDiscount()
    await itemDiscountPage.selectMode("percent")
    await itemDiscountPage.typeDiscount("5")
    expect(await itemDiscountPage.getDiscountDisplayText()).toContain("%")
  })

  it("IDISC-04 @regression · amount mode enters cents ('1' → $0.01)", async () => {
    await reviewOrderPage.tapItem(0)
    await itemDiscountPage.waitForLoaded()
    await itemDiscountPage.toggleApplyDiscount()
    await itemDiscountPage.selectMode("amount")
    await itemDiscountPage.typeDiscount("1")
    expect(await itemDiscountPage.getDiscountDisplayText()).toContain("0.01")
  })

  it("IDISC-05 @smoke · applying a discount reduces Total by that amount", async () => {
    const before = await reviewOrderPage.getTotalCents()
    await applyOneCentDiscount()
    expect(await reviewOrderPage.hasItemDiscountLine()).toBe(true)
    expect(expectMoneyEqual(await reviewOrderPage.getTotalCents(), subtractCents(before, 1))).toBe(true)
  })

  it("IDISC-06 @regression · Charge button matches the new Total", async () => {
    await applyOneCentDiscount()
    expect(
      expectMoneyEqual(await reviewOrderPage.getChargeAmountCents(), await reviewOrderPage.getTotalCents())
    ).toBe(true)
  })

  it("IDISC-07 @regression · removing the discount restores Total (reversible)", async () => {
    const before = await reviewOrderPage.getTotalCents()
    await applyOneCentDiscount()
    // Re-open the item and toggle the discount back off.
    await reviewOrderPage.tapItem(0)
    await itemDiscountPage.waitForLoaded()
    await itemDiscountPage.toggleApplyDiscount()
    await itemDiscountPage.save()
    await reviewOrderPage.waitForLoaded()
    expect(await reviewOrderPage.hasItemDiscountLine()).toBe(false)
    expect(expectMoneyEqual(await reviewOrderPage.getTotalCents(), before)).toBe(true)
  })

  it("IDISC-11 @regression · a discount larger than the price never makes Total negative", async () => {
    await reviewOrderPage.tapItem(0)
    await itemDiscountPage.waitForLoaded()
    await itemDiscountPage.toggleApplyDiscount()
    await itemDiscountPage.selectMode("amount")
    await itemDiscountPage.typeDiscount("99999") // $999.99 — far above any line price
    await itemDiscountPage.confirmDiscount()
    await itemDiscountPage.save()
    await reviewOrderPage.waitForLoaded()
    expect(await reviewOrderPage.getTotalCents()).toBeGreaterThanOrEqual(0)
  })

  // IDISC-08: needs a multi-service order to prove the discount hits only the
  // edited line; the shared checkout creates a single-service draft.
  it.skip("IDISC-08 @regression · discount applies only to the edited line (needs multi-item order)", async () => {
    await applyOneCentDiscount()
  })

  // IDISC-09: editing PRICE needs the price-edit sub-flow (chevron → keypad),
  // not yet modelled on the item sheet.
  it.skip("IDISC-09 @regression · editing Price recomputes the line + Total (needs price-edit flow)", async () => {
    await reviewOrderPage.tapItem(0)
  })

  // IDISC-10: note persistence needs a note field + re-open verification.
  it.skip("IDISC-10 @regression · a saved Note persists on the item (needs note verify)", async () => {
    await reviewOrderPage.tapItem(0)
  })
})
