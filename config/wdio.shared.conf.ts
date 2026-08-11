import "dotenv/config"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Options } from "@wdio/types"
import { ENV } from "../src/utils/env.js"
import { logger } from "../src/utils/logger.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

/**
 * Shared WebdriverIO configuration consumed by all environment-specific configs.
 * Environment configs (local / web / ci) override only the bits that differ —
 * capabilities, services, baseUrl, runner, etc.
 */
export const sharedConfig: Partial<Options.Testrunner> = {
  runner: "local",

  // Resolve CLI `--spec` globs from the project root, not the config dir.
  // WDIO defaults rootDir to the directory of the config file (config/), and it
  // only rebases a wildcard-free `--spec` to CWD — a glob like
  // `./src/specs/**/*.e2e.ts` is left relative to rootDir. Without this it would
  // glob `config/src/...` and silently match nothing.
  rootDir: ROOT,
  // WebdriverIO v9 auto-detects TypeScript and transpiles config + specs via
  // tsx/ts-node, driven by tsconfig.json — the old `autoCompileOpts` block was
  // removed in v8, so there is nothing to configure here.

  specs: [path.join(ROOT, "src/specs/**/*.e2e.ts")],
  // ⛔ LOGIN SPECS DISABLED — every run uses the already-authenticated,
  //    session-persisted app (appium:noReset), so login/token specs are no
  //    longer used. Excluding them here (one central place, inherited by every
  //    env config) means they are never LOADED — they neither run nor show up
  //    as skipped rows on the dashboard. To re-enable, remove the relevant
  //    entry below. Covers functional login tests + the login-once setup spec +
  //    the switch-shop ops spec (see each file's DISABLED banner).
  exclude: [
    path.join(ROOT, "src/specs/android/staff-token-login.e2e.ts"),
    path.join(ROOT, "src/specs/android/login-staff-token-form.e2e.ts"),
    path.join(ROOT, "src/specs/android/login-once.e2e.ts"),
    path.join(ROOT, "src/specs/android/switch-shop.e2e.ts"),
    path.join(ROOT, "src/specs/auth/staff-token-login.e2e.ts")
  ],

  maxInstances: ENV.parallelInstances,
  logLevel: ENV.logLevel,
  bail: 0,
  waitforTimeout: ENV.waitTimeout,
  waitforInterval: 250,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 3,

  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: ENV.longTimeout,
    retries: ENV.retryFailedTests,
    grep: process.env.TEST_TAGS || undefined
    // expect-webdriverio is auto-injected by @wdio/mocha-framework.
  },

  reporters: [
    "spec",
    [
      "allure",
      {
        outputDir: ENV.allureResultsDir,
        disableWebdriverStepsReporting: false,
        disableWebdriverScreenshotsReporting: false,
        useCucumberStepReporter: false,
        addConsoleLogs: true
      }
    ]
  ],

  // -------------------------------------------------------------------------
  // Hooks — kept minimal here; complex orchestration lives in src/hooks/.
  // -------------------------------------------------------------------------
  onPrepare: function (_config, capabilities) {
    logger.info(`[wdio] Starting E2E run | env=${ENV.testEnv} | capabilities=${capabilities.length}`)
  },

  before: async function () {
    const { registerCustomCommands } = await import("../src/hooks/custom-commands.js")
    registerCustomCommands()
  },

  beforeTest: async function (test) {
    logger.info(`▶  ${test.parent} > ${test.title}`)
  },

  afterTest: async function (test, _ctx, result) {
    if (!result.passed && ENV.screenshotsOnFailure) {
      const safeName = `${test.parent}-${test.title}`.replace(/[^a-z0-9]/gi, "_").toLowerCase()
      const dir = path.join(ROOT, "reports", "screenshots")
      const file = path.join(dir, `${safeName}-${Date.now()}.png`)
      try {
        const fs = await import("node:fs")
        fs.mkdirSync(dir, { recursive: true })
        await browser.saveScreenshot(file)
        logger.warn(`✗ FAILED — screenshot saved: ${file}`)
      } catch (err) {
        logger.error(`Could not save screenshot: ${(err as Error).message}`)
      }
    }
  },

  onComplete: function () {
    logger.info(`[wdio] Run finished. Reports → ${ENV.allureResultsDir}`)
  }
}

export default sharedConfig
