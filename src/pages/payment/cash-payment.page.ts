/**
 * CashPaymentPage — the "Cash payment" tender screen (docs/payment-test-cases.md
 * §3, §8.2). Reads the breakdown (Subtotal / Service fee / Cash discount /
 * Amount due / Change due), drives Quick cash + keypad, and reports whether
 * [Accept cash] is enabled. Money getters return **integer cents**.
 *
 * Selectors are REAL Tauri-webview hooks (Đường A2): breakdown rows via
 * utils/tender-webview (data-slot="summary-item"), chips/keypad via data-slot,
 * the CASH RECEIVED figure via BIG_MONEY.
 *
 * ⚠️ SAFETY: never tap [Accept cash] in a committed spec — it opens the staff
 * passcode gate and finalizes a REAL transaction. Assert it is *enabled* only.
 */
import { SELECTORS } from "../../constants/selectors.js"
import { hasSummaryRows, readBigMoneyCents, readSummaryCents } from "../../utils/tender-webview.js"
import { BasePage } from "../base.page.js"

export class CashPaymentPage extends BasePage {
  protected readonly pageName = "CashPaymentPage"
  protected readonly rootSelector = SELECTORS.CASH_PAYMENT.HEADER

  async isOnScreen(): Promise<boolean> {
    return this.isLoaded()
  }

  /** True when every breakdown row is present (CASH-01). */
  async hasBreakdownRows(): Promise<boolean> {
    return hasSummaryRows([/^Subtotal/i, /service fee/i, /cash discount/i, /amount due/i, /change due/i])
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

  async getChangeDueCents(): Promise<number> {
    return readSummaryCents(/change due/i)
  }

  /** Tap a Quick cash chip — label is "Exact" | "100" | "120" | "150"
   * (the "$" prefix on the numeric chips is added here). */
  async enterQuickCash(label: string): Promise<void> {
    const text = label === "Exact" ? "Exact" : label.startsWith("$") ? label : `$${label}`
    await this.safeClick(SELECTORS.CASH_PAYMENT.QUICK_CASH(text), `quick cash ${text}`)
  }

  /** Type an amount digit-by-digit on the keypad (e.g. "1500" for $15.00). */
  async typeAmount(digits: string): Promise<void> {
    for (const digit of digits) {
      await this.safeClick(SELECTORS.CASH_PAYMENT.KEYPAD(digit), `keypad ${digit}`)
    }
  }

  async isAcceptEnabled(): Promise<boolean> {
    return this.$(SELECTORS.CASH_PAYMENT.ACCEPT_CASH).isEnabled()
  }

  /**
   * Tap [Accept cash] → opens the staff-passcode gate (it does NOT complete on
   * its own). Used only by opt-in finalize cases; never call in a safe case.
   */
  async tapAccept(): Promise<void> {
    await this.safeClick(SELECTORS.CASH_PAYMENT.ACCEPT_CASH, "accept cash")
  }

  /** Open the Add Tip screen (shared across tenders — §6). */
  async openTip(): Promise<void> {
    await this.safeClick(SELECTORS.CASH_PAYMENT.TIP_BTN, "tip")
  }
}

export const cashPaymentPage = new CashPaymentPage()
