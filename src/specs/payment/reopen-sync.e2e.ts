/**
 * docs/payment-test-cases.md §8.11 (REOPEN / SYNC) — order re-open and
 * POS ↔ Portal ↔ P8 sync.
 *
 * REOPEN-01 (the Re-open tab is empty on the dev shop) is drivable on P8 and
 * runnable. Everything else is cross-device / needs dev confirmation and is
 * scaffolded as `it.skip` rather than faked:
 *   • REOPEN-02 — no Reopen action was found in P8 order detail; needs dev to
 *     confirm whether Reopen is supported on P8 (may be POS/Portal-only).
 *   • SYNC-01…06 — multi-device integration that Appium-on-P8 alone can't drive;
 *     needs a POS/Portal harness or a backend check.
 *
 * GATING: skipped until ANDROID_WEBVIEW_READY=1 && VOLT_PAYMENT_TESTIDS=1.
 */
import { expect } from "@wdio/globals"
import { androidAppShellPage, ordersListPage } from "@pages"
import { ROUTES } from "../../constants/routes.js"
import { ensureLoggedIn } from "../../utils/ensure-logged-in.js"

const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
const TESTIDS_LANDED = process.env.VOLT_PAYMENT_TESTIDS === "1"
const suite = WEBVIEW_READY && TESTIDS_LANDED ? describe : describe.skip

suite("Reopen & Sync", () => {
  it("REOPEN-01 @regression · the Re-open tab lists reopened orders (empty on dev shop)", async () => {
    await ensureLoggedIn()
    await androidAppShellPage.switchToWebview()
    await browser.url(ROUTES.APP.ORDERS)
    await ordersListPage.waitForLoaded()
    await ordersListPage.openStatusTab("re-open")
    expect(await ordersListPage.isEmpty()).toBe(true)
  })

  // REOPEN-02: no Reopen action in P8 order detail today — confirm with dev
  // whether Reopen is supported on P8 (may be POS/Portal-only) before wiring.
  it.skip("REOPEN-02 @regression · Reopen a settled/canceled order (needs dev confirmation on P8)", () => {
    // pending dev confirmation that a Reopen action exists on P8.
  })

  // SYNC-* : cross-device — needs POS/Portal harness (or backend verification).
  it.skip("SYNC-01 @regression · service changes sync Portal/POS → P8 (cross-device)", () => {})
  it.skip("SYNC-02 @regression · staff changes sync Portal/POS → P8 (cross-device)", () => {})
  it.skip("SYNC-03 @regression · promotion/reward/discount config syncs → P8 (cross-device)", () => {})
  it.skip("SYNC-04 @regression · order & payment settings sync → P8 (cross-device)", () => {})
  it.skip("SYNC-05 @smoke · an order created on POS appears on P8 (cross-device)", () => {})
  it.skip("SYNC-06 @smoke · an order created on P8 appears on POS (cross-device)", () => {})
})
