# Giải thích code: `src/specs/android/open-and-hold.e2e.ts`

> **File nguồn:** [src/specs/android/open-and-hold.e2e.ts](../../../../src/specs/android/open-and-hold.e2e.ts)
> **Loại:** Spec (Mocha E2E, Android) — demo điều khiển thủ công
> **Chạy khi nào:** **LUÔN chạy** — `describe` thường, KHÔNG skip logic. Thường được gọi riêng qua `npm run android:open`.
> **Một câu:** Mở/attach app P8D qua pipeline Appium thật, chứng minh session đang thực sự điều khiển thiết bị, rồi **giữ session mở** một khoảng thời gian để người xem tận mắt xác nhận app đang mở dưới quyền kiểm soát của test.

---

## 1. Mục đích tổng quan

Đây là spec **demo điều khiển thủ công (manual control demo)**, không phải test tự động thông thường. Theo docblock (dòng 1–18):

- **Chứng minh quyền kiểm soát**: session Appium đang thật sự lái thiết bị — in ra package/activity đang foreground, danh sách context, và chụp screenshot.
- **Giữ app mở**: `browser.pause()` giữ session sống một khoảng (mặc định 20s) để người ngồi trước thiết bị vật lý nhìn thấy app đang mở.
- **KHÔNG assertion, KHÔNG fail vì trạng thái app**: khác `app-launch.e2e.ts`, spec này không giả định màn hình nào render và không có `expect`. Nó chỉ demo quyền kiểm soát rồi để app mở.

Cách chạy (docblock dòng 14–18):
- Chạy riêng: `npm run android:open`
- Tùy chỉnh thời gian giữ mở: `HOLD_MS=60000 npm run android:open`

---

## 2. Các import / phụ thuộc (dòng 19–22)

```ts
19 import { androidAppShellPage } from "@pages"
20 import { logger } from "../../utils/logger.js"
21
22 const HOLD_MS = Number(process.env.HOLD_MS ?? 20_000)
```

| Dòng | Ý nghĩa |
|------|---------|
| 19 | `androidAppShellPage` — page object vỏ Android (switchToWebview, getBodyText, screenshot). Xem [pages/android/app-shell.page.ts](../../../../src/pages/android/app-shell.page.ts). |
| 20 | `logger` — logger dùng chung. |
| 22 | **`HOLD_MS`**: thời gian giữ session (ms). Đọc từ biến môi trường `HOLD_MS`; nếu không set → mặc định `20_000` (20 giây). `Number(...)` ép kiểu chuỗi ENV về số. |

> Spec này **không** dùng `expect` — không import `@wdio/globals`. Nó cũng không import SELECTORS/ROUTES/TIMEOUTS vì không thao tác form hay điều hướng route.

---

## 3. Điều kiện chạy suite (skip logic)

**KHÔNG có skip logic.** Dòng 24 dùng `describe` thường:

```ts
24 describe("Android open app (manual control demo)", () => {
```

Suite luôn chạy khi runner nạp file. Tuy nhiên trong thực tế nó được **gọi riêng lẻ** qua script `npm run android:open` (giới hạn `--spec` chỉ file này), vì mục đích là demo/giữ app mở chứ không phải chạy trong bộ regression tự động.

---

## 4. Giải thích từng khối (before/it/after)

Suite có **một** `it`, không `before`/`after`. Test chia làm 4 bước, ba bước đầu đều bọc `try/catch` để **không bao giờ fail vì lỗi phụ**.

### 4.1. Bước 1 — App nào đang foreground? (dòng 26–34)

```ts
26     // 1. Which app is actually in the foreground right now? ...
28     try {
29       const pkg = await browser.execute("mobile: getCurrentPackage")
30       const act = await browser.execute("mobile: getCurrentActivity")
31       logger.info(`[open-hold] foreground package=${pkg} activity=${act}`)
32     } catch (err) {
33       logger.warn(`[open-hold] could not read current package/activity: ${(err as Error).message}`)
34     }
```

- **Dòng 29–30** — Lệnh Appium `mobile: getCurrentPackage` / `getCurrentActivity` đọc package & activity đang chạy ở tiền cảnh. **Chứng minh** session gắn đúng vào app P8D chứ không phải launcher hay app khác.
- **Dòng 32–33** — Nếu đọc lỗi → chỉ log **warning**, không ném. Bước chẩn đoán này không được phép làm hỏng demo.

### 4.2. Bước 2 — Screenshot native (dòng 36–43)

```ts
36     // 2. Native screenshot — works even if the webview isn't ready yet.
37     try {
38       const file = `./reports/screenshots/android-open-native-${Date.now()}.png`
39       await browser.saveScreenshot(file)
40       logger.info(`[open-hold] native screenshot → ${file}`)
41     } catch (err) {
42       logger.warn(`[open-hold] native screenshot failed: ${(err as Error).message}`)
43     }
```

- **Dòng 38–39** — Chụp screenshot ở tầng **native** (`browser.saveScreenshot`), tên file gắn timestamp `Date.now()`. Chụp native hoạt động **kể cả khi WebView chưa sẵn sàng** — đó là lý do bước này đứng trước bước WebView.
- **Dòng 41–42** — Lỗi chụp → log warning, không fail.

### 4.3. Bước 3 — Best-effort vào WebView đọc DOM (dòng 45–55)

```ts
45     // 3. Best-effort: switch into the app's webview and read the DOM. ...
48     try {
49       await androidAppShellPage.switchToWebview(30_000)
50       const body = await androidAppShellPage.getBodyText()
51       logger.info(`[open-hold] webview DOM body (first 300): ${body.slice(0, 300)}`)
52       await androidAppShellPage.screenshot("open-webview")
53     } catch (err) {
54       logger.warn(`[open-hold] webview step skipped (app still controlled natively): ${(err as Error).message}`)
55     }
```

- **Dòng 49** — `switchToWebview(30_000)` — thử vào WebView với timeout **30 giây** (truyền tường minh, dù giá trị này trùng `TIMEOUTS.LONG`). Đây là **bằng chứng mạnh nhất** về quyền kiểm soát (lái được cả DOM).
- **Dòng 50–52** — Nếu vào được: đọc 300 ký tự đầu của body, log, và chụp screenshot WebView nhãn `"open-webview"`.
- **Dòng 53–54** — **Điểm mấu chốt của thiết kế**: nếu WebView bị chặn/chậm (ví dụ thiết bị MDM-locked), toàn bộ bước 3 bị bọc `try/catch` ⇒ chỉ log warning "app vẫn được điều khiển ở tầng native", demo **không fail**. Đây là lý do vì sao demo an toàn chạy trên cả thiết bị không lái được WebView.

### 4.4. Bước 4 — Giữ session mở (dòng 57–60)

```ts
57     // 4. Hold the session open so the app stays on-screen for manual inspection.
58     logger.info(`[open-hold] holding session open for ${HOLD_MS}ms — app is on-screen and under control`)
59     await browser.pause(HOLD_MS)
60     logger.info("[open-hold] hold window elapsed — session ending, app left running")
```

- **Dòng 59** — `browser.pause(HOLD_MS)` — chặn test đúng `HOLD_MS` mili-giây (mặc định 20s). Trong khoảng này app vẫn mở trên màn hình để người xem quan sát. **Đây là lý do tồn tại của spec** — không phải "chờ vô nghĩa" mà là cửa sổ quan sát thủ công.
- **Dòng 60** — Hết giờ giữ → log kết thúc; app vẫn được để chạy (session đóng nhưng app không bị tắt).

---

## 5. Sơ đồ luồng test

```
describe "Android open app (manual control demo)"  (luôn chạy, thường gọi riêng)
        │
        ▼
it "launches the app and holds the session open"
        │
[28-34] Bước 1: getCurrentPackage/Activity  (try/catch → warn nếu lỗi)
        │
[37-43] Bước 2: screenshot native            (try/catch → warn nếu lỗi)
        │
[48-55] Bước 3: switchToWebview(30s) + đọc DOM + screenshot  (try/catch → warn nếu lỗi)
        │       ↳ nếu WebView bị chặn: bỏ qua, demo KHÔNG fail
        ▼
[59] Bước 4: browser.pause(HOLD_MS)  ← cửa sổ quan sát thủ công (mặc định 20s)
        │
        ▼
[60] Kết thúc — không assertion, không fail vì trạng thái app
```

---

## 6. Ghi chú & điểm dễ nhầm

- **Không có `expect`**: spec này KHÔNG kiểm tra gì cả — nó là công cụ demo/quan sát. Đừng nhầm với test tự động.
- **Ba bước đầu đều `try/catch` non-fatal**: mọi lỗi (đọc package, chụp, vào WebView) chỉ ra warning. Chỉ có bước 4 (`pause`) là "bắt buộc chạy tới".
- **`HOLD_MS` là ENV**: muốn giữ app mở lâu hơn, đặt `HOLD_MS=60000` (60s) trước lệnh chạy. Giá trị mặc định 20_000 nằm ngay ở dòng 22.
- **Khác biệt với `app-launch.e2e.ts`**: `app-launch` có 1 assertion pipeline và có thể fail; `open-and-hold` không assertion, không bao giờ fail vì app-state — chỉ chứng minh quyền kiểm soát và để app mở.
- **`switchToWebview(30_000)` truyền số cứng** thay vì `TIMEOUTS.LONG`; giá trị bằng nhau nhưng ở đây viết literal.
