/**
 * docs/payment-test-cases.md §8.10 (OACT / OCAN / ORCP / OSND) — the detail of an
 * already-Paid order (Orders → Successful): Order info + totals + Payment
 * details, and the footer actions Cancel order / Reprint receipt / Share (Send
 * receipt — Email/Text only, no Print/No-receipt).
 *
 * ⚠️ SAFETY: [Cancel order] VOIDS + reverses a real payment (OCAN-04, `it.skip`);
 * [Send] emails/texts a real receipt (OSND-04, `it.skip`). Safe cases stop at the
 * dialog's [Back] and never send.
 *
 * Requires a settled order to open — set VOLT_TEST_PAID_ORDER to a Paid order id
 * on the isolated dev shop. GATING: also skipped until
 * ANDROID_WEBVIEW_READY=1 && VOLT_PAYMENT_TESTIDS=1.
 */
import { expect } from "@wdio/globals"
import { androidAppShellPage, orderDetailPage } from "@pages"
import { ROUTES } from "../../constants/routes.js"
import { ensureLoggedIn } from "../../utils/ensure-logged-in.js"

const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
const TESTIDS_LANDED = process.env.VOLT_PAYMENT_TESTIDS === "1"
const suite = WEBVIEW_READY && TESTIDS_LANDED ? describe : describe.skip

const PAID_ORDER_ID = process.env.VOLT_TEST_PAID_ORDER ?? ""

async function reachPaidOrderDetail(): Promise<void> {
  await ensureLoggedIn()
  await androidAppShellPage.switchToWebview()
  await browser.url(ROUTES.APP.ORDER_DETAIL(PAID_ORDER_ID))
  await orderDetailPage.waitForLoaded()
}

suite("Order actions — Cancel / Reprint / Send receipt", () => {
  beforeEach(async () => {
    await reachPaidOrderDetail()
  })

  it("OACT-01 @smoke · shows order info, totals and payment details", async () => {
    expect(await orderDetailPage.isOnScreen()).toBe(true)
    expect(await orderDetailPage.getTotalPaidCents()).toBeGreaterThan(0)
    expect((await orderDetailPage.getPaymentMethodText()).length).toBeGreaterThan(0)
  })

  it("OACT-02 @regression · Cancel / Reprint / Share actions are present", async () => {
    expect(await orderDetailPage.hasCancelAction()).toBe(true)
    expect(await orderDetailPage.hasReprintAction()).toBe(true)
    expect(await orderDetailPage.hasShareAction()).toBe(true)
  })

  it("OCAN-01 @smoke · Cancel order opens the confirm dialog", async () => {
    await orderDetailPage.openCancelDialog()
    expect(await orderDetailPage.isCancelDialogOpen()).toBe(true)
  })

  it("OCAN-02 @regression · shows all 7 reasons, default Customer request", async () => {
    await orderDetailPage.openCancelDialog()
    expect(await orderDetailPage.hasAllCancelReasons()).toBe(true)
    expect(await orderDetailPage.isReasonSelected("customer-request")).toBe(true)
  })

  it("OCAN-03 @smoke · Back closes the dialog, order stays Successful", async () => {
    await orderDetailPage.openCancelDialog()
    await orderDetailPage.cancelBack()
    expect(await orderDetailPage.isCancelDialogOpen()).toBe(false)
    expect(await orderDetailPage.isOnScreen()).toBe(true)
  })

  it("ORCP-01 @regression · Reprint receipt does not error on the emulator", async () => {
    await orderDetailPage.reprint()
    expect(await orderDetailPage.isOnScreen()).toBe(true)
  })

  it("OSND-01 @regression · Send receipt offers Email + Text only (no Print)", async () => {
    await orderDetailPage.openSendReceipt()
    expect(await orderDetailPage.hasSendOption("email")).toBe(true)
    expect(await orderDetailPage.hasSendOption("text")).toBe(true)
    expect(await orderDetailPage.hasPrintOption()).toBe(false)
  })

  it("OSND-02 @regression · Email requires a valid address before Send enables", async () => {
    await orderDetailPage.openSendReceipt()
    await orderDetailPage.selectSendReceipt("email")
    expect(await orderDetailPage.isSendEnabled()).toBe(false)
    await orderDetailPage.fillReceiptTarget("qa.receipt@example.com")
    expect(await orderDetailPage.isSendEnabled()).toBe(true)
  })

  it("OSND-03 @regression · Text receipt accepts a phone number", async () => {
    await orderDetailPage.openSendReceipt()
    await orderDetailPage.selectSendReceipt("text")
    await orderDetailPage.fillReceiptTarget("5551234567")
    expect(await orderDetailPage.isSendEnabled()).toBe(true)
    // Intentionally NOT tapping Send in the committed suite.
  })

  // ⚠️ OCAN-04: confirming voids the order + reverses payment. Isolated shop only.
  it.skip("OCAN-04 @regression · ⚠️ Cancel → order voided (isolated shop only)", async () => {
    await orderDetailPage.openCancelDialog()
    await orderDetailPage.selectCancelReason("customer-request")
    // Intentionally NOT tapping Cancel order (confirmCancel) in the committed suite.
  })

  // ⚠️ OSND-04: actually sends a real email/SMS — test address only.
  it.skip("OSND-04 @regression · ⚠️ Send delivers a real receipt (test address only)", async () => {
    await orderDetailPage.openSendReceipt()
    await orderDetailPage.selectSendReceipt("email")
    await orderDetailPage.fillReceiptTarget("qa.receipt@example.com")
    // Intentionally NOT tapping Send in the committed suite.
  })
})
