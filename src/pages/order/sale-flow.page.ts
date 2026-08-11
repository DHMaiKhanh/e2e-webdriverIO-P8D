/**
 * SaleFlowPage — the create-order wizard (New Sale › Select Staff (Step 1/2) ›
 * Add service (Step 2/2) › Review order). Documented in
 * docs/order-test-cases.md §2.3; used here only as the on-ramp the payment
 * specs need to reach Review order → Charge → Payment method.
 *
 * ⚠️ Reaching Review order persists an Open/"In Use" DRAFT order before Charge
 * (docs/payment-test-cases.md §10) — specs that drive this must clean up.
 *
 * ⚠️ The data-testid selectors (SELECTORS.SALE_FLOW.*) are a §9 PROPOSAL — they
 * don't exist in the WebView yet. Rows are index-addressable so we can pick "the
 * first staff / first service" without hard-coding ephemeral dev-shop names.
 */
import { SELECTORS } from "../../constants/selectors.js"
import { BasePage } from "../base.page.js"

export class SaleFlowPage extends BasePage {
  protected readonly pageName = "SaleFlowPage"
  protected readonly rootSelector = SELECTORS.SALE_FLOW.STEP1_HEADER

  /** True on Step 1 · Select Staff. */
  async isOnSelectStaff(): Promise<boolean> {
    return this.isLoaded()
  }

  /** Pick a technician by 0-based row index (defaults to the first). */
  async selectStaff(index = 0): Promise<void> {
    await this.safeClick(SELECTORS.SALE_FLOW.STAFF_ROW(index), `staff row ${index}`)
  }

  /** True on Step 2 · Add service. */
  async isOnAddService(): Promise<boolean> {
    return this.$(SELECTORS.SALE_FLOW.STEP2_HEADER).isDisplayed()
  }

  /** Pick a service card by 0-based index (defaults to the first). */
  async selectService(index = 0): Promise<void> {
    await this.safeClick(SELECTORS.SALE_FLOW.SERVICE_CARD(index), `service card ${index}`)
  }

  /** Tap "Review order · $X" → Review order screen. */
  async reviewOrder(): Promise<void> {
    await this.safeClick(SELECTORS.SALE_FLOW.REVIEW_ORDER_BTN, "review order")
  }
}

export const saleFlowPage = new SaleFlowPage()
