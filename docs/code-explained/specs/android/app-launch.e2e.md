# Giải thích code: `src/specs/android/app-launch.e2e.ts`

> **File nguồn:** [src/specs/android/app-launch.e2e.ts](../../../../src/specs/android/app-launch.e2e.ts)
> **Loại:** Spec (Mocha E2E, Android)
> **Chạy khi nào:** **LUÔN chạy** — dùng `describe` thường, KHÔNG có skip logic; không phụ thuộc biến môi trường nào.
> **Một câu:** Smoke test chứng minh toàn bộ pipeline Appium/uiautomator2 (attach thiết bị → mở app → chuyển context WebView → đọc được DOM) hoạt động end-to-end.

---

## 1. Mục đích tổng quan

Đây là bài **smoke test cho pipeline**, không phải test tính năng nghiệp vụ. Mục tiêu duy nhất: chứng minh chuỗi mắt xích kỹ thuật chạy được từ đầu đến cuối:

1. Appium attach được vào thiết bị/emulator.
2. App P8D được khởi động.
3. WebdriverIO chuyển được từ context `NATIVE_APP` sang context `WEBVIEW_*`.
4. Đọc được DOM (`body`) bên trong WebView.

Điểm đặc biệt (nêu ở docblock dòng 1–10): spec này **KHÔNG giả định** app chạy tới màn `/login`. App hiện có thể hiển thị màn "Please contact support for assistance" trên một số thiết bị, nên spec **ghi lại trạng thái đó như một chẩn đoán** (log + screenshot) thay vì fail mù quáng chỉ vì một giả định không được đáp ứng.

---

## 2. Các import / phụ thuộc (dòng 11–13)

```ts
11 import { expect } from "@wdio/globals"
12 import { androidAppShellPage } from "@pages"
13 import { logger } from "../../utils/logger.js"
```

| Dòng | Ý nghĩa |
|------|---------|
| 11 | `expect` từ `@wdio/globals` — API assertion của WebdriverIO (dạng Jest-like). |
| 12 | `androidAppShellPage` — page object điều khiển "vỏ" app Android (chuyển WebView, đọc body, chụp màn hình). Xem [pages/android/app-shell.page.ts](../../../../src/pages/android/app-shell.page.ts). |
| 13 | `logger` — logger dùng chung (winston) in log console + file. Đường dẫn `.js` do project chạy ESM/NodeNext. |

> Đáng chú ý: file này **không** import `SELECTORS`, `ROUTES` hay `TIMEOUTS` — vì nó chỉ đọc `body`, không thao tác selector cụ thể hay điều hướng route.

---

## 3. Điều kiện chạy suite (skip logic)

**KHÔNG có skip logic.** Dòng 15 khai báo suite bằng `describe(...)` thường:

```ts
15 describe("Android app launch @smoke", () => {
```

Nghĩa là suite **luôn chạy** mỗi khi runner nạp file này (miễn spec nằm trong glob của config Android). Tag `@smoke` chỉ là nhãn để lọc/nhóm test, không ảnh hưởng việc chạy hay skip.

> Khác với các spec `staff-token-login`, `app-home`, `login-once` (có `describe.skip` hoặc gate theo ENV), spec này cố tình luôn chạy vì nó là "tín hiệu pipeline" cơ bản nhất.

---

## 4. Giải thích từng khối (before/it/after)

Suite chỉ có **một** test case `it`, không có `before`/`after`.

### 4.1. Chuyển vào WebView (dòng 16–17)

```ts
16   it("attaches to the app and reaches a webview context", async () => {
17     await androidAppShellPage.switchToWebview()
```

- **Dòng 16** — Khai báo test case async.
- **Dòng 17** — Gọi `switchToWebview()` (mặc định timeout `TIMEOUTS.LONG` = 30s, xem app-shell.page.ts). Hàm này **poll lặp** `getContexts()`, tìm context bắt đầu bằng `WEBVIEW`, rồi `switchContext`. Nếu sau timeout không thấy WebView → **ném lỗi** ⇒ test fail. Đây là mắt xích quan trọng nhất của smoke test.

### 4.2. Đọc DOM + chụp màn hình + log (dòng 19–21)

```ts
19     const bodyText = await androidAppShellPage.getBodyText()
20     await androidAppShellPage.screenshot("launch")
21     logger.info(`[android-launch] body text snapshot: ${bodyText.slice(0, 500)}`)
```

- **Dòng 19** — `getBodyText()` = `$("body").getText()` — lấy toàn bộ text của màn hình đang hiển thị trong WebView. Chứng minh DOM đọc được.
- **Dòng 20** — Chụp screenshot chẩn đoán, nhãn `"launch"` → lưu vào `reports/screenshots/android-launch-<timestamp>.png`. Đây là hàm **best-effort**: nếu chụp lỗi thì chỉ log warning, không ném (xem app-shell.page.ts dòng 59–70).
- **Dòng 21** — Log 500 ký tự đầu của body để soi nhanh app đang hiển thị gì.

### 4.3. Phát hiện màn hình "contact support" (dòng 23–28)

```ts
23     if (/contact support/i.test(bodyText)) {
24       logger.error(
25         "[android-launch] app rendered a support/error screen instead of the login flow — " +
26           "pipeline works, but the app itself is blocked. See screenshot in reports/screenshots."
27       )
28     }
```

- **Dòng 23** — Regex `/contact support/i` (không phân biệt hoa/thường) kiểm tra body có phải màn hình lỗi/support không.
- **Dòng 24–27** — Nếu đúng → **log LỖI** (mức `error`) nhưng **KHÔNG** ném exception. Thông điệp phân biệt rõ: "pipeline chạy được, nhưng bản thân app đang bị chặn". Đây là triết lý "chẩn đoán thay vì fail mù": vấn đề nằm ở app, không phải ở pipeline test.

### 4.4. Assertion duy nhất — chỉ kiểm tra pipeline (dòng 30–31)

```ts
30     // Pipeline assertion only: we reached a webview and could read the DOM.
31     expect(bodyText.length).toBeGreaterThan(0)
```

- **Dòng 31** — Assertion **duy nhất**: body có độ dài > 0, tức là đã vào được WebView và đọc được DOM. Cố tình **không** kiểm tra nội dung màn hình cụ thể (login, home...) để test không fail vì trạng thái app — chỉ fail khi pipeline thật sự hỏng.

---

## 5. Sơ đồ luồng test

```
describe "Android app launch @smoke"  (luôn chạy)
        │
        ▼
it "attaches to the app and reaches a webview context"
        │
[17] switchToWebview() ── thất bại ──► ném lỗi ⇒ TEST FAIL (pipeline hỏng)
        │ thành công
        ▼
[19] getBodyText() ──► [20] screenshot("launch") ──► [21] log 500 ký tự đầu
        │
        ▼
[23] body chứa "contact support"?
        │ có → [24-27] log ERROR (không fail — app bị chặn, pipeline vẫn OK)
        ▼
[31] expect(bodyText.length > 0)  ✅ pass nếu đọc được DOM
```

---

## 6. Ghi chú & điểm dễ nhầm

- **Không phải test nghiệp vụ**: spec này chỉ chứng minh "đường ống" chạy được, không kiểm tra login hay màn hình cụ thể. Đừng thêm assertion về nội dung màn hình vào đây.
- **`switchToWebview()` không tham số** ⇒ dùng timeout mặc định 30s (`TIMEOUTS.LONG`). Nếu WebView không xuất hiện trong 30s, chính test này sẽ fail — đó là ý đồ (báo pipeline hỏng).
- **Log ERROR không làm fail test**: dòng 24 dùng `logger.error` chỉ để nhấn mạnh trong log, Mocha không coi đó là lỗi. Test chỉ fail nếu `expect` sai hoặc có exception ném ra.
- **Trên thiết bị vật lý MDM-locked**, WebView có thể không answer CDP ⇒ `switchToWebview()` treo/timeout ⇒ spec này fail. Trên các spec khác vấn đề này được né bằng gate `ANDROID_WEBVIEW_READY`; spec smoke này cố ý không gate để phơi bày sự cố pipeline.
