/**
 * CustomerPage — Find Customer + Customer profile, whose **Orders** tab is the
 * per-customer order history (docs/order-history-test-cases.md §2.6, §4.7). The
 * profile also carries stats (Points / Visits / Lifetime / Last visit) and the
 * Rewards / History tabs (History = appointments, NOT orders).
 *
 * Read-only. Money/number getters return **integer cents** / parsed ints.
 *
 * Real hooks (harvested — no data-testid / data-customer-id ships): the Find
 * Customer rows and per-customer order rows are content-area `pressable`s
 * (addressed positionally); the profile route is `/customers/<id>`; the tab bar
 * is `segment-tabs-trigger` (data-state active/inactive); and the four stat tiles
 * have NO hooks, so their values are read by locating the label text and taking
 * the adjacent value node (see `statValue`).
 */
import { ROUTES } from "../constants/routes.js"
import { SELECTORS } from "../constants/selectors.js"
import { TIMEOUTS } from "../constants/timeouts.js"
import { toCents } from "../utils/currency.js"
import { androidAppShellPage } from "./android/app-shell.page.js"
import { BasePage } from "./base.page.js"

/** Profile tabs (doc §2.6). */
export type CustomerTab = "orders" | "rewards" | "history"

const DATE_RE = /\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Z][a-z]{2}\s+\d{1,2},?\s+\d{4}/
const MONEY_RE = /-?\$[\d,]+\.\d{2}/g

export class CustomerPage extends BasePage {
  protected readonly pageName = "CustomerPage"
  // The name/phone search box is unique to Find Customer → good root anchor.
  protected readonly rootSelector = SELECTORS.CUSTOMER.SEARCH_INPUT

  /** Deep-link to Find Customer (switches into the webview first). */
  async open(): Promise<void> {
    await androidAppShellPage.switchToWebview()
    await browser.url(ROUTES.APP.CUSTOMERS)
    await this.waitForLoaded()
  }

  async isOnFindCustomer(): Promise<boolean> {
    return this.isLoaded()
  }

  // ------------------------------------------------------------ find customer

  async searchCustomer(query: string): Promise<void> {
    await this.safeFill(SELECTORS.CUSTOMER.SEARCH_INPUT, query, "customer search")
    await browser.pause(TIMEOUTS.ANIMATION * 2)
  }

  private async customerRows() {
    return this.$$(SELECTORS.CUSTOMER.ROW_ANY).getElements()
  }

  async customerCount(): Promise<number> {
    return (await this.customerRows()).length
  }

  /** Open a pinned customer by id (profile route is /customers/<id>). */
  async openCustomer(id: string): Promise<void> {
    await browser.url(`${ROUTES.APP.CUSTOMERS}/${id}`)
    await browser.pause(TIMEOUTS.ANIMATION * 2)
  }

  /** Open the first customer row (no id ships — addressed positionally). */
  async openFirstCustomer(): Promise<string> {
    const rows = await this.customerRows()
    if (rows.length === 0) throw new Error("[CustomerPage] no customer rows to open")
    await rows[0].click()
    await browser.pause(TIMEOUTS.ANIMATION * 2)
    return (await browser.getUrl()).split("/").pop() ?? ""
  }

  // ---------------------------------------------------------------- profile

  async isProfileLoaded(): Promise<boolean> {
    return this.$(SELECTORS.CUSTOMER.STAT_ROOT)
      .waitForExist({ timeout: TIMEOUTS.MEDIUM })
      .then(
        () => true,
        () => false
      )
  }

  /** Read a stat-tile value by locating its label node and taking the adjacent
   * value node (the tiles have no data hooks). "" when the label isn't found. */
  private async statValue(label: string): Promise<string> {
    return browser.execute((lab: string) => {
      const nodes = Array.from(document.querySelectorAll("span,div,p"))
      const el = nodes.find((n) => (n.textContent || "").trim() === lab)
      if (!el) return ""
      const prev = el.previousElementSibling
      if (prev && (prev.textContent || "").trim()) return (prev.textContent || "").trim()
      const parent = el.parentElement
      if (parent) {
        const kids = Array.from(parent.children).map((c) => (c.textContent || "").trim())
        const i = kids.indexOf(lab)
        if (i > 0) return kids[i - 1]
      }
      return ""
    }, label)
  }

  /** True when all four stat tiles render a value (§4.7.1). */
  async hasAllStats(): Promise<boolean> {
    for (const label of ["Points", "Visits", "Lifetime", "Last visit"]) {
      if ((await this.statValue(label)).length === 0) return false
    }
    return true
  }

  async getVisits(): Promise<number> {
    return Number.parseInt((await this.statValue("Visits")).replace(/[^\d]/g, ""), 10) || 0
  }

  async getLifetimeCents(): Promise<number> {
    const t = await this.statValue("Lifetime")
    return /\$/.test(t) ? toCents(t) : 0
  }

  /** The masked phone shown on the profile — "•••-•••-8888" (§4.7.7). */
  async getMaskedPhone(): Promise<string> {
    return this.$(SELECTORS.CUSTOMER.PHONE).getText()
  }

  // ------------------------------------------------------------------ tabs

  async openTab(tab: CustomerTab): Promise<void> {
    await this.safeClick(SELECTORS.CUSTOMER.PROFILE_TAB(tab), `customer tab ${tab}`)
    await browser.pause(TIMEOUTS.ANIMATION)
  }

  async isTabActive(tab: CustomerTab): Promise<boolean> {
    const state = await this.$(SELECTORS.CUSTOMER.PROFILE_TAB(tab)).getAttribute("data-state")
    return state === "active"
  }

  // --------------------------------------------------- Orders tab (history)

  private async orderRows() {
    // Segment-tab panels can stay mounted, so keep only the VISIBLE rows (the
    // active Orders panel) — hidden Rewards/History pressables must not count.
    const all = await this.$$(SELECTORS.CUSTOMER.ORDER_ROW_ANY).getElements()
    const visible: WebdriverIO.Element[] = []
    for (const el of all) if (await el.isDisplayed()) visible.push(el)
    return visible
  }

  async orderCount(): Promise<number> {
    return (await this.orderRows()).length
  }

  /** True when the Orders tab shows its "No orders yet" empty state (§4.7.2). */
  async isOrdersEmpty(): Promise<boolean> {
    return this.$(SELECTORS.CUSTOMER.ORDER_EMPTY).isExisting()
  }

  /** The date label of every order row (§4.7.2 — assert spans multiple days). */
  async orderRowDates(): Promise<string[]> {
    const rows = await this.orderRows()
    const out: string[] = []
    for (const row of rows) {
      const text = (await row.getText()).replace(/\s+/g, " ")
      out.push(text.match(DATE_RE)?.[0] ?? text)
    }
    return out
  }

  /** The total of every order row, in cents (§4.7.4 — Σ ≈ Lifetime). */
  async orderRowTotalsCents(): Promise<number[]> {
    const rows = await this.orderRows()
    const out: number[] = []
    for (const row of rows) {
      const monies = (await row.getText()).replace(/\s+/g, " ").match(MONEY_RE) ?? []
      out.push(monies.length ? toCents(monies[monies.length - 1]) : 0)
    }
    return out
  }

  /** Open the first history order (§4.7.5). */
  async openFirstOrder(): Promise<void> {
    const rows = await this.orderRows()
    if (rows.length === 0) throw new Error("[CustomerPage] no order rows to open")
    await rows[0].scrollIntoView({ block: "center" })
    await rows[0].click()
  }
}

export const customerPage = new CustomerPage()
