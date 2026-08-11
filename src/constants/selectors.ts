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

// --- Real Tauri-webview hooks (Đường A2) ---------------------------------
// The P8D webview ships NO data-testid, but its DOM is fully queryable and the
// UI kit tags elements with a stable `data-slot`. Payment tenders use these:
//   summary-item  → a breakdown row (label span + value span) — read via
//                   utils/tender-webview.readSummary*(), never a selector const
//   pressable     → Quick-cash / tip-preset chips
//   keypad-key    → numpad digit keys
//   span.font-data.text-4xl → the large received/due/tip figure (BIG_MONEY)
/** data-slot attribute selector (the app's stable webview hook). */
export const slot = (name: string): string => `[data-slot="${name}"]`
/** The large received / amount-due / tip figure shared by every tender screen. */
export const BIG_MONEY = "span.font-data.text-4xl"
/** A <button> whose exact visible text equals `t`. */
const btnText = (t: string): string => `//button[normalize-space()="${t}"]`
/** A `data-slot="pressable"` chip (Quick cash / tip preset) by exact text. */
const pressable = (t: string): string => `//button[@data-slot="pressable"][normalize-space()="${t}"]`
/** A numpad key (`data-slot="keypad-key"`) by label ("1".."9", "0", "C"). */
const keypad = (n: string): string => `//button[@data-slot="keypad-key"][normalize-space()="${n}"]`

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

  /**
   * Payment-method screen reached from Review order via [Charge $X]
   * (docs/payment-test-cases.md §2, §8.1). Lists Card / Cash / Gift card /
   * Other, each with an amount.
   *
   * ⚠️ These data-testids are a §9 PROPOSAL — they do NOT exist in the WebView
   * yet. Gate any spec that drives this screen behind VOLT_PAYMENT_TESTIDS until
   * the app ships them (see the volt-e2e-spec skill).
   */
  PAYMENT_METHOD: {
    // id: "card" | "cash" | "gift-card" | "other"
    METHOD: (id: string): string => testId(`pay-method-${id}`),
    METHOD_AMOUNT: (id: string): string => testId(`pay-method-amount-${id}`),
    HEADER: byText("*", "Payment method")
  },

  /**
   * Create-order wizard — New Sale › Select Staff (Step 1/2) › Add service
   * (Step 2/2) › Review order. Mirrors docs/order-test-cases.md §2.3 (the
   * shared checkout helper drives this to reach Payment method).
   *
   * ⚠️ These data-testids are a PROPOSAL — index-addressable rows so the helper
   * can pick "the first staff / first service" without hard-coding dev-shop
   * names (which are ephemeral). Gate behind VOLT_PAYMENT_TESTIDS.
   */
  SALE_FLOW: {
    STEP1_HEADER: byText("*", "choose a technician"),
    STEP2_HEADER: byText("*", "Add service"),
    // Step 1 · Select Staff — 0-based row index
    STAFF_ROW: (index: number): string => testId(`sale-staff-${index}`),
    NO_TECH_NEEDED: byText("*", "No technician needed"),
    // Step 2 · Add service — 0-based service-card index
    SERVICE_CARD: (index: number): string => testId(`sale-service-${index}`),
    CATEGORY_CHIP: (name: string): string => byText("button", name),
    REVIEW_ORDER_BTN: byText("button", "Review order")
  },

  /**
   * Review order screen (order detail before Charge) — docs §8.9/§8.8 discounts
   * and the [Charge $X] gateway to Payment method. Keys reuse the
   * docs/order-test-cases.md §9 names (order-charge / order-subtotal / …).
   */
  REVIEW_ORDER: {
    HEADER: byText("*", "Review order"),
    CHARGE_BTN: testId("order-charge"),
    SUBTOTAL: testId("order-subtotal"),
    TOTAL: testId("order-total"),
    // 0-based line-item row (tap to open the item sheet — §8.9)
    ITEM_ROW: (index: number): string => testId(`order-line-${index}`)
  },

  // ---------------- Cash payment (§3, §8.2) — real webview selectors ----------
  // Breakdown rows (Subtotal / Service fee / Cash discount / Amount due /
  // Change due) are read via utils/tender-webview by label, not by a const.
  CASH_PAYMENT: {
    HEADER: btnText("Accept cash"), // unique to the Cash screen → good rootSelector
    RECEIVED: BIG_MONEY, // the large "CASH RECEIVED" figure
    // label passed already as display text ("Exact" | "$100" | "$120" | "$150")
    QUICK_CASH: (label: string): string => pressable(label),
    KEYPAD: (n: number | string): string => keypad(String(n)),
    TIP_BTN: btnText("Tip"),
    ACCEPT_CASH: btnText("Accept cash")
  },

  // ---------------- Gift card / Redeem (§4, §8.3) — real webview selectors -----
  // Subtotal / Service fee / Cash discount rows + balance/applying are read via
  // utils/tender-webview by label; AMOUNT DUE is the BIG_MONEY figure.
  GIFT_CARD: {
    HEADER: 'input[placeholder="Gift card code"]', // rootSelector — unique to this screen
    CODE_INPUT: 'input[placeholder="Gift card code"]',
    SCAN_BTN: '//input[@placeholder="Gift card code"]/following::button[1]',
    AMOUNT_DUE: BIG_MONEY,
    REDEEM_BTN: btnText("Redeem"),
    TIP_BTN: btnText("Tip")
  },

  // ---------------- Other payment (§5, §8.4) — real webview selectors ----------
  // Subtotal / Service fee / Amount due / Remaining rows read via
  // utils/tender-webview by label. No cash-discount row (keeps the fee).
  OTHER_PAYMENT: {
    HEADER: btnText("Record payment"), // unique to the Other screen → rootSelector
    RECEIVED: BIG_MONEY, // the large "amount received" figure
    KEYPAD: (n: number | string): string => keypad(String(n)),
    CLEAR_BTN: keypad("C"),
    BACKSPACE: '//button[@data-slot="keypad-key"][not(normalize-space())]',
    RECORD_PAYMENT: btnText("Record payment"),
    TIP_BTN: btnText("Tip")
  },

  // ---------------- Add Tip (§6, §8.5) — real webview selectors ---------------
  TIP: {
    HEADER: btnText("Add tip"), // rootSelector — unique to the Add Tip screen
    AMOUNT: BIG_MONEY, // the large "TIP AMOUNT" figure
    // Percent chips are merchant-configured (tiệm 14: 10/15/20/25/30/35% → chip
    // text "10%" …). The old "0%" clear chip was REPLACED by a "Custom Tip" chip
    // (VP UI change 2026-08): tapping it enters manual-entry mode at $0. Clearing
    // a running tip is now the keypad "C" key (both reset TIP AMOUNT to $0).
    PRESET: (pct: number): string => pressable(`${pct}%`),
    CUSTOM_TIP: pressable("Custom Tip"),
    KEYPAD: (n: number | string): string => keypad(String(n)),
    CLEAR: keypad("C"),
    ADD_TIP: btnText("Add tip")
  },

  // ---------------- Card payment (§2.1, §8.6) ----------------
  // Two runtime states, chosen by device capability (VP-2191 UI change 2026-08):
  //   • BLOCKED — no Kozen P8 / `capabilities.charge` falsy → a "Card payment
  //     unavailable" note + a "Choose another method" button.
  //   • IDLE    — the confirm-charge screen: a disabled primary "Charge · $X"
  //     (or "Retry · $X" after a decline) plus a secondary "Tip" button.
  // On the emulator (no card terminal) card is NEVER completable: it is either
  // BLOCKED, or IDLE with the Charge button present-but-DISABLED. Specs assert
  // that invariant rather than a single hard-coded copy.
  CARD_PAYMENT: {
    // XPath on the NavBar title span (present in BOTH idle & blocked states).
    // The webview reliably resolves XPath (cash uses the same //button style);
    // WDIO's `*=`/`**=` text forms did NOT match this span, so anchor exactly.
    HEADER: '//span[normalize-space()="Card payment"]',
    UNAVAILABLE: '//*[normalize-space()="Card payment unavailable"]',
    CHOOSE_ANOTHER: byText("button", "Choose another method"),
    CHARGE_BTN: byText("button", "Charge"),
    // NavBar back — leaves the screen (→ /payment/choose). The IDLE state has no
    // "Choose another method" button, so this is how a spec exits there.
    NAV_BACK: '//button[@data-slot="nav-icon-button"]'
  },

  /**
   * Payment complete / staff passcode / receipt (§6.1, §8.7).
   * NB: the 4-digit passcode keypad already exists as
   * SELECTORS.PASSCODE_GUARD.DIGIT(n) — reuse it, don't duplicate.
   */
  PAYMENT_COMPLETE: {
    PASSCODE_MODAL: byText("*", "Enter staff code to complete payment"),
    SKIP_PASSCODE: testId("skip-passcode-30m"),
    APPROVED_BADGE: testId("payment-approved"),
    // type: "email" | "text" | "print" | "none"
    RECEIPT: (type: string): string => testId(`receipt-${type}`),
    NEW_ORDER: testId("new-order")
  },

  // ---------------- Review order: promo / reward (§8.8) ----------------
  PROMO_REWARD: {
    APPLY_ENTRY: testId("apply-promo-reward"),
    SHEET_HEADER: byText("*", "Promo & Rewards"),
    NO_PROMOTIONS: byText("*", "No promotions available"),
    PROMO_ITEM: (id: string): string => testId(`promo-item-${id}`),
    REWARD_ITEM: (id: string): string => testId(`reward-item-${id}`),
    APPLY_TO_ORDER: testId("promo-reward-apply"),
    CLOSE: testId("promo-reward-close")
  },

  // ---------------- Review order: item discount (§8.9) ----------------
  ITEM_DISCOUNT: {
    PRICE: testId("item-price"),
    NOTE: testId("item-note"),
    DISCOUNT_TOGGLE: testId("item-discount-toggle"),
    SAVE: testId("item-save"),
    // mode: "percent" | "amount"
    MODE: (mode: string): string => testId(`discount-mode-${mode}`),
    KEY: (n: number | string): string => testId(`discount-key-${n}`),
    // The live "N%" / "$X.XX" readout on the Discount keypad.
    DISPLAY: testId("discount-display"),
    OK: testId("discount-ok"),
    LINE: testId("item-discount-line")
  },

  // ---------------- Order detail actions (§8.10) ----------------
  ORDER_DETAIL: {
    PAYMENT_DETAILS: byText("*", "Payment details"),
    SEND_SHEET: byText("*", "Send receipt"),
    SHARE: testId("order-share"),
    CANCEL_ORDER: testId("cancel-order"),
    REPRINT_RECEIPT: testId("reprint-receipt"),
    SUBTOTAL: testId("order-detail-subtotal"),
    TOTAL_PAID: testId("order-detail-total-paid"),
    PAYMENT_METHOD: testId("order-detail-payment-method"),
    STATUS_BADGE: testId("order-detail-status"),
    // key: "customer-request" | "service-issue" | "incorrect-order" | ...
    CANCEL_DIALOG: byText("*", "Cancel this order?"),
    CANCEL_REASON: (key: string): string => testId(`cancel-reason-${key}`),
    CANCEL_CONFIRM: testId("cancel-confirm"),
    CANCEL_BACK: testId("cancel-back"),
    // type: "email" | "text"
    SEND_RECEIPT: (type: string): string => testId(`send-receipt-${type}`),
    RECEIPT_INPUT: testId("receipt-input"),
    RECEIPT_SEND: testId("receipt-send")
  },

  // ---------------- Orders list status tabs (§8.11) ----------------
  ORDERS_LIST: {
    // key: "all" | "pending" | "re-open" | "successful" | "canceled"
    STATUS_TAB: (key: string): string => testId(`orders-status-${key}`),
    ORDER_CARD: (id: string): string => testId(`order-card-${id}`),
    EMPTY: byText("*", "No orders match these filters")
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
