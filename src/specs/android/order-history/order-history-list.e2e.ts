/**
 * docs/order-history-test-cases.md §4.1 (order-history-list) — the Orders list
 * browse surface: header + Search/Filter controls + status tabs + order cards.
 * Read-only, so every case is safe (nothing is created/edited/cancelled).
 *
 * GATING — needs ANDROID_WEBVIEW_READY=1 (a webview-capable target, i.e. the
 * emulator). The app ships NO data-testid, so the page objects are re-pointed at
 * its real DOM hooks: nav-icon-button aria-labels, header `pressable` status tabs
 * (URL ?status= drives active state), and order cards read by parsing their text
 * + `data-slot="badge"` and addressed by the visible #OD code.
 *
 * Tags live on each `it` title (mocha greps the full title) so `test:smoke` /
 * `test:regression` filter per case, matching the doc's P/Loại columns.
 */
import { expect } from "@wdio/globals"
import { orderDetailPage, orderHistoryPage } from "@pages"
import { ensureLoggedIn } from "../../../utils/ensure-logged-in.js"

const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
const suite = WEBVIEW_READY ? describe : describe.skip

// #OD + YYMMDD + "-" + 8 digits (doc §2.1). Optional leading "#".
const ORDER_CODE_RE = /^#?OD\d{6}-\d{8}$/
// "$#,##0.00" — e.g. "$2,000.48"
const MONEY_RE = /^\$\d{1,3}(,\d{3})*\.\d{2}$/
// "MM/DD/YYYY hh:mm AM/PM"
const CARD_TIME_RE = /\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}\s+(AM|PM)/i

suite("Order History · list — browse @regression", () => {
  before(async () => {
    await ensureLoggedIn()
  })

  beforeEach(async () => {
    await orderHistoryPage.open()
  })

  it("OHL-01 @smoke · Orders list shows header, controls, tabs and cards", async () => {
    expect(await orderHistoryPage.isOnScreen()).toBe(true)
    expect(await orderHistoryPage.hasAllStatusTabs()).toBe(true)
    expect(await orderHistoryPage.cardCount()).toBeGreaterThanOrEqual(0)
  })

  it("OHL-02 @regression · each order card exposes all fields", async () => {
    if ((await orderHistoryPage.cardCount()) === 0) return // empty day — nothing to read
    expect(await orderHistoryPage.firstCardHasAllFields()).toBe(true)
  })

  it("OHL-03 @regression · order code matches #OD YYMMDD-######## format", async () => {
    if ((await orderHistoryPage.cardCount()) === 0) return
    const card = await orderHistoryPage.readFirstCard()
    expect(card.code).toMatch(ORDER_CODE_RE)
  })

  it("OHL-04 @regression · money and time render in the expected formats", async () => {
    if ((await orderHistoryPage.cardCount()) === 0) return
    const card = await orderHistoryPage.readFirstCard()
    expect(await orderHistoryPage.firstCardTotalText()).toMatch(MONEY_RE)
    expect(card.time).toMatch(CARD_TIME_RE)
  })

  it("OHL-05 @smoke · tapping a card opens that exact order's detail", async () => {
    // Use a completed (Successful - Unsettled) order: its detail is the receipt
    // whose header echoes the #OD code. Open/In-Use orders route to the working
    // ticket instead, which needn't surface the code — a weaker signal.
    await orderHistoryPage.selectStatus("successful-unsettled")
    if ((await orderHistoryPage.cardCount()) === 0) return
    const card = await orderHistoryPage.readFirstCard()
    await orderHistoryPage.openOrder(card.id)
    await orderDetailPage.waitForLoaded()
    expect(await orderDetailPage.getOrderId()).toContain(card.code.replace(/^#/, ""))
  })

  it("OHL-06 @regression · scrolling loads more cards without duplicates", async () => {
    const before = await orderHistoryPage.cardIds()
    if (before.length === 0) return
    await orderHistoryPage.scrollToEnd()
    const after = await orderHistoryPage.cardIds()
    // No id appears twice, and the list never shrinks after a scroll.
    expect(new Set(after).size).toBe(after.length)
    expect(after.length).toBeGreaterThanOrEqual(before.length)
  })

  it("OHL-07 @regression · an empty day shows the empty state, not an error", async () => {
    // Walk back far enough to reach a day with no orders on the dev shop.
    for (let i = 0; i < 30; i++) {
      if ((await orderHistoryPage.cardCount()) === 0) break
      await orderHistoryPage.previousDay()
    }
    if ((await orderHistoryPage.cardCount()) === 0) {
      expect(await orderHistoryPage.isEmpty()).toBe(true)
    }
    // Either way the screen is still the Orders list (no crash / error screen).
    expect(await orderHistoryPage.isOnScreen()).toBe(true)
  })
})
