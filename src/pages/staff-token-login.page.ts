import { ROUTES } from "../constants/routes.js"
import { SELECTORS } from "../constants/selectors.js"
import { BasePage } from "./base.page.js"

/**
 * StaffTokenLoginPage — the real fallback login form at `/login-staff-token`
 * (src/routes/login-staff-token/-components/staff-token-form.tsx).
 *
 * The app's primary login is a QR-code screen with no locatable DOM hooks,
 * so this text-token form is the only login UI E2E can currently drive.
 * None of its elements carry a `data-testid`; selectors fall back to
 * `name`/`type` attributes — flag adding testids to the team when convenient.
 */
export class StaffTokenLoginPage extends BasePage {
  protected readonly pageName = "StaffTokenLoginPage"
  protected readonly rootSelector = SELECTORS.LOGIN_STAFF_TOKEN.INPUT

  async open(): Promise<void> {
    await browser.url(ROUTES.LOGIN_STAFF_TOKEN)
    await this.waitForLoaded()
  }

  async enterToken(token: string): Promise<void> {
    await this.safeFill(SELECTORS.LOGIN_STAFF_TOKEN.INPUT, token, "staff token input")
  }

  async submit(): Promise<void> {
    await this.safeClick(SELECTORS.LOGIN_STAFF_TOKEN.SUBMIT_BTN, "staff token submit")
  }

  async signIn(token: string): Promise<void> {
    await this.enterToken(token)
    await this.submit()
  }

  async hasErrorAlert(): Promise<boolean> {
    return $(SELECTORS.LOGIN_STAFF_TOKEN.ERROR_ALERT).isExisting()
  }

  async getErrorText(): Promise<string> {
    return $(SELECTORS.LOGIN_STAFF_TOKEN.ERROR_ALERT).getText()
  }
}

export const staffTokenLoginPage = new StaffTokenLoginPage()
