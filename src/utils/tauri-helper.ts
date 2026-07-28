import { TIMEOUTS } from "../constants/timeouts.js"
import { logger } from "./logger.js"
import { waitUntil } from "./wait.js"

/**
 * Tauri-specific helpers.
 *
 * These wrap interactions that only make sense inside a Tauri WebView —
 * invoking Tauri commands directly and multi-window switching. When the test
 * runs in plain browser mode (`wdio.web.conf.ts`), the calls become no-ops
 * with a warning so the same page objects work in both environments.
 *
 * Delete this file if the app under test is web-only.
 */

/**
 * Window labels declared in `src-tauri/tauri.conf.json`. P8D always runs two
 * webviews: the staff-facing POS ("main") and the customer-facing display
 * ("customer", second monitor). Closing either destroys the other
 * (`src-tauri/src/lib.rs`), so tests should always switch explicitly rather
 * than assume window order.
 */
export const WINDOW_LABELS = {
  MAIN: "main",
  CUSTOMER: "customer"
} as const

export type WindowLabel = (typeof WINDOW_LABELS)[keyof typeof WINDOW_LABELS]

declare global {
  interface Window {
    __TAURI__?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      core: { invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window: any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event: any
    }
  }
}

export const isTauriContext = async (): Promise<boolean> => {
  return await browser.execute(() => typeof window !== "undefined" && Boolean(window.__TAURI__))
}

/**
 * Invoke a Tauri command from the test runner.
 *
 *   await tauri.invoke<UserDto>("get_current_user")
 */
export const invoke = async <T = unknown>(
  command: string,
  args: Record<string, unknown> = {}
): Promise<T | undefined> => {
  if (!(await isTauriContext())) {
    logger.warn(`tauri.invoke("${command}") skipped — not running inside Tauri.`)
    return undefined
  }
  return browser.executeAsync<T, [string, Record<string, unknown>]>(
    function (cmd, params, done) {
      ;(window.__TAURI__!.core.invoke(cmd, params) as Promise<unknown>)
        .then((res) => done(res as T))
        // eslint-disable-next-line prefer-promise-reject-errors
        .catch((e) => done({ __error: String(e) } as unknown as T))
    },
    command,
    args
  )
}

/**
 * Read the `label` of whichever Tauri window the driver is currently
 * attached to (e.g. "main" or "customer"). Returns undefined outside Tauri
 * or if the JS window API isn't available yet (window still loading).
 */
export const getCurrentWindowLabel = async (): Promise<string | undefined> => {
  return browser.execute(() => {
    const w = window.__TAURI__?.window
    if (!w) return undefined
    try {
      const current = typeof w.getCurrentWindow === "function" ? w.getCurrentWindow() : w.getCurrent?.()
      return current?.label
    } catch {
      return undefined
    }
  })
}

/**
 * Switch the WebDriver session to the window with the given label.
 *
 * tauri-driver exposes each webview as a plain WebDriver window handle with
 * no label of its own, so the only reliable way to find "customer" vs
 * "main" is to switch to each handle and ask the page which window it is.
 * Retries via `waitUntil` because the customer window can still be
 * initializing when the main window is ready.
 */
export const switchToWindow = async (
  label: WindowLabel | string,
  timeout = TIMEOUTS.MEDIUM
): Promise<void> => {
  await waitUntil(
    async () => {
      const handles = await browser.getWindowHandles()
      for (const handle of handles) {
        await browser.switchToWindow(handle)
        const current = await getCurrentWindowLabel()
        if (current === label) return handle
      }
      return false
    },
    { timeout, timeoutMsg: `Tauri window with label "${label}" was not found` }
  )
  logger.debug(`[tauri] switched to window "${label}"`)
}

/**
 * Run `fn` against the given window, then switch back to whichever window
 * was active before the call — so specs can dip into the customer display
 * to assert something and resume staff-side actions without extra bookkeeping.
 *
 *   const total = await tauri.withWindow(WINDOW_LABELS.CUSTOMER, () => customerDisplay.getCartTotal())
 */
export const withWindow = async <T>(label: WindowLabel | string, fn: () => Promise<T>): Promise<T> => {
  const originalHandle = await browser.getWindowHandle()
  await switchToWindow(label)
  try {
    return await fn()
  } finally {
    await browser.switchToWindow(originalHandle)
  }
}

export const tauri = {
  isTauriContext,
  invoke,
  switchToWindow,
  withWindow,
  getCurrentWindowLabel,
  WINDOW_LABELS
}
