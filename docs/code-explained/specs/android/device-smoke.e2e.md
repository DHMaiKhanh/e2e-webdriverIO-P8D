# Giải thích code: `src/specs/android/device-smoke.e2e.ts`

> **File nguồn:** [src/specs/android/device-smoke.e2e.ts](../../../../src/specs/android/device-smoke.e2e.ts)
> **Loại:** Spec (Mocha E2E, Android) — smoke test tầng native
> **Chạy khi nào:** **LUÔN chạy** — `describe` thường, KHÔNG skip logic.
> **Một câu:** Xác nhận app P8D **khởi động và nằm dưới quyền kiểm soát** của test trên thiết bị P8D vật lý, **mà KHÔNG chạm vào DOM của WebView** — chỉ dùng session native uiautomator2 nên luôn "xanh".

---

## 1. Mục đích tổng quan

Spec này cố tình dừng ở **tầng đáng tin cậy nhất** — session native uiautomator2 — và **không** đụng tới DOM WebView. Lý do (docblock dòng 5–11):

- Trên thiết bị P8D vật lý, renderer Chrome DevTools của Tauri WebView **không trả lời lệnh CDP**, nên `switchContext(WEBVIEW_*)` **treo** và mọi automation DOM/selector bất khả thi (chính vì thế `staff-token-login.e2e.ts` bị gate).
- Bằng cách chỉ kiểm tra ở tầng native, spec này **chạy xanh hôm nay** và cho CI một tín hiệu thật: "app khởi động được trên thiết bị".

Ba việc nó kiểm tra: (1) app ở foreground đúng activity, (2) tiến trình Tauri WebView đã boot (có context `WEBVIEW_*` trong danh sách, dù không lái được), (3) chụp được screenshot native làm artifact.

---

## 2. Các import / phụ thuộc (dòng 17–20)

```ts
17 import { expect } from "@wdio/globals"
18 import { logger } from "../../utils/logger.js"
19
20 const APP_ID = "com.fastboy.volt_pos"
```

| Dòng | Ý nghĩa |
|------|---------|
| 17 | `expect` — API assertion WebdriverIO. |
| 18 | `logger` — logger dùng chung. |
| 20 | **`APP_ID`** — hằng số package Android của app P8D (`com.fastboy.volt_pos`), dùng cho `mobile: activateApp`. |

> Không import page object hay SELECTORS/ROUTES — vì spec chỉ dùng lệnh native (`mobile: *`, `getContexts`, `saveScreenshot`), không thao tác DOM.

---

## 3. Điều kiện chạy suite (skip logic)

**KHÔNG có skip logic.** Dòng 22 là `describe` thường:

```ts
22 describe("P8D Android device smoke @smoke", () => {
```

Suite luôn chạy. Đây là chủ ý thiết kế: vì spec chỉ chạm tầng native (luôn hoạt động kể cả trên thiết bị MDM-locked), nó **không cần** gate `ANDROID_WEBVIEW_READY` như các spec WebView. Nhờ vậy CI luôn có một tín hiệu smoke đáng tin.

---

## 4. Giải thích từng khối (before/it/after)

Suite có **ba** `it`, không `before`/`after`.

### 4.1. Test 1 — App ở foreground đúng activity (dòng 23–34)

```ts
23   it("has the app in the foreground on the correct activity", async () => {
24     // A fresh session already launched the app (appPackage/appActivity caps),
25     // but make foregrounding explicit so the check is order-independent.
26     await browser.execute("mobile: activateApp", { appId: APP_ID })
27
28     const pkg = String(await browser.execute("mobile: getCurrentPackage"))
29     const activity = String(await browser.execute("mobile: getCurrentActivity"))
30     logger.info(`[smoke] foreground package=${pkg} activity=${activity}`)
31
32     expect(pkg).toContain("volt_pos")
33     expect(activity).toContain("MainActivity")
34   })
```

- **Dòng 26** — Chủ động đưa app lên foreground bằng `mobile: activateApp`. Comment (24–25) giải thích: session mới đã tự mở app qua capabilities, nhưng gọi tường minh để test **không phụ thuộc thứ tự** chạy (order-independent).
- **Dòng 28–29** — Đọc package & activity hiện tại, `String(...)` ép kiểu chắc chắn về chuỗi.
- **Dòng 32–33** — **Hai assertion**: package chứa `"volt_pos"` và activity chứa `"MainActivity"`. Chứng minh đúng app P8D đang ở tiền cảnh, đúng activity chính.

### 4.2. Test 2 — Tiến trình WebView đã boot (dòng 36–46)

```ts
36   it("has booted its Tauri webview process", async () => {
37     // getContexts enumerating a WEBVIEW_* context proves the embedded Chromium
38     // WebView actually started (its devtools socket is up), even though we
39     // can't drive its DOM. ...
41     const contexts = (await browser.getContexts()) as string[]
42     logger.info(`[smoke] contexts=${JSON.stringify(contexts)}`)
43
44     expect(contexts).toContain("NATIVE_APP")
45     expect(contexts.some((c) => String(c).startsWith("WEBVIEW"))).toBe(true)
46   })
```

- **Dòng 41** — `getContexts()` liệt kê các context khả dụng. Ép kiểu `string[]`.
- **Dòng 44** — Assertion: có context `NATIVE_APP` (luôn tồn tại).
- **Dòng 45** — Assertion: **tồn tại ít nhất một** context bắt đầu bằng `"WEBVIEW"`. Comment (37–40) giải thích tinh tế: chỉ cần WebView **xuất hiện trong danh sách** là đã chứng minh Chromium WebView nhúng đã khởi động (devtools socket đã lên) — **dù không lái được DOM**. Đây là tín hiệu kiểm soát mạnh nhất có thể lấy khi không có CDP renderer hoạt động.

> Điểm khác biệt cốt lõi so với các spec WebView: ở đây chỉ **liệt kê** context (không treo), KHÔNG gọi `switchContext` (sẽ treo trên thiết bị vật lý).

### 4.3. Test 3 — Chụp screenshot native làm artifact (dòng 48–52)

```ts
48   it("captures a native screenshot artifact", async () => {
49     const file = `./reports/screenshots/smoke-${Date.now()}.png`
50     await browser.saveScreenshot(file)
51     logger.info(`[smoke] screenshot → ${file}`)
52   })
```

- **Dòng 49–50** — Chụp screenshot native (không phụ thuộc WebView), lưu vào `reports/screenshots/smoke-<timestamp>.png`.
- Không có `expect`: test này chỉ tạo **artifact** để soi bằng mắt. Nếu `saveScreenshot` ném lỗi, Mocha coi test fail; ngược lại pass.

---

## 5. Sơ đồ luồng test

```
describe "P8D Android device smoke @smoke"  (luôn chạy — không gate)
        │
        ├─ it 1: [26] activateApp → [28-29] đọc pkg/activity
        │        [32] expect pkg chứa "volt_pos"
        │        [33] expect activity chứa "MainActivity"
        │
        ├─ it 2: [41] getContexts()  (chỉ liệt kê, KHÔNG switchContext)
        │        [44] expect có "NATIVE_APP"
        │        [45] expect có context bắt đầu "WEBVIEW"
        │
        └─ it 3: [50] saveScreenshot → reports/screenshots/smoke-<ts>.png
```

---

## 6. Ghi chú & điểm dễ nhầm

- **Chủ đích tránh DOM**: đây là điểm thiết kế quan trọng nhất. Trên thiết bị P8D vật lý, `switchContext(WEBVIEW_*)` **treo** vì renderer không answer CDP. Spec cố tình chỉ **liệt kê** context (dòng 41) chứ không chuyển vào — nên luôn chạy được.
- **`getContexts` an toàn, `switchContext` nguy hiểm**: bài học ở đây là chỉ cần "thấy" WebView trong danh sách là đủ chứng minh nó boot; đừng thử "vào" nó trên thiết bị vật lý.
- **Không gate ENV**: khác với `app-home`, `staff-token-login`... spec này không cần `ANDROID_WEBVIEW_READY` vì hoàn toàn ở tầng native ⇒ dùng làm smoke tin cậy cho CI.
- **`activateApp` gọi tường minh** dù capabilities đã mở app — để test không phụ thuộc thứ tự chạy trong suite.
- Xem thêm `staff-token-login.e2e.ts` để hiểu tại sao automation DOM bị chặn trên thiết bị này (chính lý do nêu ở docblock dòng 5–8).
