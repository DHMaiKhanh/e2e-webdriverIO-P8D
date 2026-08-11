/**
 * TEMP re-scan (Đường A2) — probes the LIVE behavior of the Tip and Card tender
 * screens after a UI change so we can repair selectors + specs against real
 * behavior (not guesses). Prefixed `_`; delete once Tip/Card are fixed.
 *
 * Run: npm run test:android:emu -- --spec ./src/specs/android/_rescan-tip-card.e2e.ts
 */
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { androidAppShellPage } from "@pages"
import { ensureLoggedIn } from "../../utils/ensure-logged-in.js"
import { FIXTURE_ORDER_ID } from "../../utils/payment-fixture.js"
import { logger } from "../../utils/logger.js"

const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
const suite = WEBVIEW_READY ? describe : describe.skip

const OUT_DIR = path.resolve(process.cwd(), "reports/rescan")

const bigMoney = () =>
  browser.execute(() => (document.querySelector("span.font-data.text-4xl")?.textContent ?? "").trim()) as Promise<string>

const clickPressable = (text: string) =>
  browser.execute((t: string) => {
    const el = Array.from(document.querySelectorAll('[data-slot="pressable"]')).find(
      (e) => (e.textContent || "").trim() === t
    )
    if (el) {
      ;(el as HTMLElement).click()
      return true
    }
    return false
  }, text) as Promise<boolean>

const clickKey = (k: string) =>
  browser.execute((t: string) => {
    const el = Array.from(document.querySelectorAll('[data-slot="keypad-key"]')).find(
      (e) => (e.textContent || "").trim() === t
    )
    if (el) {
      ;(el as HTMLElement).click()
      return true
    }
    return false
  }, k) as Promise<boolean>

suite("RESCAN · Tip + Card behavior probe", () => {
  before(async () => {
    await ensureLoggedIn()
    await mkdir(OUT_DIR, { recursive: true })
  })

  it("probes Tip interactions", async () => {
    await androidAppShellPage.switchToWebview()
    await browser.url(`/order/${FIXTURE_ORDER_ID}`)
    await browser.url(`/order/${FIXTURE_ORDER_ID}/payment/tip`)
    await browser.pause(2500)

    const steps: Record<string, unknown> = {}
    steps["0_default"] = await bigMoney()
    steps["1_click_10pct_ok"] = await clickPressable("10%")
    await browser.pause(600)
    steps["1_amount_after_10pct"] = await bigMoney()
    steps["2_click_20pct_ok"] = await clickPressable("20%")
    await browser.pause(600)
    steps["2_amount_after_20pct"] = await bigMoney()
    steps["3_click_C_ok"] = await clickKey("C")
    await browser.pause(600)
    steps["3_amount_after_C"] = await bigMoney()
    steps["4_click_CustomTip_ok"] = await clickPressable("Custom Tip")
    await browser.pause(600)
    steps["4_amount_after_CustomTip"] = await bigMoney()
    steps["5_type_500"] = [await clickKey("5"), await clickKey("0"), await clickKey("0")]
    await browser.pause(600)
    steps["5_amount_after_500"] = await bigMoney()
    steps["6_click_C_ok"] = await clickKey("C")
    await browser.pause(600)
    steps["6_amount_after_C"] = await bigMoney()

    logger.info(`[rescan][TIP-PROBE] ${JSON.stringify(steps, null, 2)}`)
    await writeFile(path.join(OUT_DIR, "tip-probe.json"), JSON.stringify(steps, null, 2), "utf8")
  })

  it("probes the Card screen title + buttons", async () => {
    await androidAppShellPage.switchToWebview()
    await browser.url(`/order/${FIXTURE_ORDER_ID}`)
    await browser.url(`/order/${FIXTURE_ORDER_ID}/payment/card`)
    await browser.pause(2500)

    const info = await browser.execute(() => {
      const trim = (s: string | null) => (s || "").replace(/\s+/g, " ").trim()
      const titleEls = Array.from(document.querySelectorAll("*"))
        .filter((e) => e.children.length === 0 && trim(e.textContent) === "Card payment")
        .map((e) => ({ tag: e.tagName.toLowerCase(), cls: (e.className || "").toString().slice(0, 70) }))
      const buttons = Array.from(document.querySelectorAll("button")).map((b) => ({
        slot: b.getAttribute("data-slot"),
        text: trim(b.textContent).slice(0, 40),
        disabled: (b as HTMLButtonElement).disabled
      }))
      return {
        url: location.href,
        titleEls,
        hasChargeText: /Charge/.test(document.body.innerText),
        hasBamboo: /BambooPay/i.test(document.body.innerText),
        hasUnavailable: /unavailable/i.test(document.body.innerText),
        hasChooseAnother: /Choose another/i.test(document.body.innerText),
        hasCardNumber: /Card number/i.test(document.body.innerText),
        buttons
      }
    })

    logger.info(`[rescan][CARD-PROBE] ${JSON.stringify(info, null, 2)}`)
    await writeFile(path.join(OUT_DIR, "card-probe.json"), JSON.stringify(info, null, 2), "utf8")
  })
})
