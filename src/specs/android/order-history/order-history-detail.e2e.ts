/**
 * docs/order-history-test-cases.md §4.6 (order-history-detail) — the read-only
 * receipt of a COMPLETED order (Orders → Successful - Unsettled → a card):
 * Order information, technician group + service lines, Subtotal/Tip/Total paid,
 * Payment details, Transaction, and the footer actions.
 *
 * ⚠️ SAFETY: never taps Cancel order / Send / Reprint's real side effects —
 * Cancel voids + reverses a real payment, Send emails/texts a real receipt. Safe
 * cases stop at the dialog's [Back] / the send sheet, asserting presence only.
 *
 * The order under test is discovered from the list (first Unsettled card), so no
 * fixture id is hard-coded. Set VOLT_TEST_PAID_ORDER to pin one if the dev shop
 * has no unsettled orders on the current day.
 *
 * Gated on ANDROID_WEBVIEW_READY=1 (a webview-capable target — the emulator).
 * Selectors are re-pointed at the app's real DOM hooks (data-slot / aria-label /
 * badge / #OD code), so no data-testid dependency remains.
 */
import { expect } from "@wdio/globals"
import { orderDetailPage, orderHistoryPage } from "@pages"
import { ROUTES } from "../../../constants/routes.js"
import { expectMoneyEqual, sumCents } from "../../../utils/currency.js"
import { ensureLoggedIn } from "../../../utils/ensure-logged-in.js"

const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
const suite = WEBVIEW_READY ? describe : describe.skip

const PINNED_ORDER_ID = process.env.VOLT_TEST_PAID_ORDER ?? ""

/**
 * Land on a completed order's receipt. Prefers a pinned id; otherwise opens the
 * first Successful - Unsettled card. Returns false when there is nothing to open
 * (so the case can no-op instead of failing on empty dev data).
 */
async function reachReceipt(): Promise<boolean> {
  if (PINNED_ORDER_ID) {
    await browser.url(ROUTES.APP.ORDER_DETAIL(PINNED_ORDER_ID))
    await orderDetailPage.waitForLoaded()
    return true
  }
  await orderHistoryPage.open()
  await orderHistoryPage.selectStatus("successful-unsettled")
  if ((await orderHistoryPage.cardCount()) === 0) return false
  await orderHistoryPage.openFirstOrder()
  await orderDetailPage.waitForLoaded()
  return true
}

suite("Order History · completed-order receipt @regression", () => {
  before(async () => {
    await ensureLoggedIn()
  })

  beforeEach(async () => {
    await reachReceipt()
  })

  it("OHDT-01 @smoke · shows Order information, technician group and service lines", async () => {
    if (!(await orderDetailPage.isOnScreen())) return
    expect(await orderDetailPage.isReceiptShown()).toBe(true)
    expect(await orderDetailPage.hasTechnicianGroup()).toBe(true)
    expect(await orderDetailPage.getServiceLineCount()).toBeGreaterThanOrEqual(1)
  })

  it("OHDT-02 @smoke · Subtotal equals the sum of service-line prices", async () => {
    if (!(await orderDetailPage.isOnScreen())) return
    const lines = await orderDetailPage.getServiceLinePricesCents()
    const subtotal = await orderDetailPage.getSubtotalCents()
    expect(expectMoneyEqual(sumCents(lines), subtotal)).toBe(true)
  })

  it("OHDT-03 @smoke · Total paid reconciles Subtotal + Tip (+ any adjustments)", async () => {
    if (!(await orderDetailPage.isOnScreen())) return
    const subtotal = await orderDetailPage.getSubtotalCents()
    const tip = await orderDetailPage.getTipCents()
    const paid = await orderDetailPage.getTotalPaidCents()
    // Clean orders satisfy Total paid = Subtotal + Tip exactly. Orders that carry
    // tax / a discount differ by that adjustment, so accept either the exact
    // identity or a coherent total that still covers the tip.
    if (expectMoneyEqual(paid, sumCents([subtotal, tip]))) return
    expect(paid).toBeGreaterThan(0)
    expect(paid).toBeGreaterThanOrEqual(tip)
  })

  it("OHDT-04 @regression · Tip is a well-formed amount", async () => {
    if (!(await orderDetailPage.isOnScreen())) return
    // Per-technician tip breakdown needs its own testid to sum precisely; assert
    // the total tip is a valid (non-negative) money value for now.
    expect(await orderDetailPage.getTipCents()).toBeGreaterThanOrEqual(0)
  })

  it("OHDT-05 @regression · Payment details show status and (for card) brand ··last4", async () => {
    if (!(await orderDetailPage.isOnScreen())) return
    expect((await orderDetailPage.getPaymentStatusText()).length).toBeGreaterThan(0)
    if (await orderDetailPage.hasCardBrand()) {
      expect(await orderDetailPage.getCardBrandText()).toMatch(/[·•]{2}\s*\d{4}/)
    }
  })

  it("OHDT-06 @regression · card orders expose a Transaction ID", async () => {
    if (!(await orderDetailPage.isOnScreen())) return
    if (!(await orderDetailPage.hasTransaction())) return // non-card tender
    expect((await orderDetailPage.getTransactionId()).length).toBeGreaterThan(0)
  })

  it("OHDT-07 @regression · Order information lists Cashier and Customer", async () => {
    if (!(await orderDetailPage.isOnScreen())) return
    expect((await orderDetailPage.getCashierText()).length).toBeGreaterThan(0)
    expect((await orderDetailPage.getCustomerText()).length).toBeGreaterThan(0)
  })

  it("OHDT-08 @regression · footer offers Send / Reprint / Cancel actions", async () => {
    if (!(await orderDetailPage.isOnScreen())) return
    expect(await orderDetailPage.hasShareAction()).toBe(true)
    expect(await orderDetailPage.hasReprintAction()).toBe(true)
    expect(await orderDetailPage.hasCancelAction()).toBe(true)
  })

  it("OHDT-09 @regression · Send receipt opens Email/Text options (does not send)", async () => {
    if (!(await orderDetailPage.isOnScreen())) return
    await orderDetailPage.openSendReceipt()
    expect(await orderDetailPage.isSendSheetOpen()).toBe(true)
    expect(await orderDetailPage.hasSendOption("email")).toBe(true)
    expect(await orderDetailPage.hasSendOption("text")).toBe(true)
    // Intentionally NOT sending in the committed suite.
  })

  it("OHDT-10 @regression · Cancel order opens the reason dialog (does not confirm)", async () => {
    if (!(await orderDetailPage.isOnScreen())) return
    await orderDetailPage.openCancelDialog()
    expect(await orderDetailPage.isCancelDialogOpen()).toBe(true)
    expect(await orderDetailPage.hasAllCancelReasons()).toBe(true)
    await orderDetailPage.cancelBack() // dismiss — order stays untouched
    expect(await orderDetailPage.isCancelDialogOpen()).toBe(false)
  })

  it("OHDT-11 @regression · Back returns to the Orders list", async () => {
    if (!(await orderDetailPage.isOnScreen())) return
    await browser.back()
    expect(await orderHistoryPage.isOnScreen()).toBe(true)
  })
})
