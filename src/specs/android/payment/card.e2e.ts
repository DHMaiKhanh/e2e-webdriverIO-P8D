/**
 * docs/payment-test-cases.md §8.6 (CARD-*) — the Card tender, run BY CODE via
 * deep-link (Đường A2). On the emulator there is no Kozen P8 terminal, so a card
 * sale can never be completed. Since the 2026-08 UI change (VP-2191) the screen
 * has TWO states — BLOCKED ("Card payment unavailable" + "Choose another
 * method") and IDLE (a disabled "Charge · $X" + a "Tip" button). These cases
 * assert the invariant across both. The real tap/swipe flow is device-only
 * (CARD-06/07, it.skip).
 *
 * Route /order/<id>/payment/card confirmed live (reports/rescan/card-probe.json).
 * CARD-01 (compare method-tile amounts) needs the Payment-method tiles, which are
 * non-<button> nodes without a stable hook, so it stays out until those land.
 *
 * Gate: ANDROID_WEBVIEW_READY=1 (npm run test:android:emu). No testids needed.
 */
import { expect } from "@wdio/globals"
import { androidAppShellPage, cardPaymentPage } from "@pages"
import { ensureLoggedIn } from "../../../utils/ensure-logged-in.js"
import { FIXTURE_ORDER_ID } from "../../../utils/payment-fixture.js"

const suite = process.env.ANDROID_WEBVIEW_READY === "1" ? describe : describe.skip

suite("Card payment · by code (deep-link, unavailable state)", () => {
  before(async () => {
    await ensureLoggedIn()
  })

  beforeEach(async () => {
    // Bounce through the order route first so the Card screen re-mounts fresh.
    await androidAppShellPage.switchToWebview()
    await browser.url(`/order/${FIXTURE_ORDER_ID}`)
    await browser.url(`/order/${FIXTURE_ORDER_ID}/payment/card`)
    await cardPaymentPage.waitForLoaded()
  })

  it("CARD-02 @regression · deep-link lands on the Card payment screen", async () => {
    expect(await cardPaymentPage.isOnScreen()).toBe(true)
  })

  it("CARD-03 @smoke · shows the card charge interface (UI only — never charges)", async () => {
    // Card is verified at the INTERFACE level ONLY: a paired terminal could
    // charge a LIVE card, so a spec must never complete one (no Charge tap).
    // Assert the screen presents its card-payment UI — the Charge action (idle)
    // or the "unavailable" note (blocked). Both are safe, tap-free checks.
    const hasChargeUi = await cardPaymentPage.hasChargeButton()
    const unavailable = await cardPaymentPage.isUnavailable()
    expect(hasChargeUi || unavailable).toBe(true)
  })

  it("CARD-05 @regression · no manual card-entry form (card is terminal-only)", async () => {
    expect(await androidAppShellPage.getBodyText()).not.toContain("Card number")
  })

  it("CARD-04 @smoke · leaving the Card screen navigates away from /payment/card", async () => {
    await cardPaymentPage.leaveScreen()
    await browser.waitUntil(async () => !(await browser.getUrl()).includes("/payment/card"), {
      timeout: 10_000,
      timeoutMsg: "leaving the Card screen did not navigate away from /payment/card"
    })
    expect((await browser.getUrl()).includes("/payment/card")).toBe(false)
  })

  // 📱 device-only: needs a real device paired with a Kozen P8 + BambooPay —
  // not runnable on the emulator (there is no card terminal).
  it.skip("CARD-06 @regression · 📱 paired terminal makes Card available", () => {})
  it.skip("CARD-07 @regression · 📱 successful card payment settles the order", () => {})
})
