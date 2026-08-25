/**
 * OrderHistoryPage — the Order-History browse surface: the Orders list with its
 * status-filter tabs, date navigation + Date picker, and the Search box
 * (docs/order-history-test-cases.md §2.1–2.4 and cases §4.1 / §4.2 / §4.3 / §4.5).
 *
 * Read-only browsing: no case here finalizes anything. Money getters return
 * **integer cents** parsed from the displayed "$X.XX".
 *
 * The current build ships NO per-card data-testid / data-order-id: a card is a
 * `button[data-slot="pressable"]` whose visible text concatenates
 *   #OD…code · customer · <badge status> · services · MM/DD/YYYY hh:mm AM/PM · $total
 * with the status in a `[data-slot="badge"]` span. Cards are therefore read by
 * parsing that text (anchored on the badge) and addressed by their #OD code —
 * `OrderCard.id` is the code, so specs keep addressing cards the same way.
 */
import { ROUTES } from "../../constants/routes.js"
import { SELECTORS } from "../../constants/selectors.js"
import { TIMEOUTS } from "../../constants/timeouts.js"
import { toCents } from "../../utils/currency.js"
import { androidAppShellPage } from "../android/app-shell.page.js"
import { BasePage } from "../base.page.js"

/** The status tabs whose presence the specs assert (doc §3). More ship
 * (Canceled, Refunded, …) but these five are the always-present browse set. */
export const STATUS_TABS = [
  "all",
  "pending",
  "re-open",
  "successful-unsettled",
  "successful-settled"
] as const

export type OrderHistoryStatus = (typeof STATUS_TABS)[number]

/** Orders-list URL status param, keyed by the spec's status key (harvested). */
const STATUS_PARAM: Record<string, string> = {
  all: "all",
  pending: "pending",
  "re-open": "re_open",
  "successful-unsettled": "successful",
  "successful-settled": "successful_settled",
  canceled: "canceled"
}

/** One order card's readable fields (doc §2.1 "giải phẫu order card"). */
export interface OrderCard {
  /** The #OD code, e.g. "#OD260812-32637619" — also how a card is addressed. */
  id: string
  code: string
  customer: string
  status: string
  services: string
  time: string
  totalCents: number
}

const ORDER_CODE_RE = /#?OD\d{6}-\d{8}/
const MONEY_RE = /-?\$[\d,]+\.\d{2}/g
const TIME_RE = /\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}\s+(?:AM|PM)/i

export class OrderHistoryPage extends BasePage {
  protected readonly pageName = "OrderHistoryPage"
  // The Filter icon button is unique to the Orders list — a stable root anchor.
  protected readonly rootSelector = SELECTORS.ORDER_HISTORY.FILTER_BTN

  /** Deep-link to the Orders list (switches into the webview first). */
  async open(): Promise<void> {
    await androidAppShellPage.switchToWebview()
    await browser.url(ROUTES.APP.ORDERS)
    await this.waitForLoaded()
  }

  async isOnScreen(): Promise<boolean> {
    return this.isLoaded()
  }

  // -------------------------------------------------------------- status tabs

  async hasStatusTab(key: OrderHistoryStatus | string): Promise<boolean> {
    return this.$(SELECTORS.ORDER_HISTORY.STATUS_TAB(key)).isExisting()
  }

  /** True when every one of the five known status tabs is present (§4.2.1). */
  async hasAllStatusTabs(): Promise<boolean> {
    for (const key of STATUS_TABS) {
      if (!(await this.hasStatusTab(key))) return false
    }
    return true
  }

  async selectStatus(key: OrderHistoryStatus | string): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_HISTORY.STATUS_TAB(key), `status tab ${key}`)
    // The tab drives the ?status= URL param + a list refetch — let it settle.
    await browser.pause(TIMEOUTS.ANIMATION * 2)
  }

  /** True when the given tab is the active one — determined by the ?status= URL
   * param the tab sets (§4.2.7), since the DOM active marker is a CSS class. */
  async isStatusActive(key: OrderHistoryStatus | string): Promise<boolean> {
    const url = await browser.getUrl()
    return url.includes(`status=${STATUS_PARAM[key] ?? key}`)
  }

  // -------------------------------------------------------------------- cards

  private async cardElements() {
    // .getElements() resolves the ChainablePromiseArray to a real array whose
    // `.length` is a number (the chainable's `.length` is a Promise).
    return this.$$(SELECTORS.ORDER_HISTORY.CARD_ANY).getElements()
  }

  async cardCount(): Promise<number> {
    return (await this.cardElements()).length
  }

  /** Parse a card element into its fields, anchored on the status `badge`. */
  private async parseCard(card: WebdriverIO.Element): Promise<OrderCard> {
    const text = (await card.getText()).replace(/\s+/g, " ").trim()
    const badgeEl = card.$(SELECTORS.ORDER_HISTORY.CARD_BADGE)
    const status = (await badgeEl.isExisting()) ? (await badgeEl.getText()).trim() : ""

    const code = text.match(ORDER_CODE_RE)?.[0] ?? ""
    const time = text.match(TIME_RE)?.[0] ?? ""
    const monies = text.match(MONEY_RE) ?? []
    const totalText = monies.length ? monies[monies.length - 1] : "$0.00"

    const codeEnd = code ? text.indexOf(code) + code.length : 0
    const badgeIdx = status ? text.indexOf(status, codeEnd) : -1
    const timeIdx = time ? text.indexOf(time) : text.length
    const customer = badgeIdx > codeEnd ? text.slice(codeEnd, badgeIdx).trim() : ""
    const servicesStart = badgeIdx >= 0 ? badgeIdx + status.length : codeEnd
    const services = timeIdx > servicesStart ? text.slice(servicesStart, timeIdx).trim() : ""

    return { id: code, code, customer, status, services, time, totalCents: toCents(totalText) }
  }

  /** The #OD code of the first card, or "" when the list is empty. */
  async firstCardId(): Promise<string> {
    const cards = await this.cardElements()
    if (cards.length === 0) return ""
    return (await this.parseCard(cards[0])).code
  }

  /** Every card's #OD code (for dedup / load-more checks). */
  async cardIds(): Promise<string[]> {
    const cards = await this.cardElements()
    const ids: string[] = []
    for (const card of cards) ids.push((await this.parseCard(card)).code)
    return ids
  }

  /** Read every visible field off the first card (§4.1.2). */
  async readFirstCard(): Promise<OrderCard> {
    const cards = await this.cardElements()
    if (cards.length === 0) throw new Error("[OrderHistoryPage] no order cards to read")
    return this.parseCard(cards[0])
  }

  /** True when the first card exposes its always-present fields — #OD code, a
   * status badge, a timestamp and a total (customer/services are optional). */
  async firstCardHasAllFields(): Promise<boolean> {
    const cards = await this.cardElements()
    if (cards.length === 0) return false
    const c = await this.parseCard(cards[0])
    return ORDER_CODE_RE.test(c.code) && c.status.length > 0 && TIME_RE.test(c.time) && c.totalCents >= 0
  }

  /** Raw total text of the first card, e.g. "$2,000.48" (§4.1.4 format check). */
  async firstCardTotalText(): Promise<string> {
    const cards = await this.cardElements()
    if (cards.length === 0) throw new Error("[OrderHistoryPage] no order cards to read")
    const text = (await cards[0].getText()).replace(/\s+/g, " ")
    const monies = text.match(MONEY_RE) ?? []
    return monies.length ? monies[monies.length - 1] : ""
  }

  /** Badge text of every card (§4.2.2/4.2.3 — assert they all match a status). */
  async cardStatuses(): Promise<string[]> {
    const cards = await this.cardElements()
    const out: string[] = []
    for (const card of cards) {
      const badge = card.$(SELECTORS.ORDER_HISTORY.CARD_BADGE)
      out.push((await badge.isExisting()) ? (await badge.getText()).trim() : "")
    }
    return out
  }

  /** True when a card with the given #OD code is present. */
  async hasCard(code: string): Promise<boolean> {
    const bare = code.replace(/^#/, "")
    return (await this.cardIds()).some((id) => id.replace(/^#/, "") === bare)
  }

  /** Tap the card carrying the given #OD code. */
  async openOrder(code: string): Promise<void> {
    const bare = code.replace(/^#/, "")
    const cards = await this.cardElements()
    for (const card of cards) {
      if ((await card.getText()).replace(/^#/, "").includes(bare)) {
        await card.scrollIntoView({ block: "center" })
        await card.click()
        return
      }
    }
    throw new Error(`[OrderHistoryPage] no card with code ${code}`)
  }

  /** Tap the first card and return the #OD code that was opened (§4.1.5). */
  async openFirstOrder(): Promise<string> {
    const cards = await this.cardElements()
    if (cards.length === 0) throw new Error("[OrderHistoryPage] no first card to open")
    const code = (await this.parseCard(cards[0])).code
    await cards[0].scrollIntoView({ block: "center" })
    await cards[0].click()
    return code
  }

  /** Empty state: no cards render (the empty-copy varies, so count is the signal). */
  async isEmpty(): Promise<boolean> {
    return (await this.cardCount()) === 0
  }

  /** Scroll the list to its end to trigger lazy loading (§4.1.6). */
  async scrollToEnd(): Promise<void> {
    const cards = await this.cardElements()
    if (cards.length === 0) return
    await cards[cards.length - 1].scrollIntoView({ block: "end" })
    await browser.pause(TIMEOUTS.ANIMATION)
  }

  // ------------------------------------------------------------- date nav

  /** The date-nav label text ("Today · Aug 12", "Aug 11", a range, …). Read via
   * DOM: the date-nav row's pressable that has no aria-label (the icon nav
   * buttons carry "Previous day"/"Next day"). Robust to the label reflowing when
   * a non-today day / range is applied. Returns "" if the row can't be found. */
  async getDateLabel(): Promise<string> {
    return browser.execute(() => {
      const prev = document.querySelector('[data-slot="pressable"][aria-label="Previous day"]')
      const next = document.querySelector('[data-slot="pressable"][aria-label="Next day"]')
      const scope = prev?.parentElement ?? next?.parentElement
      if (!scope) return ""
      const label = Array.from(scope.querySelectorAll('button[data-slot="pressable"]')).find(
        (b) => !b.getAttribute("aria-label")
      )
      return (label?.textContent || "").trim().replace(/\s+/g, " ")
    })
  }

  async isNextDayEnabled(): Promise<boolean> {
    return this.$(SELECTORS.ORDER_HISTORY.DATE_NEXT).isEnabled()
  }

  async previousDay(): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_HISTORY.DATE_PREV, "previous day")
    await browser.pause(TIMEOUTS.ANIMATION)
  }

  async nextDay(): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_HISTORY.DATE_NEXT, "next day")
    await browser.pause(TIMEOUTS.ANIMATION)
  }

  // --------------------------------------------------------- date picker sheet

  async openDatePicker(): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_HISTORY.DATE_LABEL, "date label")
  }

  async isDatePickerOpen(): Promise<boolean> {
    return this.$(SELECTORS.DATE_PICKER.SHEET).isExisting()
  }

  async selectPreset(preset: string): Promise<void> {
    await this.safeClick(SELECTORS.DATE_PICKER.PRESET(preset), `date preset ${preset}`)
    await browser.pause(TIMEOUTS.ANIMATION)
  }

  /** The aria-label of the calendar's currently-selected day (e.g.
   * "…, August 11th, 2026, selected"), or "" if none is marked. */
  async getSelectedDayLabel(): Promise<string> {
    const el = this.$(SELECTORS.DATE_PICKER.SELECTED_DAY)
    return (await el.isExisting()) ? ((await el.getAttribute("aria-label")) ?? "") : ""
  }

  /** Whether a specific ISO day cell is enabled — future days are disabled (§4.3.7). */
  async isDayEnabled(iso: string): Promise<boolean> {
    const cell = this.$(SELECTORS.DATE_PICKER.DAY(iso))
    if (!(await cell.isExisting())) return false
    return cell.isEnabled()
  }

  async selectDay(iso: string): Promise<void> {
    await this.safeClick(SELECTORS.DATE_PICKER.DAY(iso), `date day ${iso}`)
  }

  /** Apply the picked date → closes the sheet, reloads the list (§4.3.8). */
  async viewOrders(): Promise<void> {
    await this.safeClick(SELECTORS.DATE_PICKER.VIEW_ORDERS, "view orders")
    await this.$(SELECTORS.DATE_PICKER.SHEET)
      .waitForExist({ reverse: true, timeout: TIMEOUTS.SHORT })
      .catch(() => {})
    // Let the header re-render its date label + the list reload before asserting.
    await browser.pause(TIMEOUTS.ANIMATION * 2)
  }

  // ------------------------------------------------------------------ search

  async openSearch(): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_HISTORY.SEARCH_BTN, "search orders")
  }

  async isSearchOpen(): Promise<boolean> {
    return this.$(SELECTORS.ORDER_HISTORY.SEARCH_INPUT).isDisplayed()
  }

  async closeSearch(): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_HISTORY.SEARCH_CLOSE, "close search")
  }

  async search(query: string): Promise<void> {
    await this.safeFill(SELECTORS.ORDER_HISTORY.SEARCH_INPUT, query, "orders search input")
    // The list filters on a debounce — let it settle before asserting results.
    await browser.pause(TIMEOUTS.ANIMATION * 2)
  }

  async clearSearch(): Promise<void> {
    // clearValue()/backspacing don't reliably fire the React onChange for this
    // controlled input; set the value through React's native setter + dispatch the
    // `input` event it listens for — the canonical way to clear a controlled input.
    await browser.execute((sel: string) => {
      const el = document.querySelector(sel) as HTMLInputElement | null
      if (!el) return
      const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
      setValue?.call(el, "")
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }, SELECTORS.ORDER_HISTORY.SEARCH_INPUT)
    await browser.pause(TIMEOUTS.ANIMATION * 2)
  }

  // ------------------------------------------------------------------ filter

  async openFilter(): Promise<void> {
    await this.safeClick(SELECTORS.ORDER_HISTORY.FILTER_BTN, "filter orders")
  }
}

export const orderHistoryPage = new OrderHistoryPage()
