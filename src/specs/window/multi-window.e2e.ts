/**
 * Verifies the dual-window contract that every other checkout-related spec
 * relies on: the app always has a "main" (staff) and a "customer" window,
 * and the suite can switch between them reliably.
 */
import { expect } from "@wdio/globals"
import { ROUTES } from "@constants/routes.js"
import { getCurrentWindowLabel, switchToWindow, WINDOW_LABELS, withWindow } from "@utils/tauri-helper.js"

describe("Dual window @smoke", () => {
  it("exposes both the main and customer windows", async () => {
    const handles = await browser.getWindowHandles()
    expect(handles.length).toBeGreaterThanOrEqual(2)
  })

  it("can switch to the main window and read its label", async () => {
    await switchToWindow(WINDOW_LABELS.MAIN)
    await expect(await getCurrentWindowLabel()).toBe(WINDOW_LABELS.MAIN)
  })

  it("can switch to the customer window and back without losing context", async () => {
    await switchToWindow(WINDOW_LABELS.MAIN)

    const customerLabel = await withWindow(WINDOW_LABELS.CUSTOMER, async () => {
      await browser.url(ROUTES.CUSTOMER)
      return getCurrentWindowLabel()
    })

    expect(customerLabel).toBe(WINDOW_LABELS.CUSTOMER)
    // withWindow restores the previously active window automatically.
    await expect(await getCurrentWindowLabel()).toBe(WINDOW_LABELS.MAIN)
  })
})
