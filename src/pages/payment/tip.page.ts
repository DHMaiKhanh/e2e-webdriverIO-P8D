/**
 * TipPage — the shared "Add Tip" screen reached from any tender's [Tip] button
 * (docs/payment-test-cases.md §6, §8.5). Preset % chips (10/15/20/25/30/0) plus
 * a keypad for a custom amount. TIP AMOUNT is returned in **integer cents**.
 *
 * Selectors are REAL Tauri-webview hooks (Đường A2): preset chips via
 * data-slot="pressable", keypad via data-slot, TIP AMOUNT via BIG_MONEY.
 */
import { SELECTORS } from "../../constants/selectors.js"
import { readBigMoneyCents } from "../../utils/tender-webview.js"
import { BasePage } from "../base.page.js"

/**
 * The merchant-configured preset percentages (tiệm 14). The old "0%" clear chip
 * was replaced by a "Custom Tip" chip in the 2026-08 UI change; clearing is now
 * the keypad "C" key. Order is irrelevant here — presence is what's asserted.
 */
export const TIP_PRESETS = [10, 15, 20, 25, 30, 35] as const

export class TipPage extends BasePage {
  protected readonly pageName = "TipPage"
  protected readonly rootSelector = SELECTORS.TIP.HEADER

  async isOnScreen(): Promise<boolean> {
    return this.isLoaded()
  }

  async getTipAmountCents(): Promise<number> {
    return readBigMoneyCents()
  }

  /** Every preset % chip present AND the "Custom Tip" chip present (TIP-01). */
  async hasAllPresets(): Promise<boolean> {
    for (const pct of TIP_PRESETS) {
      if (!(await this.$(SELECTORS.TIP.PRESET(pct)).isExisting())) return false
    }
    return this.$(SELECTORS.TIP.CUSTOM_TIP).isExisting()
  }

  async selectPreset(pct: number): Promise<void> {
    await this.safeClick(SELECTORS.TIP.PRESET(pct), `tip preset ${pct}%`)
  }

  /** Enter manual-entry mode — the "Custom Tip" chip that replaced the old "0%"
   *  chip. Resets TIP AMOUNT to $0 and readies the keypad (TIP-05). */
  async startCustom(): Promise<void> {
    await this.safeClick(SELECTORS.TIP.CUSTOM_TIP, "custom tip")
  }

  /** Clear a running tip back to $0 via the keypad "C" key (TIP-04). */
  async clear(): Promise<void> {
    await this.safeClick(SELECTORS.TIP.CLEAR, "clear tip")
  }

  /** Type a custom tip digit-by-digit on the keypad. */
  async typeTip(digits: string): Promise<void> {
    for (const digit of digits) {
      await this.safeClick(SELECTORS.TIP.KEYPAD(digit), `keypad ${digit}`)
    }
  }

  /** Confirm → returns to the tender screen with the tip applied. */
  async addTip(): Promise<void> {
    await this.safeClick(SELECTORS.TIP.ADD_TIP, "add tip")
  }
}

export const tipPage = new TipPage()
