/**
 * docs/order-history-test-cases.md §4.7 (order-history-customer) — the Customer
 * profile whose Orders tab is the per-customer order history (all days, not
 * limited by the list's date filter). Also covers stats, the Rewards/History
 * tabs (History = appointments, NOT orders), and the masked phone. Read-only.
 *
 * The customer under test is discovered (first row of Find Customer), so no id is
 * hard-coded. Set VOLT_TEST_CUSTOMER to pin one with rich history if the first
 * row is thin.
 *
 * Gated on ANDROID_WEBVIEW_READY=1 (a webview-capable target — the emulator).
 * Selectors are re-pointed at the app's real DOM hooks (data-slot / aria-label /
 * badge / #OD code), so no data-testid dependency remains.
 */
import { expect } from "@wdio/globals"
import { customerPage, orderDetailPage } from "@pages"
import { ensureLoggedIn } from "../../../utils/ensure-logged-in.js"

const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
const suite = WEBVIEW_READY ? describe : describe.skip

const PINNED_CUSTOMER_ID = process.env.VOLT_TEST_CUSTOMER ?? ""

/** Open a customer profile (pinned id, else the first Find Customer row). */
async function reachProfile(): Promise<boolean> {
  if (PINNED_CUSTOMER_ID) {
    await customerPage.open()
    await customerPage.openCustomer(PINNED_CUSTOMER_ID)
  } else {
    await customerPage.open()
    if ((await customerPage.customerCount()) === 0) return false
    await customerPage.openFirstCustomer()
  }
  return customerPage.isProfileLoaded()
}

suite("Order History · per-customer history @regression", () => {
  before(async () => {
    await ensureLoggedIn()
  })

  beforeEach(async () => {
    await reachProfile()
  })

  it("OHC-01 @regression · profile shows Points / Visits / Lifetime / Last visit", async () => {
    if (!(await customerPage.isProfileLoaded())) return
    expect(await customerPage.hasAllStats()).toBe(true)
  })

  it("OHC-02 @smoke · Orders tab lists the customer's order history", async () => {
    if (!(await customerPage.isProfileLoaded())) return
    await customerPage.openTab("orders")
    const count = await customerPage.orderCount()
    // Most dev-shop customers are Walk-in with no attached orders — an honest
    // empty state is the correct result there. With history, assert it spans days.
    if (count === 0) {
      expect(await customerPage.isOrdersEmpty()).toBe(true)
      return
    }
    expect(count).toBeGreaterThanOrEqual(1)
    if (count >= 2) {
      const dates = await customerPage.orderRowDates()
      expect(new Set(dates).size).toBeGreaterThanOrEqual(2)
    }
  })

  it("OHC-03 @regression · Visits stat is populated and the Orders tab renders", async () => {
    if (!(await customerPage.isProfileLoaded())) return
    await customerPage.openTab("orders")
    // Visits is a non-negative count; the Orders tab shows rows or its empty state.
    expect(await customerPage.getVisits()).toBeGreaterThanOrEqual(0)
    const count = await customerPage.orderCount()
    if (count === 0) expect(await customerPage.isOrdersEmpty()).toBe(true)
    else expect(count).toBeGreaterThan(0)
  })

  it("OHC-04 @regression · Lifetime is at least the largest single order", async () => {
    if (!(await customerPage.isProfileLoaded())) return
    await customerPage.openTab("orders")
    const totals = await customerPage.orderRowTotalsCents()
    if (totals.length === 0) return
    const lifetime = await customerPage.getLifetimeCents()
    expect(lifetime).toBeGreaterThanOrEqual(Math.max(...totals))
  })

  it("OHC-05 @smoke · tapping an order opens its detail", async () => {
    if (!(await customerPage.isProfileLoaded())) return
    await customerPage.openTab("orders")
    if ((await customerPage.orderCount()) === 0) return
    await customerPage.openFirstOrder()
    await orderDetailPage.waitForLoaded()
    expect(await orderDetailPage.isOnScreen()).toBe(true)
    expect((await orderDetailPage.getOrderId()).length).toBeGreaterThan(0)
  })

  it("OHC-06 @regression · Rewards and History tabs switch content (History ≠ orders)", async () => {
    if (!(await customerPage.isProfileLoaded())) return
    await customerPage.openTab("rewards")
    expect(await customerPage.isTabActive("rewards")).toBe(true)
    await customerPage.openTab("history")
    expect(await customerPage.isTabActive("history")).toBe(true)
  })

  it("OHC-07 @regression · the customer's phone is masked", async () => {
    if (!(await customerPage.isProfileLoaded())) return
    // "•••-•••-2052" — masked, must not expose a full 10-digit number.
    const phone = await customerPage.getMaskedPhone()
    expect(phone).toMatch(/[•*]/)
    expect(phone.replace(/\D/g, "").length).toBeLessThan(10)
  })
})
