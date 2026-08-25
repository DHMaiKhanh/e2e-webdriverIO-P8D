/**
 * P8D Android device smoke test — verifies the app *boots and is under our
 * control* on the physical P8D device, WITHOUT touching the webview DOM.
 *
 * Why no DOM here: on this device the Tauri WebView's Chrome DevTools renderer
 * does not answer CDP commands, so `switchContext(WEBVIEW_*)` hangs and no
 * DOM/selector automation is possible (see staff-token-login.e2e.ts, which is
 * gated on that). This spec deliberately stays at the layer that IS reliable
 * — the native uiautomator2 session — so it runs green today and gives CI a
 * real "the app launches on the device" signal.
 *
 * Run:
 *   npm run test:android            (whole android suite)
 *   cross-env TEST_ENV=android wdio run ./config/wdio.android.conf.ts \
 *     --spec ./src/specs/android/device-smoke.e2e.ts
 */
import { expect } from "@wdio/globals"
import { logger } from "../../utils/logger.js"

const APP_ID = "com.fastboy.volt_pos.debug"

describe("P8D Android device smoke @smoke", () => {
  it("has the app in the foreground on the correct activity", async () => {
    // A fresh session already launched the app (appPackage/appActivity caps),
    // but make foregrounding explicit so the check is order-independent.
    await browser.execute("mobile: activateApp", { appId: APP_ID })

    const pkg = String(await browser.execute("mobile: getCurrentPackage"))
    const activity = String(await browser.execute("mobile: getCurrentActivity"))
    logger.info(`[smoke] foreground package=${pkg} activity=${activity}`)

    expect(pkg).toContain("volt_pos")
    expect(activity).toContain("MainActivity")
  })

  it("has booted its Tauri webview process", async () => {
    // getContexts enumerating a WEBVIEW_* context proves the embedded Chromium
    // WebView actually started (its devtools socket is up), even though we
    // can't drive its DOM. This is the strongest control signal available
    // without a working renderer CDP.
    const contexts = (await browser.getContexts()) as string[]
    logger.info(`[smoke] contexts=${JSON.stringify(contexts)}`)

    expect(contexts).toContain("NATIVE_APP")
    expect(contexts.some((c) => String(c).startsWith("WEBVIEW"))).toBe(true)
  })

  it("captures a native screenshot artifact", async () => {
    const file = `./reports/screenshots/smoke-${Date.now()}.png`
    await browser.saveScreenshot(file)
    logger.info(`[smoke] screenshot → ${file}`)
  })
})
