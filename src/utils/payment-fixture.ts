/**
 * Payment deep-link fixture (Đường A2).
 *
 * The P8D SPA is URL-routable, so a tender screen can be reached directly with
 * `browser.url('/order/<id>/payment/<tender>')` — NO create-order wizard, and
 * therefore no new draft order per test. The screens are read-only + safe
 * interactions only (no Accept/Redeem/Record), so the same open draft is reused.
 *
 * FIXTURE_ORDER_ID is an already-open draft captured live. Override it via
 * PAYMENT_ORDER_ID when that draft is settled/cancelled and a fresh one is made.
 */
import { androidAppShellPage } from "@pages"
import { logger } from "./logger.js"

export type Tender = "cash" | "gift_card" | "other" | "tip"

/** Open draft order used as the deep-link fixture (captured from CDP 2026-08-04). */
export const FIXTURE_ORDER_ID = process.env.PAYMENT_ORDER_ID || "019fcc5a-7f27-748a-893b-5c86aa98ad77"

/**
 * Deep-link straight to a tender screen for the fixture order. Bounces through
 * the order route first so the tender component re-mounts with fresh state
 * between tests (keypad / quick-cash reset). baseUrl = http://tauri.localhost.
 */
export async function openTender(tender: Tender): Promise<void> {
  await androidAppShellPage.switchToWebview()
  await browser.url(`/order/${FIXTURE_ORDER_ID}`)
  await browser.url(`/order/${FIXTURE_ORDER_ID}/payment/${tender}`)
  await browser.waitUntil(async () => (await browser.getUrl()).includes(`/payment/${tender}`), {
    timeout: 15_000,
    timeoutMsg: `[openTender] never reached /payment/${tender} for order ${FIXTURE_ORDER_ID} (is the draft still open?)`
  })
  logger.info(`[openTender] on ${tender} screen for order ${FIXTURE_ORDER_ID}`)
}
