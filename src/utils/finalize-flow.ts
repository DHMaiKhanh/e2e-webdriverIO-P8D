/**
 * finalizeFlow — the ⚠️ DANGEROUS on-ramp that drives a chosen tender all the
 * way to the shared staff-passcode gate (docs/payment-test-cases.md §6.1, §8.7).
 *
 * `reachFinalizeGate(tender)` reaches Payment method, selects the tender, makes
 * it payable, and taps the tender's finalize button — which opens the
 * "Enter staff code to complete payment" modal. It STOPS there: it never enters
 * the passcode, so this helper alone creates no transaction. Entering the
 * passcode (paymentCompletePage.enterPasscode) is what finalizes a REAL payment,
 * and only the opt-in / isolated-shop FIN-* / GC-11 cases do that.
 *
 * ⚠️ Every path here also leaks an Open/"In Use" draft order (checkoutFlow, doc
 * §10) and, on gift card, resolves a real card. Run only against the isolated
 * `Volt POS 14 Dev` shop and clean up the draft/settled order afterwards.
 *
 * ⚠️ WebView not debuggable + §9 testids not shipped yet → callers gate behind
 * ANDROID_WEBVIEW_READY=1 + VOLT_PAYMENT_TESTIDS=1, so this never runs blind.
 */
import { cashPaymentPage, giftCardPaymentPage, otherPaymentPage, paymentMethodPage } from "@pages"
import { checkoutFlow } from "./checkout-flow.js"
import { logger } from "./logger.js"

/** The three tenders that funnel through the staff-passcode gate. Card is never
 * completable on the emulator (no terminal) — see card.e2e.ts. */
export type FinalizeTender = "cash" | "gift-card" | "other"

/**
 * A real gift-card code WITH balance, read from env/secret — never hard-coded
 * (doc verified card `1880`). Only the gift-card path reads it.
 */
const GIFT_CARD_CODE = process.env.GIFT_CARD_CODE ?? ""

/**
 * Reach `tender`'s screen, make it payable, and tap finalize → the staff-passcode
 * modal opens. Returns the Amount due in cents (the expected Approved amount for
 * a tender that covers the order in full). Does NOT enter the passcode.
 */
export async function reachFinalizeGate(tender: FinalizeTender): Promise<number> {
  await checkoutFlow.reachPaymentMethod()
  await paymentMethodPage.selectMethod(tender)

  switch (tender) {
    case "cash": {
      await cashPaymentPage.waitForLoaded()
      const due = await cashPaymentPage.getAmountDueCents()
      await cashPaymentPage.enterQuickCash("Exact") // received = due → Accept enabled
      await cashPaymentPage.tapAccept() // ⚠️ opens the passcode gate
      logger.info("[finalizeFlow] cash → staff-passcode gate")
      return due
    }
    case "other": {
      await otherPaymentPage.waitForLoaded()
      const due = await otherPaymentPage.getAmountDueCents()
      // Amount received is pre-filled to Amount due → Record payment is already enabled.
      await otherPaymentPage.tapRecord() // ⚠️ opens the passcode gate
      logger.info("[finalizeFlow] other → staff-passcode gate")
      return due
    }
    case "gift-card": {
      await giftCardPaymentPage.waitForLoaded()
      const due = await giftCardPaymentPage.getAmountDueCents()
      await giftCardPaymentPage.enterCode(GIFT_CARD_CODE)
      await giftCardPaymentPage.waitForCardResolved()
      await giftCardPaymentPage.tapRedeem() // ⚠️ opens the passcode gate
      logger.info("[finalizeFlow] gift card → staff-passcode gate")
      return due
    }
    default:
      throw new Error(`[finalizeFlow] unknown tender: ${tender as string}`)
  }
}
