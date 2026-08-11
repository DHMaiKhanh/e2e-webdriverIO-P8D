/**
 * docs/payment-test-cases.md §8.2 (CASH-*) — the Cash tender, run BY CODE via
 * deep-link (Đường A2). No create-order wizard, no [Accept cash] (never
 * finalizes). Reaches the screen straight from the fixture order's route and
 * asserts state read from the real webview DOM.
 *
 * Gate: ANDROID_WEBVIEW_READY=1 (npm run test:android:emu). No testids needed.
 */
import { expect } from "@wdio/globals"
import { cashPaymentPage } from "@pages"
import { expectMoneyEqual, subtractCents } from "../../../utils/currency.js"
import { ensureLoggedIn } from "../../../utils/ensure-logged-in.js"
import { openTender } from "../../../utils/payment-fixture.js"

const suite = process.env.ANDROID_WEBVIEW_READY === "1" ? describe : describe.skip

suite("Cash payment · by code (deep-link, no finalize)", () => {
  before(async () => {
    await ensureLoggedIn()
  })

  beforeEach(async () => {
    await openTender("cash")
    await cashPaymentPage.waitForLoaded()
  })

  it("CASH-01 @smoke · shows every breakdown row", async () => {
    expect(await cashPaymentPage.hasBreakdownRows()).toBe(true)
  })

  it("CASH-02 @smoke · dual pricing: Amount due equals Subtotal", async () => {
    const subtotal = await cashPaymentPage.getSubtotalCents()
    const due = await cashPaymentPage.getAmountDueCents()
    expect(expectMoneyEqual(due, subtotal)).toBe(true)
  })

  it("CASH-03 @regression · defaults: $0 received, $0 change, Accept disabled", async () => {
    expect(await cashPaymentPage.getReceivedCents()).toBe(0)
    expect(await cashPaymentPage.getChangeDueCents()).toBe(0)
    expect(await cashPaymentPage.isAcceptEnabled()).toBe(false)
  })

  it("CASH-04 @regression · Quick cash Exact → received = due, change $0, Accept enabled", async () => {
    const due = await cashPaymentPage.getAmountDueCents()
    await cashPaymentPage.enterQuickCash("Exact")
    expect(expectMoneyEqual(await cashPaymentPage.getReceivedCents(), due)).toBe(true)
    expect(await cashPaymentPage.getChangeDueCents()).toBe(0)
    expect(await cashPaymentPage.isAcceptEnabled()).toBe(true)
  })

  it("CASH-05 @smoke · Quick cash $100 → change = 100 − amount due", async () => {
    const due = await cashPaymentPage.getAmountDueCents()
    await cashPaymentPage.enterQuickCash("100")
    expect(await cashPaymentPage.getReceivedCents()).toBe(10000)
    expect(expectMoneyEqual(await cashPaymentPage.getChangeDueCents(), subtractCents(10000, due))).toBe(true)
  })

  it("CASH-06 @regression · Quick cash $120 / $150 → change = amount − due", async () => {
    const due = await cashPaymentPage.getAmountDueCents()
    for (const [label, received] of [
      ["120", 12000],
      ["150", 15000]
    ] as const) {
      await cashPaymentPage.enterQuickCash(label)
      expect(await cashPaymentPage.getReceivedCents()).toBe(received)
      expect(expectMoneyEqual(await cashPaymentPage.getChangeDueCents(), subtractCents(received, due))).toBe(true)
    }
  })

  it("CASH-07 @regression · keypad entry updates CASH RECEIVED", async () => {
    await cashPaymentPage.typeAmount("1500") // → $15.00
    expect(await cashPaymentPage.getReceivedCents()).toBe(1500)
  })

  it("CASH-08 @regression · insufficient cash keeps Accept disabled", async () => {
    await cashPaymentPage.typeAmount("1") // 1 cent — below any real amount due
    const due = await cashPaymentPage.getAmountDueCents()
    expect(await cashPaymentPage.getReceivedCents()).toBeLessThan(due)
    expect(await cashPaymentPage.isAcceptEnabled()).toBe(false)
  })
})
