/**
 * PaymentCompletePage — the shared finalize gate + receipt flow
 * (docs/payment-test-cases.md §6.1, §8.7). Every [Accept cash] / [Redeem] /
 * [Record payment] first opens the "Enter staff code to complete payment" modal
 * (4-digit PIN via the existing SELECTORS.PASSCODE_GUARD.DIGIT keypad); a correct
 * code lands on "Payment complete" (Approved badge) → Send receipt → + New order.
 *
 * ⚠️ SAFETY: entering a correct passcode FINALIZES a real transaction. Only the
 * opt-in, isolated-shop finalize cases call `enterPasscode` — never the safe
 * committed cases. The 4-digit PIN comes from env (`STAFF_PASSCODE`), never
 * hard-coded. Selectors (besides PASSCODE_GUARD) are the §9 PROPOSAL.
 */
import { SELECTORS } from "../../constants/selectors.js"
import { toCents } from "../../utils/currency.js"
import { BasePage } from "../base.page.js"

/** Receipt-delivery options on the post-payment screen. */
export type ReceiptType = "email" | "text" | "print" | "none"

export class PaymentCompletePage extends BasePage {
  protected readonly pageName = "PaymentCompletePage"
  protected readonly rootSelector = SELECTORS.PAYMENT_COMPLETE.PASSCODE_MODAL

  /** True when the staff-passcode modal is open (FIN-01). */
  async isPasscodeModalOpen(): Promise<boolean> {
    return this.$(SELECTORS.PAYMENT_COMPLETE.PASSCODE_MODAL).isExisting()
  }

  /**
   * Enter the 4-digit staff PIN. ⚠️ Finalizes a real transaction on a correct
   * code — opt-in, isolated-shop cases only. PIN is read from env by the caller.
   */
  async enterPasscode(pin: string): Promise<void> {
    for (const digit of pin) {
      await this.safeClick(SELECTORS.PASSCODE_GUARD.DIGIT(digit), `passcode ${digit}`)
    }
  }

  /** Tick "Skip passcode for the next 30 minutes" (FIN-05). */
  async toggleSkipPasscode(): Promise<void> {
    await this.safeClick(SELECTORS.PAYMENT_COMPLETE.SKIP_PASSCODE, "skip passcode 30m")
  }

  /** True once the "Approved" badge is shown (FIN-02). */
  async isApproved(): Promise<boolean> {
    return this.$(SELECTORS.PAYMENT_COMPLETE.APPROVED_BADGE).isExisting()
  }

  /** Amount on the Payment complete screen, in cents. */
  async getApprovedAmountCents(): Promise<number> {
    return toCents(await this.$(SELECTORS.PAYMENT_COMPLETE.APPROVED_BADGE).getText())
  }

  async isReceiptOptionEnabled(type: ReceiptType): Promise<boolean> {
    return this.$(SELECTORS.PAYMENT_COMPLETE.RECEIPT(type)).isEnabled()
  }

  /** Choose a receipt-delivery option (⚠️ email/text send real messages). */
  async selectReceipt(type: ReceiptType): Promise<void> {
    await this.safeClick(SELECTORS.PAYMENT_COMPLETE.RECEIPT(type), `receipt ${type}`)
  }

  /** Start a fresh order (FIN-09). */
  async newOrder(): Promise<void> {
    await this.safeClick(SELECTORS.PAYMENT_COMPLETE.NEW_ORDER, "new order")
  }
}

export const paymentCompletePage = new PaymentCompletePage()
