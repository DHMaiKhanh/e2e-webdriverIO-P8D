# Giải thích code: `src/specs/android/login-staff-token-form.e2e.ts`

> **File nguồn:** [src/specs/android/login-staff-token-form.e2e.ts](../../../../src/specs/android/login-staff-token-form.e2e.ts)
> **Loại:** Spec (Mocha E2E, Android) — kiểm thử HÀNH VI của FORM staff-token
> **Chạy khi nào:** **KHÔNG BAO GIỜ chạy** ở trạng thái hiện tại — dòng 34 hard-code `const suite = describe.skip`. (Nếu bật lại: gate theo `ANDROID_WEBVIEW_READY === "1"`.)
> **Một câu:** Kiểm chứng **bản thân form** staff-token — cấu trúc, xử lý nhập liệu, validate phía client và khả năng thử lại — **không case nào cần `STAFF_TOKEN` thật**, nên nếu chạy thì tất cả case đều thực thi.

---

## 1. Mục đích tổng quan

Đây là "người anh em" của [staff-token-login.e2e.ts](./staff-token-login.e2e.md). Phân vai (docblock dòng 1–8):

- File kia khẳng định **KẾT QUẢ AUTH** (hợp lệ/không hợp lệ/rỗng → app có cho vào không) — case happy-path cần token thật.
- **File này** khẳng định **BẢN THÂN FORM**: cấu trúc, nhập liệu, validate client-side, khả năng phục hồi. **Không case nào token-gated** → nếu suite bật thì mọi case đều chạy trên emulator.

---

## 2. Các import / phụ thuộc (dòng 21–27)

```ts
21 import { expect } from "@wdio/globals"
22 import { androidAppShellPage, staffTokenLoginPage } from "@pages"
23 import { ROUTES } from "../../constants/routes.js"
24 import { SELECTORS } from "../../constants/selectors.js"
25 import { TIMEOUTS } from "../../constants/timeouts.js"
26
27 const APP_ID = "com.fastboy.volt_pos"
```

| Dòng | Ý nghĩa |
|------|---------|
| 21 | `expect` — assertion. |
| 22 | `androidAppShellPage` (screenshot) + `staffTokenLoginPage` (`enterToken`, `signIn`). |
| 23 | `ROUTES.LOGIN_STAFF_TOKEN` = `/login-staff-token`. |
| 24 | `SELECTORS.LOGIN_STAFF_TOKEN.INPUT` (`input[placeholder="Enter Staff Token"]`), `.SUBMIT_BTN` (`button[type="submit"]`). |
| 25 | `TIMEOUTS` — `EXTRA_LONG`=60s, `LONG`=30s. |
| 27 | **`APP_ID`** — package app P8D. |

> Khác với file `staff-token-login.e2e.ts`, file này **KHÔNG** import `ENV` — vì không case nào cần token thật.

---

## 3. Điều kiện chạy suite (skip logic) — **TRỌNG TÂM**

```ts
29 // ⛔ LOGIN TEST CASES DISABLED — by project decision, every run goes STRAIGHT
30 //    into the app on the already-authenticated session (appium:noReset keeps the
31 //    session alive; see src/specs/android/app-home.e2e.ts + utils/ensure-logged-in.ts).
32 //    These cases are kept for reference but never run. To re-enable, restore:
33 //      const suite = process.env.ANDROID_WEBVIEW_READY === "1" ? describe : describe.skip
34 const suite = describe.skip
```

- **Dòng 34 — `const suite = describe.skip`**: **hard skip**. `suite(...)` ở dòng 36 chính là `describe.skip(...)` ⇒ Mocha **luôn bỏ qua toàn bộ suite**, không phụ thuộc ENV. Không có điều kiện nào khiến nó chạy hiện nay.
- **Tại sao?** (comment 29–31): quyết định dự án — mọi lần chạy đi thẳng vào app trên session đã auth sẵn (nhờ `appium:noReset`). Các case login giữ lại **chỉ để tham khảo**.
- **Cách bật lại** (comment 33): thay dòng 34 bằng
  `const suite = process.env.ANDROID_WEBVIEW_READY === "1" ? describe : describe.skip`
  Khi đó suite chạy **chỉ khi** `ANDROID_WEBVIEW_READY === "1"` (đặt qua `npm run test:android:emu`). Gate này vì thiết bị P8D vật lý MDM-locked giết renderer WebView, làm treo context switch (xem device-smoke.e2e.ts).
- **Khác với `staff-token-login.e2e.ts`**: file này **không** có gate cấp-case (`happyPathIt`) vì **không case nào cần `STAFF_TOKEN`** (docblock dòng 18–19). Nếu suite bật, tất cả 5 case đều chạy.

> Tóm lại: hiện **cả suite skip cứng**; nếu bật lại chỉ cần `ANDROID_WEBVIEW_READY=1`, không cần token.

---

## 4. Giải thích từng khối (before/beforeEach/it)

### 4.1. `before` — mở app + vào WebView (dòng 37–40)

```ts
37   before(async () => {
38     await browser.execute("mobile: activateApp", { appId: APP_ID })
39     await androidAppShellPage.switchToWebview()
40   })
```

- **Dòng 38–39** — Đưa app lên foreground rồi vào WebView (một lần trước suite) để selector DOM hoạt động.

### 4.2. `beforeEach` — remount form sạch (dòng 46–49)

```ts
46   beforeEach(async () => {
47     await browser.url(ROUTES.LOGIN_STAFF_TOKEN)
48     await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).waitForDisplayed({ timeout: TIMEOUTS.EXTRA_LONG })
49   })
```

- **Dòng 47–48** — Trước **mỗi** case: điều hướng cứng về `/login-staff-token`, chờ input hiển thị (60s). Đảm bảo mỗi test bắt đầu từ trạng thái sạch, không rò rỉ giá trị từ case trước (comment 42–45).

### 4.3. Case 1 — render đủ input/nút/nhãn (dòng 51–57)

```ts
51   it("renders the token input, submit button and Staff Token label", async () => {
52     await androidAppShellPage.screenshot("login-form-structure")
54     expect(await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).isDisplayed()).toBe(true)
55     expect(await $(SELECTORS.LOGIN_STAFF_TOKEN.SUBMIT_BTN).isExisting()).toBe(true)
56     expect(await $("body").getText()).toContain("Staff Token")
57   })
```

- **Dòng 54–56** — Ba assertion về cấu trúc form: input **hiển thị**, nút submit **tồn tại** (`isExisting`, không cần visible), body chứa "Staff Token".

### 4.4. Case 2 — ô token rỗng khi vào mới (dòng 59–63)

```ts
59   it("starts with an empty token field on a fresh visit", async () => {
62     expect(await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).getValue()).toBe("")
63   })
```

- **Dòng 62** — Sau khi `beforeEach` vừa hard-navigate tới, ô input phải **rỗng** — không rò rỉ giá trị từ case trước, không bị autofill (comment 60–61).

### 4.5. Case 3 — gõ token phản ánh vào ô (dòng 65–71)

```ts
65   it("reflects a typed token in the field", async () => {
68     const sample = "sample-token-1234"
69     await staffTokenLoginPage.enterToken(sample)
70     expect(await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).getValue()).toBe(sample)
71   })
```

- **Dòng 69–70** — Gõ chuỗi mẫu qua `enterToken` rồi kiểm tra `getValue()` khớp — chứng minh input React-controlled thực sự bắt được, form không phải "render chết" (comment 66–67).

### 4.6. Case 4 — không auth token toàn khoảng trắng (dòng 73–87)

```ts
73   it("does not authenticate a whitespace-only token", async () => {
77     await staffTokenLoginPage.enterToken("   ")
78     const submitBtn = $(SELECTORS.LOGIN_STAFF_TOKEN.SUBMIT_BTN)
79     if (await submitBtn.isClickable()) {
80       await submitBtn.click()
81       await browser.pause(TIMEOUTS.LONG)
82     }
83     await androidAppShellPage.screenshot("login-whitespace-token")
86     expect(await browser.getUrl()).toContain("login")
87   })
```

- **Dòng 77** — Nhập token chỉ gồm khoảng trắng (`"   "`).
- **Dòng 79–82** — Nút có thể vẫn disable khi giá trị trim thành rỗng; nếu vậy chỉ riêng điều đó đã thoả bất biến (comment 74–76). Chỉ click khi actionable, rồi chờ 30s.
- **Dòng 86** — **Bất biến an toàn**: token toàn khoảng trắng **không được** vào app → URL vẫn chứa `"login"`.

### 4.7. Case 5 — cho phép thử lại sau token bị từ chối (dòng 89–102)

```ts
89   it("lets the operator retry after a rejected token", async () => {
92     await staffTokenLoginPage.signIn("00000000-invalid-token")
93     await browser.pause(TIMEOUTS.LONG)
94     expect(await browser.getUrl()).toContain("login")
98     await browser.url(ROUTES.LOGIN_STAFF_TOKEN)
99     await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).waitForDisplayed({ timeout: TIMEOUTS.EXTRA_LONG })
100    await staffTokenLoginPage.enterToken("second-attempt")
101    expect(await $(SELECTORS.LOGIN_STAFF_TOKEN.INPUT).getValue()).toBe("second-attempt")
102  })
```

- **Dòng 92–94** — Submit token sai, chờ 30s, khẳng định vẫn ở luồng login. Token xấu **không được** khoá luồng lại (comment 90–91).
- **Dòng 98–101** — Mở lại form (bất kể submit lỗi đưa tới màn nào), nhập lần thử thứ hai và kiểm tra giá trị vào được ô — chứng minh operator **sửa lỗi gõ và thử lại được**.

---

## 5. Sơ đồ luồng test

```
[34] const suite = describe.skip  ⇒ TOÀN BỘ SUITE BỊ SKIP (trạng thái hiện tại)
        │
        └─ (nếu bật lại: chạy khi ANDROID_WEBVIEW_READY === "1" — KHÔNG cần token)
                │
                ▼
        before: [38] activateApp → [39] switchToWebview   (1 lần)
                │
        beforeEach: [47] url(/login-staff-token) → [48] chờ input (60s)   (mỗi case)
                │
    ┌───────┬────────────┬───────────────┬───────────────────┬───────────────────────┐
    ▼       ▼            ▼               ▼                   ▼                        │
  it1     it2          it3            it4                 it5
 cấu trúc  ô rỗng      gõ phản ánh    whitespace          retry sau token sai
 [54-56]  [62]="" ""  [70]=sample    [77] nhập "   "     [92-94] sai → vẫn "login"
                                     [86] URL "login"    [98-101] mở lại + gõ lần 2 OK
                                     (bất biến an toàn)
```

---

## 6. Ghi chú & điểm dễ nhầm

- **Một lớp gate duy nhất**: khác `staff-token-login.e2e.ts` (có thêm `happyPathIt` token-gated), file này chỉ có gate cấp-suite. Hiện `describe.skip` cứng; nếu bật lại chỉ cần `ANDROID_WEBVIEW_READY=1`.
- **Không cần `STAFF_TOKEN`**: mọi case chỉ kiểm tra form/đường-âm-tính, không thực hiện auth thành công. Đây là điểm phân vai then chốt với file "outcome".
- **`isExisting` vs `isDisplayed`**: case 1 kiểm nút submit bằng `isExisting` (chỉ cần có trong DOM) chứ không đòi visible — mềm dẻo hơn.
- **Bất biến an toàn** lặp lại ở case 4 & 5: điều tối quan trọng luôn là "**URL vẫn ở luồng login**" — token xấu/khoảng trắng KHÔNG lọt vào app.
- **`beforeEach` hard-navigate** đảm bảo cô lập case; case 5 còn tự navigate lại lần nữa (dòng 98) để thử lại từ form sạch.
