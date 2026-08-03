# 📖 Code Explained — Giải thích code từng dòng

Thư mục này chứa tài liệu **giải thích code theo từng dòng/từng khối** (tiếng Việt) cho **toàn bộ file `.ts` trong `src/`** của project WebdriverIO E2E P8D.

- **Mỗi file nguồn `src/...` = một file giải thích `.md` riêng.**
- Cấu trúc thư mục ở đây **mirror (sao chép)** cấu trúc `src/` để dễ tra cứu: `src/utils/env.ts` → `docs/code-explained/utils/env.md`.
- Mỗi tài liệu gồm: *Mục đích tổng quan → Import/phụ thuộc → Giải thích từng khối (kèm số dòng khớp file nguồn) → Sơ đồ luồng/cách dùng → Ghi chú & điểm dễ nhầm*.

> 💡 Bắt đầu từ đâu? Nếu bạn đang tìm hiểu cơ chế **"đăng nhập 1 lần, giữ mãi"**, đọc [utils/ensure-logged-in.md](./utils/ensure-logged-in.md) trước, rồi tới [specs/android/app-home.e2e.md](./specs/android/app-home.e2e.md).

---

## 🗂️ utils/ — Tiện ích dùng chung

| File giải thích | File nguồn | Tóm tắt |
|---|---|---|
| [ensure-logged-in.md](./utils/ensure-logged-in.md) | `src/utils/ensure-logged-in.ts` | "Login once, stay logged in" — đảm bảo đã auth, chỉ nhập staff token khi cần. **Nơi chứa logic no-op.** |
| [ensure-network.md](./utils/ensure-network.md) | `src/utils/ensure-network.ts` | Bật lại mạng best-effort (Appium `setConnectivity`, fallback `adb`), không bao giờ fail run. |
| [env.md](./utils/env.md) | `src/utils/env.ts` | Object `ENV` strong-typed đọc từ `.env` (helper `num`/`bool`), gom mọi `process.env`. |
| [logger.md](./utils/logger.md) | `src/utils/logger.ts` | Logger winston dùng chung: console có màu + file log xoay vòng; `childLogger`. |
| [wait.md](./utils/wait.md) | `src/utils/wait.ts` | Bộ chờ có chủ đích: `waitUntil`, `waitForStable`, `sleep`, `withTimeout` (chống treo Appium), `waitForRoute`. |
| [retry.md](./utils/retry.md) | `src/utils/retry.ts` | `retry()` thử lại thao tác chập chờn với attempts/delay/backoff. |
| [tauri-helper.md](./utils/tauri-helper.md) | `src/utils/tauri-helper.ts` | Helper Tauri: `invoke`, `switchToWindow`, `withWindow` (khôi phục cửa sổ bằng `finally`). |
| [currency.md](./utils/currency.md) | `src/utils/currency.ts` | Tiền theo quy ước số nguyên cent; `expectMoneyEqual` dung sai 1 cent. |
| [data-factory.md](./utils/data-factory.md) | `src/utils/data-factory.ts` | Factory sinh fixture (customer/product/email/pin) bằng faker + uuidv7. |

## 🗂️ constants/ — Hằng số tập trung

| File giải thích | File nguồn | Tóm tắt |
|---|---|---|
| [timeouts.md](./constants/timeouts.md) | `src/constants/timeouts.ts` | `TIMEOUTS`: SHORT 5s / MEDIUM 15s / LONG 30s / EXTRA_LONG 60s / ANIMATION 500ms. |
| [routes.md](./constants/routes.md) | `src/constants/routes.ts` | `ROUTES`: phân biệt `/login` (QR, không DOM hook) vs `/login-staff-token` (form thật). |
| [selectors.md](./constants/selectors.md) | `src/constants/selectors.ts` | Registry selector + helper `testId`/`dataAttr`/`byText`; phân biệt selector thật vs fallback. |
| [messages.md](./constants/messages.md) | `src/constants/messages.ts` | Chuỗi văn bản UI để assert; phải khớp từng ký tự với app thật. |

## 🗂️ pages/ — Page Object

| File giải thích | File nguồn | Tóm tắt |
|---|---|---|
| [base.page.md](./pages/base.page.md) | `src/pages/base.page.ts` | Lớp cha `BasePage`: `safeClick`/`safeFill`/`waitForLoaded`/toast/modal/screenshot. |
| [staff-token-login.page.md](./pages/staff-token-login.page.md) | `src/pages/staff-token-login.page.ts` | Màn login **thật** `/login-staff-token` mà `ensureLoggedIn()` dùng. |
| [login.page.md](./pages/login.page.md) | `src/pages/login.page.ts` | Page **mẫu/template** (màn QR thật không có data-testid). |
| [customer-display.page.md](./pages/customer-display.page.md) | `src/pages/customer-display.page.ts` | Cửa sổ Tauri "customer"; dùng `withWindow` tự chuyển & khôi phục cửa sổ. |
| [index.md](./pages/index.md) | `src/pages/index.ts` | Barrel `@pages`: re-export instance + class. |
| [components/base.component.md](./pages/components/base.component.md) | `src/pages/components/base.component.ts` | `BaseComponent`: `$()` scope theo root thay vì toàn trang. |
| [components/header.component.md](./pages/components/header.component.md) | `src/pages/components/header.component.ts` | Component mẫu `HeaderComponent` (menu user, logout). |
| [android/app-shell.page.md](./pages/android/app-shell.page.md) | `src/pages/android/app-shell.page.ts` | `AndroidAppShellPage`: `switchToWebview()` (2 lớp timeout), `screenshot()` best-effort. |

## 🗂️ specs/android/ — Test E2E trên Android

> Cột **Chạy khi nào** là điểm quan trọng: nhiều spec bị skip có điều kiện.

| File giải thích | File nguồn | Chạy khi nào |
|---|---|---|
| [app-home.e2e.md](./specs/android/app-home.e2e.md) | `src/specs/android/app-home.e2e.ts` | ✅ khi `ANDROID_WEBVIEW_READY=1` (`npm run test:android:emu`). Điểm vào test thật. |
| [login-once.e2e.md](./specs/android/login-once.e2e.md) | `src/specs/android/login-once.e2e.ts` | ✅ khi `ANDROID_LOGIN_SETUP=1` (`npm run android:login`). Login setup 1 lần. |
| [staff-token-login.e2e.md](./specs/android/staff-token-login.e2e.md) | `src/specs/android/staff-token-login.e2e.ts` | ⛔ `describe.skip` cứng (dòng 37). |
| [login-staff-token-form.e2e.md](./specs/android/login-staff-token-form.e2e.md) | `src/specs/android/login-staff-token-form.e2e.ts` | ⛔ `describe.skip` cứng (dòng 34). |
| [app-launch.e2e.md](./specs/android/app-launch.e2e.md) | `src/specs/android/app-launch.e2e.ts` | ✅ luôn chạy — smoke test pipeline. |
| [device-smoke.e2e.md](./specs/android/device-smoke.e2e.md) | `src/specs/android/device-smoke.e2e.ts` | ✅ luôn chạy — smoke tầng native. |
| [open-and-hold.e2e.md](./specs/android/open-and-hold.e2e.md) | `src/specs/android/open-and-hold.e2e.ts` | ✅ luôn chạy — demo mở & giữ app (`npm run android:open`). |
| [dump-page-source.e2e.md](./specs/android/dump-page-source.e2e.md) | `src/specs/android/dump-page-source.e2e.ts` | ✅ luôn chạy — công cụ dump selector (`npm run android:dump`). |

## 🗂️ specs/ khác

| File giải thích | File nguồn | Tóm tắt |
|---|---|---|
| [specs/window/multi-window.e2e.md](./specs/window/multi-window.e2e.md) | `src/specs/window/multi-window.e2e.ts` | Kiểm chứng "hợp đồng dual-window" Tauri (main/customer). |
| [specs/auth/staff-token-login.e2e.md](./specs/auth/staff-token-login.e2e.md) | `src/specs/auth/staff-token-login.e2e.ts` | Test form login staff-token (load form / báo lỗi token sai). |

## 🗂️ types / hooks / fixtures

| File giải thích | File nguồn | Tóm tắt |
|---|---|---|
| [types/wdio.d.md](./types/wdio.d.md) | `src/types/wdio.d.ts` | Khai báo ambient mở rộng type `browser`/element cho custom commands. |
| [hooks/custom-commands.md](./hooks/custom-commands.md) | `src/hooks/custom-commands.ts` | `registerCustomCommands()`: `gotoRoute`, `waitAndClick`, `softAssert`. |
| [fixtures/test-data.md](./fixtures/test-data.md) | `src/fixtures/test-data.ts` | Facade dữ liệu test: `TEST_DATA`, `findUserByRole`. |

---

## 🔑 Hai biến môi trường gate quan trọng (dễ nhầm)

| Biến | Đặt bởi | Điều khiển spec nào |
|---|---|---|
| `ANDROID_WEBVIEW_READY=1` | `npm run test:android:emu` | `app-home` (và `staff-token-*` nếu bật lại) — cần target lái được WebView (emulator). |
| `ANDROID_LOGIN_SETUP=1` | `npm run android:login` | `login-once` — chạy setup đăng nhập một lần cho mỗi emulator. |

## ✍️ Quy ước tài liệu

- Số dòng trích trong mỗi `.md` **khớp chính xác** với file nguồn tại thời điểm viết. Khi sửa code, hãy cập nhật lại tài liệu tương ứng.
- Link `[text](path)` trỏ tới file nguồn hoặc tài liệu liên quan bằng đường dẫn tương đối.
- Giải thích cả **CÁI GÌ** (code làm gì) lẫn **TẠI SAO** (lý do thiết kế: timeout, retry, guard, skip...).
