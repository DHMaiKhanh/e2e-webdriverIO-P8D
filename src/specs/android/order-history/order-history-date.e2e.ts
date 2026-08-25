/**
 * docs/order-history-test-cases.md §4.3 (order-history-date) — date navigation
 * (‹ / label / ›) and the "Select date" picker (presets + month calendar).
 * Read-only browsing, every case safe.
 *
 * Dates are computed RELATIVE to the run date (never hard-coded "Aug 11", per
 * doc §7). The emulator's system clock and the host clock are assumed aligned
 * (both are the dev-shop date); assertions prefer reading the on-screen label
 * over recomputing it where possible.
 *
 * Gated on ANDROID_WEBVIEW_READY=1 (a webview-capable target — the emulator).
 * Selectors are re-pointed at the app's real DOM hooks (data-slot / aria-label /
 * badge / #OD code), so no data-testid dependency remains.
 */
import { expect } from "@wdio/globals"
import { addDays, format, subDays } from "date-fns"
import { orderHistoryPage } from "@pages"
import { ensureLoggedIn } from "../../../utils/ensure-logged-in.js"

const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
const suite = WEBVIEW_READY ? describe : describe.skip

const iso = (d: Date): string => format(d, "yyyy-MM-dd")
// react-day-picker aria-label day form, e.g. "August 11th".
const longMonthDay = (d: Date): string => format(d, "MMMM do")

suite("Order History · date navigation @regression", () => {
  before(async () => {
    await ensureLoggedIn()
  })

  beforeEach(async () => {
    await orderHistoryPage.open()
  })

  it("OHD-01 @regression · defaults to Today", async () => {
    expect(await orderHistoryPage.getDateLabel()).toMatch(/today/i)
  })

  it("OHD-02 @regression · Previous day moves the label back one day", async () => {
    const today = await orderHistoryPage.getDateLabel()
    await orderHistoryPage.previousDay()
    const prev = await orderHistoryPage.getDateLabel()
    expect(prev).not.toEqual(today)
    expect(prev).not.toMatch(/today/i)
  })

  it("OHD-03 @regression · Next day is disabled on today (no future browsing)", async () => {
    expect(await orderHistoryPage.isNextDayEnabled()).toBe(false)
  })

  it("OHD-04 @smoke · date label opens the Select date picker", async () => {
    await orderHistoryPage.openDatePicker()
    expect(await orderHistoryPage.isDatePickerOpen()).toBe(true)
  })

  it("OHD-05 @regression · Yesterday preset selects yesterday", async () => {
    const yesterday = subDays(new Date(), 1)
    await orderHistoryPage.openDatePicker()
    await orderHistoryPage.selectPreset("yesterday")
    // If the picker stays open, the calendar marks yesterday as selected; either
    // way, applying it moves the list's date label off "Today".
    if (await orderHistoryPage.isDatePickerOpen()) {
      expect(await orderHistoryPage.getSelectedDayLabel()).toContain(longMonthDay(yesterday))
      await orderHistoryPage.viewOrders()
    }
    expect(await orderHistoryPage.getDateLabel()).not.toMatch(/today/i)
  })

  it("OHD-06 @regression · Last 7 days preset keeps the picker healthy", async () => {
    await orderHistoryPage.openDatePicker()
    await orderHistoryPage.selectPreset("last-7-days")
    if (await orderHistoryPage.isDatePickerOpen()) await orderHistoryPage.viewOrders()
    // The range preset applied without error: the picker closed and the Orders
    // list is still on screen (a range may replace the single-day nav label).
    expect(await orderHistoryPage.isDatePickerOpen()).toBe(false)
    expect(await orderHistoryPage.isOnScreen()).toBe(true)
  })

  it("OHD-07 @regression · future days are disabled in the calendar", async () => {
    const tomorrow = addDays(new Date(), 1)
    await orderHistoryPage.openDatePicker()
    expect(await orderHistoryPage.isDayEnabled(iso(tomorrow))).toBe(false)
  })

  it("OHD-08 @smoke · picking a past day + View orders reloads that day", async () => {
    const today = await orderHistoryPage.getDateLabel()
    const yesterday = subDays(new Date(), 1)
    await orderHistoryPage.openDatePicker()
    await orderHistoryPage.selectDay(iso(yesterday))
    await orderHistoryPage.viewOrders()
    expect(await orderHistoryPage.isDatePickerOpen()).toBe(false)
    expect(await orderHistoryPage.getDateLabel()).not.toEqual(today)
    expect(await orderHistoryPage.isOnScreen()).toBe(true)
  })
})
