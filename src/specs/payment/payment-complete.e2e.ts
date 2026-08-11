/**
 * docs/payment-test-cases.md §8.7 (FIN-01 … FIN-09) + §8.3 GC-11 — the shared
 * finalize gate (staff-passcode modal) → "Payment complete" (Approved) → Send
 * receipt → + New order, driven end-to-end for ALL THREE completable tenders:
 *   • Cash       — [Accept cash]
 *   • Gift card  — [Redeem]        (doc §GC-11)
 *   • Other      — [Record payment]
 * (Card is never completable on the emulator — no terminal — see card.e2e.ts.)
 *
 * ⚠️ SAFETY: EVERY case here is opt-in / isolated-shop only. Reaching the gate
 * leaks a draft order; entering a valid passcode FINALIZES a REAL transaction
 * (gift card also redeems real card balance) and email/text receipts send real
 * messages. So every case is `it.skip` with its flow written out — a maintainer
 * un-skips an individual case on the isolated `Volt POS 14 Dev` shop and cleans
 * up the settled order + leftover draft afterwards. Because the cases are
 * pending, Mocha skips the `beforeEach` too, so nothing finalizes accidentally.
 *
 * Secrets come from env — never hard-coded:
 *   STAFF_PASSCODE   4-digit staff/manager PIN (dev 8888)
 *   GIFT_CARD_CODE   a real card WITH balance (doc verified 1880)
 *
 * GATING: skipped until ANDROID_WEBVIEW_READY=1 && VOLT_PAYMENT_TESTIDS=1 (the
 * §9 data-testids on the Payment-complete screen don't exist in the WebView yet).
 */
import { expect } from "@wdio/globals"
import { cashPaymentPage, paymentCompletePage } from "@pages"
import { expectMoneyEqual } from "../../utils/currency.js"
import { reachFinalizeGate, type FinalizeTender } from "../../utils/finalize-flow.js"

const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
const TESTIDS_LANDED = process.env.VOLT_PAYMENT_TESTIDS === "1"
const suite = WEBVIEW_READY && TESTIDS_LANDED ? describe : describe.skip

// Staff PIN from env/secret (dev uses 8888). Never commit the value.
const STAFF_PASSCODE = process.env.STAFF_PASSCODE ?? ""
// A deliberately wrong PIN for the rejection case — differs from any real code.
const WRONG_PASSCODE = "0000"

interface TenderCase {
  key: FinalizeTender
  label: string
  finalizeBtn: string
  // Gift card's Approved amount depends on shared card balance → assert only the
  // Approved badge, not an exact figure (doc §GC-12 + volt-e2e skill safety).
  assertAmount: boolean
}

const TENDERS: TenderCase[] = [
  { key: "cash", label: "Cash", finalizeBtn: "Accept cash", assertAmount: true },
  { key: "gift-card", label: "Gift card", finalizeBtn: "Redeem", assertAmount: false },
  { key: "other", label: "Other", finalizeBtn: "Record payment", assertAmount: true }
]

// One end-to-end finalize block per completable tender (FIN-01/02/03; gift card
// FIN-02 is also doc §GC-11). Proves each method reaches "Payment complete".
for (const t of TENDERS) {
  suite(`Payment complete · ${t.label} → passcode → Approved`, () => {
    let dueCents = 0

    beforeEach(async () => {
      // ⚠️ Reaches the tender screen and taps the finalize button → the
      // staff-passcode modal opens (no PIN entered yet, no transaction).
      dueCents = await reachFinalizeGate(t.key)
    })

    it.skip(`FIN-01 @smoke · ⚠️ ${t.label}: ${t.finalizeBtn} opens the staff-passcode modal`, async () => {
      expect(await paymentCompletePage.isPasscodeModalOpen()).toBe(true)
    })

    it.skip(`FIN-02 @smoke · ⚠️ ${t.label}: correct PIN → Payment complete / Approved`, async () => {
      await paymentCompletePage.enterPasscode(STAFF_PASSCODE)
      expect(await paymentCompletePage.isApproved()).toBe(true)
      if (t.assertAmount) {
        expect(expectMoneyEqual(await paymentCompletePage.getApprovedAmountCents(), dueCents)).toBe(true)
      }
    })

    it.skip(`FIN-03 @regression · ⚠️ ${t.label}: wrong PIN rejected (order not settled)`, async () => {
      await paymentCompletePage.enterPasscode(WRONG_PASSCODE)
      expect(await paymentCompletePage.isApproved()).toBe(false)
    })
  })
}

// Shared post-gate cases (FIN-04 … FIN-09) — tender-agnostic once at the gate /
// Approved screen. Driven via Cash, the simplest tender to reach the gate.
suite("Payment complete · shared gate — dismiss / skip / receipt / new order (via Cash)", () => {
  beforeEach(async () => {
    await reachFinalizeGate("cash") // ⚠️ leaves the app on the passcode modal
  })

  it.skip("FIN-04 @regression · ⚠️ dismissing the modal keeps the cart (no transaction)", async () => {
    expect(await paymentCompletePage.isPasscodeModalOpen()).toBe(true)
    await browser.back()
    expect(await cashPaymentPage.isOnScreen()).toBe(true)
  })

  it.skip("FIN-05 @regression · ⚠️ 'Skip passcode for 30 minutes' toggle", async () => {
    await paymentCompletePage.toggleSkipPasscode()
    expect(await paymentCompletePage.isPasscodeModalOpen()).toBe(true)
  })

  it.skip("FIN-06 @regression · ⚠️ Send receipt options (Print disabled, no printer)", async () => {
    await paymentCompletePage.enterPasscode(STAFF_PASSCODE)
    expect(await paymentCompletePage.isReceiptOptionEnabled("email")).toBe(true)
    expect(await paymentCompletePage.isReceiptOptionEnabled("print")).toBe(false)
  })

  it.skip("FIN-07 @regression · ⚠️ No receipt closes the flow (order settled)", async () => {
    await paymentCompletePage.enterPasscode(STAFF_PASSCODE)
    await paymentCompletePage.selectReceipt("none")
    expect(await paymentCompletePage.isApproved()).toBe(false)
  })

  it.skip("FIN-08 @regression · ⚠️ Email/Text receipt sends a real message (test address only)", async () => {
    await paymentCompletePage.enterPasscode(STAFF_PASSCODE)
    await paymentCompletePage.selectReceipt("email")
    // ⚠️ Real send — only with a test address; not exercised here.
  })

  it.skip("FIN-09 @regression · ⚠️ + New order starts a fresh sale", async () => {
    await paymentCompletePage.enterPasscode(STAFF_PASSCODE)
    await paymentCompletePage.newOrder()
  })
})
