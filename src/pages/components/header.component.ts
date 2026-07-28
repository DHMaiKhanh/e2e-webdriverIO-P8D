import { SELECTORS } from "../../constants/selectors.js"
import { TIMEOUTS } from "../../constants/timeouts.js"
import { BaseComponent } from "./base.component.js"

/**
 * HeaderComponent — EXAMPLE reusable component kept as a template.
 *
 * Shows how to model a UI fragment that appears on many pages: scope every
 * query to the component root and expose intent-revealing actions.
 */
export class HeaderComponent extends BaseComponent {
  protected readonly rootSelector = SELECTORS.APP_SHELL.HEADER

  async openUserMenu(): Promise<void> {
    const menu = await this.$(SELECTORS.APP_SHELL.USER_MENU)
    await menu.waitForClickable({ timeout: TIMEOUTS.SHORT })
    await menu.click()
  }

  async logout(): Promise<void> {
    await this.openUserMenu()
    const btn = await $(SELECTORS.APP_SHELL.LOGOUT_BTN)
    await btn.waitForClickable({ timeout: TIMEOUTS.SHORT })
    await btn.click()
  }
}

export const header = new HeaderComponent()
