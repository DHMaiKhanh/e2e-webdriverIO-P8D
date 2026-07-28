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
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      project: path.join(ROOT, "tsconfig.json")
    }
  },

  specs: [path.join(ROOT, "src/specs/**/*.e2e.ts")],
  exclude: [],

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
