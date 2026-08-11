/**
 * GiftCardPaymentPage — the "Redeem Gift Card" tender screen
 * (docs/payment-test-cases.md §4, §8.3). Enter/scan a card code, read the
 * amount due (= base price; gift card cancels the service fee like cash), and
 * report whether [Redeem] is enabled. Money getters return **integer cents**.
 *
 * Selectors are REAL Tauri-webview hooks (Đường A2): the code input by
 * placeholder, AMOUNT DUE via BIG_MONEY, balance/applying rows via
 * utils/tender-webview once a card resolves.
 *
 * ⚠️ SAFETY: never tap [Redeem] in a committed spec — it opens the staff
 * passcode gate and finalizes a REAL transaction. Assert *enabled* only.
 * ⚠️ Gift-card balance is shared server data — do NOT assert an exact post-redeem
 * decrease (doc §GC-12, §10).
 */
import { SELECTORS } from "../../constants/selectors.js"
import { TIMEOUTS } from "../../constants/timeouts.js"
import { readBigMoneyCents, readSummaryCents, readSummaryMap } from "../../utils/tender-webview.js"
import { waitUntil } from "../../utils/wait.js"
import { BasePage } from "../base.page.js"

export class GiftCardPaymentPage extends BasePage {
  protected readonly pageName = "GiftCardPaymentPage"
  protected readonly rootSelector = SELECTORS.GIFT_CARD.HEADER

  async isOnScreen(): Promise<boolean> {
    return this.isLoaded()
  }

  /** AMOUNT DUE — the large figure at the top of the screen. */
  async getAmountDueCents(): Promise<number> {
    return readBigMoneyCents()
  }

  /** Type a gift-card code into the input (app auto-looks-up on entry). */
  async enterCode(code: string): Promise<void> {
    await this.safeFill(SELECTORS.GIFT_CARD.CODE_INPUT, code, "gift card code")
  }

  /** True once a card was resolved and a balance row is showing. */
  async isCardResolved(): Promise<boolean> {
    return Object.keys(await readSummaryMap()).some((k) => /balance/i.test(k))
  }

  /**
   * Wait until an entered card resolves (a balance row appears) so [Redeem] can
   * enable. Times out if the code matches no card / has no balance.
   */
  async waitForCardResolved(): Promise<void> {
    await waitUntil(() => this.isCardResolved(), {
      timeout: TIMEOUTS.LONG,
      timeoutMsg: "[GiftCardPaymentPage] card did not resolve (check GIFT_CARD_CODE / balance)"
    })
  }

  /** Available balance on the resolved card, in cents. */
  async getBalanceCents(): Promise<number> {
    return readSummaryCents(/balance/i)
  }

  /** Amount applied from the card (shown as "-$X.XX") — returns positive cents. */
  async getApplyingCents(): Promise<number> {
    return Math.abs(await readSummaryCents(/apply/i))
  }

  async isRedeemEnabled(): Promise<boolean> {
    return this.$(SELECTORS.GIFT_CARD.REDEEM_BTN).isEnabled()
  }

  /**
   * Tap [Redeem] → opens the shared staff-passcode gate (it does NOT complete on
   * its own). ⚠️ Once the passcode is entered this finalizes a REAL redemption
   * against shared card balance — opt-in, isolated-shop cases only (doc §GC-11,
   * §6.1). Never call in a safe case.
   */
  async tapRedeem(): Promise<void> {
    await this.safeClick(SELECTORS.GIFT_CARD.REDEEM_BTN, "redeem")
  }

  /** Tap the scan icon → camera / QR flow (GC-08). */
  async tapScan(): Promise<void> {
    await this.safeClick(SELECTORS.GIFT_CARD.SCAN_BTN, "gift card scan")
  }

  async openTip(): Promise<void> {
    await this.safeClick(SELECTORS.GIFT_CARD.TIP_BTN, "tip")
  }
}

export const giftCardPaymentPage = new GiftCardPaymentPage()
