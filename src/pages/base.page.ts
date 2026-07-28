import type { ChainablePromiseElement } from "webdriverio"
import { SELECTORS } from "../constants/selectors.js"
import { TIMEOUTS } from "../constants/timeouts.js"
import { logger } from "../utils/logger.js"
import { sleep, waitForRoute } from "../utils/wait.js"

/**
 * BasePage — the parent of every Page Object.
 *
 * Responsibilities:
 *   - Common waits, navigation, screenshot helpers
 *   - Toast / modal handling that every page needs
 *   - A single place to instrument *all* page actions (logging) without
 *     polluting individual pages
 *
 * Convention: page-specific selectors live on the subclass; this class only
 * touches `SELECTORS.COMMON.*`.
 */
export abstract class BasePage {
  /** Identifier shown in logs. Subclasses set this. */
  protected abstract readonly pageName: string

  /** A primary element used by `isLoaded()`. Subclasses override. */
  protected abstract readonly rootSelector: string

  // ----------------------------------------------------------------- waits

  async isLoaded(timeout = TIMEOUTS.MEDIUM): Promise<boolean> {
    try {
      await $(this.rootSelector).waitForDisplayed({
        timeout,
        timeoutMsg: `[${this.pageName}] root element ${this.rootSelector} not displayed in ${timeout}ms`
      })
      return true
    } catch (err) {
      logger.error(`[${this.pageName}] not loaded: ${(err as Error).message}`)
      return false
    }
  }

  async waitForLoaded(timeout = TIMEOUTS.MEDIUM): Promise<void> {
    const ok = await this.isLoaded(timeout)
    if (!ok) throw new Error(`[${this.pageName}] failed to load`)
    logger.debug(`[${this.pageName}] loaded`)
  }

  async waitForRoute(fragment: string, timeout = TIMEOUTS.MEDIUM): Promise<void> {
    await waitForRoute(fragment, { timeout })
  }

  // -------------------------------------------------------------- elements

  protected $(selector: string): ChainablePromiseElement {
    return $(selector)
  }

  protected $$(selector: string) {
    return $$(selector)
  }

  // ---------------------------------------------------------------- toasts

  async waitForSuccessToast(timeout = TIMEOUTS.SHORT): Promise<string> {
    const toast = await $(SELECTORS.COMMON.TOAST_SUCCESS)
    await toast.waitForDisplayed({ timeout, timeoutMsg: "Success toast did not appear" })
    return toast.getText()
  }

  async waitForErrorToast(timeout = TIMEOUTS.SHORT): Promise<string> {
    const toast = await $(SELECTORS.COMMON.TOAST_ERROR)
    await toast.waitForDisplayed({ timeout, timeoutMsg: "Error toast did not appear" })
    return toast.getText()
  }

  // ---------------------------------------------------------------- modals

  async confirmModal(): Promise<void> {
    const btn = await $(SELECTORS.COMMON.MODAL_CONFIRM)
    await btn.waitForClickable({ timeout: TIMEOUTS.SHORT })
    await btn.click()
  }

  async cancelModal(): Promise<void> {
    const btn = await $(SELECTORS.COMMON.MODAL_CANCEL)
    await btn.waitForClickable({ timeout: TIMEOUTS.SHORT })
    await btn.click()
  }

  async closeModal(): Promise<void> {
    const btn = await $(SELECTORS.COMMON.MODAL_CLOSE)
    if (await btn.isExisting()) await btn.click()
  }

  // ------------------------------------------------------------- utilities

  /**
   * Resilient click — waits for element, scrolls into view, clicks, retries
   * once on stale-element / intercept. This is the click most pages should use.
   */
  protected async safeClick(selector: string, label?: string): Promise<void> {
    const tag = label ?? selector
    const el = await $(selector)
    await el.waitForClickable({
      timeout: TIMEOUTS.MEDIUM,
      timeoutMsg: `[${this.pageName}] ${tag} not clickable`
    })
    await el.scrollIntoView({ block: "center", inline: "center" })
    try {
      await el.click()
    } catch (err) {
      if (/stale element|element click intercepted/i.test((err as Error).message)) {
        logger.warn(`[${this.pageName}] retrying click on ${tag} after intercept`)
        await sleep(200)
        await (await $(selector)).click()
      } else {
        throw err
      }
    }
  }

  /** Type into an input, clearing any existing value first. */
  protected async safeFill(selector: string, value: string, label?: string): Promise<void> {
    const tag = label ?? selector
    const el = await $(selector)
    await el.waitForDisplayed({
      timeout: TIMEOUTS.MEDIUM,
      timeoutMsg: `[${this.pageName}] ${tag} not visible`
    })
    await el.click()
    await el.clearValue()
    await el.setValue(value)
  }

  async getCurrentUrl(): Promise<string> {
    return browser.getUrl()
  }

  async screenshot(label: string): Promise<string> {
    const safe = label.replace(/[^a-z0-9]/gi, "_").toLowerCase()
    const file = `./reports/screenshots/${this.pageName}-${safe}-${Date.now()}.png`
    await browser.saveScreenshot(file)
    logger.info(`[${this.pageName}] screenshot → ${file}`)
    return file
  }
}
