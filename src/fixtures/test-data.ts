import users from "../data/users.json" with { type: "json" }

/**
 * Strongly-typed fixture facade.
 *
 * Specs and page objects pull static test data through this module rather
 * than re-importing JSON. Adding a new role / record? Update the JSON file
 * and the type below — TypeScript will surface every spec that needs
 * adjustment.
 */

export interface TestUser {
  email: string
  pin: string
  role: "ADMIN" | "MANAGER" | "STAFF" | "CASHIER"
  displayName: string
  permissions: string[]
}

export const TEST_DATA = {
  users: users as Record<string, TestUser>
} as const

export const findUserByRole = (role: TestUser["role"]): TestUser | undefined =>
  Object.values(TEST_DATA.users).find((u) => u.role === role)
