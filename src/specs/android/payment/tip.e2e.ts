/**
 * docs/payment-test-cases.md §8.5 (TIP-*) — the shared Add Tip screen, run BY
 * CODE via deep-link (Đường A2). No wizard, no [Add tip] commit. Assertions are
 * relational (no hard-coded amounts): preset % scale linearly, the keypad "C"
 * clears, and the keypad drives the TIP AMOUNT.
 *
 * UI change 2026-08: the "0%" chip was replaced by a "Custom Tip" chip (manual
 * entry) and a 35% preset was added — see selectors.ts TIP + tip.page.ts.
 *
 * Gate: ANDROID_WEBVIEW_READY=1 (npm run test:android:emu).
 */
import { expect } from "@wdio/globals"
import { tipPage } from "@pages"
import { expectMoneyEqual } from "../../../utils/currency.js"
import { ensureLoggedIn } from "../../../utils/ensure-logged-in.js"
import { openTender } from "../../../utils/payment-fixture.js"

const suite = process.env.ANDROID_WEBVIEW_READY === "1" ? describe : describe.skip

suite("Add Tip · by code (deep-link, no commit)", () => {
  before(async () => {
    await ensureLoggedIn()
  })

  beforeEach(async () => {
    await openTender("tip")
    await tipPage.waitForLoaded()
  })

  it("TIP-01 @smoke · every preset chip + Custom Tip is present", async () => {
    expect(await tipPage.hasAllPresets()).toBe(true)
  })

  it("TIP-02 @regression · default TIP AMOUNT is $0", async () => {
    // Fresh deep-link → no tip seeded, so the screen opens at $0 with no action.
    expect(await tipPage.getTipAmountCents()).toBe(0)
  })

  it("TIP-03 @smoke · preset % scale linearly (20% ≈ 2 × 10%, both > 0)", async () => {
    await tipPage.selectPreset(10)
    const ten = await tipPage.getTipAmountCents()
    await tipPage.selectPreset(20)
    const twenty = await tipPage.getTipAmountCents()
    expect(ten).toBeGreaterThan(0)
    expect(expectMoneyEqual(twenty, ten * 2)).toBe(true)
  })

  it("TIP-04 @regression · keypad C clears a running tip back to $0", async () => {
    await tipPage.selectPreset(20)
    expect(await tipPage.getTipAmountCents()).toBeGreaterThan(0)
    await tipPage.clear()
    expect(await tipPage.getTipAmountCents()).toBe(0)
  })

  it("TIP-05 @regression · Custom Tip + keypad drives a custom amount", async () => {
    await tipPage.startCustom() // manual-entry mode (replaces the old 0% chip), resets to $0
    await tipPage.typeTip("500") // → $5.00
    expect(await tipPage.getTipAmountCents()).toBe(500)
  })
})
