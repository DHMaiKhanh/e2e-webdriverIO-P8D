/**
 * OtherPaymentPage — the "Other payment" tender screen
 * (docs/payment-test-cases.md §5, §8.4). Manual/external payment: Amount
 * received is pre-filled to Amount due, editable via keypad. Unlike Cash there
 * is NO cash discount, so Amount due keeps the service fee (card price).
 * Money getters return **integer cents**.
 *
 * Selectors are REAL Tauri-webview hooks (Đường A2): breakdown rows via
 * utils/tender-webview, keypad via data-slot, received figure via BIG_MONEY.
 *
 * ⚠️ SAFETY: never tap [Record payment] in a committed spec — it opens the staff
 * passcode gate and finalizes a REAL transaction. Assert *enabled* only.
 */
import { SELECTORS } from "../../constants/selectors.js"
import { hasSummaryRows, readBigMoneyCents, readSummaryCents } from "../../utils/tender-webview.js"
import { BasePage } from "../base.page.js"

export class OtherPaymentPage extends BasePage {
  protected readonly pageName = "OtherPaymentPage"
  protected readonly rootSelector = SELECTORS.OTHER_PAYMENT.HEADER

  async isOnScreen(): Promise<boolean> {
    return this.isLoaded()
  }

  async getSubtotalCents(): Promise<number> {
    return readSummaryCents(/^Subtotal/i)
  }

  async getAmountDueCents(): Promise<number> {
    return readSummaryCents(/amount due/i)
  }

  async getReceivedCents(): Promise<number> {
    return readBigMoneyCents()
  }

  async getRemainingCents(): Promise<number> {
    return readSummaryCents(/remaining/i)
  }

  /** True when a Cash-discount breakdown row exists — expected FALSE for Other. */
  async hasCashDiscountRow(): Promise<boolean> {
    return hasSummaryRows([/cash discount/i])
  }

  /** Type an amount digit-by-digit on the keypad. */
  async typeAmount(digits: string): Promise<void> {
    for (const digit of digits) {
      await this.safeClick(SELECTORS.OTHER_PAYMENT.KEYPAD(digit), `keypad ${digit}`)
    }
  }

  /** Tap C (clear) → Amount received back to $0.00 (OTH-06). */
  async clear(): Promise<void> {
    await this.safeClick(SELECTORS.OTHER_PAYMENT.CLEAR_BTN, "clear")
  }

  /** Backspace one digit (OTH-07). */
  async backspace(): Promise<void> {
    await this.safeClick(SELECTORS.OTHER_PAYMENT.BACKSPACE, "backspace")
  }

  async isRecordEnabled(): Promise<boolean> {
    return this.$(SELECTORS.OTHER_PAYMENT.RECORD_PAYMENT).isEnabled()
  }

  /**
   * Tap [Record payment] → opens the shared staff-passcode gate (it does NOT
   * complete on its own). ⚠️ Once the passcode is entered this finalizes a REAL
   * transaction — opt-in, isolated-shop cases only (doc §6.1). Never call in a
   * safe case.
   */
  async tapRecord(): Promise<void> {
    await this.safeClick(SELECTORS.OTHER_PAYMENT.RECORD_PAYMENT, "record payment")
  }

  async openTip(): Promise<void> {
    await this.safeClick(SELECTORS.OTHER_PAYMENT.TIP_BTN, "tip")
  }
}

export const otherPaymentPage = new OtherPaymentPage()
