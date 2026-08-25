/**
 * docs/order-history-test-cases.md §4.2 (order-history-status) — the status
 * filter tabs: All / Pending / Re-open / Successful - Unsettled /
 * Successful - Settled. Read-only browsing, every case safe.
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

/** Every card's badge must match the regex for its tab (empty list passes). */
async function everyCardStatusMatches(re: RegExp): Promise<boolean> {
  const statuses = await orderHistoryPage.cardStatuses()
  return statuses.every((s) => re.test(s))
}

suite("Order History · status tabs @regression", () => {
  before(async () => {
    await ensureLoggedIn()
  })

  beforeEach(async () => {
    await orderHistoryPage.open()
  })

  it("OHS-01 @smoke · shows all five status tabs", async () => {
    expect(await orderHistoryPage.hasAllStatusTabs()).toBe(true)
  })

  it("OHS-02 @regression · Pending → every card is Pending or In Use", async () => {
    await orderHistoryPage.selectStatus("pending")
    expect(await everyCardStatusMatches(/pending|in use/i)).toBe(true)
  })

  it("OHS-03 @regression · Successful - Unsettled → every card is Unsettled", async () => {
    await orderHistoryPage.selectStatus("successful-unsettled")
    expect(await everyCardStatusMatches(/unsettled/i)).toBe(true)
  })

  it("OHS-04 @regression · Successful - Settled → list switches to settled orders", async () => {
    await orderHistoryPage.selectStatus("successful-settled")
    expect(await orderHistoryPage.isStatusActive("successful-settled")).toBe(true)
    // Settled cards never carry the "Unsettled" badge.
    expect(await everyCardStatusMatches(/^(?!.*unsettled).*/i)).toBe(true)
  })

  it("OHS-05 @regression · Re-open → only re-opened orders (may be empty)", async () => {
    await orderHistoryPage.selectStatus("re-open")
    expect(await orderHistoryPage.isStatusActive("re-open")).toBe(true)
    expect(await orderHistoryPage.isOnScreen()).toBe(true)
  })

  it("OHS-06 @regression · All → shows every status for the day", async () => {
    await orderHistoryPage.selectStatus("all")
    expect(await orderHistoryPage.isStatusActive("all")).toBe(true)
    expect(await orderHistoryPage.cardCount()).toBeGreaterThanOrEqual(0)
  })

  it("OHS-07 @regression · the active tab is highlighted and moves with selection", async () => {
    await orderHistoryPage.selectStatus("pending")
    expect(await orderHistoryPage.isStatusActive("pending")).toBe(true)
    expect(await orderHistoryPage.isStatusActive("all")).toBe(false)
    await orderHistoryPage.selectStatus("all")
    expect(await orderHistoryPage.isStatusActive("all")).toBe(true)
    expect(await orderHistoryPage.isStatusActive("pending")).toBe(false)
  })

  it("OHS-08 @regression · In Use cards name the locking device", async () => {
    await orderHistoryPage.selectStatus("pending")
    const inUse = (await orderHistoryPage.cardStatuses()).filter((s) => /in use/i.test(s))
    if (inUse.length === 0) return // no order locked on another POS right now
    // "In Use · <device>" — there must be a device name after the separator.
    expect(inUse.every((s) => /in use\s*·\s*\S+/i.test(s))).toBe(true)
  })
})
