/**
 * TEMP harvest — visit each Order-History surface (Orders list, a completed
 * order's detail/receipt, Customers, a customer profile) and dump ground-truth
 * selector facts to reports/page-source/harvest-order-history.json, so the
 * order-history page objects can be re-pointed from the §5 testid PROPOSALS at
 * the REAL text / data-slot / data-attr / aria hooks the app actually ships
 * (mirrors _harvest-payment-selectors.e2e.ts). Delete once converted.
 *
 * It auto-discovers ids: the first "/order/<id>" and "/customer/<id>" href on the
 * list screens drives the detail dumps. Override with HARVEST_ORDER_ID /
 * HARVEST_CUSTOMER_ID when the lists render no anchors.
 *
 * Run: npm run test:android:emu -- --spec ./src/specs/android/_harvest-order-history-selectors.e2e.ts
 * Read-only — never taps a mutate action (Cancel / Send / Apply-that-finalizes).
 */
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { androidAppShellPage } from "@pages"
import { ROUTES } from "../../constants/routes.js"
import { ensureLoggedIn } from "../../utils/ensure-logged-in.js"
import { logger } from "../../utils/logger.js"
import { sleep } from "../../utils/wait.js"

const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
const suite = WEBVIEW_READY ? describe : describe.skip
const OUT = path.resolve(process.cwd(), "reports/page-source")

/**
 * Generic DOM-fact collector — runs inside the webview. Surfaces the hooks a
 * page object could bind to: visible buttons (text + aria + data-slot + state),
 * inputs (placeholder), tab-like elements (role/aria-selected/data-active/state),
 * every distinct data-* attribute name, elements carrying data-order-id /
 * data-customer-id, summary-item breakdown rows, money-shaped leaf nodes, "#OD"
 * order-code leaves, and "/order|/customer" hrefs (for id discovery).
 */
function collectFacts(): Record<string, unknown> {
  const vis = (e: Element): boolean => (e as HTMLElement).offsetParent !== null
  const txt = (e: Element): string => (e.textContent || "").trim().replace(/\s+/g, " ")
  const attrs = (e: Element): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const a of Array.from(e.attributes)) {
      if (/^(data-|aria-|role$)/.test(a.name)) out[a.name] = a.value
    }
    return out
  }

  const summaryItems: Record<string, string> = {}
  document.querySelectorAll('[data-slot="summary-item"]').forEach((r) => {
    const s = r.querySelectorAll("span")
    if (s.length >= 2) summaryItems[txt(s[0])] = txt(s[s.length - 1])
  })

  const dataAttrNames = new Set<string>()
  document.querySelectorAll("*").forEach((e) => {
    for (const a of Array.from(e.attributes)) if (a.name.startsWith("data-")) dataAttrNames.add(a.name)
  })

  return {
    url: location.href,
    headers: Array.from(document.querySelectorAll("h1,h2,h3")).map(txt).filter(Boolean).slice(0, 20),
    buttons: Array.from(document.querySelectorAll("button"))
      .filter(vis)
      .map((b) => ({
        text: txt(b).slice(0, 40),
        aria: b.getAttribute("aria-label"),
        slot: b.getAttribute("data-slot"),
        state: b.getAttribute("data-state") || b.getAttribute("data-active") || b.getAttribute("aria-selected"),
        disabled: (b as HTMLButtonElement).disabled
      }))
      .slice(0, 60),
    inputs: Array.from(document.querySelectorAll("input")).map((i) => ({
      placeholder: (i as HTMLInputElement).placeholder,
      inputmode: i.getAttribute("inputmode"),
      slot: i.getAttribute("data-slot")
    })),
    // Tab-like elements (status tabs / profile tabs) — how does the app mark "active"?
    tabs: Array.from(document.querySelectorAll('[role="tab"],[data-slot*="tab"],[aria-selected]'))
      .filter(vis)
      .map((e) => ({ text: txt(e).slice(0, 30), ...attrs(e) }))
      .slice(0, 30),
    // Order cards / customer rows — the id-bearing containers.
    orderIdEls: Array.from(document.querySelectorAll("[data-order-id]"))
      .slice(0, 8)
      .map((e) => ({ id: e.getAttribute("data-order-id"), tag: e.tagName.toLowerCase(), text: txt(e).slice(0, 120) })),
    customerIdEls: Array.from(document.querySelectorAll("[data-customer-id]"))
      .slice(0, 8)
      .map((e) => ({ id: e.getAttribute("data-customer-id"), tag: e.tagName.toLowerCase(), text: txt(e).slice(0, 80) })),
    summaryItems,
    moneyLeaves: Array.from(document.querySelectorAll("*"))
      .filter((e) => vis(e) && e.children.length === 0 && /^-?\$[\d,]+\.\d{2}$/.test(txt(e)))
      .map((e) => ({ text: txt(e), tag: e.tagName.toLowerCase(), slot: e.getAttribute("data-slot"), cls: (e.className || "").toString().slice(0, 60) }))
      .slice(0, 16),
    orderCodeLeaves: Array.from(document.querySelectorAll("*"))
      .filter((e) => e.children.length === 0 && /#?OD\d{6}-\d{8}/.test(txt(e)))
      .map((e) => ({ text: txt(e), tag: e.tagName.toLowerCase(), ...attrs(e) }))
      .slice(0, 8),
    hrefs: Array.from(document.querySelectorAll('a[href*="/order/"],a[href*="/customer/"]'))
      .map((a) => a.getAttribute("href"))
      .filter((h): h is string => !!h)
      .slice(0, 12),
    dataAttrNames: Array.from(dataAttrNames).sort().slice(0, 60)
  }
}

/** Best-effort click a control by visible text or aria-label (reveals sheets). */
function clickByLabel(labels: string[]): boolean {
  const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ")
  const wanted = labels.map(norm)
  const els = Array.from(document.querySelectorAll("button,[role='button'],a")) as HTMLElement[]
  for (const el of els) {
    const text = norm(el.textContent || "")
    const aria = norm(el.getAttribute("aria-label") || "")
    if (wanted.some((w) => text === w || aria === w || aria.includes(w))) {
      el.click()
      return true
    }
  }
  return false
}

/** First "/order/<id>" or "/customer/<id>" id found in the current DOM hrefs.
 * `kind` is typed as string (not a literal union) to satisfy browser.execute's
 * argument transform typing. */
function discoverId(kind: string): string | null {
  const re = new RegExp(`/${kind}/([0-9a-zA-Z-]+)`)
  for (const a of Array.from(document.querySelectorAll(`a[href*="/${kind}/"]`))) {
    const m = (a.getAttribute("href") || "").match(re)
    if (m) return m[1]
  }
  const attr = kind === "order" ? "data-order-id" : "data-customer-id"
  const el = document.querySelector(`[${attr}]`)
  return el ? el.getAttribute(attr) : null
}

suite("_harvest order-history selectors", () => {
  before(async () => {
    await ensureLoggedIn()
    await androidAppShellPage.switchToWebview(30_000)
  })

  it("dumps facts for each Order-History surface", async () => {
    await mkdir(OUT, { recursive: true })
    const result: Record<string, unknown> = {}

    const dumpRoute = async (name: string, route: string): Promise<void> => {
      try {
        await browser.url(route)
        await sleep(1800) // SPA render settle — no known selector yet (that's what we harvest)
        result[name] = await browser.execute(collectFacts)
        logger.info(`[harvest] ${name} → ${(result[name] as { url: string }).url}`)
      } catch (err) {
        result[name] = { error: (err as Error).message }
        logger.warn(`[harvest] ${name} FAILED: ${(err as Error).message}`)
      }
    }

    const reveal = async (name: string, labels: string[]): Promise<void> => {
      try {
        const clicked = await browser.execute(clickByLabel, labels)
        await sleep(1200) // let the revealed sheet animate in
        result[name] = { clicked, ...(await browser.execute(collectFacts)) }
        logger.info(`[harvest] ${name} → clicked=${clicked}`)
      } catch (err) {
        result[name] = { error: (err as Error).message }
      }
    }

    // 1) Orders list, then reveal Search / Filter / Date picker in place.
    await dumpRoute("orders_list", ROUTES.APP.ORDERS)
    await reveal("orders_search_open", ["Search orders", "Search"])
    await dumpRoute("orders_list_again", ROUTES.APP.ORDERS) // reset before next reveal
    await reveal("orders_filter_open", ["Filter orders", "Filter"])
    await dumpRoute("orders_list_again2", ROUTES.APP.ORDERS)
    await reveal("orders_date_open", ["Today", "Select date", "Change date"])

    // 2) A completed order's detail (id discovered from the list, or overridden).
    let orderId: string | null = process.env.HARVEST_ORDER_ID || null
    if (!orderId) {
      await browser.url(ROUTES.APP.ORDERS)
      await sleep(1200)
      orderId = await browser.execute(discoverId, "order")
    }
    if (orderId) await dumpRoute("order_detail", ROUTES.APP.ORDER_DETAIL(orderId))
    else result["order_detail"] = { skipped: "no order id discovered — set HARVEST_ORDER_ID" }

    // 3) Customers list, then a customer profile + its Orders tab.
    await dumpRoute("customers_list", ROUTES.APP.CUSTOMERS)
    let customerId: string | null = process.env.HARVEST_CUSTOMER_ID || null
    if (!customerId) customerId = await browser.execute(discoverId, "customer")
    if (customerId) {
      await dumpRoute("customer_detail", ROUTES.APP.CUSTOMER_DETAIL(customerId))
      await reveal("customer_orders_tab", ["Orders"])
    } else {
      result["customer_detail"] = { skipped: "no customer id discovered — set HARVEST_CUSTOMER_ID" }
    }

    const file = path.join(OUT, "harvest-order-history.json")
    await writeFile(file, JSON.stringify(result, null, 2), "utf8")
    logger.info(`[harvest] wrote ${file}`)
  })
})
