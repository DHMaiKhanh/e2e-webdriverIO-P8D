/**
 * PromoRewardPage — the "Promo & Rewards" bottom sheet opened from Review order
 * via [Apply Promotion/Reward] (docs/payment-test-cases.md §8.8). Lists
 * Promotions (dev shop: "No promotions available") and Rewards; selecting a
 * reward enables [Apply to order].
 *
 * ⚠️ KNOWN GAP (VP-2096): applying a reward currently does NOT reduce Total — the
 * RWD-04 spec asserts it SHOULD and is marked known-fail. Selectors are the §9
 * PROPOSAL (gate behind VOLT_PAYMENT_TESTIDS).
 */
import { SELECTORS } from "../../constants/selectors.js"
import { BasePage } from "../base.page.js"

export class PromoRewardPage extends BasePage {
  protected readonly pageName = "PromoRewardPage"
  protected readonly rootSelector = SELECTORS.PROMO_REWARD.SHEET_HEADER

  async isSheetOpen(): Promise<boolean> {
    return this.isLoaded()
  }

  /** Dev shop shows "No promotions available" (PROMO-02). */
  async hasNoPromotions(): Promise<boolean> {
    return this.$(SELECTORS.PROMO_REWARD.NO_PROMOTIONS).isExisting()
  }

  /** Tap a reward tile by id → selects it (✓ + border). */
  async selectReward(id: string): Promise<void> {
    await this.safeClick(SELECTORS.PROMO_REWARD.REWARD_ITEM(id), `reward ${id}`)
  }

  /** [Apply to order] is enabled once a reward is selected (RWD-02/03 proxy). */
  async isApplyEnabled(): Promise<boolean> {
    return this.$(SELECTORS.PROMO_REWARD.APPLY_TO_ORDER).isEnabled()
  }

  async applyToOrder(): Promise<void> {
    await this.safeClick(SELECTORS.PROMO_REWARD.APPLY_TO_ORDER, "apply to order")
  }

  /** Close the sheet (✕) → back to Review order unchanged (RWD-05). */
  async close(): Promise<void> {
    await this.safeClick(SELECTORS.PROMO_REWARD.CLOSE, "close promo/reward sheet")
  }
}

export const promoRewardPage = new PromoRewardPage()
