/**
 * Covers the fallback text-token login form at /login-staff-token
 * (src/routes/login-staff-token/-components/staff-token-form.tsx).
 *
 * The app's primary /login screen is QR-code based with no assertable DOM
 * state machine hook, so this is the only login entry point E2E can drive
 * today without adding data-testid attributes to the QR flow.
 */
import { expect } from "@wdio/globals"
import { staffTokenLoginPage } from "@pages"

describe("Staff token login @smoke", () => {
  beforeEach(async () => {
    await staffTokenLoginPage.open()
  })

  it("loads the staff token form", async () => {
    await expect(await staffTokenLoginPage.isLoaded()).toBe(true)
  })

  it("shows an error for an invalid staff token", async () => {
    await staffTokenLoginPage.signIn("00000000-invalid-token")
    await expect(await staffTokenLoginPage.hasErrorAlert()).toBe(true)
  })
})
