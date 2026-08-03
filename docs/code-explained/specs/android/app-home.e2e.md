# Giải thích code: `src/specs/android/app-home.e2e.ts`

> **File nguồn:** [src/specs/android/app-home.e2e.ts](../../../../src/specs/android/app-home.e2e.ts)
> **Loại:** Spec (Mocha E2E, Android) — điểm vào cho test sản phẩm thật
> **Chạy khi nào:** **CHỈ chạy khi `ANDROID_WEBVIEW_READY === "1"`** (dòng 29–30) — đặt qua `npm run test:android:emu`. Mặc định (không set) → `describe.skip`.
> **Một câu:** Điểm vào cho các test tính năng thật — giả định app **đã đăng nhập sẵn**, đi thẳng vào app (không màn login, không assertion login), là nơi bạn thêm các case sản phẩm.

---

## 1. Mục đích tổng quan

Đây là **điểm vào (entry point) cho test sản phẩm thật** (docblock dòng 1–22). Nó giả định app **đã xác thực sẵn**:

- `ensureLoggedIn()` chỉ thực hiện đăng nhập staff-token ở **lần đầu** (hoặc sau khi session hết hạn) và là **no-op thuần** ở mọi lần chạy sau — nhờ config Android dùng `appium:noReset = true` (Tauri WebView giữ session auth qua các lần chạy). Xem [utils/ensure-logged-in.ts](../../../../src/utils/ensure-logged-in.ts) → [tài liệu giải thích](../../utils/ensure-logged-in.md).
- Do đó hằng ngày spec này **đi thẳng vào app** và chạy các case của bạn — không màn login, không assertion login, không test login.

**Thiết lập lần đầu** (một lần cho mỗi emulator): `npm run android:login` (chính là spec [login-once](./login-once.e2e.md)). Sau đó các lần chạy bình thường đi thẳng vào.

---

## 2. Các import / phụ thuộc (dòng 23–24)

```ts
23 import { expect } from "@wdio/globals"
24 import { ensureLoggedIn } from "../../utils/ensure-logged-in.js"
```

| Dòng | Ý nghĩa |
|------|---------|
| 23 | `expect` — assertion. |
| 24 | **`ensureLoggedIn`** — guard đảm bảo đã đăng nhập (no-op nếu session còn). Toàn bộ logic login nằm trong hàm này; xem [ensure-logged-in.md](../../utils/ensure-logged-in.md). |

> Spec tối giản: chưa import `ROUTES`/`SELECTORS` vì mới chỉ có case khung; khi thêm case thật bạn sẽ import chúng (xem gợi ý ở dòng 44–51).

---

## 3. Điều kiện chạy suite (skip logic) — **TRỌNG TÂM**

```ts
26 // Driving the DOM needs a webview-capable target (the emulator). Gated like the
27 // other webview specs so it's skipped on the physical MDM device that can't
28 // drive its WebView. `npm run test:android:emu` sets this flag.
29 const WEBVIEW_READY = process.env.ANDROID_WEBVIEW_READY === "1"
30 const suite = WEBVIEW_READY ? describe : describe.skip
```

- **Dòng 29 — `WEBVIEW_READY`**: `true` **chỉ khi** biến môi trường `ANDROID_WEBVIEW_READY` bằng đúng chuỗi `"1"`.
- **Dòng 30 — `const suite = WEBVIEW_READY ? describe : describe.skip`**: **skip có điều kiện**.
  - `ANDROID_WEBVIEW_READY === "1"` → `suite = describe` → **suite CHẠY**.
  - Ngược lại → `suite = describe.skip` → **suite BỊ SKIP**.
- **Ai đặt biến này?** Script `npm run test:android:emu` (comment 28). Đây là cách chạy suite trên emulator.
- **Tại sao gate?** (comment 26–28): lái DOM cần một target có WebView hoạt động (emulator). Trên **thiết bị P8D vật lý MDM-locked**, WebView không lái được (renderer không answer CDP, context switch treo — xem device-smoke.e2e.ts), nên phải skip ở đó. Gate `ANDROID_WEBVIEW_READY` là "công tắc" khẳng định "đang chạy trên target lái được WebView".

> So sánh: [login-once](./login-once.e2e.md) gate theo `ANDROID_LOGIN_SETUP`; còn spec này (và `staff-token-*` khi bật lại) gate theo `ANDROID_WEBVIEW_READY`.

---

## 4. Giải thích từng khối (before/it/after)

### 4.1. `before` — guard đăng nhập (dòng 33–38)

```ts
33   before(async () => {
34     // Straight into the app. Logs in ONCE only if the session isn't established
35     // yet (or expired); otherwise a pure no-op. This is the guard that gets us
36     // in — never a login *test*.
37     await ensureLoggedIn()
38   })
```

- **Dòng 37** — Gọi `ensureLoggedIn()` **một lần** trước toàn suite. Đây là **guard đưa ta vào app**, KHÔNG phải một *test* login (comment 34–36). Bên trong: đã auth → return ngay (no-op); chưa/hết hạn → nhập `STAFF_TOKEN` một lần. Chi tiết ở [ensure-logged-in.md](../../utils/ensure-logged-in.md).

### 4.2. Case 1 — đang ở trong app đã xác thực (dòng 40–42)

```ts
40   it("is inside the authenticated app (not parked on a login screen)", async () => {
41     expect(await browser.getUrl()).not.toContain("login")
42   })
```

- **Dòng 41** — Assertion: URL **không** chứa `"login"` — chứng minh sau `before` ta đã ở trong app, không kẹt màn login. Đây là case "sanity" xác nhận session đã sẵn sàng cho các test thật.

### 4.3. Khối gợi ý case thật (comment, dòng 44–51)

```ts
44   // 👉 Add your real app test cases below. The session is authenticated and
45   //    you're on the app root — navigate with `browser.url(ROUTES.APP.*)` and
46   //    assert against the screen. Example:
47   //
48   //  it("opens settings", async () => {
49   //    await browser.url(ROUTES.APP.SETTINGS)
50   //    expect(await browser.getUrl()).toContain("/settings")
51   //  })
```

- **Dòng 44–51** — Đây là **comment hướng dẫn**, không chạy. Chỉ ra cách viết case thật: session đã auth và đang ở app root — điều hướng bằng `browser.url(ROUTES.APP.*)` rồi assert. Ví dụ mẫu: mở `/settings` và kiểm tra URL. (`ROUTES.APP.SETTINGS` = `/settings` — xem [constants/routes.ts](../../../../src/constants/routes.ts).)

---

## 5. Sơ đồ luồng test

```
[29] WEBVIEW_READY = (ANDROID_WEBVIEW_READY === "1")
[30] suite = WEBVIEW_READY ? describe : describe.skip
        │
   ┌────┴──────────────────────────────┐
   │ ANDROID_WEBVIEW_READY=1            │ khác (mặc định / thiết bị vật lý)
   │ (npm run test:android:emu)        │
   ▼                                   ▼
 SUITE CHẠY                       SUITE SKIP
   │
   ▼
 before: [37] ensureLoggedIn()
   │        ↳ đã auth → no-op | chưa → login 1 lần (STAFF_TOKEN)
   ▼
 it "is inside the authenticated app"
   │
[41] expect URL KHÔNG chứa "login"   ✅ đã ở trong app
   │
   └── (chỗ để bạn thêm các case sản phẩm thật — dòng 44-51)
```

---

## 6. Ghi chú & điểm dễ nhầm

- **Gate là `ANDROID_WEBVIEW_READY`** (đặt bởi `npm run test:android:emu`): suite chỉ chạy khi biến này = "1"; ngược lại skip. Trên thiết bị vật lý không lái được WebView, cố ý để skip.
- **Logic "no-op nếu đã login" KHÔNG nằm ở đây**: file này chỉ gọi `ensureLoggedIn()` trong `before`. Toàn bộ cơ chế "đã auth thì bỏ qua login" nằm ở [ensure-logged-in.ts](../../../../src/utils/ensure-logged-in.ts) (xem [tài liệu](../../utils/ensure-logged-in.md)). Đừng tìm logic skip-login trong file này.
- **`before` là guard, không phải test login**: đây là chủ ý thiết kế — không có test *login* nào trong luồng thường; login chỉ xảy ra ngầm một lần qua guard.
- **Quan hệ setup**: chạy [login-once](./login-once.e2e.md) (`npm run android:login`) một lần để mồi session; sau đó spec này đi thẳng vào nhờ `appium:noReset` giữ session.
- **Nơi mở rộng test thật**: thêm case dưới dòng 42; session đã auth, dùng `ROUTES.APP.*` để điều hướng.
