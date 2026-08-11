/**
 * docs/payment-test-cases.md §8.4 (OTH-*) — the Other tender, run BY CODE via
 * deep-link (Đường A2). No wizard, no [Record payment] (never finalizes).
 * Other keeps the service fee (card price) and has NO cash discount.
 *
 * Gate: ANDROID_WEBVIEW_READY=1 (npm run test:android:emu).
 */
import { expect } from "@wdio/globals"
import { otherPaymentPage } from "@pages"
import { expectMoneyEqual, sumCents } from "../../../utils/currency.js"
import { ensureLoggedIn } from "../../../utils/ensure-logged-in.js"
import { openTender } from "../../../utils/payment-fixture.js"
import { readSummaryCents } from "../../../utils/tender-webview.js"

const suite = process.env.ANDROID_WEBVIEW_READY === "1" ? describe : describe.skip

suite("Other payment · by code (deep-link, no finalize)", () => {
  before(async () => {
    await ensureLoggedIn()
  })

  beforeEach(async () => {
    await openTender("other")
    await otherPaymentPage.waitForLoaded()
  })

  it("OTH-01 @smoke · dual pricing: Amount due = Subtotal + Service fee (keeps fee)", async () => {
    const subtotal = await otherPaymentPage.getSubtotalCents()
    const fee = await readSummaryCents(/service fee/i)
    const due = await otherPaymentPage.getAmountDueCents()
    expect(expectMoneyEqual(due, sumCents([subtotal, fee]))).toBe(true)
  })

  it("OTH-02 @regression · has NO cash-discount row (unlike Cash)", async () => {
    expect(await otherPaymentPage.hasCashDiscountRow()).toBe(false)
  })

  it("OTH-03 @regression · defaults: received pre-filled to due, remaining $0, Record enabled", async () => {
    const due = await otherPaymentPage.getAmountDueCents()
    expect(expectMoneyEqual(await otherPaymentPage.getReceivedCents(), due)).toBe(true)
    expect(await otherPaymentPage.getRemainingCents()).toBe(0)
    expect(await otherPaymentPage.isRecordEnabled()).toBe(true)
  })

  it("OTH-04 @regression · Clear → received $0, remaining = due, Record disabled", async () => {
    const due = await otherPaymentPage.getAmountDueCents()
    await otherPaymentPage.clear()
    expect(await otherPaymentPage.getReceivedCents()).toBe(0)
    expect(expectMoneyEqual(await otherPaymentPage.getRemainingCents(), due)).toBe(true)
    expect(await otherPaymentPage.isRecordEnabled()).toBe(false)
  })

  it("OTH-05 @regression · keypad after Clear updates amount received", async () => {
    await otherPaymentPage.clear()
    await otherPaymentPage.typeAmount("500") // → $5.00
    expect(await otherPaymentPage.getReceivedCents()).toBe(500)
  })

  it("OTH-07 @regression · backspace removes the last entered digit", async () => {
    await otherPaymentPage.clear()
    await otherPaymentPage.typeAmount("500") // → $5.00
    await otherPaymentPage.backspace() // drop the trailing digit → $0.50
    expect(await otherPaymentPage.getReceivedCents()).toBe(50)
  })
})
