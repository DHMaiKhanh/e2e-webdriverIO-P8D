/**
 * UI strings & error messages used by assertions.
 * Mirror exactly what users see — change here when the app copy changes.
 */
export const MESSAGES = {
  LOGIN: {
    INVALID_CREDENTIALS: "Invalid email or PIN",
    REDIRECTING: "Sign in successful. Redirecting..."
  },

  SETTINGS: {
    SAVED: "Settings saved successfully"
  },

  COMMON: {
    NETWORK_ERROR: "Network error. Please try again.",
    UNAUTHORIZED: "Session expired. Please sign in again.",
    GENERIC_ERROR: "Something went wrong"
  }
} as const

export type MessageKey = keyof typeof MESSAGES
