/**
 * ItemDiscountPage — the per-line-item sheet + Discount keypad opened by tapping
 * a service row in Review order (docs/payment-test-cases.md §8.9). The item sheet
 * has Price / Note / Apply-discount toggle / Save; toggling the discount on opens
 * a keypad that switches between % and $ (mode "$" is entered in cents:
 * typing "1" → $0.01).
 *
 * ✅ Unlike reward, item discount really reduces Total and is reversible (toggle
 * off → Save). Prices returned in **integer cents**. Selectors are the §9 PROPOSAL.
 */
import { SELECTORS } from "../../constants/selectors.js"
import { toCents } from "../../utils/currency.js"
import { BasePage } from "../base.page.js"

/** Discount entry mode. */
export type DiscountMode = "percent" | "amount"

export class ItemDiscountPage extends BasePage {
  protected readonly pageName = "ItemDiscountPage"
  protected readonly rootSelector = SELECTORS.ITEM_DISCOUNT.SAVE

  /** True when the item sheet (Price / Note / Apply discount / Save) is open. */
  async isItemSheetOpen(): Promise<boolean> {
    return this.isLoaded()
  }

  async getPriceCents(): Promise<number> {
    return toCents(await this.$(SELECTORS.ITEM_DISCOUNT.PRICE).getText())
  }

  /** Toggle "Apply discount" on/off. On → opens the Discount keypad. */
  async toggleApplyDiscount(): Promise<void> {
    await this.safeClick(SELECTORS.ITEM_DISCOUNT.DISCOUNT_TOGGLE, "apply discount toggle")
  }

  /** True when the Discount keypad sheet (with OK) is showing. */
  async isDiscountSheetOpen(): Promise<boolean> {
    return this.$(SELECTORS.ITEM_DISCOUNT.OK).isExisting()
  }

  /** Switch the Discount keypad between "%" and "$" modes. */
  async selectMode(mode: DiscountMode): Promise<void> {
    await this.safeClick(SELECTORS.ITEM_DISCOUNT.MODE(mode), `discount mode ${mode}`)
  }

  /** The live keypad readout — "N%" in percent mode, "$X.XX" in amount mode. */
  async getDiscountDisplayText(): Promise<string> {
    return this.$(SELECTORS.ITEM_DISCOUNT.DISPLAY).getText()
  }

  /** Type a discount value digit-by-digit (mode "$" is cents: "1" → $0.01). */
  async typeDiscount(digits: string): Promise<void> {
    for (const digit of digits) {
      await this.safeClick(SELECTORS.ITEM_DISCOUNT.KEY(digit), `discount key ${digit}`)
    }
  }

  /** Confirm the keypad (OK) → back to the item sheet with the discount row. */
  async confirmDiscount(): Promise<void> {
    await this.safeClick(SELECTORS.ITEM_DISCOUNT.OK, "discount ok")
  }

  /** Save the item sheet → back to Review order with totals recalculated. */
  async save(): Promise<void> {
    await this.safeClick(SELECTORS.ITEM_DISCOUNT.SAVE, "item save")
  }
}

export const itemDiscountPage = new ItemDiscountPage()
