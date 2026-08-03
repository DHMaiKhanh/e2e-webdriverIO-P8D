# Giải thích code: `src/specs/android/login-once.e2e.ts`

> **File nguồn:** [src/specs/android/login-once.e2e.ts](../../../../src/specs/android/login-once.e2e.ts)
> **Loại:** Spec (Mocha E2E, Android) — thiết lập đăng nhập một lần (opt-in setup)
> **Chạy khi nào:** **CHỈ chạy khi `ANDROID_LOGIN_SETUP === "1"`** (dòng 28–29) — tức khi gọi tường minh `npm run android:login`. Mặc định (không set) → `describe.skip`.
> **Một câu:** Chạy **một lần** để thiết lập session đã xác thực trên emulator; nhờ `appium:noReset` session được giữ mãi, nên các lần chạy sau đi thẳng vào app không cần login.

---

## 1. Mục đích tổng quan

Spec này là **setup opt-in** — "đăng nhập một lần, giữ đăng nhập mãi" (docblock dòng 1–19):

- Chạy **một lần** để tạo session đã auth trên emulator: `npm run android:login`.
- Vì config Android dùng `appium:noReset = true`, Tauri WebView **giữ session đó** qua mọi lần chạy sau — không cần login lại cho tới khi session hết hạn.
- `ensureLoggedIn()` là **idempotent**: nếu app đã đăng nhập thì nó là no-op. Nhờ vậy spec **an toàn để chạy lại** và an toàn để giữ trong suite (chỉ no-op khi đã vào).

**Điều kiện tiên quyết** (docblock dòng 13–18): `ANDROID_UDID=emulator-5554`, dev server P8D chạy, `adb reverse`, `STAFF_TOKEN` trong `.env` (hiện là `14ea0a94`), và chạy với gate `npm run android:login` (đặt `ANDROID_WEBVIEW_READY=1`).

---

## 2. Các import / phụ thuộc (dòng 20–21)

```ts
20 import { expect } from "@wdio/globals"
21 import { ensureLoggedIn } from "../../utils/ensure-logged-in.js"
```

| Dòng | Ý nghĩa |
|------|---------|
| 20 | `expect` — assertion. |
| 21 | **`ensureLoggedIn`** — hàm chứa toàn bộ luồng đăng nhập "một lần". Đây là trái tim nghiệp vụ; xem giải thích chi tiết tại [utils/ensure-logged-in.md](../../utils/ensure-logged-in.md) (file nguồn [src/utils/ensure-logged-in.ts](../../../../src/utils/ensure-logged-in.ts)). |

> Spec cực gọn: mọi logic mở app / vào WebView / kiểm tra đã login / nhập token **nằm trong `ensureLoggedIn()`**, không lặp lại ở đây.

---

## 3. Điều kiện chạy suite (skip logic) — **TRỌNG TÂM**

```ts
23 // One-time login is OPT-IN setup, not part of every run. It only runs when you
24 // invoke it explicitly with `npm run android:login` (which sets
25 // ANDROID_LOGIN_SETUP=1). Thanks to `appium:noReset = true` the session
26 // established here persists, so every later run goes straight into the app with
27 // NO login — see src/specs/android/app-home.e2e.ts.
28 const RUN_LOGIN_SETUP = process.env.ANDROID_LOGIN_SETUP === "1"
29 const suite = RUN_LOGIN_SETUP ? describe : describe.skip
```

- **Dòng 28 — `RUN_LOGIN_SETUP`**: `true` **chỉ khi** biến môi trường `ANDROID_LOGIN_SETUP` bằng đúng chuỗi `"1"`.
- **Dòng 29 — `const suite = RUN_LOGIN_SETUP ? describe : describe.skip`**: đây là **skip có điều kiện**.
  - `ANDROID_LOGIN_SETUP === "1"` → `suite = describe` → **suite CHẠY**.
  - Ngược lại (không set / khác "1") → `suite = describe.skip` → **suite BỊ SKIP**.
- **Ai đặt biến này?** Script `npm run android:login` — chính nó set `ANDROID_LOGIN_SETUP=1` (comment 23–25). Nghĩa là spec chỉ chạy khi bạn **chủ động** gọi lệnh setup, không chạy trong các lần test thông thường.
- **Tại sao thiết kế opt-in?** Vì nhờ `appium:noReset = true`, session tạo ở đây **tồn tại lâu dài**, nên không cần đăng nhập lại mỗi lần chạy — các lần chạy sau đi thẳng vào app (xem [app-home.e2e.ts](./app-home.e2e.md)).

> Lưu ý gate ở đây là `ANDROID_LOGIN_SETUP` (khác với `ANDROID_WEBVIEW_READY` mà `app-home`/`staff-token-*` dùng). Dù docblock khuyến nghị chạy kèm `ANDROID_WEBVIEW_READY=1`, quyết định **skip suite** chỉ dựa trên `ANDROID_LOGIN_SETUP`.

---

## 4. Giải thích từng khối (before/it/after)

Suite chỉ có **một** `it`, không `before`/`after`.

### 4.1. Case duy nhất — đăng nhập (hoặc xác nhận session) (dòng 31–37)

```ts
31 suite("P8D Android — login once @setup", () => {
32   it("signs in (or confirms an existing session) so later runs skip login", async () => {
33     await ensureLoggedIn()
34
35     // Proof of the invariant: after this we are NOT parked on a login screen.
36     expect(await browser.getUrl()).not.toContain("login")
37   })
38 })
```

- **Dòng 31** — Khai báo suite qua biến `suite` (là `describe` hoặc `describe.skip` tuỳ dòng 29). Tag `@setup` đánh dấu đây là bước thiết lập.
- **Dòng 33** — Gọi `ensureLoggedIn()`. Bên trong nó (xem [ensure-logged-in.md](../../utils/ensure-logged-in.md)):
  1. `activateApp` mở app + `switchToWebview`.
  2. Về `/`, chờ router settle.
  3. **Nếu đã auth** → return ngay (no-op).
  4. **Nếu bị đá về `/login`** → nhập `STAFF_TOKEN` đúng một lần rồi chờ rời khỏi luồng login.
- **Dòng 36** — **Bằng chứng bất biến**: sau khi hàm chạy xong, URL **không** được chứa `"login"` — tức đã ở trong app (dù là vừa login hay đã có sẵn session). Đây là assertion **duy nhất** của spec.

---

## 5. Sơ đồ luồng test

```
[28] RUN_LOGIN_SETUP = (ANDROID_LOGIN_SETUP === "1")
[29] suite = RUN_LOGIN_SETUP ? describe : describe.skip
        │
   ┌────┴──────────────────────────────┐
   │ ANDROID_LOGIN_SETUP=1              │ khác (mặc định)
   │ (npm run android:login)           │
   ▼                                   ▼
 SUITE CHẠY                       SUITE SKIP (no-op)
   │
   ▼
 it "signs in (or confirms an existing session)"
   │
[33] ensureLoggedIn()  ──► (đã auth → no-op) HOẶC (chưa → nhập STAFF_TOKEN 1 lần)
   │        (chi tiết trong utils/ensure-logged-in.ts)
   ▼
[36] expect URL KHÔNG chứa "login"   ✅ đã ở trong app
```

---

## 6. Ghi chú & điểm dễ nhầm

- **Gate là `ANDROID_LOGIN_SETUP`, KHÔNG phải `ANDROID_WEBVIEW_READY`**: đây là điểm dễ nhầm nhất. Quyết định chạy/skip của *suite này* chỉ dựa trên `ANDROID_LOGIN_SETUP === "1"` (đặt bởi `npm run android:login`).
- **Logic đăng nhập KHÔNG nằm ở đây**: spec chỉ gọi `ensureLoggedIn()`. Toàn bộ cơ chế "đã login thì bỏ qua / chưa thì nhập token một lần" nằm trong [src/utils/ensure-logged-in.ts](../../../../src/utils/ensure-logged-in.ts) — xem [tài liệu giải thích](../../utils/ensure-logged-in.md).
- **Idempotent & an toàn chạy lại**: vì `ensureLoggedIn()` no-op khi đã auth, chạy `npm run android:login` nhiều lần vô hại.
- **`noReset:true` là mấu chốt**: session tạo ở đây được giữ qua các lần chạy — đó là lý do đây chỉ cần chạy "một lần" cho mỗi emulator. Nếu ai đó đổi `noReset` thành `false`, mỗi lần chạy sẽ wipe app và phải login lại.
- **Quan hệ với `app-home.e2e.ts`**: chạy `login-once` một lần để "mồi" session; sau đó [app-home](./app-home.e2e.md) (và các test thật) đi thẳng vào app.
