/**
 * OrderFilterPage — the "Filter" bottom sheet opened from the Orders list
 * (docs/order-history-test-cases.md §2.2, §4.4): SORT BY (radio) / STAFF
 * (multi-checkbox + search) / PAYMENT METHOD (multi-checkbox), plus Apply and
 * Clear all. Applying a filter is read-only + safe.
 *
 * Real hooks (harvested — no data-testid ships): the sort options are
 * `button[role="radio"]` keyed by their form value (updatedAt / completedAt); the
 * staff + payment rows are `button[data-slot="checkbox"]` whose aria-label is the
 * option name; selection state is on `data-state` ("checked"/"unchecked"). Staff
 * checkboxes carry the staff name in their aria-label (their text node is empty).
 */
import { SELECTORS } from "../../constants/selectors.js"
import { TIMEOUTS } from "../../constants/timeouts.js"
import { BasePage } from "../base.page.js"

/** Sort options (doc §2.2 SORT BY). */
export type SortOption = "date-completed" | "last-updated"
/** Payment-method filter keys (doc §2.2 PAYMENT METHOD). */
export type PaymentFilter = "card" | "cash" | "gift-card" | "other"

export class OrderFilterPage extends BasePage {
  protected readonly pageName = "OrderFilterPage"
  protected readonly rootSelector = SELECTORS.ORDER_FILTER.SHEET

  async isOpen(): Promise<boolean> {
    return this.isLoaded()
  }

  /** True when the sheet shows SORT / STAFF / PAYMENT plus Apply + Clear all (§4.4.1). */
  async hasAllSections(): Promise<boolean> {
    const S = SELECTORS.ORDER_FILTER
    for (const sel of [S.SORT("date-completed"), S.STAFF_SEARCH, S.PAYMENT("card"), S.APPLY, S.CLEAR_ALL]) {
      if (!(await this.$(sel).isExisting())) return false
    }
    return true
  }

  // --------------------------------------------------------------- sort by

  async selectSort(option: SortOption): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_FILTER.SORT(option), `sort ${option}`)
  }

  async isSortSelected(option: SortOption): Promise<boolean> {
    const el = this.$(SELECTORS.ORDER_FILTER.SORT(option))
    const state = await el.getAttribute("data-state")
    if (state) return state === "checked"
    return (await el.getAttribute("aria-checked")) === "true"
  }

  // ----------------------------------------------------------------- staff

  async searchStaff(name: string): Promise<void> {
    await this.safeFill(SELECTORS.ORDER_FILTER.STAFF_SEARCH, name, "staff search")
  }

  async hasStaffOption(name: string): Promise<boolean> {
    return this.$(SELECTORS.ORDER_FILTER.STAFF_OPTION(name)).isExisting()
  }

  async toggleStaff(name: string): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_FILTER.STAFF_OPTION(name), `staff ${name}`)
  }

  async staffOptionCount(): Promise<number> {
    return (await this.$$(SELECTORS.ORDER_FILTER.STAFF_OPTION_ANY).getElements()).length
  }

  /** Tick the first staff option and return its name (its aria-label) — avoids
   * hard-coding an ephemeral dev-shop name. */
  async toggleFirstStaff(): Promise<string> {
    const options = await this.$$(SELECTORS.ORDER_FILTER.STAFF_OPTION_ANY).getElements()
    if (options.length === 0) throw new Error("[OrderFilterPage] no staff options to tick")
    const label = (await options[0].getAttribute("aria-label")) ?? ""
    await options[0].click()
    return label
  }

  /** Tick the first N distinct staff options; returns how many were ticked. */
  async toggleFirstStaffCount(n: number): Promise<number> {
    const options = await this.$$(SELECTORS.ORDER_FILTER.STAFF_OPTION_ANY).getElements()
    const count = Math.min(n, options.length)
    for (let i = 0; i < count; i++) await options[i].click()
    return count
  }

  async isStaffChecked(name: string): Promise<boolean> {
    return (await this.$(SELECTORS.ORDER_FILTER.STAFF_OPTION(name)).getAttribute("data-state")) === "checked"
  }

  // --------------------------------------------------------- payment method

  async togglePayment(method: PaymentFilter): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_FILTER.PAYMENT(method), `payment ${method}`)
  }

  async isPaymentChecked(method: PaymentFilter): Promise<boolean> {
    return (await this.$(SELECTORS.ORDER_FILTER.PAYMENT(method)).getAttribute("data-state")) === "checked"
  }

  // ------------------------------------------------------------- apply/clear

  /** Apply the filter → closes the sheet (§4.4.8). */
  async apply(): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_FILTER.APPLY, "apply filter")
    // Apply dismisses the sheet — wait for it to actually go before returning, so
    // callers that assert "sheet closed" (OHF-08) or read the refreshed list don't
    // race the close animation. Mirrors OrderHistoryPage.viewOrders for the date
    // sheet. Best-effort: a stuck sheet still fails the caller's own assertion.
    await this.$(SELECTORS.ORDER_FILTER.SHEET)
      .waitForDisplayed({ reverse: true, timeout: TIMEOUTS.SHORT })
      .catch(() => {})
  }

  /** Clear all selections back to default (§4.4.9). */
  async clearAll(): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_FILTER.CLEAR_ALL, "clear all")
  }
}

export const orderFilterPage = new OrderFilterPage()
