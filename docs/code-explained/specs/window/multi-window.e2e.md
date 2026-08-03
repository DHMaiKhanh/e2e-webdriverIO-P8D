# Giải thích code: `src/specs/window/multi-window.e2e.ts`

> **File nguồn:** [src/specs/window/multi-window.e2e.ts](../../../../src/specs/window/multi-window.e2e.ts)
> **Loại:** Spec (Mocha E2E test)
> **Một câu:** Kiểm chứng "hợp đồng hai cửa sổ" (dual-window) mà mọi spec liên quan tới checkout đều dựa vào — app Tauri của P8D **luôn** có cửa sổ "main" (nhân viên) và cửa sổ "customer" (khách hàng), và bộ test có thể chuyển qua lại giữa chúng một cách tin cậy.

---

## 1. Mục đích tổng quan

App P8D chạy trên Tauri với **hai WebView (hai cửa sổ)**:

- **`main`** — màn hình POS cho nhân viên (staff-facing).
- **`customer`** — màn hình hiển thị cho khách hàng, thường ở màn hình thứ hai (customer-facing display).

Spec này (đánh dấu `@smoke`) xác nhận 3 điều tối thiểu mà các spec checkout khác giả định là đúng:

1. Session WebDriver **nhìn thấy được cả hai** cửa sổ (ít nhất 2 window handle).
2. Có thể **chuyển sang cửa sổ `main`** và đọc đúng label của nó.
3. Có thể **tạm nhảy sang cửa sổ `customer`** rồi **tự động quay lại** cửa sổ đang active trước đó mà không mất context.

Toàn bộ logic chuyển cửa sổ nằm trong helper [src/utils/tauri-helper.ts](../../../../src/utils/tauri-helper.ts); spec này chỉ là lớp kiểm chứng mỏng gọi các helper đó.

---

## 2. Các import / phụ thuộc (dòng 6–8)

```ts
6  import { expect } from "@wdio/globals"
7  import { ROUTES } from "@constants/routes.js"
8  import { getCurrentWindowLabel, switchToWindow, WINDOW_LABELS, withWindow } from "@utils/tauri-helper.js"
```

| Dòng | Ý nghĩa |
|------|---------|
| 6 | `expect` lấy từ `@wdio/globals` — API assertion của WebdriverIO (tích hợp `expect-webdriverio`). Import tường minh để TypeScript hiểu kiểu. |
| 7 | `ROUTES` — registry hằng số route tập trung. Ở đây dùng `ROUTES.CUSTOMER` = `"/customer/"` (màn hình khách hàng). Xem [src/constants/routes.ts](../../../../src/constants/routes.ts). |
| 8 | 4 thứ từ **tauri-helper**: `getCurrentWindowLabel` (đọc label cửa sổ đang gắn), `switchToWindow` (chuyển sang cửa sổ theo label), `WINDOW_LABELS` (hằng số `{ MAIN: "main", CUSTOMER: "customer" }`), `withWindow` (chạy 1 hàm trong 1 cửa sổ rồi tự quay lại). |

> 💡 Các alias `@wdio/globals`, `@constants/*`, `@utils/*` được cấu hình trong `tsconfig`/`wdio.conf`. Đuôi `.js` (dù nguồn là `.ts`) là do project chạy chuẩn **ESM/NodeNext**: import phải trỏ tới file `.js` output sau biên dịch.

### Nhắc lại các helper được dùng (từ tauri-helper.ts)

- **`WINDOW_LABELS`** (dòng 23–26 của tauri-helper): `{ MAIN: "main", CUSTOMER: "customer" }`. Đây là các label khai báo trong `src-tauri/tauri.conf.json`.
- **`getCurrentWindowLabel()`** (dòng 77–88): chạy JS trong WebView để đọc `window.__TAURI__.window.getCurrentWindow().label`. Trả `undefined` nếu không ở trong Tauri hoặc window chưa sẵn sàng.
- **`switchToWindow(label)`** (dòng 99–116): vì tauri-driver expose mỗi webview thành 1 window handle **không có label riêng**, nên cách duy nhất tin cậy để tìm "customer" vs "main" là lần lượt switch sang từng handle rồi hỏi trang "bạn là cửa sổ nào". Retry qua `waitUntil` vì cửa sổ customer có thể vẫn đang khởi tạo khi main đã sẵn sàng.
- **`withWindow(label, fn)`** (dòng 125–133): lưu handle hiện tại → `switchToWindow(label)` → chạy `fn()` → trong khối `finally` **luôn** switch về handle ban đầu. Nhờ vậy spec có thể "ghé thăm" cửa sổ khác để assert rồi tiếp tục thao tác mà không phải tự quản lý việc quay lại.

---

## 3. Giải thích từng khối code

### 3.1. Khối `describe` (dòng 10)

```ts
10 describe("Dual window @smoke", () => {
```

- Khai báo **test suite** Mocha tên `"Dual window @smoke"`. Hậu tố `@smoke` là **tag** dùng để lọc chạy nhóm smoke test (ví dụ `--mochaOpts.grep @smoke`).
- **Không có `before`/`after`/`beforeEach`/`afterEach`** trong suite này — mỗi `it` tự đứng độc lập. Đáng chú ý: session không tự động về một cửa sổ cố định giữa các test, nên test 2 và test 3 đều **chủ động** `switchToWindow(MAIN)` trước khi làm gì.

### 3.2. Test 1 — Có mặt cả hai cửa sổ (dòng 11–14)

```ts
11   it("exposes both the main and customer windows", async () => {
12     const handles = await browser.getWindowHandles()
13     expect(handles.length).toBeGreaterThanOrEqual(2)
14   })
```

- **Dòng 12** — `browser.getWindowHandles()` trả về **mảng handle** của tất cả cửa sổ/webview mà WebDriver đang thấy.
- **Dòng 13** — Khẳng định có **ít nhất 2** handle. Đây là kiểm tra nền tảng nhất: nếu app chỉ mở 1 cửa sổ thì toàn bộ luồng checkout hai màn hình sẽ hỏng.
- Lưu ý dùng `toBeGreaterThanOrEqual(2)` (>= 2) thay vì `toBe(2)`: linh hoạt phòng khi runtime tạo thêm webview phụ, miễn là có tối thiểu 2 cửa sổ cần thiết.

**Điều kiện chạy/skip:** không có logic skip — test này luôn chạy.

### 3.3. Test 2 — Chuyển sang `main` và đọc label (dòng 16–19)

```ts
16   it("can switch to the main window and read its label", async () => {
17     await switchToWindow(WINDOW_LABELS.MAIN)
18     await expect(await getCurrentWindowLabel()).toBe(WINDOW_LABELS.MAIN)
19   })
```

- **Dòng 17** — `switchToWindow("main")`: gắn session WebDriver vào cửa sổ có label `main`. Bên trong, helper lặp qua các handle, switch vào từng cái và hỏi label cho tới khi khớp `"main"` (retry qua `waitUntil`, timeout mặc định `TIMEOUTS.MEDIUM` = 15s).
- **Dòng 18** — Đọc lại label cửa sổ hiện tại và khẳng định nó đúng bằng `"main"`. Đây là kiểm chứng vòng-tròn (round-trip): "yêu cầu chuyển sang main" → "cửa sổ hiện tại đúng là main".
- Chú ý `await expect(await getCurrentWindowLabel())`: `getCurrentWindowLabel()` trả `Promise<string | undefined>`, nên phải `await` bên trong trước khi đưa vào `expect`.

**Điều kiện chạy/skip:** không có logic skip.

### 3.4. Test 3 — Nhảy sang `customer` rồi tự quay lại (dòng 21–32)

```ts
21   it("can switch to the customer window and back without losing context", async () => {
22     await switchToWindow(WINDOW_LABELS.MAIN)
23
24     const customerLabel = await withWindow(WINDOW_LABELS.CUSTOMER, async () => {
25       await browser.url(ROUTES.CUSTOMER)
26       return getCurrentWindowLabel()
27     })
28
29     expect(customerLabel).toBe(WINDOW_LABELS.CUSTOMER)
30     // withWindow restores the previously active window automatically.
31     await expect(await getCurrentWindowLabel()).toBe(WINDOW_LABELS.MAIN)
32   })
```

Đây là test quan trọng nhất — chứng minh cơ chế "ghé thăm cửa sổ khác rồi quay về" hoạt động.

- **Dòng 22** — Trước tiên **cố định điểm xuất phát**: chuyển về `main`. Bước này đảm bảo "cửa sổ active ban đầu" mà `withWindow` sẽ khôi phục chính là `main` (không phụ thuộc test trước đó để lại session ở cửa sổ nào).
- **Dòng 24–27** — Gọi `withWindow("customer", fn)`:
  - Bên trong, helper lưu handle hiện tại (`main`), rồi `switchToWindow("customer")`.
  - **Dòng 25** — Trong ngữ cảnh cửa sổ customer, điều hướng WebView tới `ROUTES.CUSTOMER` = `"/customer/"` (route của màn hình khách hàng).
  - **Dòng 26** — Trả về `getCurrentWindowLabel()` — tức label của cửa sổ **trong lúc** `fn` chạy. Giá trị này được `withWindow` trả ra ngoài và gán vào `customerLabel`.
  - Sau khi `fn` xong, `withWindow` (trong `finally`) **tự động switch về** handle `main` ban đầu.
- **Dòng 29** — Khẳng định label thu được trong `fn` đúng là `"customer"` → xác nhận đã thực sự vào cửa sổ customer khi chạy `fn`.
- **Dòng 31** — Khẳng định **sau khi** `withWindow` kết thúc, cửa sổ hiện tại đã **quay lại `main`** → xác nhận cơ chế khôi phục tự động hoạt động, "không mất context" như tên test mô tả.

**Điều kiện chạy/skip:** không có logic skip.

---

## 4. Cách dùng / quan hệ với file khác

- **Phụ thuộc trực tiếp** vào [src/utils/tauri-helper.ts](../../../../src/utils/tauri-helper.ts) — nơi chứa toàn bộ logic switch/khôi phục cửa sổ. Spec này chỉ kiểm chứng hành vi của helper đó.
- **`ROUTES.CUSTOMER`** đến từ [src/constants/routes.ts](../../../../src/constants/routes.ts) (dòng 14: `CUSTOMER: "/customer/"`).
- **Vai trò "hợp đồng nền tảng":** như comment đầu file (dòng 1–5) nêu, các spec checkout khác **giả định** dual-window hoạt động. Nếu spec này fail, đó là tín hiệu sớm rằng môi trường Tauri không tạo đủ cửa sổ hoặc tauri-driver không expose đúng handle — giúp chẩn đoán trước khi các test phức tạp hơn fail một cách khó hiểu.
- Đây là spec **chỉ chạy được trong môi trường Tauri desktop** (không phải Android/web thuần), vì nó dựa vào nhiều cửa sổ WebDriver và `window.__TAURI__`.

---

## 5. Ghi chú & điểm dễ nhầm

- **Vì sao mỗi test đều tự `switchToWindow(MAIN)`?** Vì không có hook `beforeEach` đặt lại cửa sổ. Session WebDriver "dính" ở cửa sổ nào là do test trước để lại; các test 2 và 3 chủ động reset điểm xuất phát để độc lập với thứ tự chạy.
- **`toBeGreaterThanOrEqual(2)` thay vì `toBe(2)`** (dòng 13): cố ý nới lỏng — chỉ cần tối thiểu 2 cửa sổ, không khoá cứng đúng 2, tránh flake nếu có webview phụ.
- **`withWindow` luôn khôi phục cửa sổ** kể cả khi `fn` ném lỗi, vì switch-back nằm trong `finally` (tauri-helper dòng 130–132). Test 3 dựa vào tính chất này.
- **`getCurrentWindowLabel()` có thể trả `undefined`** ngoài Tauri hoặc khi window chưa load xong; nhưng trong suite này ta luôn assert bằng `.toBe("main"|"customer")`, nên nếu môi trường sai (undefined) test sẽ fail rõ ràng chứ không lặng lẽ pass.
- **`@smoke` là tag, không phải cú pháp đặc biệt của Mocha** — nó chỉ là chuỗi trong tên suite, dùng cho việc grep/lọc khi chạy.
