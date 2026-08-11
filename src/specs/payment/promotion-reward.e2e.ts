/**
 * docs/payment-test-cases.md §8.8 (PROMO-01…03, RWD-01…05) — the "Promo &
 * Rewards" bottom sheet opened from Review order via [Apply Promotion/Reward].
 *
 * ⚠️ KNOWN GAP (VP-2096): applying a reward currently does NOT reduce Total.
 * RWD-04 asserts it SHOULD (the correct behaviour) and is `it.skip` with a
 * KNOWN GAP note — it must NOT be written to pass on the buggy behaviour.
 *
 * GATING: skipped until ANDROID_WEBVIEW_READY=1 && VOLT_PAYMENT_TESTIDS=1.
 */
import { expect } from "@wdio/globals"
import { promoRewardPage, reviewOrderPage } from "@pages"
import { checkoutFlow } from "../../utils/checkout-flow.js"
import { expectMoneyEqual } from "../../utils/currency.js"

const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
const TESTIDS_LANDED = process.env.VOLT_PAYMENT_TESTIDS === "1"
const suite = WEBVIEW_READY && TESTIDS_LANDED ? describe : describe.skip

// A reward known to exist on the dev shop (doc observed "aahaha"). Reward ids
// are shop data — overridable so none is hard-wired.
const REWARD_ID = process.env.VOLT_TEST_REWARD ?? "aahaha"

suite("Promotion & Reward", () => {
  beforeEach(async () => {
    // ⚠️ Reaching Review order leaves a draft order behind (doc §10) — dev shop only.
    await checkoutFlow.reachReviewOrder()
  })

  it("PROMO-01 @smoke · Apply Promotion/Reward opens the Promo & Rewards sheet", async () => {
    await reviewOrderPage.openPromoReward()
    expect(await promoRewardPage.isSheetOpen()).toBe(true)
  })

  it("PROMO-02 @regression · dev shop shows 'No promotions available'", async () => {
    await reviewOrderPage.openPromoReward()
    expect(await promoRewardPage.hasNoPromotions()).toBe(true)
  })

  it("RWD-02 @smoke · selecting a reward enables Apply to order", async () => {
    await reviewOrderPage.openPromoReward()
    await promoRewardPage.selectReward(REWARD_ID)
    expect(await promoRewardPage.isApplyEnabled()).toBe(true)
  })

  it("RWD-03 @regression · deselecting a reward disables Apply to order", async () => {
    await reviewOrderPage.openPromoReward()
    await promoRewardPage.selectReward(REWARD_ID)
    await promoRewardPage.selectReward(REWARD_ID) // tap again to deselect
    expect(await promoRewardPage.isApplyEnabled()).toBe(false)
  })

  it("RWD-05 @regression · closing the sheet leaves the order unchanged", async () => {
    const before = await reviewOrderPage.getTotalCents()
    await reviewOrderPage.openPromoReward()
    await promoRewardPage.close()
    expect(expectMoneyEqual(await reviewOrderPage.getTotalCents(), before)).toBe(true)
  })

  // PROMO-03: needs a promotion configured on the shop (dev has none) to observe
  // Total dropping — enable once the Portal has a test promotion.
  it.skip("PROMO-03 @regression · applying a promotion reduces Total (needs promo data)", async () => {
    await reviewOrderPage.openPromoReward()
  })

  // RWD-01: rewards are shop data; asserting a specific reward needs a stable
  // fixture id. Enable once a known reward id is provisioned.
  it.skip("RWD-01 @regression · Rewards section lists available rewards (needs fixture)", async () => {
    await reviewOrderPage.openPromoReward()
    await promoRewardPage.selectReward(REWARD_ID)
  })

  // RWD-04 — KNOWN GAP VP-2096: applying a reward should reduce Total, but the
  // app currently leaves Total unchanged and shows no discount line. This asserts
  // the CORRECT behaviour and stays skipped (known-fail) until the app fixes it.
  it.skip("RWD-04 @regression · applying a reward reduces Total (KNOWN GAP VP-2096)", async () => {
    const before = await reviewOrderPage.getTotalCents()
    await reviewOrderPage.openPromoReward()
    await promoRewardPage.selectReward(REWARD_ID)
    await promoRewardPage.applyToOrder()
    expect(await reviewOrderPage.getTotalCents()).toBeLessThan(before)
  })
})
