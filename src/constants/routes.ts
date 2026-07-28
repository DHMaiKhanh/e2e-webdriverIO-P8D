/**
 * Route constants. Mirror the application's router tree here and keep this
 * file in sync when routes are added — specs reference these, never inline
 * URL strings.
 */
export const ROUTES = {
  ROOT: "/",
  SPLASHSCREEN: "/splashscreen",
  /** QR-code login screen — no locatable DOM hooks today, see LOGIN_STAFF_TOKEN selectors. */
  LOGIN: "/login",
  /** Fallback text-token login form, reached via a secret tap on the About/version info. */
  LOGIN_STAFF_TOKEN: "/login-staff-token",
  /** Customer-facing display — always the second Tauri window (label "customer"). */
  CUSTOMER: "/customer/",

  APP: {
    HOME: "/",
    SETTINGS: "/settings",
    ORDER_CHECKOUT: (orderId: string): string => `/order/${orderId}/checkout`
  }
} as const

export type AppRoute = (typeof ROUTES.APP)[keyof typeof ROUTES.APP]
