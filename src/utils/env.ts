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
    appiumPort: num(process.env.APPIUM_PORT, 4723)
  },

  // ---- API ----
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:8080",
  apiToken: process.env.API_TOKEN ?? "",

  // ---- Test accounts ----
  testUser: {
    email: process.env.TEST_USER_EMAIL ?? "qa.user@p8d.local",
    pin: process.env.TEST_USER_PIN ?? "1234"
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
