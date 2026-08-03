# Giải thích code: `src/utils/ensure-logged-in.ts`

> **File nguồn:** [src/utils/ensure-logged-in.ts](../../../src/utils/ensure-logged-in.ts)
> **Loại:** Utility (helper dùng chung cho các spec cần đăng nhập)
> **Một câu:** "Đăng nhập 1 lần, giữ đăng nhập mãi" — đảm bảo app Android P8D đã login, chỉ thực sự nhập staff token khi session hiện tại **chưa** đăng nhập.

---

## 1. Mục đích tổng quan

File này export đúng **một hàm** `ensureLoggedIn()`. Nhiệm vụ của nó:

1. Mở app P8D trên Android và nhảy vào WebView (app là Tauri WebView đóng gói thành app Android).
2. Điều hướng về gốc `/` và để router của SPA tự quyết định màn hình.
3. **Nếu đã đăng nhập** → thoát ngay (no-op), không đụng vào form login.
4. **Nếu bị đá về `/login`** (session hết hạn hoặc chạy lần đầu) → nhập staff token đúng **một lần**.

Nhờ cấu hình `appium:noReset = true` trong [config/wdio.android.conf.ts](../../../config/wdio.android.conf.ts), Appium **không** xoá dữ liệu app giữa các lần chạy, nên session được giữ lại. Sau lần login đầu tiên, hàm này luôn là **no-op** ở mọi lần chạy sau.

---

## 2. Các import (dòng 1–8)

```ts
1  import { androidAppShellPage, staffTokenLoginPage } from "@pages"
2  import { ROUTES } from "../constants/routes.js"
3  import { SELECTORS } from "../constants/selectors.js"
4  import { TIMEOUTS } from "../constants/timeouts.js"
5  import { ENV } from "./env.js"
6  import { logger } from "./logger.js"
7
8  const APP_ID = "com.fastboy.volt_pos"
```

| Dòng | Ý nghĩa |
|------|---------|
| 1 | Import 2 **page object** qua alias `@pages` (định nghĩa trong `tsconfig`/`wdio.conf`): `androidAppShellPage` (chuyển context sang WebView), `staffTokenLoginPage` (thao tác form nhập token). Xem [pages/index.ts](../../../src/pages/index.ts). |
| 2 | `ROUTES` — hằng số đường dẫn (route). Ở đây dùng `ROUTES.ROOT` = `/` và `ROUTES.LOGIN_STAFF_TOKEN` = `/login-staff-token`. |
| 3 | `SELECTORS` — registry selector tập trung. Ở đây dùng `SELECTORS.LOGIN_STAFF_TOKEN.INPUT` = `input[placeholder="Enter Staff Token"]`. |
| 4 | `TIMEOUTS` — các mốc timeout đặt tên sẵn: `SHORT`=5s, `ANIMATION`=500ms, `EXTRA_LONG`=60s… |
| 5 | `ENV` — object biến môi trường đã strong-typed. Ở đây lấy `ENV.testUser.staffToken` (đọc từ biến `STAFF_TOKEN` trong `.env`). |
| 6 | `logger` — logger dùng chung (winston) để in log ra console + file. |
| 8 | **Hằng số package Android** của app P8D. Dùng cho lệnh `mobile: activateApp` để bật app đúng package. |

> 💡 Các import đều dùng đuôi `.js` (dù file gốc là `.ts`) vì project chạy theo chuẩn **ESM/NodeNext** — khi biên dịch, đường dẫn import phải trỏ tới file `.js` output.

---

## 3. Docblock mô tả hàm (dòng 10–31)

```ts
10 /**
11  * "Login once, stay logged in."
...
16  * Why this is enough to log in a single time and never again:
17  * the Android config runs with `appium:noReset = true`
...
22  * later run: it navigates to the app root, sees it is NOT on a `/login*` screen,
23  * and returns immediately.
...
31  */
```

Đây là JSDoc giải thích **tại sao** chỉ cần login một lần:

- **`appium:noReset = true`** → Appium không bao giờ wipe dữ liệu app giữa các session.
- Tauri WebView vì thế **giữ nguyên session auth** mà mutation `exchangeImpersonationToken` đã tạo — xuyên suốt các spec, các lần chạy `npm run test:android`, thậm chí qua reboot — cho tới khi session **thực sự** hết hạn.
- Sau lần login thành công đầu tiên, hàm là **no-op**: về root `/`, thấy KHÔNG ở màn `/login*` → return ngay.

**Điều kiện tiên quyết** (dòng 29–30): emulator đang bật, dev server + `adb reverse` đã chạy, `ANDROID_WEBVIEW_READY=1`, và `STAFF_TOKEN` đã set trong `.env`.

**Cách dùng** (dòng 26–27):
```ts
before(async () => { await ensureLoggedIn() })
```

---

## 4. Thân hàm — phân tích từng dòng

### 4.1. Mở app + vào WebView (dòng 32–34)

```ts
32 export async function ensureLoggedIn(): Promise<void> {
33   await browser.execute("mobile: activateApp", { appId: APP_ID })
34   await androidAppShellPage.switchToWebview()
```

- **Dòng 32** — Khai báo hàm `async`, trả về `Promise<void>` (không trả giá trị, chỉ side-effect là đảm bảo đã login).
- **Dòng 33** — Gọi lệnh Appium đặc biệt `mobile: activateApp` để **đưa app P8D lên foreground** (mở app hoặc kéo về trước nếu đang chạy nền). `appId` chính là `APP_ID` ở dòng 8.
- **Dòng 34** — Gọi `switchToWebview()`: WebdriverIO mặc định ở context `NATIVE_APP`. Mọi selector DOM (`SELECTORS.*`) **chỉ** hoạt động khi đã chuyển sang context `WEBVIEW_*`. Hàm này retry liên tục trong khi WebView còn đang "attach" (thường ngay sau khi mở app). Chi tiết ở [pages/android/app-shell.page.ts](../../../src/pages/android/app-shell.page.ts).

### 4.2. Về gốc app, chờ animation (dòng 36–40)

```ts
36   // Land on the app root and let the SPA router decide where we belong: an
37   // authenticated session settles on a real screen, a logged-out one is
38   // bounced to /login (QR) — either way `splashscreen` is only ever transient.
39   await browser.url(ROUTES.ROOT)
40   await browser.pause(TIMEOUTS.ANIMATION)
```

- **Dòng 36–38 (comment)** — Giải thích chiến lược: điều hướng về `/` rồi để **router của SPA** tự quyết định. Session đã auth → dừng ở màn hình thật; session logout → bị đá về `/login` (màn QR). Còn `splashscreen` chỉ là màn hình **chuyển tiếp tạm thời**.
- **Dòng 39** — `browser.url("/")` điều hướng WebView về route gốc. (Đây là điều hướng trong WebView chứ không phải trên trình duyệt thật.)
- **Dòng 40** — `browser.pause(500)` — dừng cứng 500ms cho animation/transition kịp chạy trước khi đọc URL. Đây là "necessary evil"; phần chờ chính xác nằm ở `waitUntil` bên dưới.

### 4.3. Kiểm tra đã đăng nhập chưa (dòng 42–56) — **trái tim của "no-op"**

```ts
42   const alreadyAuthenticated = await browser
43     .waitUntil(
44       async () => {
45         const url = await browser.getUrl()
46         return !url.includes("login") && !url.includes("splashscreen")
47       },
48       { timeout: TIMEOUTS.SHORT }
49     )
50     .then(() => true)
51     .catch(() => false)
52
53   if (alreadyAuthenticated) {
54     logger.info("[ensureLoggedIn] session already authenticated — skipping login")
55     return
56   }
```

Đây chính là đoạn "đã đăng nhập rồi thì bỏ qua login".

- **Dòng 42–49** — `browser.waitUntil(...)` **poll lặp lại** hàm điều kiện cho tới khi nó trả `true` hoặc hết `timeout`:
  - **Dòng 45** — Đọc URL hiện tại của WebView.
  - **Dòng 46** — Điều kiện "đã auth" = URL **không** chứa `"login"` **và** **không** chứa `"splashscreen"`. Nghĩa là đã dừng ở một màn hình thật (không phải login, không phải splash).
  - **Dòng 48** — `timeout: TIMEOUTS.SHORT` = **5 giây**. Nếu trong 5s router settle về màn thật → coi như đã auth.
- **Dòng 50–51** — Biến `waitUntil` thành boolean **không ném lỗi**:
  - `.then(() => true)` → nếu điều kiện đạt trong 5s → `alreadyAuthenticated = true`.
  - `.catch(() => false)` → nếu **timeout** (vẫn kẹt ở login/splash sau 5s) → `false`. Nhờ `.catch`, timeout không làm crash test.
- **Dòng 53–56** — Nếu `alreadyAuthenticated === true`: ghi log và **`return` ngay lập tức**. 👈 **Đây chính là "no-op, vào thẳng app"** — không đụng gì tới form login.

> Vì `noReset:true` giữ session, sau lần login đầu tiên URL luôn settle về màn thật trong 5s ⇒ luôn rơi vào nhánh `return` này.

### 4.4. Trường hợp mập mờ: không login, không màn thật (dòng 58–64)

```ts
58   const settledUrl = await browser.getUrl()
59   if (!settledUrl.includes("login")) {
60     // Neither settled on a real screen nor bounced to login — don't force a
61     // needless login; the router is likely mid-transition on an authed session.
62     logger.info(`[ensureLoggedIn] not on a login screen (url=${settledUrl}) — assuming authenticated`)
63     return
64   }
```

Chỉ chạy tới đây khi `waitUntil` ở trên **đã timeout** (chưa settle về màn thật trong 5s).

- **Dòng 58** — Đọc lại URL "đã ổn định".
- **Dòng 59** — Nếu URL **không** chứa `"login"` (ví dụ vẫn đang `splashscreen` hoặc đang chuyển tiếp) → **không ép** login vô ích.
- **Dòng 62–63** — Ghi log và `return`. Lý do (comment dòng 60–61): router nhiều khả năng đang **giữa quá trình chuyển tiếp** trên một session đã auth — cứ giả định là đã đăng nhập, tránh login thừa.

> Chỉ khi URL **thực sự** chứa `login` mới đi tiếp xuống nhánh login bên dưới.

### 4.5. Thực hiện login staff-token (chỉ khi cần) (dòng 66–83)

```ts
66   const token = ENV.testUser.staffToken
67   if (!token) {
68     throw new Error("[ensureLoggedIn] STAFF_TOKEN is empty — set it in .env before running authenticated specs")
69   }
70
71   logger.info("[ensureLoggedIn] not authenticated — performing one-time staff-token login")
72   await browser.url(ROUTES.LOGIN_STAFF_TOKEN)
73   await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).waitForDisplayed({ timeout: TIMEOUTS.EXTRA_LONG })
74   await staffTokenLoginPage.signIn(token)
75
76   // A successful auth routes the SPA away from any `/login*` screen. Wait for
77   // that navigation rather than a fixed pause — startup + first data sync is
78   // slow on the ARM-translated emulator.
79   await browser.waitUntil(async () => !(await browser.getUrl()).includes("login"), {
80     timeout: TIMEOUTS.EXTRA_LONG,
81     timeoutMsg: "[ensureLoggedIn] expected to leave the /login flow after a valid staff token"
82   })
83   logger.info("[ensureLoggedIn] login complete — session now persists via noReset:true")
84 }
```

- **Dòng 66** — Lấy staff token từ `.env` (qua `ENV.testUser.staffToken` ← biến `STAFF_TOKEN`).
- **Dòng 67–69** — **Fail-fast**: nếu token rỗng → ném lỗi rõ ràng ngay, để người chạy biết cần set `STAFF_TOKEN` trong `.env`.
- **Dòng 71** — Log báo bắt đầu login một lần.
- **Dòng 72** — Điều hướng WebView tới form nhập token `/login-staff-token`.
- **Dòng 73** — Chờ ô input hiển thị, timeout `EXTRA_LONG` = **60 giây** (khởi động app + đồng bộ dữ liệu lần đầu rất chậm trên emulator ARM giả lập).
- **Dòng 74** — Gọi `staffTokenLoginPage.signIn(token)`: nhập token vào ô + bấm submit (xem [staff-token-login.page.ts](../../../src/pages/staff-token-login.page.ts)).
- **Dòng 79–82** — Sau khi submit, chờ **điều hướng rời khỏi** mọi màn `/login*` (điều kiện: URL không còn chứa `login`) thay vì `pause` cứng. Timeout 60s; nếu quá hạn ném lỗi với `timeoutMsg` rõ ràng (token sai hoặc auth thất bại).
- **Dòng 83** — Log hoàn tất; nhấn mạnh session giờ sẽ được giữ nhờ `noReset:true`.

---

## 5. Sơ đồ luồng

```
ensureLoggedIn()
        │
        ▼
[33] activateApp ──► [34] switchToWebview ──► [39] url("/") ──► [40] pause(500ms)
        │
        ▼
[42-51] waitUntil: URL không phải login/splash trong 5s?
        │
   ┌────┴─────────────────────────────┐
   │ có (đã auth)                      │ không (timeout sau 5s)
   ▼                                   ▼
[53-55] return  ✅ NO-OP        [58-59] URL có chứa "login"?
(vào thẳng app)                        │
                            ┌──────────┴───────────┐
                            │ không                 │ có
                            ▼                       ▼
                   [62-63] return         [66-69] có token? (không → throw)
                   (giả định đã auth)              │
                                                   ▼
                                          [72-74] mở form + nhập token + submit
                                                   │
                                                   ▼
                                          [79-82] chờ rời /login (tối đa 60s)
                                                   │
                                                   ▼
                                          [83] login xong ✅ (session persist)
```

---

## 6. Ghi chú & điểm dễ nhầm

- **Đây là nơi "no-op" thật sự nằm** — không phải trong `app-home.e2e.ts`. File `app-home` chỉ gọi `ensureLoggedIn()` trong `before()`; toàn bộ logic "đã login thì bỏ qua" nằm ở dòng **42–56** của file này.
- **`noReset:true` là mấu chốt**: nếu ai đó đổi thành `false`, mỗi lần chạy sẽ wipe app ⇒ nhánh login (dòng 66–83) chạy lại mỗi lần ⇒ cần `STAFF_TOKEN` hợp lệ luôn.
- **Ba lối `return`/ném lỗi**: (1) đã auth → return; (2) không ở màn login → return; (3) ở màn login nhưng thiếu token → throw. Chỉ nhánh (3-có-token) mới thực sự đăng nhập.
- **Vì sao dùng `.then/.catch` quanh `waitUntil`?** Để biến "timeout" thành `false` thay vì ném lỗi — cho phép chương trình chạy tiếp xuống các nhánh xử lý thay vì dừng test.
- **`waitUntil` (poll điều kiện) khác `pause` (chờ cứng)**: code ưu tiên `waitUntil` ở những chỗ quan trọng để test nhanh và ổn định; chỉ `pause(500ms)` một lần cho animation.
