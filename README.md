# P8D — E2E Test Suite (WebdriverIO)

Enterprise-grade end-to-end testing for **P8D**, built with WebdriverIO 9 +
TypeScript using the Page Object Model.

This repository is a **clean scaffold** — the full test infrastructure is in
place, but there are **no test cases yet**. Start writing specs under
[`src/specs/`](src/specs/).

---

## Stack

| Concern        | Tool                                      |
| -------------- | ----------------------------------------- |
| Runner         | WebdriverIO 9 (`@wdio/cli`, local runner) |
| Framework      | Mocha (BDD)                               |
| Language       | TypeScript (ESM, strict)                  |
| Assertions     | `expect-webdriverio`                      |
| Desktop target | Tauri via `tauri-driver` (`wdio.local`)   |
| Web target     | Chrome (`wdio.web`, `wdio.ci`)            |
| Reporting      | spec reporter + Allure                    |
| Logging        | winston (console + file)                  |
| Test data      | `@faker-js/faker`, JSON fixtures          |
| Lint / format  | ESLint + Prettier                         |

---

## Project structure

```
.
├── config/                      # WDIO configs, one per environment
│   ├── wdio.shared.conf.ts       #   base config (specs, reporters, hooks)
│   ├── wdio.local.conf.ts        #   Tauri desktop via tauri-driver
│   ├── wdio.web.conf.ts          #   real browser
│   └── wdio.ci.conf.ts           #   headless browser for pipelines
├── src/
│   ├── constants/               # timeouts, routes, selectors, messages
│   ├── data/                    # static JSON fixtures
│   ├── fixtures/                # typed facade over data/
│   ├── hooks/                   # custom WDIO commands
│   ├── pages/                   # Page Object Model
│   │   ├── base.page.ts          #   parent of every page
│   │   ├── login.page.ts         #   EXAMPLE page (template)
│   │   ├── components/           #   reusable UI fragments
│   │   └── index.ts              #   barrel — import { x } from "@pages"
│   ├── specs/                   # >>> YOUR TEST CASES GO HERE (empty) <<<
│   ├── types/                   # ambient d.ts (custom command typings)
│   └── utils/                   # env, logger, wait, currency, retry, ...
├── .env.example                 # copy to .env and fill in
├── tsconfig.json                # path aliases: @pages, @utils, @constants...
├── .eslintrc.cjs / .prettierrc.json
└── package.json
```

---

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env        # then edit values (app path, URLs, accounts)

# 3. (Desktop only) install tauri-driver + Edge WebDriver, on PATH
#    cargo install tauri-driver

# 4. Write your first spec under src/specs/ (see src/specs/README.md)

# 5. Run
npm run test:web            # browser
npm run test:local          # Tauri desktop
```

---

## npm scripts

| Script                      | What it does                        |
| --------------------------- | ----------------------------------- |
| `npm test`                  | run the local (Tauri) config        |
| `npm run test:web`          | run against a real browser          |
| `npm run test:local`        | run the Tauri desktop binary        |
| `npm run test:ci`           | headless run for CI                 |
| `npm run test:smoke`        | run only `@smoke`-tagged specs      |
| `npm run test:regression`   | run only `@regression`-tagged specs |
| `npm run report:allure`     | generate + open the Allure report   |
| `npm run lint` / `lint:fix` | ESLint                              |
| `npm run format`            | Prettier write                      |
| `npm run typecheck`         | `tsc --noEmit`                      |

---

## Multi-window (staff + customer display)

P8D always runs two Tauri windows, `main` (staff) and `customer` (second
monitor, `src-tauri/tauri.conf.json`). `src/utils/tauri-helper.ts` exposes
`switchToWindow(label)` and `withWindow(label, fn)` to target either one —
see `src/specs/window/multi-window.e2e.ts` and `CustomerDisplayPage`
(`src/pages/customer-display.page.ts`) for the pattern. Any spec asserting on
cart totals, tip selection, or payment confirmation shown to the customer
must go through the `customer` window, not the staff one.

## Known gaps — `data-testid` coverage

Most of the app has no `data-testid` yet: the primary QR login screen, the
passcode re-verification keypad, and the main checkout/payment screens all
lack stable hooks (only order-history refund/cancel dialogs, pay-period
settings, and the customer payment-method buttons have real ones). Specs for
those areas currently fall back to text/attribute selectors, which are more
brittle and locale-sensitive. Use the `volt-e2e-spec` skill's testid review
step to propose additions before writing more coverage there.

---

## Conventions

- **Selectors** live only in [`src/constants/selectors.ts`](src/constants/selectors.ts)
  and target stable `data-testid` attributes — never inline CSS/XPath in specs.
- **Routes**, **timeouts**, and **copy strings** are likewise centralized in
  `src/constants/`.
- **Page objects** extend `BasePage`, expose intent-revealing methods, and are
  exported from `src/pages/index.ts`.
- **Specs** orchestrate page objects + assertions only — no raw `$()` queries.
- **No `browser.pause()`** — use the helpers in
  [`src/utils/wait.ts`](src/utils/wait.ts).
- **Env access** goes through [`src/utils/env.ts`](src/utils/env.ts), never
  `process.env` directly.

See [`src/specs/README.md`](src/specs/README.md) for how to add a spec and a
new page object.
