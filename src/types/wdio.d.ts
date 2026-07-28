/// <reference types="@wdio/globals/types" />
/// <reference types="@wdio/mocha-framework" />
/// <reference types="expect-webdriverio" />

declare namespace WebdriverIO {
  interface Browser {
    /** Navigate to an app route and log the transition. */
    gotoRoute(route: string): Promise<void>

    /** Run an async assertion, suppress the throw, and return a record of the failure. */
    softAssert(
      fn: () => Promise<void>,
      message: string
    ): Promise<{ message: string; error: string } | null>
  }

  interface Element {
    /** Wait for clickable then click — combined for one-liners. */
    waitAndClick(timeout?: number): Promise<void>
  }
}
