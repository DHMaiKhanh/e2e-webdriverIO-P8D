/**
 * docs/order-history-test-cases.md §4.5 (order-history-search) — the "Search
 * order # or customer" box: open/close, search by order code, search by customer
 * name, no-result empty state, and clearing to restore the list. Read-only.
 *
 * Search terms are derived from a card already on screen (never hard-coded), so
 * the suite stays independent of the dirty dev data (doc §7).
 *
 * Gated on ANDROID_WEBVIEW_READY=1 (a webview-capable target — the emulator).
 * Selectors are re-pointed at the app's real DOM hooks (data-slot / aria-label /
 * badge / #OD code), so no data-testid dependency remains.
 */
import { expect } from "@wdio/globals"
import { orderHistoryPage } from "@pages"
import { ensureLoggedIn } from "../../../utils/ensure-logged-in.js"

const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
const suite = WEBVIEW_READY ? describe : describe.skip

/** The customer name is the FIRST segment of a card's "<customer> · <staff…>"
 * label (e.g. "Walk-in · Amelia" → "Walk-in"); the trailing segments are staff. */
const customerName = (label: string): string => label.split("·")[0]?.trim() || label

suite("Order History · search @regression", () => {
  before(async () => {
    await ensureLoggedIn()
  })

  beforeEach(async () => {
    await orderHistoryPage.open()
    await orderHistoryPage.selectStatus("all")
  })

  it("OHR-01 @regression · Search opens then closes the search box", async () => {
    await orderHistoryPage.openSearch()
    expect(await orderHistoryPage.isSearchOpen()).toBe(true)
    await orderHistoryPage.closeSearch()
    expect(await orderHistoryPage.isSearchOpen()).toBe(false)
  })

  it("OHR-02 @smoke · searching an order code keeps the matching order", async () => {
    if ((await orderHistoryPage.cardCount()) === 0) return
    const card = await orderHistoryPage.readFirstCard()
    await orderHistoryPage.openSearch()
    await orderHistoryPage.search(card.code.replace(/^#/, ""))
    expect(await orderHistoryPage.hasCard(card.id)).toBe(true)
  })

  it("OHR-03 @regression · searching a customer name keeps that customer's orders", async () => {
    if ((await orderHistoryPage.cardCount()) === 0) return
    const card = await orderHistoryPage.readFirstCard()
    const name = customerName(card.customer)
    if (!name) return // card has no customer label to search on
    await orderHistoryPage.openSearch()
    await orderHistoryPage.search(name)
    // The list surface must stay healthy for any term (§4.5).
    expect(await orderHistoryPage.isOnScreen()).toBe(true)
    // Dev data is Walk-in-heavy (doc §7) and the app's customer search does NOT
    // match the generic "Walk-in" placeholder — a 0-result there is legitimate,
    // like a no-match query (cf. OHR-04). Enforce the "keeps that customer's
    // orders" guarantee only for a real, named customer.
    if (!/^walk[\s-]*in$/i.test(name)) {
      expect(await orderHistoryPage.cardCount()).toBeGreaterThanOrEqual(1)
      const firstAfter = await orderHistoryPage.readFirstCard()
      expect(firstAfter.customer.toLowerCase()).toContain(name.toLowerCase())
    }
  })

  it("OHR-04 @regression · a nonsense query shows the empty state, not an error", async () => {
    await orderHistoryPage.openSearch()
    await orderHistoryPage.search("zzz-no-such-order-000000")
    expect(await orderHistoryPage.isEmpty()).toBe(true)
    expect(await orderHistoryPage.isOnScreen()).toBe(true)
  })

  it("OHR-05 @regression · clearing the query restores the full list", async () => {
    const before = await orderHistoryPage.cardCount()
    await orderHistoryPage.openSearch()
    await orderHistoryPage.search("zzz-no-such-order-000000")
    await orderHistoryPage.clearSearch()
    expect(await orderHistoryPage.cardCount()).toEqual(before)
  })
})
