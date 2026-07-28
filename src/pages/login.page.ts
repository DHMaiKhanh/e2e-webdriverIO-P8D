import { ROUTES } from "../constants/routes.js"
import { SELECTORS } from "../constants/selectors.js"
import { BasePage } from "./base.page.js"

/**
 * LoginPage — EXAMPLE page object kept as a template.
 *
 * It shows the conventions every page object should follow:
 *   - extend BasePage
 *   - declare `pageName` + `rootSelector`
 *   - expose an `open()` navigator, query getters, and action methods
 *   - reference selectors from SELECTORS, never inline strings
 *
 * Adjust / replace the methods to match the real login flow, then add more
 * pages alongside this one and export them from `index.ts`.
 */
export class LoginPage extends BasePage {
  protected readonly pageName = "LoginPage"
  protected readonly rootSelector = SELECTORS.LOGIN.CARD

  // ------------------------------------------------------------ navigation

  async open(): Promise<void> {
    await browser.url(ROUTES.LOGIN)
    await this.waitForLoaded()
  }

  // -------------------------------------------------------------- queries

  async hasErrorMessage(): Promise<boolean> {
    return $(SELECTORS.LOGIN.ERROR_MESSAGE).isExisting()
  }

  async getErrorMessage(): Promise<string> {
    return $(SELECTORS.LOGIN.ERROR_MESSAGE).getText()
  }

  // ---------------------------------------------------------------- actions

  async submit(): Promise<void> {
    await this.safeClick(SELECTORS.LOGIN.SUBMIT_BTN, "login submit")
  }
}

export const loginPage = new LoginPage()
