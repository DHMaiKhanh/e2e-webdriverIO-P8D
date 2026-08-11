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
  protected readonly rootSelector = SELECTORS.ORDER_DETAIL.PAYMENT_DETAILS

  async isOnScreen(): Promise<boolean> {
    return this.isLoaded()
  }

  async getTotalPaidCents(): Promise<number> {
    return toCents(await this.$(SELECTORS.ORDER_DETAIL.TOTAL_PAID).getText())
  }

  async getPaymentMethodText(): Promise<string> {
    return this.$(SELECTORS.ORDER_DETAIL.PAYMENT_METHOD).getText()
  }

  async getStatusText(): Promise<string> {
    return this.$(SELECTORS.ORDER_DETAIL.STATUS_BADGE).getText()
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
    return this.$(SELECTORS.ORDER_DETAIL.CANCEL_REASON(key)).isSelected()
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
