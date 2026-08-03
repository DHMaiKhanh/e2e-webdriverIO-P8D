import "dotenv/config"

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "silent"

const num = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const bool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback
  return ["1", "true", "yes", "on"].includes(value.toLowerCase())
}

/** Parse a comma-separated list of ports ("1420,1421") into numbers. */
const ports = (value: string | undefined, fallback: number[]): number[] => {
  if (!value) return fallback
  const parsed = value
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
  return parsed.length ? parsed : fallback
}

/**
 * Strongly-typed environment object.
 *
 * Centralizing this here means `process.env` access never leaks into
 * specs or page objects, which keeps tests deterministic and easier
 * to reason about across environments.
 */
export const ENV = {
  testEnv: process.env.TEST_ENV ?? "local",

  // ---- Tauri (desktop) ----
  tauriAppPath:
    process.env.TAURI_APP_PATH ?? "D:\\Project\\P8D\\P8D\\src-tauri\\target\\release\\volt-pos.exe",
  tauriDriver: {
    path: process.env.TAURI_DRIVER_PATH ?? "tauri-driver",
    host: process.env.TAURI_DRIVER_HOST ?? "127.0.0.1",
    port: num(process.env.TAURI_DRIVER_PORT, 4444),
    /** Optional explicit path to msedgedriver.exe — bypasses PATH lookup. */
    nativeDriver: process.env.MSEDGEDRIVER_PATH ?? ""
  },

  // ---- Web ----
  webBaseUrl: process.env.WEB_BASE_URL ?? "http://localhost:1420",
  webBrowser: process.env.WEB_BROWSER ?? "chrome",
  headless: bool(process.env.HEADLESS, false),

  // ---- Android (real device via adb/Appium) ----
  android: {
    appPackage: process.env.ANDROID_APP_PACKAGE ?? "com.fastboy.volt_pos",
    appActivity: process.env.ANDROID_APP_ACTIVITY ?? ".MainActivity",
    appPath: process.env.ANDROID_APP_PATH ?? "",
    deviceName: process.env.ANDROID_DEVICE_NAME ?? "",
    udid: process.env.ANDROID_UDID ?? "",
    appiumHost: process.env.APPIUM_HOST ?? "127.0.0.1",
    appiumPort: num(process.env.APPIUM_PORT, 4723),
    /**
     * Device→host localhost bridges the P8D WebView needs for backend data.
     * On the emulator the app does NOT reach the backend over the internet
     * directly — it calls `localhost:<port>`, which only reaches the laptop's
     * dev server + backend while these adb-reverse forwards are live (mirrors
     * `npm run android:reverse`). If they drop, the app shows "Couldn't load …
     * / Please check your connection" even though the laptop is online.
     * Override with ANDROID_REVERSE_PORTS="1420,1421".
     */
    reversePorts: ports(process.env.ANDROID_REVERSE_PORTS, [1420, 1421])
  },

  // ---- API ----
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:8080",
  apiToken: process.env.API_TOKEN ?? "",

  // ---- Test accounts ----
  testUser: {
    email: process.env.TEST_USER_EMAIL ?? "qa.user@p8d.local",
    pin: process.env.TEST_USER_PIN ?? "1234",
    /** Real staff token for the fallback login form. Leave empty to skip the
     *  happy-path login test (src/specs/android/staff-token-login.e2e.ts). */
    staffToken: process.env.STAFF_TOKEN ?? ""
  },
  testAdmin: {
    email: process.env.TEST_ADMIN_EMAIL ?? "qa.admin@p8d.local",
    pin: process.env.TEST_ADMIN_PIN ?? "9999"
  },

  // ---- Reporting ----
  allureResultsDir: process.env.ALLURE_RESULTS_DIR ?? "./reports/allure-results",
  logLevel: (process.env.LOG_LEVEL ?? "info") as LogLevel,
  screenshotsOnFailure: bool(process.env.SCREENSHOTS_ON_FAILURE, true),

  // ---- Timeouts ----
  waitTimeout: num(process.env.WAIT_TIMEOUT, 15_000),
  navigationTimeout: num(process.env.NAVIGATION_TIMEOUT, 30_000),
  longTimeout: num(process.env.LONG_TIMEOUT, 60_000),

  // ---- Misc ----
  retryFailedTests: num(process.env.RETRY_FAILED_TESTS, 1),
  parallelInstances: num(process.env.PARALLEL_INSTANCES, 1)
} as const

export type AppEnv = typeof ENV
