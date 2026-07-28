import { spawn, type ChildProcess } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Options } from "@wdio/types"
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
 * `com.fastboy.volt_pos`, `src-tauri/gen/android`) on a physical device
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

export const config: Options.Testrunner = {
  ...sharedConfig,

  hostname: ENV.android.appiumHost,
  port: ENV.android.appiumPort,
  path: "/",

  // Only one physical device is targeted — a single session at a time.
  maxInstances: 1,

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
      "appium:newCommandTimeout": 240
    } as WebdriverIO.Capabilities
  ],

  services: [],

  /** Spawn a local Appium server before the run, same pattern as tauri-driver in wdio.local.conf.ts. */
  onPrepare: async function (config, capabilities) {
    if (sharedConfig.onPrepare) {
      await sharedConfig.onPrepare.call(this, config, capabilities, undefined)
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

  onComplete: function (...args) {
    if (appiumProcess && !appiumProcess.killed) {
      logger.info("[appium] Stopping server process")
      appiumProcess.kill()
      appiumProcess = null
    }
    if (sharedConfig.onComplete) {
      // @ts-expect-error — variadic forwarding
      sharedConfig.onComplete.call(this, ...args)
    }
  }
}

export default config
