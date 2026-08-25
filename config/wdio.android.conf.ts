import { spawn, type ChildProcess } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ENV } from "../src/utils/env.js"
import { logger } from "../src/utils/logger.js"
import sharedConfig from "./wdio.shared.conf.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

/** Poll the Appium server's /status endpoint instead of a blind sleep. */
const waitForAppiumReady = async (host: string, port: number, timeout = 20_000): Promise<void> => {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://${host}:${port}/status`)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`Appium server did not become ready on ${host}:${port} within ${timeout}ms`)
}

/**
 * Android config — drives the real P8D Android build (package
 * `com.fastboy.volt_pos.debug`, `src-tauri/gen/android`) on a physical device
 * connected over USB via adb + Appium's uiautomator2 driver.
 *
 * Prereqs on the host machine:
 *   - `adb devices` lists the target device (USB debugging enabled + authorized).
 *   - Appium is installed with the uiautomator2 driver:
 *       npm install --save-dev appium @wdio/appium-service appium-uiautomator2-driver
 *       npx appium driver install uiautomator2
 *   - ANDROID_HOME / ANDROID_SDK_ROOT set, platform-tools on PATH.
 */

let appiumProcess: ChildProcess | null = null

export const config: WebdriverIO.Config = {
  ...sharedConfig,

  hostname: ENV.android.appiumHost,
  port: ENV.android.appiumPort,
  path: "/",

  // Only one physical device is targeted — a single session at a time.
  maxInstances: 1,

  // The Tauri webview serves the SPA from the `tauri.localhost` custom protocol,
  // so a bare `browser.url("/route")` (no host) resolves to a hostname and fails
  // with ERR_NAME_NOT_RESOLVED. Giving WDIO a baseUrl lets page objects navigate
  // by path (e.g. staffTokenLoginPage.open()) exactly like the web/desktop configs.
  baseUrl: "http://tauri.localhost",

  // Android-only specs. Desktop/web specs (window handles, browser.url())
  // don't apply to a native uiautomator2 session and must not be picked up here.
  specs: [path.join(ROOT, "src/specs/android/**/*.e2e.ts")],

  capabilities: [
    {
      platformName: "Android",
      "appium:automationName": "UiAutomator2",
      "appium:deviceName": ENV.android.deviceName || "Android Device",
      ...(ENV.android.udid ? { "appium:udid": ENV.android.udid } : {}),
      // Install the APK when a path is given; otherwise attach to whatever's
      // already installed on the device and just (re)launch it.
      ...(ENV.android.appPath
        ? { "appium:app": ENV.android.appPath }
        : {
            "appium:appPackage": ENV.android.appPackage,
            "appium:appActivity": ENV.android.appActivity
          }),
      "appium:noReset": true,
      "appium:newCommandTimeout": 240,
      // --- Tauri webview interop ---
      // The Tauri WebView accepts a raw CDP page socket but never answers
      // protocol commands on it, so Appium's default "collect webview details"
      // step (which opens exactly that per-page socket to read each page's
      // url/title) hangs getContexts for its full timeout and jams the
      // uiautomator2 command queue. Turning it off makes getContexts return the
      // WEBVIEW_<pkg> name immediately; chromedriver then attaches through the
      // browser endpoint (Target.attachToTarget), which the WebView does answer.
      "appium:enableWebviewDetailsCollection": false,
      // Screenshot the webview via the native uiautomator2 path instead of the
      // chromedriver path, which is also unreliable against this WebView.
      "appium:nativeWebScreenshot": true
    } as WebdriverIO.Capabilities
  ],

  services: [],

  /**
   * Force the device online before every Android session (before login, before
   * any spec). The P8D WebView needs the backend to render its live data — a
   * radio left off produces "Couldn't load today's numbers" screens and flaky,
   * network-caused failures. See src/utils/ensure-network.ts.
   */
  before: async function (capabilities, specs, browserInstance) {
    // Keep the shared before (registers custom commands) — narrow via typeof so
    // TS drops the array branch of the hook's union type before `.call`.
    if (typeof sharedConfig.before === "function") {
      await sharedConfig.before.call(this, capabilities, specs, browserInstance)
    }
    const { ensureNetworkOnline } = await import("../src/utils/ensure-network.js")
    await ensureNetworkOnline()
  },

  /** Spawn a local Appium server before the run, same pattern as tauri-driver in wdio.local.conf.ts. */
  onPrepare: async function (config, capabilities) {
    if (typeof sharedConfig.onPrepare === "function") {
      await sharedConfig.onPrepare.call(this, config, capabilities)
    }

    logger.info(`[appium] Starting server on ${ENV.android.appiumHost}:${ENV.android.appiumPort}`)
    appiumProcess = spawn(
      "npx",
      [
        "appium",
        "--address",
        ENV.android.appiumHost,
        "--port",
        String(ENV.android.appiumPort),
        "--allow-insecure",
        "chromedriver_autodownload"
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32"
      }
    )

    appiumProcess.stdout?.on("data", (chunk) => logger.debug(`[appium] ${chunk}`))
    appiumProcess.stderr?.on("data", (chunk) => logger.warn(`[appium] ${chunk}`))
    appiumProcess.on("exit", (code) => logger.info(`[appium] exited with code ${code}`))

    await waitForAppiumReady(ENV.android.appiumHost, ENV.android.appiumPort)
    logger.info("[appium] server ready")
  },

  onComplete: async function (...args) {
    if (appiumProcess && !appiumProcess.killed) {
      logger.info("[appium] Stopping server process")
      appiumProcess.kill()
      appiumProcess = null
    }
    if (typeof sharedConfig.onComplete === "function") {
      await sharedConfig.onComplete.call(this, ...args)
    }
  }
}

export default config
