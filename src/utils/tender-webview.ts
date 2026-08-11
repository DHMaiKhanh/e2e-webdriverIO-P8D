/**
 * Tender-screen webview readers (Đường A2).
 *
 * The P8D Tauri webview ships NO `data-testid`, but its DOM is fully queryable
 * (see memory: p8d-webview-is-debuggable). Every tender breakdown row is
 * `div[data-slot="summary-item"]` (a label <span> + a value <span>), and the
 * big received/amount-due/tip figure is `span.font-data.text-4xl`
 * (SELECTORS.* → BIG_MONEY). These helpers read the money off those rows
 * without hard-coding any amount, so assertions stay data-driven.
 */
import { BIG_MONEY } from "../constants/selectors.js"
import { toCents } from "./currency.js"

/** All breakdown rows on the current tender screen as `{ label: "$value" }`. */
export async function readSummaryMap(): Promise<Record<string, string>> {
  return browser.execute(() => {
    const out: Record<string, string> = {}
    document.querySelectorAll('[data-slot="summary-item"]').forEach((row) => {
      const spans = row.querySelectorAll("span")
      if (spans.length >= 2) {
        out[(spans[0].textContent || "").trim()] = (spans[spans.length - 1].textContent || "").trim()
      }
    })
    return out
  }) as Promise<Record<string, string>>
}

/** The value of the first breakdown row whose label matches `labelRe`, in cents. */
export async function readSummaryCents(labelRe: RegExp): Promise<number> {
  const map = await readSummaryMap()
  const hit = Object.entries(map).find(([label]) => labelRe.test(label))
  if (!hit) {
    throw new Error(`[tender] no breakdown row matches ${labelRe} (saw: ${Object.keys(map).join(", ") || "none"})`)
  }
  return toCents(hit[1])
}

/** True when every label regex matches at least one breakdown row. */
export async function hasSummaryRows(labels: RegExp[]): Promise<boolean> {
  const keys = Object.keys(await readSummaryMap())
  return labels.every((re) => keys.some((k) => re.test(k)))
}

/** The large received / amount-due / tip figure (BIG_MONEY), in cents. */
export async function readBigMoneyCents(): Promise<number> {
  const el = await $(BIG_MONEY)
  await el.waitForExist({ timeout: 5000 })
  return toCents(await el.getText())
}
