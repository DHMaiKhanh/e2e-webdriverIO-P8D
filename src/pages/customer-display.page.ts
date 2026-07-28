import { SELECTORS } from "../constants/selectors.js"
import { WINDOW_LABELS, withWindow } from "../utils/tauri-helper.js"
import { BasePage } from "./base.page.js"

/**
 * CustomerDisplayPage — the customer-facing screen shown on the second
 * Tauri window (label "customer", src/routes/customer/).
 *
 * Every method here switches to the "customer" window, runs the action,
 * then restores whatever window was active — so a spec driving the staff
 * checkout flow can dip in to assert on the customer screen without manual
 * window bookkeeping.
 */
export class CustomerDisplayPage extends BasePage {
  protected readonly pageName = "CustomerDisplayPage"
  protected readonly rootSelector = "body"

  async isPaymentMethodVisible(methodId: string): Promise<boolean> {
    return withWindow(WINDOW_LABELS.CUSTOMER, async () => {
      return $(SELECTORS.CUSTOMER_DISPLAY.PAY_BY_METHOD(methodId)).isExisting()
    })
  }

  async selectPaymentMethod(methodId: string): Promise<void> {
    return withWindow(WINDOW_LABELS.CUSTOMER, async () => {
      await this.safeClick(SELECTORS.CUSTOMER_DISPLAY.PAY_BY_METHOD(methodId), `customer pay-by-${methodId}`)
    })
  }
}

export const customerDisplayPage = new CustomerDisplayPage()
