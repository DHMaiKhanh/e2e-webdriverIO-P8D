import { faker } from "@faker-js/faker"
import { v7 as uuidv7 } from "uuid"
import { toCents } from "./currency.js"

/**
 * Test data factory.
 *
 * Generates production-shaped fixtures (uuidv7 IDs, integer cents for money)
 * so test data round-trips through the same validators as real records.
 * Pass `overrides` to pin any field you assert on.
 */

export interface FakeCustomer {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  createdAt: string
}

export interface FakeProduct {
  id: string
  name: string
  priceCents: number
  categoryId: string
}

export const factory = {
  customer(overrides: Partial<FakeCustomer> = {}): FakeCustomer {
    return {
      id: uuidv7(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email().toLowerCase(),
      phone: faker.phone.number({ style: "international" }),
      createdAt: new Date().toISOString(),
      ...overrides
    }
  },

  product(overrides: Partial<FakeProduct> = {}): FakeProduct {
    return {
      id: uuidv7(),
      name: faker.commerce.productName(),
      priceCents: toCents(faker.number.float({ min: 10, max: 250, fractionDigits: 2 })),
      categoryId: uuidv7(),
      ...overrides
    }
  },

  /** A unique stable-looking email under our test domain. */
  testEmail(prefix = "qa"): string {
    return `${prefix}.${faker.string.alphanumeric(6).toLowerCase()}@p8d.test`
  },

  /** 4-digit PIN string. */
  pin(): string {
    return faker.string.numeric(4)
  }
}
