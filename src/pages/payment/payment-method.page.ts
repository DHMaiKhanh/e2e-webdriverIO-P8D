/**
 * PaymentMethodPage — the "Payment method" screen reached from Review order via
 * [Charge $X] (docs/payment-test-cases.md §2, §8.1). Lists Card / Cash /
 * Gift card / Other, each with an amount, then routes to the chosen tender.
 *
 * ⚠️ The data-testid selectors this uses (SELECTORS.PAYMENT_METHOD.*) are a §9
 * PROPOSAL — they don't exist in the WebView yet. Until the app ships them, gate
 * the spec that drives this page behind VOLT_PAYMENT_TESTIDS (see the
 * volt-e2e-spec skill). Written testid-first so it "just works" the day the
 * hooks land.
 */
import { SELECTORS } from "../../constants/selectors.js"
import { toCents } from "../../utils/currency.js"
import { BasePage } from "../base.page.js"

/** Payment-method ids as they appear in the testid suffix. */
export type PaymentMethodId = "card" | "cash" | "gift-card" | "other"

export class PaymentMethodPage extends BasePage {
  protected readonly pageName = "PaymentMethodPage"
  protected readonly rootSelector = SELECTORS.PAYMENT_METHOD.HEADER

  /** True once the "Payment method" header is on screen. */
  async isOnScreen(): Promise<boolean> {
    return this.isLoaded()
  }

  /** Every method tile present? */
  async hasAllMethods(): Promise<boolean> {
    const ids: PaymentMethodId[] = ["card", "cash", "gift-card", "other"]
    for (const id of ids) {
      if (!(await this.$(SELECTORS.PAYMENT_METHOD.METHOD(id)).isExisting())) return false
    }
    return true
  }

  /** The advertised amount for a method, in **integer cents** (parsed from the
   * displayed "$X.XX"). Compare with expectMoneyEqual — never hard-code. */
  async getMethodAmountCents(id: PaymentMethodId): Promise<number> {
    const text = await this.$(SELECTORS.PAYMENT_METHOD.METHOD_AMOUNT(id)).getText()
    return toCents(text)
  }

  /** Tap a method tile → routes to that tender screen. */
  async selectMethod(id: PaymentMethodId): Promise<void> {
    await this.safeClick(SELECTORS.PAYMENT_METHOD.METHOD(id), `payment method ${id}`)
  }
}

export const paymentMethodPage = new PaymentMethodPage()
