/**
 * OrdersListPage — the Orders screen with status-filter tabs (All / Pending /
 * Re-open / Successful / Canceled), docs/payment-test-cases.md §8.11 &
 * docs/order-test-cases.md §2.1. Used to reach the Re-open tab (currently empty
 * on P8) and to locate order cards.
 *
 * ⚠️ Selectors are the §9 PROPOSAL (gate behind VOLT_PAYMENT_TESTIDS).
 */
import { SELECTORS } from "../../constants/selectors.js"
import { BasePage } from "../base.page.js"

/** Status-tab keys as they appear in the testid suffix. */
export type OrderStatusTab = "all" | "pending" | "re-open" | "successful" | "canceled"

export class OrdersListPage extends BasePage {
  protected readonly pageName = "OrdersListPage"
  protected readonly rootSelector = SELECTORS.ORDERS_LIST.STATUS_TAB("all")

  async isOnScreen(): Promise<boolean> {
    return this.isLoaded()
  }

  /** Switch the status filter. */
  async openStatusTab(key: OrderStatusTab): Promise<void> {
    await this.safeClick(SELECTORS.ORDERS_LIST.STATUS_TAB(key), `orders tab ${key}`)
  }

  /** True when the "No orders match these filters" empty state is showing. */
  async isEmpty(): Promise<boolean> {
    return this.$(SELECTORS.ORDERS_LIST.EMPTY).isExisting()
  }

  async hasOrderCard(id: string): Promise<boolean> {
    return this.$(SELECTORS.ORDERS_LIST.ORDER_CARD(id)).isExisting()
  }
}

export const ordersListPage = new OrdersListPage()
