# Cấu trúc dự án P8D E2E — Lộ trình đọc source (từ quan trọng → chi tiết)

Tài liệu này là **lộ trình đọc code** cho người mới. Đọc lần lượt từ trên xuống,
mỗi tầng (tier) là một "vòng hiểu" trọn vẹn — đọc hết Tier 1 là đã nắm được bộ
khung, đọc hết Tier 3 là đủ để tự viết một spec mới.

> Dự án: **E2E test suite cho P8D** (ứng dụng POS `com.fastboy.volt_pos`, một
> app Tauri + WebView) viết bằng **WebdriverIO 9 + TypeScript + Mocha**, theo mô
> hình **Page Object Model (POM)**. App chạy trên 3 đích: **desktop (Tauri)**,
> **web (Chrome)**, và **Android (Appium)**.

---

## Bản đồ nhanh — dòng chảy khi chạy 1 test

```
npm run test:android                         (1) chọn config theo môi trường
        │
        ▼
config/wdio.android.conf.ts                  (2) merge với wdio.shared.conf.ts
   ├─ đọc cấu hình từ  src/utils/env.ts       (3) mọi biến môi trường tập trung ở đây
   ├─ onPrepare:  spawn Appium / tauri-driver
   ├─ before:     registerCustomCommands()  +  ensureNetworkOnline()
        │
        ▼
src/specs/**/*.e2e.ts                         (4) test case — chỉ điều phối
   ├─ import Page Object từ  @pages  (src/pages/index.ts)
   ├─ Page Object kế thừa  BasePage  → dùng SELECTORS / ROUTES / TIMEOUTS
   └─ assert bằng expect-webdriverio
        │
        ▼
reports/ (Allure + screenshot)  &  logs/ (winston)   (5) kết quả
```

Ba câu thần chú của repo (đọc kỹ phần **Conventions** trong `README.md`):
- **Selector** chỉ nằm trong `src/constants/selectors.ts` — không viết CSS/XPath thẳng trong spec.
- **Không dùng `browser.pause()`** — dùng helper trong `src/utils/wait.ts`.
- **Không đọc `process.env` trực tiếp** — mọi thứ đi qua `src/utils/env.ts`.

---

## Tier 0 — Đọc trước tiên để có bối cảnh (5 phút)

| Thứ tự | File | Vì sao đọc | Ghi nhớ |
| --- | --- | --- | --- |
| 1 | [README.md](../README.md) | Tổng quan stack, cách chạy, quy ước, cách chạy Android trên emulator | Toàn cảnh dự án + phần "Conventions" |
| 2 | [package.json](../package.json) | Các script `npm run test:*`, danh sách thư viện | `test:local`=Tauri, `test:web`=Chrome, `test:android`=Appium |
| 3 | [tsconfig.json](../tsconfig.json) | Định nghĩa **path alias** (`@pages`, `@utils`, `@constants`…) — thấy ở khắp nơi trong code | ESM strict, alias trỏ vào `src/*` |

---

## Tier 1 — Bộ khung chạy (config & môi trường)

Đây là "động cơ": WDIO nạp config nào, cấu hình từ đâu ra.

| Thứ tự | File | Vai trò |
| --- | --- | --- |
| 4 | [config/wdio.shared.conf.ts](../config/wdio.shared.conf.ts) | **Config gốc** mọi môi trường kế thừa: specs glob, reporter (spec + Allure), framework Mocha, và các hook `onPrepare`/`before`/`beforeTest`/`afterTest` (chụp screenshot khi fail). |
| 5 | [src/utils/env.ts](../src/utils/env.ts) | **Trung tâm cấu hình.** Object `ENV` gói toàn bộ biến môi trường đã ép kiểu (Tauri path, web URL, Android package/udid/reversePorts, tài khoản test, timeout…). Không nơi nào đọc `process.env` trực tiếp ngoài file này. |
| 6 | [config/wdio.android.conf.ts](../config/wdio.android.conf.ts) | Config **Android** — quan trọng nhất trong 4 config vì đây là đích đang được dùng thật. Tự spawn Appium server, cấu hình capability WebView cho Tauri (`enableWebviewDetailsCollection:false`…), và gọi `ensureNetworkOnline()` trước mỗi phiên. |
| 7 | [config/wdio.local.conf.ts](../config/wdio.local.conf.ts) | Config **desktop Tauri** — spawn `tauri-driver`, chạy binary `volt-pos.exe`. |
| 8 | [config/wdio.web.conf.ts](../config/wdio.web.conf.ts) | Config **web** — Chrome (có cờ headless). Nhẹ, đọc nhanh nhất. |
| 9 | [config/wdio.ci.conf.ts](../config/wdio.ci.conf.ts) | Config **CI** — Chrome headless cho pipeline. |

> Mẹo: đọc `wdio.web.conf.ts` trước (ngắn nhất) để thấy pattern "kế thừa
> `sharedConfig` rồi override capability", rồi mới sang `android` (phức tạp nhất).

---

## Tier 2 — Hằng số dùng chung (constants)

Đọc cả 4 file này liền một mạch — chúng là "từ điển" mà mọi Page Object và spec tham chiếu.

| Thứ tự | File | Nội dung |
| --- | --- | --- |
| 10 | [src/constants/timeouts.ts](../src/constants/timeouts.ts) | `TIMEOUTS.SHORT/MEDIUM/LONG/EXTRA_LONG/ANIMATION`. Đọc đầu tiên vì file khác đều import. |
| 11 | [src/constants/selectors.ts](../src/constants/selectors.ts) | **Kho selector.** Helper `testId()`, `dataAttr()`, `byText()`. Ghi chú rất kỹ chỗ nào **thiếu `data-testid`** phải fallback theo placeholder/text (login QR, keypad passcode…). |
| 12 | [src/constants/routes.ts](../src/constants/routes.ts) | Cây route của app: `/login`, `/login-staff-token`, `/customer/`, `APP.SETTINGS`… |
| 13 | [src/constants/messages.ts](../src/constants/messages.ts) | Chuỗi text UI dùng để assert (thông báo lỗi login, network…). |

---

## Tier 3 — Page Object Model (trái tim của POM)

Đọc theo đúng thứ tự cha → con: hiểu lớp gốc trước, rồi tới các page cụ thể.

| Thứ tự | File | Vai trò |
| --- | --- | --- |
| 14 | [src/pages/base.page.ts](../src/pages/base.page.ts) | **`BasePage` — cha của mọi page.** Cung cấp `isLoaded()`, `waitForLoaded()`, `safeClick()`, `safeFill()` (có retry chống stale element), xử lý toast/modal, `screenshot()`. Đọc kỹ nhất trong tier này. |
| 15 | [src/pages/components/base.component.ts](../src/pages/components/base.component.ts) | **`BaseComponent`** — cha của các mảnh UI tái sử dụng (header, sidebar), mọi query scope theo `rootSelector`. |
| 16 | [src/pages/index.ts](../src/pages/index.ts) | **Barrel export.** Spec chỉ `import { loginPage } from "@pages"`. Thêm page mới phải khai báo ở đây. |
| 17 | [src/pages/login.page.ts](../src/pages/login.page.ts) | **`LoginPage` (mẫu/template)** — ví dụ chuẩn về cách viết 1 page: khai báo `pageName`+`rootSelector`, có `open()`, getter, action. |
| 18 | [src/pages/staff-token-login.page.ts](../src/pages/staff-token-login.page.ts) | **`StaffTokenLoginPage`** — form login **thật** đang dùng (`/login-staff-token`). Là UI login duy nhất hiện có DOM để tự động hoá. |
| 19 | [src/pages/customer-display.page.ts](../src/pages/customer-display.page.ts) | **`CustomerDisplayPage`** — màn hình khách hàng ở cửa sổ Tauri thứ 2 ("customer"). Mỗi method tự switch sang cửa sổ đó rồi quay lại. |
| 20 | [src/pages/android/app-shell.page.ts](../src/pages/android/app-shell.page.ts) | **`AndroidAppShellPage`** — điểm vào cho Android: `switchToWebview()` chuyển từ context `NATIVE_APP` sang `WEBVIEW_*` (có timeout-guard chống treo). Sau bước này mới dùng được các page DOM. |
| 21 | [src/pages/components/header.component.ts](../src/pages/components/header.component.ts) | `HeaderComponent` — ví dụ component tái sử dụng (mở user menu, logout). |

**Mô hình tư duy POM:**
```
BasePage (waits, click/fill an toàn, toast, modal)
   ├── LoginPage            (template)
   ├── StaffTokenLoginPage  (login thật)
   └── CustomerDisplayPage  (cửa sổ khách hàng)
AndroidAppShellPage         (không kế thừa BasePage — lo việc switch context)
BaseComponent
   └── HeaderComponent
```

---

## Tier 4 — Tiện ích (utils) — nơi chứa logic khó

Sau khi hiểu POM, đọc các util theo mức độ quan trọng dưới đây.

| Thứ tự | File | Vai trò | Độ ưu tiên |
| --- | --- | --- | --- |
| 22 | [src/utils/wait.ts](../src/utils/wait.ts) | Các hàm chờ thông minh: `waitUntil`, `waitForStable`, `waitForRoute`, `withTimeout` (đua với timeout để không treo), `sleep`. Thay cho `browser.pause()`. | ⭐ Cao |
| 23 | [src/utils/logger.ts](../src/utils/logger.ts) | Logger winston dùng chung (console + `logs/test-run.log` + `errors.log`). | ⭐ Cao |
| 24 | [src/utils/tauri-helper.ts](../src/utils/tauri-helper.ts) | **Đa cửa sổ Tauri:** `switchToWindow()`, `withWindow()`, `invoke()` (gọi lệnh Tauri). Nền tảng cho spec multi-window. | ⭐ Cao |
| 25 | [src/utils/ensure-network.ts](../src/utils/ensure-network.ts) | **Chống flaky mạng trên Android/emulator:** bật radio, dựng lại `adb reverse`, kiểm tra backend `:8080`, và `recoverAppConnection()` bấm "Try again" khi app báo "Couldn't load…". | ⭐ Cao (Android) |
| 26 | [src/utils/ensure-logged-in.ts](../src/utils/ensure-logged-in.ts) | **"Login once, stay logged in":** chỉ login staff-token lần đầu, nhờ `appium:noReset=true` phiên đăng nhập được giữ qua các lần chạy. | ⭐ Cao (Android) |
| 27 | [src/utils/retry.ts](../src/utils/retry.ts) | `retry(fn, {attempts, backoff})` cho thao tác chập chờn. | Trung bình |
| 28 | [src/utils/currency.ts](../src/utils/currency.ts) | Tiền tệ theo **integer cents**: `toCents`, `formatMoney`, `expectMoneyEqual`… Cấm float thô. | Trung bình |
| 29 | [src/utils/data-factory.ts](../src/utils/data-factory.ts) | Sinh dữ liệu giả (faker + uuidv7): `factory.customer()`, `factory.product()`. | Thấp |

---

## Tier 5 — Hook, kiểu, và dữ liệu test

| Thứ tự | File | Vai trò |
| --- | --- | --- |
| 30 | [src/hooks/custom-commands.ts](../src/hooks/custom-commands.ts) | Lệnh WDIO tuỳ biến đăng ký 1 lần trong `before`: `browser.gotoRoute()`, `el.waitAndClick()`, `browser.softAssert()`. |
| 31 | [src/types/wdio.d.ts](../src/types/wdio.d.ts) | Khai báo kiểu (ambient d.ts) cho các custom command ở trên để TypeScript hiểu. |
| 32 | [src/fixtures/test-data.ts](../src/fixtures/test-data.ts) | Facade có kiểu đọc `data/users.json`: `TEST_DATA.users`, `findUserByRole()`. |
| 33 | [src/data/users.json](../src/data/users.json) | Dữ liệu tĩnh: tài khoản `admin` / `staff` (email, pin, role, quyền). |

---

## Tier 6 — Specs (các test case thật)

Đọc cuối cùng — giờ bạn đã đủ nền để hiểu chúng chỉ *điều phối* Page Object + assert.

**Nhóm chạy được ổn định:**
| File | Mô tả |
| --- | --- |
| [src/specs/window/multi-window.e2e.ts](../src/specs/window/multi-window.e2e.ts) | Kiểm tra hợp đồng 2 cửa sổ `main`/`customer` (desktop). Đọc đầu tiên — ngắn, minh hoạ rõ `tauri-helper`. |
| [src/specs/android/device-smoke.e2e.ts](../src/specs/android/device-smoke.e2e.ts) | Smoke **native** (không đụng DOM): app foreground đúng activity, WebView đã boot, chụp screenshot. Chạy được trên **mọi** thiết bị/emulator. |
| [src/specs/android/app-home.e2e.ts](../src/specs/android/app-home.e2e.ts) | **Điểm vào test app thật:** gọi `ensureLoggedIn()` rồi đi thẳng vào app đã đăng nhập. Đây là chỗ bạn thêm test case mới. |
| [src/specs/auth/staff-token-login.e2e.ts](../src/specs/auth/staff-token-login.e2e.ts) | Login staff-token cho desktop/web. |

**Nhóm setup / chẩn đoán / tham khảo:**
| File | Mô tả |
| --- | --- |
| [src/specs/android/login-once.e2e.ts](../src/specs/android/login-once.e2e.ts) | Chạy `npm run android:login` **một lần** để tạo phiên đăng nhập ban đầu. |
| [src/specs/android/staff-token-login.e2e.ts](../src/specs/android/staff-token-login.e2e.ts) | Bộ case login (hiện `describe.skip` — giữ để tham khảo, vì đã chuyển sang mô hình "login once"). |
| [src/specs/android/switch-shop.e2e.ts](../src/specs/android/switch-shop.e2e.ts) | Đổi cửa hàng (tiệm). |
| [src/specs/android/app-launch.e2e.ts](../src/specs/android/app-launch.e2e.ts) · [open-and-hold.e2e.ts](../src/specs/android/open-and-hold.e2e.ts) · [dump-page-source.e2e.ts](../src/specs/android/dump-page-source.e2e.ts) · [login-staff-token-form.e2e.ts](../src/specs/android/login-staff-token-form.e2e.ts) | Các spec mở app / giữ mở / dump page source để debug selector. |
| [src/specs/_example.e2e.ts.template](../src/specs/_example.e2e.ts.template) | Mẫu để copy khi viết spec mới (đuôi `.template` để WDIO không chạy). |
| [src/specs/README.md](../src/specs/README.md) | Hướng dẫn viết spec + thêm page object mới. |

---

## Tier 7 — Tài liệu bổ trợ (khi cần đào sâu 1 file)

- [docs/code-explained/](code-explained/) — **giải thích từng file** một cách chi tiết (mirror lại cây `src/`). Khi cần hiểu sâu 1 file cụ thể, tìm file `.md` tương ứng ở đây.
- [docs/android-emulator-setup.md](android-emulator-setup.md) — dựng emulator P8_Dual để chạy DOM test.
- [docs/login-test-cases.md](login-test-cases.md) — đặc tả các case login.

---

## Tóm tắt lộ trình 1 dòng

> **README → package.json → tsconfig → wdio.shared → env.ts → wdio.android →
> constants(timeouts→selectors→routes→messages) → base.page → index.ts →
> các page cụ thể → wait/logger/tauri-helper/ensure-* → hooks+types+fixtures →
> specs.**

Đọc xong tới `base.page.ts` (mục 14) là đã hiểu **bộ khung**; đọc xong Tier 4 là
đủ để **tự viết spec mới** trong `src/specs/android/app-home.e2e.ts`.
