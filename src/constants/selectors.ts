/**
 * Centralized selector registry.
 *
 * Convention: every interactive element should expose a stable
 * `data-testid` attribute. Tests reference IDs from this file — never
 * inline. When the UI changes, update one place.
 *
 * Selector helpers:
 *   testId("login-submit")   →  '[data-testid="login-submit"]'
 *   dataAttr("state", "open") →  '[data-state="open"]'
 *   byText("button", "Save")  →  'button*=Save'
 */

export const testId = (id: string): string => `[data-testid="${id}"]`
export const dataAttr = (attr: string, value: string): string => `[data-${attr}="${value}"]`
export const byText = (tag: string, text: string): string => `${tag}*=${text}`

export const SELECTORS = {
  // ---------------- Login (EXAMPLE/template — see LOGIN_STAFF_TOKEN for the real flow) ----------------
  LOGIN: {
    CARD: testId("login-card"),
    SUBMIT_BTN: testId("login-submit"),
    ERROR_MESSAGE: testId("login-error"),
    LOADING: testId("login-loading")
  },

  /**
   * Real fallback login form at `/login-staff-token`
   * (src/routes/login-staff-token/-components/staff-token-form.tsx).
   * The primary `/login` screen is QR-code based with no stable DOM hook at
   * all; this text form is the only login UI with locatable elements today.
   * Neither has a `data-testid` — flag adding one (see volt-e2e-spec skill).
   */
  LOGIN_STAFF_TOKEN: {
    // Verified against the live Android form: the field has no name/testid and
    // an auto-generated React id, so the placeholder is the only stable hook.
    INPUT: 'input[placeholder="Enter Staff Token"]',
    SUBMIT_BTN: 'button[type="submit"]',
    ERROR_ALERT: '[role="alert"], .destructive, .text-destructive'
  },

  /**
   * In-app numeric passcode keypad (permission re-verification gate), e.g.
   * src/routes/_app/settings/permissions/-components/passcode-guard-dialog.tsx.
   * No data-testid on the digit buttons — they're plain buttons whose only
   * distinguishing feature is their visible text, hence the `button=<n>` locators.
   */
  PASSCODE_GUARD: {
    DIGIT: (digit: number | string): string => `button=${digit}`,
    BACKSPACE: '[class*="icon-backspace"]',
    ERROR_TEXT: ".text-red-500"
  },

  /**
   * Customer-facing display window (second Tauri window, label "customer").
   * This is one of the few areas of the app with real production
   * `data-testid`s — src/routes/customer/-view-cart/payment-method-buttons.tsx.
   */
  CUSTOMER_DISPLAY: {
    PAY_BY_METHOD: (methodId: string): string => testId(`customer-pay-by-${methodId}`)
  },

  // ---------------- App shell ----------------
  APP_SHELL: {
    HEADER: testId("app-header"),
    SIDEBAR: testId("app-sidebar"),
    USER_MENU: testId("app-user-menu"),
    LOGOUT_BTN: testId("app-logout"),
    NAV_HOME: testId("nav-home"),
    NAV_SETTINGS: testId("nav-settings")
  },

  // ---------------- Settings ----------------
  SETTINGS: {
    SAVE_BTN: testId("settings-save"),
    SAVED_TOAST: testId("settings-saved-toast")
  },

  /**
   * The Tauri WebView's data-fetch error screen — "Couldn't load … / Please
   * check your connection / Try again" (e.g. the Orders list when the backend
   * bridge is down). No data-testid on it, so the retry control is matched by
   * its visible label. Recovery logic lives in src/utils/ensure-network.ts.
   */
  NETWORK_ERROR: {
    // Primary: the retry button. A broader `*=Try again` (any element) is used
    // as a fallback in code in case the control isn't a <button>.
    RETRY_BTN: "button*=Try again",
    RETRY_TEXT: "*=Try again",
    MESSAGE: "*=Please check your connection"
  },

  // ---------------- Common ----------------
  COMMON: {
    TOAST_SUCCESS: '[data-testid="toast-success"], [data-sonner-toast][data-type="success"]',
    TOAST_ERROR: '[data-testid="toast-error"], [data-sonner-toast][data-type="error"]',
    MODAL: '[role="dialog"]',
    MODAL_CLOSE: testId("modal-close"),
    MODAL_CONFIRM: testId("modal-confirm"),
    MODAL_CANCEL: testId("modal-cancel"),
    LOADING_SPINNER: testId("loading-spinner"),
    EMPTY_STATE: testId("empty-state")
  }
} as const
