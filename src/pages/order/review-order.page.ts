/**
 * ReviewOrderPage — the order-detail/Review screen shown before [Charge $X]
 * (docs/payment-test-cases.md §1, §8.8, §8.9). Reads the money totals, opens the
 * item sheet (item discount) and the Promo & Rewards sheet, and charges.
 *
 * Money getters return **integer cents** parsed from the displayed "$X.XX" —
 * compute expectations from these, never hard-code (dual pricing is shop-config
 * dependent). ⚠️ Selectors are the §9 PROPOSAL (gate behind VOLT_PAYMENT_TESTIDS).
 */
import { SELECTORS } from "../../constants/selectors.js"
import { toCents } from "../../utils/currency.js"
import { BasePage } from "../base.page.js"

export class ReviewOrderPage extends BasePage {
  protected readonly pageName = "ReviewOrderPage"
  protected readonly rootSelector = SELECTORS.REVIEW_ORDER.HEADER

  async isOnScreen(): Promise<boolean> {
    return this.isLoaded()
  }

  /** Subtotal (base price, before fee/discount) in cents. */
  async getSubtotalCents(): Promise<number> {
    return toCents(await this.$(SELECTORS.REVIEW_ORDER.SUBTOTAL).getText())
  }

  /** Total in cents (what the Charge button should echo). */
  async getTotalCents(): Promise<number> {
    return toCents(await this.$(SELECTORS.REVIEW_ORDER.TOTAL).getText())
  }

  /** Amount on the "Charge $X" button, in cents. */
  async getChargeAmountCents(): Promise<number> {
    return toCents(await this.$(SELECTORS.REVIEW_ORDER.CHARGE_BTN).getText())
  }

  /** True once the "Item discount −$X" totals row is present. */
  async hasItemDiscountLine(): Promise<boolean> {
    return this.$(SELECTORS.ITEM_DISCOUNT.LINE).isExisting()
  }

  /** Tap a line-item row (0-based) → opens the item sheet (§8.9). */
  async tapItem(index = 0): Promise<void> {
    await this.safeClick(SELECTORS.REVIEW_ORDER.ITEM_ROW(index), `order line ${index}`)
  }

  /** Open the "Promo & Rewards" bottom sheet (§8.8). */
  async openPromoReward(): Promise<void> {
    await this.safeClick(SELECTORS.PROMO_REWARD.APPLY_ENTRY, "apply promotion/reward")
  }

  async isChargeEnabled(): Promise<boolean> {
    return this.$(SELECTORS.REVIEW_ORDER.CHARGE_BTN).isEnabled()
  }

  /** Tap [Charge $X] → routes to the Payment method screen. */
  async charge(): Promise<void> {
    await this.safeClick(SELECTORS.REVIEW_ORDER.CHARGE_BTN, "charge")
  }
}

export const reviewOrderPage = new ReviewOrderPage()
