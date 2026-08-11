---
name: volt-e2e-spec
description: >
  Generate or update WebdriverIO E2E code (specs, page objects, selector
  entries) for the Volt POS / P8D Android app from the test-case docs —
  docs/payment-test-cases.md (Charge/tender: Cash, Gift card, Other, Card, Tip,
  passcode, promo/reward, item discount, order actions) and its sibling
  docs/order-test-cases.md. Use whenever the user asks to turn a §8.x test-case
  table into runnable specs, add a payment/checkout/order page object, or wire
  up the proposed data-testid selectors. Enforces this repo's POM + cents-money
  + ESM conventions and the WebView-not-debuggable reality.
---

# volt-e2e-spec — write P8D E2E code from the test-case docs

This skill turns the human-written test-case tables in
[docs/payment-test-cases.md](../../../docs/payment-test-cases.md) (and
[docs/order-test-cases.md](../../../docs/order-test-cases.md)) into code that
matches this repo **exactly**: Page Object Model, a central selector registry,
integer-cents money math, ESM `.js` import suffixes, and tag-filtered specs.

The payment doc is the source of truth for *behaviour* (dual pricing, the
staff-passcode gate, known gaps). This skill is the source of truth for *how to
write the code*. Read the relevant `§8.x` table first, then generate.

## The one hard constraint — read this before writing a selector

The app is **Tauri + WebView with WebView debugging OFF**. On the emulator,
Appium sees a single opaque `android.webkit.WebView` node — **no DOM, no
`data-testid`, `$(css)` does not resolve**. That is why the doc was authored by
screenshot + tap-coordinate. Consequences for the code you write:

- The `data-testid` selectors in the doc's **§9** are a **proposal for the app
  team**, not attributes that exist today. Write them into `SELECTORS` as the
  durable target (they're how the code *should* read), but **do not claim a spec
  passes** on the emulator until the app ships those testids or the app enables
  `setWebContentsDebuggingEnabled(true)`.
- Gate any spec whose steps need real DOM behind the existing
  `ANDROID_WEBVIEW_READY` pattern **and** a clear skip until testids land — see
  "Gating" below. Never leave a red spec that can't pass for an environmental
  reason presented as a product bug.
- For exploratory / manual verification runs, drive by coordinate tap (Appium
  MCP or `mobile: clickGesture`) — see "Coordinate fallback". Keep that out of
  the committed spec; the committed spec targets the testid selectors.

## Repo conventions you MUST follow

Match the surrounding code — these are non-negotiable and easy to get wrong:

- **Formatting** (`.prettierrc.json`): **no semicolons**, **double quotes**,
  2-space indent, `printWidth` 110, `arrowParens: always`, no trailing commas.
- **ESM**: every relative import ends in **`.js`** even though the source is
  `.ts` (e.g. `import { BasePage } from "./base.page.js"`). Cross-area imports
  use path aliases: `@pages`, `@constants/*`, `@utils/*`, `@fixtures/*`.
- **Specs** live in `src/specs/<feature>/<name>.e2e.ts`. The doc already names
  each file (e.g. `cash-payment.e2e.ts`); put payment specs under
  `src/specs/payment/`. Only `*.e2e.ts` is picked up by WDIO.
- **Tags** go in the `describe` title: `@smoke` for P0 survival cases,
  `@regression` otherwise — matching the `P`/`Loại` columns in the tables.
- **Page objects** extend `BasePage` ([src/pages/base.page.ts](../../../src/pages/base.page.ts)),
  set `pageName` + `rootSelector`, use the inherited `safeClick` / `safeFill` /
  `waitForSuccessToast` / modal helpers, and are exported as **both** the class
  and a singleton instance. Register every new page in the barrel
  [src/pages/index.ts](../../../src/pages/index.ts).
- **Selectors** are centralized in [src/constants/selectors.ts](../../../src/constants/selectors.ts)
  — never inline a selector in a page/spec. Use `testId(id)`, `dataAttr(a,v)`,
  `byText(tag,text)`. Follow §9's key names.
- **Money is integer cents.** Use [src/utils/currency.ts](../../../src/utils/currency.ts):
  `toCents` / `fromCents` / `formatMoney` / `applyPercentage` / `subtractCents`,
  and assert with **`expectMoneyEqual`** (1-cent tolerance), never `===` on
  floats. **Compute expected amounts from the order** (parse Subtotal, apply the
  configured fee/discount %) — never hard-code `$12.22`/`$13.44`/`10%`; those are
  shop-config-dependent per the doc.
- **Timeouts / routes / messages** come from `@constants/*` — no magic numbers,
  no inline URL strings.
- **Android session**: specs assume an authenticated, reused session
  (`appium:noReset:true`). Call `ensureLoggedIn()` in a `before` hook; never add
  a login step mid-flow. Switch into the webview with
  `androidAppShellPage.switchToWebview()` before any DOM access.

## Generation workflow

For a given `§8.x` table:

1. **Read the section** in the doc — the feature narrative above the table
   describes the real screen (headers, computed rows, buttons). The table rows
   are the cases; the `#` (e.g. `CASH-05`), `P`, and `Loại` columns map to test
   name, priority, and tag.
2. **Selectors** — add/confirm a group in `SELECTORS` using §9's keys for that
   screen. If the screen isn't in §9, propose keys in the same style and note
   they need testids. Keep dynamic ones as functions (`QUICK_CASH(label)`,
   `KEYPAD(n)`) like the existing `PASSCODE_GUARD.DIGIT`.
3. **Page object** — one per screen (`cash-payment.page.ts`, etc.) extending
   `BasePage`. Expose intent-level methods (`enterQuickCash("100")`,
   `getChangeDue()`, `isAcceptEnabled()`), returning parsed **cents** for money
   getters. Add its export to the barrel.
4. **Spec** — one `describe` per file, one `it` per table row, titled with the
   case id + intent (`it("CASH-05 · $100 quick cash → change due = 100 − due", …)`).
   Assert with `expectMoneyEqual`. Compute expectations from the order.
5. **Safety guardrails** (see below) — never finalize a real transaction in a
   committed spec.
6. **Verify**: `npm run typecheck` and `npm run lint` must pass. Run the spec
   only against the isolated dev shop (`Volt POS 14 Dev`) per the doc.

Use the already-materialized Payment-method (§8.1) files in the repo as your
conventions-matching examples — mirror them for the other tenders:
- [`src/constants/selectors.ts`](../../../src/constants/selectors.ts) — the live
  `SELECTORS` registry; the §9 payment groups (`PAYMENT_METHOD`, `CASH_PAYMENT`,
  `GIFT_CARD`, `OTHER_PAYMENT`, …) are already merged. Add new screens in the
  same style, keyed per §9.
- [`src/pages/payment/payment-method.page.ts`](../../../src/pages/payment/payment-method.page.ts)
  — a full, live page object (registered in the barrel).
- [`src/specs/payment/payment-method.e2e.ts`](../../../src/specs/payment/payment-method.e2e.ts)
  — the live spec for `PM-01…PM-08` (gating + guardrails applied).

## Gating (so red never means "product bug" when it's really "no testid yet")

Mirror the existing emulator specs. Until the app ships the §9 testids (or turns
on WebView debugging), keep DOM-dependent payment specs from running blind:

```ts
const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
// data-testid selectors from doc §9 don't exist in the app yet — set this once
// they land so the payment suite goes live.
const TESTIDS_LANDED = process.env.VOLT_PAYMENT_TESTIDS === "1"
const suite = WEBVIEW_READY && TESTIDS_LANDED ? describe : describe.skip
```

A skipped-until-ready spec is honest; a failing spec blamed on the product is
not. When you skip, say why in a top-of-file comment.

## Safety guardrails (from the doc — enforce in every spec)

- **Never finalize a real transaction in a committed test.** Stop before
  `Accept cash` / `Redeem` / `Record payment` / `Cancel order` / `Send`. Those
  create real payments / send real email/SMS / void real orders. Assert the
  finalize button is *enabled* and the amounts are correct — do not tap it.
  (The `⚠️` cases and `FIN-*`/`GC-11`/`OCAN-04` finalize rows are opt-in,
  isolated-shop only, and must self-clean.)
- **Staff passcode is a 4-digit PIN read from env/secret** (dev `8888`) — never
  hard-code it in the repo. Use `ENV`/`process.env`; the digit keypad selector
  is `SELECTORS.PASSCODE_GUARD.DIGIT(n)` (already in the repo).
- **Gift-card balance is shared server data** — do NOT assert an exact
  post-redeem decrease; assert `after ≤ before` or verify via the Approved badge
  / order state (doc §GC-12, §10).
- **Reward is a known gap (VP-2096):** applying a reward currently does *not*
  reduce Total. Write `RWD-04` to assert the reward **does** reduce Total and
  mark it a known-fail (`it.skip` with a `// KNOWN GAP VP-2096` note) — do not
  write it to pass on the buggy behaviour.
- **Item discount works** — safe to assert it reduces Total and is reversible.
- **Draft orders leak:** reaching *Review order* persists an Open/"In Use" draft
  before Charge; note cleanup in specs that create orders.

## Coordinate fallback (exploratory / manual only — not committed)

When you need to actually see a flow on the emulator before testids exist, drive
by tap. This is for investigation, not the committed spec:

- Prefer the **Appium MCP** tools (`appium_screenshot` then `appium_gesture` /
  `appium_perform_actions`) to screenshot, read coordinates, and tap.
- Or, from a WDIO REPL/spec, `browser.execute("mobile: clickGesture", { x, y })`
  in the NATIVE_APP context.
- Coordinates are screen-resolution specific (doc used **1080×2400**) and brittle
  — never commit them as the assertion path. Convert findings into testid-based
  page-object methods once the hooks exist.

## Section → files map (payment doc)

| Doc § | Spec file (under `src/specs/payment/`) | Page object |
| ----- | -------------------------------------- | ----------- |
| 8.1 Payment method | `payment-method.e2e.ts` | `payment-method.page.ts` |
| 8.2 Cash | `cash-payment.e2e.ts` | `cash-payment.page.ts` |
| 8.3 Gift card | `gift-card-payment.e2e.ts` | `gift-card-payment.page.ts` |
| 8.4 Other | `other-payment.e2e.ts` | `other-payment.page.ts` |
| 8.5 Tip | `tip.e2e.ts` | `tip.page.ts` |
| 8.6 Card | `card-payment.e2e.ts` | `card-payment.page.ts` |
| 8.7 Finalize + receipt | `payment-complete.e2e.ts` | `payment-complete.page.ts` |
| 8.8 Promo & Reward | `promotion-reward.e2e.ts` | `promo-reward.page.ts` |
| 8.9 Item discount | `item-discount.e2e.ts` | `item-discount.page.ts` |
| 8.10 Order actions | `order-actions.e2e.ts` | `order-detail.page.ts` |
| 8.11 Reopen & Sync | `reopen-sync.e2e.ts` | (cross-device — mostly manual) |

`SYNC-*` and cross-device `REOPEN-*` cases are multi-device integration
(POS ↔ Portal ↔ P8) and can't be driven by Appium-on-P8 alone — scaffold them
as `it.skip` with a `// cross-device — needs POS/Portal harness` note rather
than faking them.
