/**
 * CardPaymentPage — the "Card payment" tender screen (docs/payment-test-cases.md
 * §2.1, §8.6). Real webview selectors (Đường A2) — no testids needed.
 *
 * The 2026-08 UI change (VP-2191) gave this screen TWO runtime states:
 *   • BLOCKED — no Kozen P8 / `capabilities.charge` falsy → a "Card payment
 *     unavailable" note + a "Choose another method" button.
 *   • IDLE    — the confirm-charge screen → a disabled "Charge · $X" (or
 *     "Retry · $X" after a decline) + a secondary "Tip" button.
 * On the emulator (no card terminal) card is NEVER completable in either state,
 * so `isChargeBlocked()` is the invariant CARD-03 asserts. The real tap/swipe
 * flow is device-only (CARD-06/07).
 */
import { SELECTORS } from "../../constants/selectors.js"
import { BasePage } from "../base.page.js"

export class CardPaymentPage extends BasePage {
  protected readonly pageName = "CardPaymentPage"
  protected readonly rootSelector = SELECTORS.CARD_PAYMENT.HEADER

  async isOnScreen(): Promise<boolean> {
    return this.isLoaded()
  }

  /** BLOCKED state: the "Card payment unavailable" note (no Kozen P8 terminal). */
  async isUnavailable(): Promise<boolean> {
    return this.$(SELECTORS.CARD_PAYMENT.UNAVAILABLE).isExisting()
  }

  /** IDLE state: a "Charge · $X" / "Retry · $X" primary button is on screen. */
  async hasChargeButton(): Promise<boolean> {
    return this.$(SELECTORS.CARD_PAYMENT.CHARGE_BTN).isExisting()
  }

  /** True only when the Charge button exists AND is enabled (real terminal). */
  async isChargeEnabled(): Promise<boolean> {
    const btn = this.$(SELECTORS.CARD_PAYMENT.CHARGE_BTN)
    if (!(await btn.isExisting())) return false
    return btn.isEnabled()
  }

  /**
   * The emulator has no card terminal, so a card sale can NEVER be completed
   * here — regardless of state: BLOCKED (unavailable note shown), or IDLE (the
   * Charge button is present but DISABLED). Returns true in either case (CARD-03).
   */
  async isChargeBlocked(): Promise<boolean> {
    if (await this.isUnavailable()) return true
    if (await this.hasChargeButton()) return !(await this.isChargeEnabled())
    return false
  }

  /**
   * Leave the Card screen back toward the method chooser (CARD-04) using whatever
   * exit the current state offers: the BLOCKED "Choose another method" button,
   * else the IDLE NavBar back — both route to /payment/choose.
   */
  async leaveScreen(): Promise<void> {
    if (await this.$(SELECTORS.CARD_PAYMENT.CHOOSE_ANOTHER).isExisting()) {
      await this.safeClick(SELECTORS.CARD_PAYMENT.CHOOSE_ANOTHER, "choose another method")
    } else {
      await this.safeClick(SELECTORS.CARD_PAYMENT.NAV_BACK, "card nav back")
    }
  }
}

export const cardPaymentPage = new CardPaymentPage()
