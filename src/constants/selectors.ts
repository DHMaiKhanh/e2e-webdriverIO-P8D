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
 *   byText("button", "Save")  →  innermost <button> whose text contains "Save"
 *   byText("*", "Saved")      →  innermost element whose text contains "Saved"
 */

export const testId = (id: string): string => `[data-testid="${id}"]`
export const dataAttr = (attr: string, value: string): string => `[data-${attr}="${value}"]`
/**
 * Text selector as **XPath**, matching the *innermost* element of `tag` whose
 * normalized text CONTAINS `text`.
 *
 * NB: do NOT emit the CSS `tag*=text` form. WDIO rejects a `*` tag (`byText("*",…)`
 * → `**=text`) with "invalid or illegal selector" (status 32) — which crashes a
 * page's `waitForLoaded`/`safeClick` — and even the valid `button*=…` form does
 * not reliably match text inside the Tauri webview's nested spans (see
 * CARD_PAYMENT.HEADER). XPath `contains(normalize-space())` is the form the rest
 * of this file already trusts (btnText / pressable / slotExact).
 */
export const byText = (tag: string, text: string): string => {
  const el = tag && tag !== "*" ? tag.toLowerCase() : "*"
  return `//${el}[contains(normalize-space(.),"${text}")][not(.//${el}[contains(normalize-space(.),"${text}")])]`
}

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
/** A header icon button (`data-slot="nav-icon-button"`) by its aria-label. */
const navIcon = (label: string): string => `[data-slot="nav-icon-button"][aria-label="${label}"]`
/** A checkbox row (`data-slot="checkbox"`) by its aria-label (staff / payment). */
const checkboxAria = (label: string): string => `[data-slot="checkbox"][aria-label="${label}"]`
/** Any element with a given `data-slot` whose exact trimmed text equals `t`. */
const slotExact = (name: string, t: string): string => `//*[@data-slot="${name}"][normalize-space()="${t}"]`
/** A `data-slot="pressable"` button by exact visible text. */
const pressableText = (t: string): string => `//button[@data-slot="pressable"][normalize-space()="${t}"]`
/** An order-detail breakdown row (`data-slot="summary-item"`) whose label span
 * equals `label` — e.g. summaryRow("Subtotal") → the "Subtotal$124.00" row. */
const summaryRow = (label: string): string =>
  `//*[@data-slot="summary-item"][.//span[normalize-space()="${label}"]]`
/** Cancel-reason radio labels, keyed by the spec's stable key (OCAN-02). */
const CANCEL_REASON_LABELS: Record<string, string> = {
  "customer-request": "Customer request",
  "service-issue": "Service issue",
  "incorrect-order": "Incorrect order",
  "duplicate-payment": "Duplicate payment",
  "promotion-discount-error": "Promotion / discount error",
  "staff-mistake": "Staff mistake",
  other: "Other"
}
/** Order-History status-tab display text, keyed by the spec's stable key. */
const STATUS_TAB_TEXT: Record<string, string> = {
  all: "All",
  pending: "Pending",
  "re-open": "Re-open",
  "successful-unsettled": "Successful - Unsettled",
  "successful-settled": "Successful - Settled",
  canceled: "Canceled"
}
/** Filter Sort-by radio form values, keyed by the spec's option key. */
const SORT_VALUE: Record<string, string> = {
  "last-updated": "updatedAt",
  "date-completed": "completedAt"
}
/** Filter Payment-method checkbox aria-labels, keyed by the spec's method key. */
const PAYMENT_LABEL: Record<string, string> = {
  card: "Card",
  cash: "Cash",
  "gift-card": "Gift Card",
  other: "Other"
}
/** Date-picker quick-preset display text, keyed by the spec's preset key. */
const DATE_PRESET_TEXT: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "last-7-days": "Last 7 days",
  "this-month": "This month"
}
/** Customer profile segment-tab display text, keyed by the spec's tab key. */
const CUSTOMER_TAB_TEXT: Record<string, string> = {
  orders: "Orders",
  rewards: "Rewards",
  history: "History"
}

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
    // an exact-text anchor is clearer here than byText's contains() form.
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

  // ---------------- Order detail actions (§8.10) + completed-order receipt ----
  // Reused by docs/order-history-test-cases.md §4.6 (the read-only receipt of a
  // finished order is the same screen). Money getters keep the `order-detail-*`
  // prefix already established here.
  // Real Tauri-webview hooks (route /order/<id>/detail). No data-testid ships; the
  // receipt is built from `summary-item` rows (label span + value span),
  // `line-item` service rows, `info-item` technician group, `badge` status pills,
  // and text-addressed section headers / footer buttons. Money getters parse the
  // "$X.XX" out of a row's text (see OrderDetailPage.moneyOf).
  ORDER_DETAIL: {
    PAYMENT_DETAILS: '//*[contains(text(),"Payment details")]',
    // Header Share = the "Send receipt" icon button; sheet = its action list.
    SEND_SHEET: slotExact("sheet-title", "Send receipt"),
    SHARE: navIcon("Send receipt"),
    // Footer actions (scope to the bottom bar so the dialog's twin doesn't clash).
    CANCEL_ORDER: '//*[@data-slot="bottom-bar"]//button[normalize-space()="Cancel order"]',
    REPRINT_RECEIPT: '//*[@data-slot="bottom-bar"]//button[normalize-space()="Reprint receipt"]',
    // Breakdown rows — matched by their label span, value parsed from the row text.
    SUBTOTAL: summaryRow("Subtotal"),
    TOTAL_PAID: summaryRow("Total paid"),
    TIP: summaryRow("Tip"),
    CASHIER: summaryRow("Cashier"),
    CUSTOMER: summaryRow("Customer"),
    PAYMENT_METHOD: '//*[contains(text(),"Payment details")]', // block header; method text read from body
    // First badge = order status; last badge = payment status ("Successful").
    STATUS_BADGE: '(//*[@data-slot="badge"])[1]',
    PAYMENT_STATUS: '(//*[@data-slot="badge"])[last()]',
    // Cancel dialog — key: "customer-request" | "service-issue" | ...
    CANCEL_DIALOG: slotExact("dialog-title", "Cancel this order?"),
    CANCEL_REASON: (key: string): string => `//label[normalize-space()="${CANCEL_REASON_LABELS[key] ?? key}"]`,
    CANCEL_CONFIRM: '//*[@data-slot="dialog-footer"]//button[normalize-space()="Cancel order"]',
    CANCEL_BACK: '//*[@data-slot="dialog-footer"]//button[normalize-space()="Back"]',
    // Send-receipt action sheet — type: "email" | "text"
    SEND_RECEIPT: (type: string): string =>
      `//*[@data-slot="action-sheet-item"][contains(normalize-space(),"${type === "email" ? "Email" : "Text"}")]`,
    RECEIPT_INPUT: '[data-slot="action-sheet-item"] input, input[type="email"], input[type="tel"]',
    RECEIPT_SEND: '//button[normalize-space()="Send"]',

    // --- Completed-order receipt fields (order-history §2.5 / §4.6) ---
    ORDER_ID: slot("nav-bar"), // header "#OD…" order number
    ORDER_INFORMATION: '//*[contains(text(),"Order information")]',
    TECH_GROUP: slot("info-item"), // technician grouping block
    // Service line rows — each is "<service name>$<price>" (price parsed in page object)
    SERVICE_LINE_ANY: slot("line-item"),
    SERVICE_LINE_PRICE: slot("line-item"),
    // Card-tender only: brand ··last4 + transaction id (cash/gift have neither)
    CARD_BRAND: '//span[contains(text(),"··") or contains(text(),"••")]',
    TRANSACTION_ID: summaryRow("Transaction")
  },

  // ---------------- Orders list status tabs (§8.11) ----------------
  ORDERS_LIST: {
    // key: "all" | "pending" | "re-open" | "successful" | "canceled"
    STATUS_TAB: (key: string): string => testId(`orders-status-${key}`),
    ORDER_CARD: (id: string): string => testId(`order-card-${id}`),
    EMPTY: byText("*", "No orders match these filters")
  },

  /**
   * Order History — the browse surface: Orders list + status tabs + date nav +
   * search (docs/order-history-test-cases.md §2.1–2.3, §4.1/4.2/4.3/4.5).
   *
   * ⚠️ testid-first per doc §5 — these hooks do NOT exist in the WebView yet;
   * the app team must ship them. The doc's "tạm" text/aria fallbacks are only
   * for exploratory scans, not encoded here (one durable selector per key).
   * Text inputs use the observed placeholder (the repo already trusts
   * placeholder hooks for inputs — see LOGIN_STAFF_TOKEN / GIFT_CARD).
   */
  ORDER_HISTORY: {
    HEADER: slot("nav-bar"),
    SEARCH_BTN: navIcon("Search orders"),
    // The search toggle flips its aria-label to "Close search" while open.
    SEARCH_CLOSE: navIcon("Close search"),
    SEARCH_INPUT: 'input[placeholder="Search order # or customer"]',
    FILTER_BTN: navIcon("Filter orders"),
    // Date nav — the label sits between the Previous/Next day icon buttons; address
    // it positionally so it works for any day text ("Today · Aug 12" / "Aug 11").
    DATE_PREV: '[data-slot="pressable"][aria-label="Previous day"]',
    DATE_NEXT: '[data-slot="pressable"][aria-label="Next day"]',
    DATE_LABEL: '//button[@aria-label="Previous day"]/following-sibling::button[@data-slot="pressable"][1]',
    // Status tabs are header pressables keyed by display text (STATUS_TAB_TEXT).
    // key: "all" | "pending" | "re-open" | "successful-unsettled" | "successful-settled"
    STATUS_TAB: (key: string): string => pressableText(STATUS_TAB_TEXT[key] ?? key),
    // Order cards — content-area pressables. No id ships; a card is addressed by its
    // visible #OD code (see OrderHistoryPage). Status is a `badge` span inside.
    CARD_ANY: '[data-slot="screen-scaffold-content"] button[data-slot="pressable"]',
    CARD_BADGE: slot("badge"),
    // Empty state is detected by cardCount()===0 (copy varies), not a fixed string.
    EMPTY: byText("*", "No orders")
  },

  /**
   * Filter sheet — Sort by / Staff / Payment method (order-history §2.2, §4.4).
   * Real hooks: sort = radio-group-items keyed by their form value (updatedAt /
   * completedAt); staff + payment = `checkbox` rows keyed by aria-label.
   */
  ORDER_FILTER: {
    SHEET: slotExact("sheet-title", "Filter"),
    // option: "date-completed" | "last-updated"
    SORT: (option: string): string => `button[role="radio"][value="${SORT_VALUE[option] ?? option}"]`,
    STAFF_SEARCH: 'input[placeholder="Search staff"]',
    STAFF_OPTION: (name: string): string => checkboxAria(name),
    // Staff options = every checkbox EXCEPT the four payment-method checkboxes.
    STAFF_OPTION_ANY:
      '[data-slot="checkbox"]:not([aria-label="Card"]):not([aria-label="Cash"]):not([aria-label="Gift Card"]):not([aria-label="Other"])',
    // method: "card" | "cash" | "gift-card" | "other"
    PAYMENT: (method: string): string => checkboxAria(PAYMENT_LABEL[method] ?? method),
    APPLY: '//button[normalize-space()="Apply"]',
    CLEAR_ALL: pressableText("Clear all")
  },

  /**
   * Date picker sheet (`/orders?sheet=date`) — quick presets + a react-day-picker
   * month calendar. Day cells live in `td[data-day="YYYY-MM-DD"]`; future days are
   * disabled. Presets and the footer are addressed by text.
   */
  DATE_PICKER: {
    SHEET: slotExact("sheet-title", "Select date"),
    // preset: "today" | "yesterday" | "last-7-days" | "this-month"
    PRESET: (preset: string): string => pressableText(DATE_PRESET_TEXT[preset] ?? preset),
    // iso: "2026-08-10" — the gridcell carries the ISO day; click the button inside.
    DAY: (iso: string): string => `td[data-day="${iso}"] button`,
    // The currently-selected day (its aria-label ends ", selected").
    SELECTED_DAY: '//td//button[contains(@aria-label,", selected")]',
    VIEW_ORDERS: '//button[normalize-space()="View orders"]'
  },

  /**
   * Customer — Find Customer list + the profile whose Orders tab is the
   * per-customer order history (order-history §2.6, §4.7). No ids ship: customer
   * rows and order rows are addressed positionally; stats are read from text.
   */
  CUSTOMER: {
    SEARCH_INPUT: '[data-slot="search-bar-input"]',
    ROW_ANY: '[data-slot="screen-scaffold-content"] [data-slot="pressable"]',
    // Profile header — masked phone is the pressable "•••-•••-XXXX".
    PHONE: '//*[@data-slot="pressable"][contains(., "•")]',
    EDIT_BTN: navIcon("Edit customer"),
    // The profile is "loaded" once its segment tab bar exists.
    STAT_ROOT: slot("segment-tabs"),
    // tab: "orders" | "rewards" | "history"
    PROFILE_TAB: (tab: string): string => slotExact("segment-tabs-trigger", CUSTOMER_TAB_TEXT[tab] ?? tab),
    PROFILE_TAB_ANY: slot("segment-tabs-trigger"),
    // Orders tab — per-customer order rows (content pressables carrying an #OD code).
    ORDER_ROW_ANY: '[data-slot="screen-scaffold-content"] [data-slot="pressable"]',
    ORDER_EMPTY: '//*[contains(text(),"No orders yet")]',
    HISTORY_EMPTY: '//*[contains(text(),"No appointment history")]'
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
