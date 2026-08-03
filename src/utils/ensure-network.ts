import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { SELECTORS } from "../constants/selectors.js"
import { TIMEOUTS } from "../constants/timeouts.js"
import { ENV } from "./env.js"
import { logger } from "./logger.js"
import { sleep } from "./wait.js"

const execFileAsync = promisify(execFile)

/** adb argv prefix that pins commands to the configured device, when one is set. */
const adbTarget = (): string[] => (ENV.android.udid ? ["-s", ENV.android.udid] : [])

/**
 * "If the laptop is online, the app is online."
 *
 * The P8D Android build is a Tauri WebView. On the emulator it does NOT reach
 * the backend over the internet directly — it talks to `localhost:<port>`,
 * which only reaches the laptop's dev server + backend while adb-reverse
 * forwards are live (see `npm run android:reverse`). So "the app is online"
 * requires TWO independent things, and this makes both true before a session:
 *
 *   1. Radios on — WiFi / mobile data enabled, airplane mode off. Otherwise
 *      even the WebView chrome can't load. (`forceRadiosOnline`)
 *   2. Host bridges up — the `adb reverse tcp:<port>` forwards that carry every
 *      backend request to the laptop. These silently drop on adb reconnects,
 *      emulator restarts, VPN changes, or host sleep. When they're gone the app
 *      renders but every data fetch fails with "Couldn't load … / Please check
 *      your connection" — even though the laptop itself is perfectly online.
 *      This is the usual cause of that screen. (`ensureHostBridge`)
 *
 * Idempotent and safe to call on every run; never throws — a still-broken
 * bridge is logged, not fatal, so the run can still surface a real assertion.
 */
export async function ensureNetworkOnline(): Promise<void> {
  await forceRadiosOnline()
  await ensureHostBridge()
  await verifyBackendReachable()
}

/**
 * Preflight: is the backend the WebView's data actually comes from up?
 *
 * The Android app's `/graphql` calls are proxied by the host Vite dev server
 * (:1420) to the local GraphQL server (ENV.apiBaseUrl, default
 * http://127.0.0.1:8080). That server is NOT started by `npm run dev:android`
 * (frontend only) — it only runs under `npm run start`
 * (`tauri dev --features graphql_server`) in the P8D app repo. When it's down,
 * the app renders but every data fetch fails with "Couldn't load … / Please
 * check your connection" — which looks like a device network problem but is
 * really a backend-not-running problem. This turns that into one loud,
 * actionable log line so it's diagnosable at a glance. Warn-only — never fatal.
 *
 * @returns `true` if something is listening (any HTTP response), else `false`.
 */
export async function verifyBackendReachable(): Promise<boolean> {
  const url = ENV.apiBaseUrl
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3_000)
  try {
    // Any HTTP status (even 400/404/405 to a bare GET) proves a server is up;
    // only a transport error (ECONNREFUSED / timeout) means nothing is there.
    const res = await fetch(url, { signal: controller.signal })
    logger.info(`[ensureNetworkOnline] backend reachable at ${url} (HTTP ${res.status})`)
    return true
  } catch (err) {
    logger.error(
      `[ensureNetworkOnline] BACKEND DOWN at ${url} (${(err as Error).message}). ` +
        `The app shows "Couldn't load … / check your connection" even though the device is online. ` +
        `Start the backend in the P8D repo:  npm run start  (tauri dev --features graphql_server)`
    )
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * In-app recovery: when the P8D screen is showing its "Couldn't load … / Please
 * check your connection" error, re-bridge the host and tap **Try again** until
 * the data loads — so the app reconnects the moment the laptop's network is
 * reachable again, instead of sitting on the error screen.
 *
 * MUST be called from the WEBVIEW context (after
 * `androidAppShellPage.switchToWebview()`). Best-effort and idempotent: if no
 * error screen is present it returns `true` immediately.
 *
 * @returns `true` if the app is connected (no error screen) on exit.
 */
export async function recoverAppConnection(attempts = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const retrySelector = await findRetrySelector()
    if (!retrySelector) {
      logger.info("[recoverAppConnection] no connection-error screen — app is online")
      return true
    }

    logger.warn(`[recoverAppConnection] offline screen up — re-bridging + retrying (${attempt}/${attempts})`)
    // Re-establish the laptop bridge first: tapping "Try again" only helps once
    // the underlying forward is actually back.
    await ensureHostBridge()
    try {
      await $(retrySelector).click()
    } catch (err) {
      logger.warn(`[recoverAppConnection] retry tap failed: ${(err as Error).message}`)
    }
    // Give the refetch time to resolve before re-checking.
    await sleep(TIMEOUTS.SHORT)
  }

  const stillDown = (await findRetrySelector()) !== null
  if (stillDown) {
    logger.error(
      `[recoverAppConnection] app still offline after ${attempts} attempts — check the host dev server + backend are running`
    )
  }
  return !stillDown
}

/** Selector of the visible "Try again" control (a real <button> first, then any
 * element with that label), or null when the error screen isn't showing. */
async function findRetrySelector(): Promise<string | null> {
  for (const selector of [SELECTORS.NETWORK_ERROR.RETRY_BTN, SELECTORS.NETWORK_ERROR.RETRY_TEXT]) {
    const visible = await $(selector)
      .isDisplayed()
      .catch(() => false)
    if (visible) return selector
  }
  return null
}

/**
 * Force the device radios on. Prefers Appium's `mobile: setConnectivity`
 * (flips WiFi + data on and airplane mode off in one call, no extra
 * `--allow-insecure` flags); falls back to host-side adb on older drivers.
 */
async function forceRadiosOnline(): Promise<void> {
  try {
    await browser.execute("mobile: setConnectivity", {
      wifi: true,
      data: true,
      airplaneMode: false
    })

    // Verify + surface the resulting state so a still-offline device is obvious
    // in the logs instead of silently producing "Couldn't load…" screens.
    const state = await browser.execute("mobile: getConnectivity")
    logger.info(`[ensureNetworkOnline] radios forced on — connectivity=${JSON.stringify(state)}`)
    return
  } catch (err) {
    logger.warn(
      `[ensureNetworkOnline] mobile:setConnectivity unavailable (${(err as Error).message}) — falling back to adb`
    )
  }

  await ensureNetworkViaAdb()
}

/** Host-side fallback: toggle the radios directly through adb. */
async function ensureNetworkViaAdb(): Promise<void> {
  const target = adbTarget()
  const steps: string[][] = [
    ["shell", "cmd", "connectivity", "airplane-mode", "disable"],
    ["shell", "svc", "wifi", "enable"],
    ["shell", "svc", "data", "enable"]
  ]

  for (const step of steps) {
    const args = [...target, ...step]
    try {
      await execFileAsync("adb", args)
      logger.info(`[ensureNetworkOnline] adb ${args.join(" ")}`)
    } catch (err) {
      // A single failing toggle (e.g. `svc data` on a WiFi-only emulator image)
      // must not abort the others — keep going.
      logger.warn(`[ensureNetworkOnline] adb ${step.join(" ")} failed: ${(err as Error).message}`)
    }
  }
}

/**
 * Re-establish the device→host `adb reverse` forwards the WebView needs for
 * backend data (mirrors `npm run android:reverse`). Re-adding an existing
 * forward is a no-op, so this is safe to run on every session.
 */
async function ensureHostBridge(): Promise<void> {
  const target = adbTarget()
  for (const port of ENV.android.reversePorts) {
    const args = [...target, "reverse", `tcp:${port}`, `tcp:${port}`]
    try {
      await execFileAsync("adb", args)
      logger.info(`[ensureNetworkOnline] bridged device:localhost:${port} → host:${port}`)
    } catch (err) {
      logger.warn(`[ensureNetworkOnline] adb reverse tcp:${port} failed: ${(err as Error).message}`)
    }
  }

  // Surface what's actually forwarded so a still-broken bridge is obvious.
  try {
    const { stdout } = await execFileAsync("adb", [...target, "reverse", "--list"])
    logger.info(`[ensureNetworkOnline] active reverse forwards:\n${stdout.trim() || "(none)"}`)
  } catch {
    /* --list is diagnostic only — ignore failures. */
  }
}
