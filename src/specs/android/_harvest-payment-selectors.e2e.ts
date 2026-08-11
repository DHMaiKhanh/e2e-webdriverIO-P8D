/**
 * TEMP harvest — deep-link each tender screen and dump ground-truth selector
 * facts to reports/page-source/harvest-payment.json so the payment page objects
 * can be written against real text/data-slot selectors (no testids exist).
 * Delete after the page objects are converted.
 *
 * Run: npm run test:android:emu -- --spec ./src/specs/android/_harvest-payment-selectors.e2e.ts
 */
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { androidAppShellPage } from "@pages"
import { ensureLoggedIn } from "../../utils/ensure-logged-in.js"
import { logger } from "../../utils/logger.js"

const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
const suite = WEBVIEW_READY ? describe : describe.skip
const ORDER_ID = process.env.SPIKE_ORDER_ID || "019fcc5a-7f27-748a-893b-5c86aa98ad77"
const OUT = path.resolve(process.cwd(), "reports/page-source")

const ROUTES = [
  ["method", `/order/${ORDER_ID}/payment/method`],
  ["method2", `/order/${ORDER_ID}/payment`],
  ["cash", `/order/${ORDER_ID}/payment/cash`],
  ["gift_card", `/order/${ORDER_ID}/payment/gift_card`],
  ["other", `/order/${ORDER_ID}/payment/other`],
  ["tip", `/order/${ORDER_ID}/payment/tip`],
  // Confirm the Card tender route + its "unavailable" markup (drives
  // src/specs/android/payment/card.e2e.ts — route still convention-based).
  ["card", `/order/${ORDER_ID}/payment/card`]
] as const

suite("_harvest payment selectors", () => {
  before(async () => {
    await ensureLoggedIn()
    await androidAppShellPage.switchToWebview(30_000)
  })

  it("dumps facts for each tender route", async () => {
    await mkdir(OUT, { recursive: true })
    const result: Record<string, unknown> = {}

    for (const [name, route] of ROUTES) {
      try {
        await browser.url(route)
        await browser.pause(1500)
        const facts = await browser.execute(() => {
          const vis = (e: Element) => (e as HTMLElement).offsetParent !== null
          const txt = (e: Element) => (e.textContent || "").trim().replace(/\s+/g, " ")
          const summaryItems: Record<string, string> = {}
          document.querySelectorAll('[data-slot="summary-item"]').forEach((r) => {
            const s = r.querySelectorAll("span")
            if (s.length >= 2) summaryItems[txt(s[0])] = txt(s[s.length - 1])
          })
          return {
            url: location.href,
            headers: Array.from(document.querySelectorAll("h1,h2,h3")).map(txt).filter(Boolean),
            buttons: Array.from(document.querySelectorAll("button"))
              .filter(vis)
              .map((b) => ({ text: txt(b), slot: b.getAttribute("data-slot"), disabled: (b as HTMLButtonElement).disabled }))
              .slice(0, 40),
            inputs: Array.from(document.querySelectorAll("input")).map((i) => ({
              placeholder: (i as HTMLInputElement).placeholder,
              inputmode: i.getAttribute("inputmode"),
              slot: i.getAttribute("data-slot")
            })),
            // Big display numbers ($X.XX not inside a summary-item row).
            moneyDisplays: Array.from(document.querySelectorAll("*"))
              .filter((e) => vis(e) && e.children.length === 0 && /^-?\$[\d,]+\.\d{2}$/.test(txt(e)))
              .map((e) => ({ text: txt(e), tag: e.tagName.toLowerCase(), slot: e.getAttribute("data-slot"), cls: (e.className || "").toString().slice(0, 70) }))
              .slice(0, 12),
            summaryItems,
            dataSlots: Array.from(new Set(Array.from(document.querySelectorAll("[data-slot]")).map((e) => e.getAttribute("data-slot")))).slice(0, 40)
          }
        })
        result[name] = facts
        logger.info(`[harvest] ${name} → ${(facts as { url: string }).url}`)
      } catch (err) {
        result[name] = { error: (err as Error).message }
        logger.warn(`[harvest] ${name} FAILED: ${(err as Error).message}`)
      }
    }

    const file = path.join(OUT, "harvest-payment.json")
    await writeFile(file, JSON.stringify(result, null, 2), "utf8")
    logger.info(`[harvest] wrote ${file}`)
  })
})
