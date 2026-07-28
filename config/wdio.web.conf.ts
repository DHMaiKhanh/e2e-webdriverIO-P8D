import type { Options } from "@wdio/types"
import { ENV } from "../src/utils/env.js"
import sharedConfig from "./wdio.shared.conf.js"

/**
 * Web config — runs the frontend in a real browser (Chrome by default).
 *
 * Use for fast feedback while the desktop binary isn't needed. WebdriverIO 9
 * auto-manages the matching browser driver, so no manual driver install.
 */

const chromeArgs = ["--disable-dev-shm-usage", "--no-sandbox"]
if (ENV.headless) chromeArgs.push("--headless=new", "--window-size=1920,1080")

export const config: Options.Testrunner = {
  ...sharedConfig,

  baseUrl: ENV.webBaseUrl,

  capabilities: [
    {
      browserName: ENV.webBrowser,
      "goog:chromeOptions": {
        args: chromeArgs
      }
    } as WebdriverIO.Capabilities
  ],

  services: []
}

export default config
