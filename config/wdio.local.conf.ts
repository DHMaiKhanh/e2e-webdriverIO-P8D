import { spawn, type ChildProcess } from "node:child_process"
import type { Options } from "@wdio/types"
import { ENV } from "../src/utils/env.js"
import { logger } from "../src/utils/logger.js"
import sharedConfig from "./wdio.shared.conf.js"

/**
 * Local config — runs the actual Tauri desktop binary via `tauri-driver`.
 *
 * tauri-driver is a thin proxy that bridges the WebDriver protocol to the
 * Tauri runtime. On Windows it relies on Microsoft Edge WebDriver under the
 * hood. Make sure both are on PATH (or set TAURI_DRIVER_PATH / MSEDGEDRIVER_PATH).
 *
 * If P8D is a web-only app, ignore this config and use `npm run test:web`.
 */

let tauriDriverProcess: ChildProcess | null = null

export const config: Options.Testrunner = {
  ...sharedConfig,

  hostname: ENV.tauriDriver.host,
  port: ENV.tauriDriver.port,

  // Tauri 2 on Windows serves the frontend over `http://tauri.localhost/...`.
  // Setting baseUrl here lets specs call `browser.url("/settings")` etc.
  baseUrl: "http://tauri.localhost",

  capabilities: [
    {
      maxInstances: 1,
      "tauri:options": {
        application: ENV.tauriAppPath
      },
      // tauri-driver proxies through Edge WebDriver (wry) on Windows
      browserName: "wry"
    } as WebdriverIO.Capabilities
  ],

  services: [],

  /** Spawn tauri-driver before the run; pipe its output through winston. */
  onPrepare: async function (config, capabilities) {
    if (sharedConfig.onPrepare) {
      await sharedConfig.onPrepare.call(this, config, capabilities, undefined)
    }

    const driverArgs: string[] = []
    if (ENV.tauriDriver.nativeDriver) {
      driverArgs.push("--native-driver", ENV.tauriDriver.nativeDriver)
    }
    logger.info(`[tauri-driver] Spawning ${ENV.tauriDriver.path} ${driverArgs.join(" ")}`.trim())
    tauriDriverProcess = spawn(ENV.tauriDriver.path, driverArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32"
    })

    tauriDriverProcess.stdout?.on("data", (chunk) => logger.debug(`[tauri-driver] ${chunk}`))
    tauriDriverProcess.stderr?.on("data", (chunk) => logger.warn(`[tauri-driver] ${chunk}`))
    tauriDriverProcess.on("exit", (code) => logger.info(`[tauri-driver] exited with code ${code}`))

    // Give the driver a moment to bind its port
    await new Promise((resolve) => setTimeout(resolve, 1500))
  },

  onComplete: function (...args) {
    if (tauriDriverProcess && !tauriDriverProcess.killed) {
      logger.info("[tauri-driver] Stopping driver process")
      tauriDriverProcess.kill()
      tauriDriverProcess = null
    }
    if (sharedConfig.onComplete) {
      // @ts-expect-error — variadic forwarding
      sharedConfig.onComplete.call(this, ...args)
    }
  }
}

export default config
