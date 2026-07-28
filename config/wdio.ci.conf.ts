import type { Options } from "@wdio/types"
import { ENV } from "../src/utils/env.js"
import sharedConfig from "./wdio.shared.conf.js"

/**
 * CI config — headless browser run for pipelines.
 *
 * Inherits the web config's shape but forces headless + bail-on-first-failure
 * off, and lets PARALLEL_INSTANCES scale across CI cores. Point baseUrl at the
 * deployed/preview environment via WEB_BASE_URL.
 */
export const config: Options.Testrunner = {
  ...sharedConfig,

  baseUrl: ENV.webBaseUrl,
  maxInstances: ENV.parallelInstances,

  capabilities: [
    {
      browserName: ENV.webBrowser,
      "goog:chromeOptions": {
        args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1920,1080"]
      }
    } as WebdriverIO.Capabilities
  ],

  services: []
}

export default config
