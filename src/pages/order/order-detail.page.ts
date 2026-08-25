/**
 * OrderDetailPage — the detail/ticket of an already-Paid order reached from
 * Orders → Successful (docs/payment-test-cases.md §8.10). Shows Order
 * information, line items, Subtotal/Tax/Tip/Total paid, Payment details, and the
 * footer actions: Cancel order (reason dialog) · Reprint receipt · Share (Send
 * receipt: Email/Text only — no Print/No-receipt, unlike the post-payment sheet).
 *
 * ⚠️ SAFETY: [Cancel order] VOIDS the order and REVERSES its payment (can't be
 * undone); [Send] emails/texts a real receipt. Safe committed cases stop at the
 * dialog's [Back]; the ⚠️ finalize cases are opt-in, isolated-shop only.
 * Selectors are the §9 PROPOSAL (gate behind VOLT_PAYMENT_TESTIDS).
 */
import { SELECTORS } from "../../constants/selectors.js"
import { toCents } from "../../utils/currency.js"
import { BasePage } from "../base.page.js"

/** The seven cancel reasons (OCAN-02); "customer-request" is the default. */
export const CANCEL_REASONS = [
  "customer-request",
  "service-issue",
  "incorrect-order",
  "duplicate-payment",
  "promotion-discount-error",
  "staff-mistake",
  "other"
] as const

/** Send-receipt channels available in the order-detail Share sheet. */
export type SendReceiptType = "email" | "text"

export class OrderDetailPage extends BasePage {
  protected readonly pageName = "OrderDetailPage"
  // The header #OD nav-bar is present on both the open-order ticket and the paid
  // receipt — a reliable "an order screen is showing" anchor. (Payment details is
  // only on the completed receipt, so it can't gate the generic detail load.)
  protected readonly rootSelector = SELECTORS.ORDER_DETAIL.ORDER_ID

  async isOnScreen(): Promise<boolean> {
    return this.isLoaded()
  }

  /** Parse the "$X.XX" amount out of a row's text ("Subtotal$124.00" → 12400).
   * Rows concatenate their label + value with no separator and labels can carry
   * digits, so read the LAST money token rather than toCents-ing the whole text. */
  private async moneyOf(selector: string): Promise<number> {
    const monies = (await this.$(selector).getText()).replace(/\s+/g, " ").match(/-?\$[\d,]+\.\d{2}/g) ?? []
    return monies.length ? toCents(monies[monies.length - 1]) : 0
  }

  async getTotalPaidCents(): Promise<number> {
    return this.moneyOf(SELECTORS.ORDER_DETAIL.TOTAL_PAID)
  }

  async getPaymentMethodText(): Promise<string> {
    return this.$(SELECTORS.ORDER_DETAIL.PAYMENT_METHOD).getText()
  }

  async getStatusText(): Promise<string> {
    return this.$(SELECTORS.ORDER_DETAIL.STATUS_BADGE).getText()
  }

  // ---- Completed-order receipt fields (order-history §4.6) ----

  /** Header order number, e.g. "#OD260811-32683488". */
  async getOrderId(): Promise<string> {
    return this.$(SELECTORS.ORDER_DETAIL.ORDER_ID).getText()
  }

  /** True when the read-only receipt (Order information + Payment details) is shown. */
  async isReceiptShown(): Promise<boolean> {
    const info = await this.$(SELECTORS.ORDER_DETAIL.ORDER_INFORMATION).isExisting()
    const pay = await this.$(SELECTORS.ORDER_DETAIL.PAYMENT_DETAILS).isExisting()
    return info && pay
  }

  async getCashierText(): Promise<string> {
    return this.$(SELECTORS.ORDER_DETAIL.CASHIER).getText()
  }

  async getCustomerText(): Promise<string> {
    return this.$(SELECTORS.ORDER_DETAIL.CUSTOMER).getText()
  }

  async hasTechnicianGroup(): Promise<boolean> {
    return this.$(SELECTORS.ORDER_DETAIL.TECH_GROUP).isExisting()
  }

  async getSubtotalCents(): Promise<number> {
    return this.moneyOf(SELECTORS.ORDER_DETAIL.SUBTOTAL)
  }

  async getTipCents(): Promise<number> {
    return this.moneyOf(SELECTORS.ORDER_DETAIL.TIP)
  }

  /** Number of service-line rows on the receipt. */
  async getServiceLineCount(): Promise<number> {
    return (await this.$$(SELECTORS.ORDER_DETAIL.SERVICE_LINE_ANY).getElements()).length
  }

  /** Per-line service prices in cents (Σ should equal Subtotal — §4.6.2). Service
   * names can contain digits, so take each row's LAST money token. */
  async getServiceLinePricesCents(): Promise<number[]> {
    const prices = await this.$$(SELECTORS.ORDER_DETAIL.SERVICE_LINE_PRICE).getElements()
    const out: number[] = []
    for (const p of prices) {
      const monies = (await p.getText()).replace(/\s+/g, " ").match(/-?\$[\d,]+\.\d{2}/g) ?? []
      out.push(monies.length ? toCents(monies[monies.length - 1]) : 0)
    }
    return out
  }

  /** The "Successful" badge in the Payment details block (§4.6.5). */
  async getPaymentStatusText(): Promise<string> {
    return this.$(SELECTORS.ORDER_DETAIL.PAYMENT_STATUS).getText()
  }

  /** Card brand + last4, e.g. "Visa ··0043" (§4.6.5/4.6.6). */
  async getCardBrandText(): Promise<string> {
    return this.$(SELECTORS.ORDER_DETAIL.CARD_BRAND).getText()
  }

  /** True only for card-tender orders (cash/gift orders have no brand row). */
  async hasCardBrand(): Promise<boolean> {
    return this.$(SELECTORS.ORDER_DETAIL.CARD_BRAND).isExisting()
  }

  async hasTransaction(): Promise<boolean> {
    return this.$(SELECTORS.ORDER_DETAIL.TRANSACTION_ID).isExisting()
  }

  async getTransactionId(): Promise<string> {
    return this.$(SELECTORS.ORDER_DETAIL.TRANSACTION_ID).getText()
  }

  async hasCancelAction(): Promise<boolean> {
    return this.$(SELECTORS.ORDER_DETAIL.CANCEL_ORDER).isExisting()
  }

  async hasReprintAction(): Promise<boolean> {
    return this.$(SELECTORS.ORDER_DETAIL.REPRINT_RECEIPT).isExisting()
  }

  async hasShareAction(): Promise<boolean> {
    return this.$(SELECTORS.ORDER_DETAIL.SHARE).isExisting()
  }

  // ---- Cancel order (OCAN-*) ----

  async openCancelDialog(): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_DETAIL.CANCEL_ORDER, "cancel order")
  }

  async isCancelDialogOpen(): Promise<boolean> {
    return this.$(SELECTORS.ORDER_DETAIL.CANCEL_DIALOG).isExisting()
  }

  /** True when every one of the seven reason options is present. */
  async hasAllCancelReasons(): Promise<boolean> {
    for (const key of CANCEL_REASONS) {
      if (!(await this.$(SELECTORS.ORDER_DETAIL.CANCEL_REASON(key)).isExisting())) return false
    }
    return true
  }

  async isReasonSelected(key: string): Promise<boolean> {
    // The reason label wraps a `button[role="radio"]` — read its checked state.
    const radio = this.$(SELECTORS.ORDER_DETAIL.CANCEL_REASON(key)).$('button[role="radio"]')
    const state = await radio.getAttribute("data-state")
    if (state) return state === "checked"
    return (await radio.getAttribute("aria-checked")) === "true"
  }

  async selectCancelReason(key: string): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_DETAIL.CANCEL_REASON(key), `cancel reason ${key}`)
  }

  /** Dismiss the dialog with [Back] — order stays Successful (OCAN-03). */
  async cancelBack(): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_DETAIL.CANCEL_BACK, "cancel back")
  }

  /** ⚠️ Confirm the void — real payment reversal. Opt-in, isolated-shop only. */
  async confirmCancel(): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_DETAIL.CANCEL_CONFIRM, "cancel confirm")
  }

  // ---- Reprint / Send receipt (ORCP-*, OSND-*) ----

  async reprint(): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_DETAIL.REPRINT_RECEIPT, "reprint receipt")
  }

  /** Open the Share → "Send receipt" sheet. */
  async openSendReceipt(): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_DETAIL.SHARE, "share / send receipt")
  }

  async isSendSheetOpen(): Promise<boolean> {
    return this.$(SELECTORS.ORDER_DETAIL.SEND_SHEET).isExisting()
  }

  async hasSendOption(type: SendReceiptType): Promise<boolean> {
    return this.$(SELECTORS.ORDER_DETAIL.SEND_RECEIPT(type)).isExisting()
  }

  /** Post-payment "Print" option must NOT appear here (OSND-01). */
  async hasPrintOption(): Promise<boolean> {
    return this.$(SELECTORS.PAYMENT_COMPLETE.RECEIPT("print")).isExisting()
  }

  async selectSendReceipt(type: SendReceiptType): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_DETAIL.SEND_RECEIPT(type), `send receipt ${type}`)
  }

  async fillReceiptTarget(value: string): Promise<void> {
    await this.safeFill(SELECTORS.ORDER_DETAIL.RECEIPT_INPUT, value, "receipt target")
  }

  async isSendEnabled(): Promise<boolean> {
    return this.$(SELECTORS.ORDER_DETAIL.RECEIPT_SEND).isEnabled()
  }

  /** ⚠️ Send a real receipt. Opt-in, test address only. */
  async send(): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_DETAIL.RECEIPT_SEND, "receipt send")
  }
}

export const orderDetailPage = new OrderDetailPage()
