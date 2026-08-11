/**
 * SPIKE (Đường A2) — prove the payment suite can run "by code" TODAY.
 *
 * Discovery (2026-08-04): the P8D Tauri WebView DOES expose a debuggable,
 * queryable DOM over CDP (chrome://inspect socket is live, url is
 * http://tauri.localhost/...). docs/payment-test-cases.md §0's "WebView đục,
 * css không chạy" is outdated. The ONLY thing missing is `data-testid`s — but
 * text/structural selectors work now, so WDIO can drive + assert real payment
 * screens without waiting on the app.
 *
 * This spike does two things, staged so a failure is informative:
 *   1. Proves WDIO (via chromedriver, not raw CDP) reads the webview DOM.
 *   2. Reads a REAL Cash-payment breakdown by code and asserts dual pricing
 *      (CASH-01 rows present + CASH-02 Amount due == Subtotal), driving the
 *      existing open draft order — NO tender is finalized.
 *
 * It reuses an already-open draft order via deep link (SPA route). Set
 * SPIKE_ORDER_ID to the current open order if the hard-coded one is gone.
 *
 * Run: npm run test:android:emu -- --spec ./src/specs/android/webview-code-path-spike.e2e.ts
 */
import { expect } from "@wdio/globals"
import { androidAppShellPage } from "@pages"
import { ensureLoggedIn } from "../../utils/ensure-logged-in.js"
import { logger } from "../../utils/logger.js"

const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
const suite = WEBVIEW_READY ? describe : describe.skip

// Open draft order captured live from CDP. Override via env if it changed.
const ORDER_ID = process.env.SPIKE_ORDER_ID || "019fcc5a-7f27-748a-893b-5c86aa98ad77"

/** Read the "$X.XX" breakdown rows (data-slot="summary-item") as {label: text}. */
const readBreakdown = () =>
  browser.execute(() => {
    const rows = Array.from(document.querySelectorAll('[data-slot="summary-item"]'))
    const out: Record<string, string> = {}
    for (const r of rows) {
      const spans = r.querySelectorAll("span")
      if (spans.length >= 2) out[spans[0].textContent!.trim()] = spans[spans.length - 1].textContent!.trim()
    }
    return out
  }) as Promise<Record<string, string>>

/** "$1,234.56" | "-$1.22" -> integer cents. */
const cents = (money: string): number => {
  const neg = /-/.test(money)
  const n = Math.round(Number(money.replace(/[^0-9.]/g, "")) * 100)
  return neg ? -n : n
}

/** Click the first visible element whose trimmed text equals `label`. */
const clickByText = (label: string) =>
  browser.execute((want: string) => {
    const els = Array.from(document.querySelectorAll("button, [role='button'], a, div"))
    const hit = els.find((e) => (e.textContent || "").trim() === want && (e as HTMLElement).offsetParent !== null)
    if (hit) {
      ;(hit as HTMLElement).click()
      return true
    }
    return false
  }, label) as Promise<boolean>

suite("SPIKE · payment suite can run by code (webview DOM is queryable)", () => {
  before(async () => {
    await ensureLoggedIn()
  })

  it("1 · WDIO reads the P8D webview DOM (chromedriver path, not just CDP)", async () => {
    await androidAppShellPage.switchToWebview(30_000)

    // Native WDIO selector engine against the webview:
    await expect($("body")).toBeExisting()
    const buttonCount = await $$("button").length
    logger.info(`[spike] WDIO sees ${buttonCount} <button> elements in the webview`)
    expect(buttonCount).toBeGreaterThan(0)

    // browser.execute round-trips into the page (mirrors the CDP probe finding).
    const facts = (await browser.execute(() => ({
      url: location.href,
      title: document.title,
      totalEls: document.querySelectorAll("*").length,
      testids: document.querySelectorAll("[data-testid]").length
    }))) as { url: string; title: string; totalEls: number; testids: number }
    logger.info(`[spike] page facts: ${JSON.stringify(facts)}`)

    expect(facts.title).toContain("Volt POS")
    expect(facts.totalEls).toBeGreaterThan(50)
    // Documents the gap: 0 testids today -> A2 uses text/structural selectors.
    logger.info(`[spike] data-testid count in app = ${facts.testids} (0 expected until §9 lands)`)
  })

  it("2 · reads a REAL Cash-payment breakdown by code + asserts dual pricing", async () => {
    await androidAppShellPage.switchToWebview(30_000)

    // Deep-link straight to the open draft's Cash payment screen (SPA route) —
    // no create-order wizard needed. baseUrl = http://tauri.localhost.
    await browser.url(`/order/${ORDER_ID}/payment/cash`)
    await browser.waitUntil(async () => (await browser.getUrl()).includes("/payment/cash"), {
      timeout: 15_000,
      timeoutMsg: `never reached /payment/cash for order ${ORDER_ID} (is the draft still open?)`
    })

    // Wait for the breakdown to render, then read it by code.
    await browser.waitUntil(async () => Object.keys(await readBreakdown()).length >= 3, {
      timeout: 15_000,
      timeoutMsg: "Cash payment breakdown rows never rendered"
    })
    const bd = await readBreakdown()
    logger.info(`[spike] Cash breakdown read by code: ${JSON.stringify(bd)}`)

    const subtotal = bd["Subtotal"]
    const amountDue = Object.entries(bd).find(([k]) => /amount due/i.test(k))?.[1]
    const fee = Object.entries(bd).find(([k]) => /service fee/i.test(k))?.[1]
    const disc = Object.entries(bd).find(([k]) => /cash discount/i.test(k))?.[1]

    // CASH-01: the key rows are present.
    expect(subtotal).toBeDefined()
    expect(amountDue).toBeDefined()

    // CASH-02 (dual pricing): the 10% service fee is cancelled by the 10% cash
    // discount, so Amount due == Subtotal.
    expect(cents(amountDue!)).toBe(cents(subtotal!))
    // And the fee/discount magnitudes match (fee + discount == 0).
    if (fee && disc) expect(cents(fee) + cents(disc)).toBe(0)

    logger.info(
      `[spike] ✅ CASH-02 verified by code: Subtotal ${subtotal} == Amount due ${amountDue} (fee ${fee} / disc ${disc})`
    )
  })
})
