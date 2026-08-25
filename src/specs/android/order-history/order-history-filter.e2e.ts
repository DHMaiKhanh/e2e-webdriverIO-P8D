/**
 * docs/order-history-test-cases.md §4.4 (order-history-filter) — the Filter sheet:
 * SORT BY (radio) / STAFF (multi + search) / PAYMENT METHOD (multi), Apply,
 * Clear all. Applying a filter is read-only + safe.
 *
 * Staff/payment values are dev-shop data — specs tick "the first staff" and the
 * fixed payment keys rather than hard-coding ephemeral names (doc §7). Because a
 * card doesn't show its staff, staff-filter cases assert the result set is a
 * subset (count never grows) + the sheet applied, not per-card staff identity.
 *
 * Gated on ANDROID_WEBVIEW_READY=1 (a webview-capable target — the emulator).
 * Selectors are re-pointed at the app's real DOM hooks (data-slot / aria-label /
 * badge / #OD code), so no data-testid dependency remains.
 */
import { expect } from "@wdio/globals"
import { orderFilterPage, orderHistoryPage } from "@pages"
import { ensureLoggedIn } from "../../../utils/ensure-logged-in.js"

const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
const suite = WEBVIEW_READY ? describe : describe.skip

suite("Order History · filter sheet @regression", () => {
  before(async () => {
    await ensureLoggedIn()
  })

  beforeEach(async () => {
    await orderHistoryPage.open()
    await orderHistoryPage.selectStatus("all")
  })

  it("OHF-01 @smoke · Filter sheet shows Sort / Staff / Payment + Apply / Clear all", async () => {
    await orderHistoryPage.openFilter()
    expect(await orderFilterPage.isOpen()).toBe(true)
    expect(await orderFilterPage.hasAllSections()).toBe(true)
  })

  it("OHF-02 @regression · Sort toggles between Date completed and Last updated", async () => {
    await orderHistoryPage.openFilter()
    await orderFilterPage.selectSort("last-updated")
    expect(await orderFilterPage.isSortSelected("last-updated")).toBe(true)
    expect(await orderFilterPage.isSortSelected("date-completed")).toBe(false)
    await orderFilterPage.selectSort("date-completed")
    expect(await orderFilterPage.isSortSelected("date-completed")).toBe(true)
  })

  it("OHF-03 @regression · filtering by one staff never grows the result set", async () => {
    const before = await orderHistoryPage.cardCount()
    await orderHistoryPage.openFilter()
    await orderFilterPage.toggleFirstStaff()
    await orderFilterPage.apply()
    expect(await orderHistoryPage.cardCount()).toBeLessThanOrEqual(before)
  })

  it("OHF-04 @regression · filtering by multiple staff (OR) applies", async () => {
    await orderHistoryPage.openFilter()
    const ticked = await orderFilterPage.toggleFirstStaffCount(2)
    expect(ticked).toBeGreaterThanOrEqual(1)
    await orderFilterPage.apply()
    expect(await orderHistoryPage.isOnScreen()).toBe(true)
  })

  it("OHF-05 @regression · staff search narrows the staff option list", async () => {
    await orderHistoryPage.openFilter()
    const all = await orderFilterPage.staffOptionCount()
    if (all === 0) return
    const first = await orderFilterPage.toggleFirstStaff() // read a real name to search for
    await orderFilterPage.toggleFirstStaff() // untick it again (leave state clean)
    await orderFilterPage.searchStaff(first.slice(0, 2))
    expect(await orderFilterPage.staffOptionCount()).toBeLessThanOrEqual(all)
  })

  it("OHF-06 @regression · filtering by payment method (Card) never grows the set", async () => {
    const before = await orderHistoryPage.cardCount()
    await orderHistoryPage.openFilter()
    await orderFilterPage.togglePayment("card")
    expect(await orderFilterPage.isPaymentChecked("card")).toBe(true)
    await orderFilterPage.apply()
    expect(await orderHistoryPage.cardCount()).toBeLessThanOrEqual(before)
  })

  it("OHF-07 @regression · combining Staff + Payment applies both", async () => {
    const before = await orderHistoryPage.cardCount()
    await orderHistoryPage.openFilter()
    await orderFilterPage.toggleFirstStaff()
    await orderFilterPage.togglePayment("card")
    await orderFilterPage.apply()
    expect(await orderHistoryPage.cardCount()).toBeLessThanOrEqual(before)
  })

  it("OHF-08 @smoke · Apply closes the sheet and returns to the list", async () => {
    await orderHistoryPage.openFilter()
    await orderFilterPage.togglePayment("cash")
    await orderFilterPage.apply()
    expect(await orderFilterPage.isOpen()).toBe(false)
    expect(await orderHistoryPage.isOnScreen()).toBe(true)
  })

  it("OHF-09 @regression · Clear all resets every selection", async () => {
    await orderHistoryPage.openFilter()
    await orderFilterPage.togglePayment("card")
    await orderFilterPage.toggleFirstStaff()
    await orderFilterPage.clearAll()
    expect(await orderFilterPage.isPaymentChecked("card")).toBe(false)
  })
})
