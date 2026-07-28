import currency from "currency.js"

/**
 * Money helpers.
 *
 * Convention: amounts are stored as **integer cents**. Tests must never use
 * raw `Math.round()` or float arithmetic — go through these.
 *
 *   toCents(12.34)        →  1234
 *   fromCents(1234)       →  12.34
 *   formatMoney(1234)     →  "$12.34"
 *   sumCents([100, 250])  →  350
 */
export const toCents = (amount: number | string): number => currency(amount).intValue

export const fromCents = (cents: number): number => currency(cents, { fromCents: true }).value

export const formatMoney = (cents: number, opts: { symbol?: string; precision?: number } = {}): string => {
  const { symbol = "$", precision = 2 } = opts
  return currency(cents, { fromCents: true, symbol, precision }).format()
}

export const sumCents = (values: number[]): number =>
  values.reduce((acc, v) => currency(acc, { fromCents: true }).add(currency(v, { fromCents: true })).intValue, 0)

export const subtractCents = (a: number, b: number): number =>
  currency(a, { fromCents: true }).subtract(currency(b, { fromCents: true })).intValue

export const applyPercentage = (cents: number, percent: number): number =>
  currency(cents, { fromCents: true }).multiply(percent / 100).intValue

/**
 * Verify two money amounts match within a 1-cent rounding tolerance.
 * Arithmetic over many line items can drift; assert with `expectMoneyEqual`
 * rather than `===`.
 */
export const expectMoneyEqual = (
  actualCents: number,
  expectedCents: number,
  toleranceCents = 1
): boolean => Math.abs(actualCents - expectedCents) <= toleranceCents
