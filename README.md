# P8D — E2E Test Suite (WebdriverIO)

Enterprise-grade end-to-end testing for **P8D**, built with WebdriverIO 9 +
TypeScript using the Page Object Model.

The test infrastructure (configs, page objects, utils, fixtures) is in place,
and a first batch of specs already covers login, multi-window, and Android
app-launch flows. Add new specs under [`src/specs/`](src/specs/).

---

## Stack

| Concern        | Tool                                       |
| -------------- | ------------------------------------------- |
| Runner         | WebdriverIO 9 (`@wdio/cli`, local runner)   |
| Framework      | Mocha (BDD)                                  |
| Language       | TypeScript (ESM, strict)                     |
| Assertions     | `expect-webdriverio`                         |
| Desktop target | Tauri via `tauri-driver` (`wdio.local`)      |
| Web target     | Chrome (`wdio.web`, `wdio.ci`)                |
| Android target | Appium + UiAutomator2 (`wdio.android`)      |
| Reporting      | spec reporter + Allure                       |
| Logging        | winston (console + file)                     |
| Test data      | `@faker-js/faker`, JSON fixtures              |
| Lint / format  | ESLint + Prettier                            |

---

## Project structure

```
.
├── config/                      # WDIO configs, one per environment
│   ├── wdio.shared.conf.ts       #   base config (specs, reporters, hooks)
│   ├── wdio.local.conf.ts        #   Tauri desktop via tauri-driver
│   ├── wdio.web.conf.ts          #   real browser
│   ├── wdio.android.conf.ts      #   Appium / UiAutomator2 (real device or emulator)
│   └── wdio.ci.conf.ts           #   headless browser for pipelines
├── src/
│   ├── constants/               # timeouts, routes, selectors, messages
│   ├── data/                    # static JSON fixtures
│   ├── fixtures/                # typed facade over data/
│   ├── hooks/                   # custom WDIO commands
│   ├── pages/                   # Page Object Model
│   │   ├── base.page.ts          #   parent of every page
│   │   ├── login.page.ts         #   staff login page
│   │   ├── staff-token-login.page.ts
│   │   ├── customer-display.page.ts
│   │   ├── android/              #   Android-specific page objects
│   │   ├── components/           #   reusable UI fragments (e.g. header)
│   │   └── index.ts              #   barrel — import { x } from "@pages"
│   ├── specs/                   # test cases
│   │   ├── auth/                  #   staff login
│   │   ├── window/                #   multi-window (staff + customer display)
│   │   ├── android/                #   Android app-launch
│   │   └── _example.e2e.ts.template
│   ├── types/                   # ambient d.ts (custom command typings)
│   └── utils/                   # env, logger, wait, currency, retry, tauri-helper, ...
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

# 4. (Android only) have adb see the device/emulator, and Appium reachable
#    adb devices

# 5. Write your spec under src/specs/ (see src/specs/README.md)

# 6. Run
npm run test:web            # browser
npm run test:local          # Tauri desktop
npm run test:android        # Android (Appium)
```

---

## npm scripts

| Script                       | What it does                          |
| ----------------------------- | -------------------------------------- |
| `npm test`                    | run the local (Tauri) config          |
| `npm run test:local`          | run the Tauri desktop binary           |
| `npm run test:web`            | run against a real browser             |
| `npm run test:android`        | run against Android via Appium         |
| `npm run test:ci`             | headless run for CI                    |
| `npm run test:smoke`          | run only `@smoke`-tagged specs         |
| `npm run test:regression`     | run only `@regression`-tagged specs    |
| `npm run report:allure`       | generate + open the Allure report      |
| `npm run report:clean`       | remove `reports/` and `logs/`          |
| `npm run lint` / `lint:fix`   | ESLint                                 |
| `npm run format` / `format:check` | Prettier write / check            |
| `npm run typecheck`           | `tsc --noEmit`                         |

---

## Android DOM E2E — run on the P8_Dual emulator (not the physical P8D)

The app under test is a **Tauri webview** (`com.fastboy.volt_pos`). Driving its
DOM (login, orders, …) needs Appium's chromedriver to attach to the WebView via
CDP. That works on the **P8_Dual emulator** but **not** on the physical
MDM-locked P8D device: there the ROM kills the WebView renderer, so
`switchContext(WEBVIEW_*)` hangs (documented in the app repo's
`docs/p8d-device-bring-up-playbook.md`, Phụ lục A). On the physical device only
the native smoke test (`device-smoke.e2e.ts`) is meaningful.

The installed debug APK loads its frontend from the Vite dev server at
`http://127.0.0.1:1420` (not bundled), so the app also needs the dev server up
and an `adb reverse` tunnel. Full working recipe:

```bash
# 0. one-time: emulator + debug APK already provisioned (AVD "P8_Dual",
#    app-arm64-debug.apk installed). ANDROID_UDID=emulator-5554 in .env.

# 1. Boot the emulator
"$ANDROID_HOME/emulator/emulator" -avd P8_Dual -no-snapshot-load

# 2. In the app repo (D:\Project\P8D\P8D): start the Android dev server.
#    TAURI_DEV_HOST=127.0.0.1 forces IPv4 so adb reverse can reach it.
TAURI_DEV_HOST=127.0.0.1 npm run dev:android

# 3. Tunnel the dev-server ports into the emulator
npm run android:reverse        # adb reverse tcp:1420 + tcp:1421

# 4. Run the DOM specs (sets ANDROID_WEBVIEW_READY=1)
npm run test:android:emu
```

`ANDROID_WEBVIEW_READY=1` un-skips the webview specs; without it they self-skip
so the suite never hangs on a dead-renderer device. First DOM interaction is
slow (~10–15 s) because a hard navigation re-mounts the whole SPA over the
tunnel under ARM translation — the specs wait `EXTRA_LONG` for it.

Specs:
- [`src/specs/android/device-smoke.e2e.ts`](src/specs/android/device-smoke.e2e.ts)
  — native only (install/launch/foreground/webview-alive/screenshot); runs on
  **any** device or emulator, no dev server needed.
- [`src/specs/android/staff-token-login.e2e.ts`](src/specs/android/staff-token-login.e2e.ts)
  — real DOM login test; requires the emulator recipe above.

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
