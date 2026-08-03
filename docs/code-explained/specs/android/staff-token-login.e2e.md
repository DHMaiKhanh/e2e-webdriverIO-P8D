# Giải thích code: `src/specs/android/staff-token-login.e2e.ts`

> **File nguồn:** [src/specs/android/staff-token-login.e2e.ts](../../../../src/specs/android/staff-token-login.e2e.ts)
> **Loại:** Spec (Mocha E2E, Android) — kiểm thử KẾT QUẢ đăng nhập staff-token
> **Chạy khi nào:** **KHÔNG BAO GIỜ chạy** ở trạng thái hiện tại — dòng 37 hard-code `const suite = describe.skip`. (Nếu bật lại: gate theo `ANDROID_WEBVIEW_READY === "1"`.)
> **Một câu:** Kiểm chứng **kết quả xác thực** của form staff-token (token hợp lệ / không hợp lệ / rỗng → app có cho vào không?) trên emulator có WebView lái được.

---

## 1. Mục đích tổng quan

Spec này khẳng định **KẾT QUẢ AUTH** (auth *outcome*): với từng loại token, app có cho vào hay không. Nó là "người anh em" của [login-staff-token-form.e2e.ts](./login-staff-token-form.e2e.md) — file kia kiểm tra **bản thân form** (cấu trúc, nhập liệu, validate client), còn file này kiểm tra **hành vi đăng nhập**.

Theo docblock (dòng 1–21), spec được xác nhận chạy được trên **emulator P8_Dual** khi có dev server P8D + `adb reverse tcp:1420` (renderer WebView của emulator answer CDP nên chromedriver lái được DOM).

**Quan trọng:** hiện tại toàn bộ suite bị **tắt cứng** (`describe.skip`) theo quyết định dự án — mọi lần chạy đi thẳng vào app trên session đã auth sẵn (xem phần 3).

---

## 2. Các import / phụ thuộc (dòng 22–30)

```ts
22 import { expect } from "@wdio/globals"
23 import { androidAppShellPage, staffTokenLoginPage } from "@pages"
24 import { ROUTES } from "../../constants/routes.js"
25 import { SELECTORS } from "../../constants/selectors.js"
26 import { TIMEOUTS } from "../../constants/timeouts.js"
27 import { ENV } from "../../utils/env.js"
28
29 const APP_ID = "com.fastboy.volt_pos"
30 const VALID_TOKEN = ENV.testUser.staffToken
```

| Dòng | Ý nghĩa |
|------|---------|
| 22 | `expect` — assertion. |
| 23 | `androidAppShellPage` (vào WebView, screenshot) + `staffTokenLoginPage` (thao tác form: `signIn`). Xem [pages/index.ts](../../../../src/pages/index.ts). |
| 24 | `ROUTES` — dùng `ROUTES.LOGIN_STAFF_TOKEN` = `/login-staff-token`. |
| 25 | `SELECTORS` — dùng `SELECTORS.LOGIN_STAFF_TOKEN.INPUT` = `input[placeholder="Enter Staff Token"]` và `.SUBMIT_BTN` = `button[type="submit"]`. |
| 26 | `TIMEOUTS` — `EXTRA_LONG`=60s, `ANIMATION`=500ms, `LONG`=30s. |
| 27 | `ENV` — biến môi trường đã typed. |
| 29 | **`APP_ID`** — package app P8D, cho `mobile: activateApp`. |
| 30 | **`VALID_TOKEN`** — staff token thật, lấy từ `ENV.testUser.staffToken` (biến `STAFF_TOKEN` trong `.env`). Quyết định case happy-path chạy hay skip. |

---

## 3. Điều kiện chạy suite (skip logic) — **TRỌNG TÂM**

```ts
32 // ⛔ LOGIN TEST CASES DISABLED — by project decision, every run goes STRAIGHT
33 //    into the app on the already-authenticated session (appium:noReset keeps the
34 //    session alive; see src/specs/android/app-home.e2e.ts + utils/ensure-logged-in.ts).
35 //    These cases are kept for reference but never run. To re-enable, restore:
36 //      const suite = process.env.ANDROID_WEBVIEW_READY === "1" ? describe : describe.skip
37 const suite = describe.skip
38 // The happy path needs a real token; skip just that case when none is provided.
39 const happyPathIt = VALID_TOKEN ? it : it.skip
```

- **Dòng 37 — `const suite = describe.skip`**: đây là **hard skip**. `suite(...)` ở dòng 41 thực chất là `describe.skip(...)` ⇒ Mocha **luôn bỏ qua toàn bộ suite**, bất kể ENV. **Không có điều kiện nào khiến nó chạy** ở trạng thái hiện tại.
- **Tại sao?** (comment 32–34): theo quyết định dự án, mọi lần chạy đi thẳng vào app trên session đã đăng nhập sẵn (nhờ `appium:noReset` giữ session — xem [app-home.e2e.ts](./app-home.e2e.md) và [ensure-logged-in.ts](../../utils/ensure-logged-in.md)). Các case login giữ lại **chỉ để tham khảo**.
- **Cách bật lại** (comment 36): thay dòng 37 bằng
  `const suite = process.env.ANDROID_WEBVIEW_READY === "1" ? describe : describe.skip`
  Khi đó suite chạy **chỉ khi** biến `ANDROID_WEBVIEW_READY === "1"` (đặt qua `npm run test:android:emu`). Gate này tồn tại vì thiết bị P8D vật lý MDM-locked giết renderer WebView, làm treo mọi context switch (xem device-smoke.e2e.ts).
- **Dòng 39 — `happyPathIt`**: gate cấp **case**. Nếu có `VALID_TOKEN` → `it` thường; nếu token rỗng → `it.skip`. Nghĩa là **kể cả khi suite được bật**, riêng case happy-path (cần token thật) vẫn tự skip nếu `STAFF_TOKEN` chưa set — các case âm tính (empty/invalid) vẫn chạy.

> Tóm lại trạng thái hiện tại: **cả suite skip cứng**. Nếu bật lại: suite chạy khi `ANDROID_WEBVIEW_READY=1`; trong đó case happy-path còn cần thêm `STAFF_TOKEN`.

---

## 4. Giải thích từng khối (before/beforeEach/it)

### 4.1. `before` — mở app + vào WebView (dòng 42–45)

```ts
42   before(async () => {
43     await browser.execute("mobile: activateApp", { appId: APP_ID })
44     await androidAppShellPage.switchToWebview()
45   })
```

- **Dòng 43** — Đưa app P8D lên foreground.
- **Dòng 44** — Chuyển sang context WebView (timeout mặc định 30s) để selector DOM hoạt động. Chạy **một lần** trước toàn bộ suite.

### 4.2. `beforeEach` — remount form sạch trước mỗi case (dòng 51–54)

```ts
51   beforeEach(async () => {
52     await browser.url(ROUTES.LOGIN_STAFF_TOKEN)
53     await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).waitForDisplayed({ timeout: TIMEOUTS.EXTRA_LONG })
54   })
```

- **Dòng 52** — Điều hướng cứng về `/login-staff-token` trước **mỗi** case, để mỗi test bắt đầu từ màn login sạch bất kể case trước đã đi tới đâu.
- **Dòng 53** — Chờ ô input hiển thị, timeout `EXTRA_LONG` = **60s**. Comment (47–50): hard navigation reload cả SPA qua dev tunnel — chậm trên emulator ARM giả lập — nên chờ rộng rãi.

### 4.3. Case 1 — form load được (dòng 56–61)

```ts
56   it("loads the staff-token form", async () => {
57     await androidAppShellPage.screenshot("staff-token-form")
58
59     expect(await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).isDisplayed()).toBe(true)
60     expect(await $("body").getText()).toContain("Staff Token")
61   })
```

- **Dòng 59–60** — Kiểm tra ô input hiển thị và body chứa chữ "Staff Token". Xác nhận đã đúng màn form.

### 4.4. Case 2 — không submit được token rỗng (dòng 63–75)

```ts
63   it("cannot submit an empty staff token", async () => {
67     const submitBtn = $(SELECTORS.LOGIN_STAFF_TOKEN.SUBMIT_BTN)
68     if (await submitBtn.isClickable()) {
69       await submitBtn.click()
70       await browser.pause(TIMEOUTS.ANIMATION)
71     }
72     await androidAppShellPage.screenshot("staff-token-empty")
73
74     expect(await browser.getUrl()).toContain("login")
75   })
```

- **Dòng 68–71** — Nút submit **có thể** bị disable khi ô rỗng; nếu vậy, chỉ riêng việc bị disable đã thoả bất biến (comment 64–66) ⇒ chỉ click **khi thật sự clickable**, rồi chờ 500ms animation.
- **Dòng 74** — **Bất biến an toàn**: submit rỗng phải **vẫn ở** luồng login → URL còn chứa `"login"`.

### 4.5. Case 3 — token sai không đăng nhập được (dòng 77–86)

```ts
77   it("does not sign in with an invalid staff token", async () => {
78     await staffTokenLoginPage.signIn("00000000-invalid-token")
79     // Allow the backend round-trip + error to render.
80     await browser.pause(TIMEOUTS.LONG)
81     await androidAppShellPage.screenshot("staff-token-invalid")
85     expect(await browser.getUrl()).toContain("login")
86   })
```

- **Dòng 78** — `signIn(...)` = nhập token sai + submit (xem [staff-token-login.page.ts](../../../../src/pages/staff-token-login.page.ts)).
- **Dòng 80** — Chờ 30s (`LONG`) để backend round-trip + hiện lỗi.
- **Dòng 85** — **Bất biến an toàn**: token sai **không được** vào app → URL vẫn chứa `"login"`.

### 4.6. Case 4 (happy-path, token-gated) — đăng nhập thành công (dòng 88–101)

```ts
88   happyPathIt("signs in with a valid staff token and leaves the login flow", async () => {
89     await staffTokenLoginPage.signIn(VALID_TOKEN)
94     await browser.waitUntil(async () => !(await browser.getUrl()).includes("login"), {
95       timeout: TIMEOUTS.EXTRA_LONG,
96       timeoutMsg: "Expected to navigate away from the login flow after a valid token"
97     })
98     await androidAppShellPage.screenshot("staff-token-success")
100    expect(await browser.getUrl()).not.toContain("login")
101  })
```

- **Dòng 88** — Dùng `happyPathIt` (skip nếu không có token — xem dòng 39).
- **Dòng 89** — Đăng nhập bằng token thật.
- **Dòng 94–97** — Sau submit, **chờ điều hướng rời** mọi màn `/login*` (URL không còn `login`) thay vì pause cứng — vì startup + sync dữ liệu lần đầu chậm. Timeout 60s, có `timeoutMsg` rõ ràng.
- **Dòng 100** — Khẳng định đã rời luồng login (URL không chứa `login`).

---

## 5. Sơ đồ luồng test

```
[37] const suite = describe.skip  ⇒ TOÀN BỘ SUITE BỊ SKIP (trạng thái hiện tại)
        │
        └─ (nếu bật lại: chạy khi ANDROID_WEBVIEW_READY === "1")
                │
                ▼
        before: [43] activateApp → [44] switchToWebview   (1 lần)
                │
        beforeEach: [52] url(/login-staff-token) → [53] chờ input (60s)  (mỗi case)
                │
    ┌───────────┼─────────────────────────┬─────────────────────────────┐
    ▼           ▼                          ▼                             ▼
 it1 form   it2 token rỗng            it3 token sai              happyPathIt token đúng
 [59-60]    [68-71] click nếu được    [78] signIn sai            (skip nếu thiếu token)
 hiển thị   [74] URL vẫn "login"      [80] chờ 30s               [89] signIn đúng
            (bất biến)                [85] URL vẫn "login"       [94-97] chờ rời login (60s)
                                      (bất biến an toàn)         [100] URL KHÔNG còn "login"
```

---

## 6. Ghi chú & điểm dễ nhầm

- **Hai lớp gate**: (1) `suite` cấp *toàn bộ* — hiện `describe.skip` cứng; nếu bật lại thì theo `ANDROID_WEBVIEW_READY`. (2) `happyPathIt` cấp *một case* — theo `VALID_TOKEN`. Đừng nhầm lẫn hai lớp.
- **Vì sao skip cứng?** Dự án quyết định không chạy test *login* nữa; session được giữ sẵn nhờ `appium:noReset`. Logic login "một lần" giờ nằm ở [ensure-logged-in.ts](../../utils/ensure-logged-in.md), và test thật đi qua [app-home.e2e.ts](./app-home.e2e.md).
- **Bất biến an toàn (safety invariant)**: các case âm tính (rỗng/sai) không kiểm tra "hiện thông báo lỗi" mà kiểm tra điều tối quan trọng hơn — **URL vẫn ở luồng login**, tức token xấu KHÔNG lọt vào app.
- **`waitUntil` (case 4) vs `pause` (case 2, 3)**: happy-path dùng `waitUntil` (chờ điều kiện) để nhanh & ổn định; case âm tính dùng `pause` cố định vì cần chờ backend phản hồi rồi mới khẳng định "vẫn ở login".
- **Phân vai với file form**: file này = *kết quả auth*; [login-staff-token-form.e2e.ts](./login-staff-token-form.e2e.md) = *hành vi form*, không cần token thật.
