# Giải thích code: `src/hooks/custom-commands.ts`

> **File nguồn:** [src/hooks/custom-commands.ts](../../../src/hooks/custom-commands.ts)
> **Loại:** Hook (đăng ký lệnh tùy biến cho WebdriverIO)
> **Một câu:** Export một hàm `registerCustomCommands()` — gọi một lần mỗi session (trong hook `before` của config) để gắn các lệnh tùy biến lên `browser` và `element`, giúp spec/page viết ngắn gọn hơn.

---

## 1. Mục đích tổng quan

WebdriverIO cho phép **mở rộng** đối tượng `browser`/`element` bằng `addCommand(...)`. File này gom các lệnh tùy biến dùng chung vào một chỗ và đăng ký chúng qua hàm `registerCustomCommands()`.

Comment đầu file (dòng 4–14) nêu **nguyên tắc khi nào nên tạo custom command** thay vì helper rời:

- Khi lệnh **đọc tự nhiên** dưới dạng `browser.X()` hoặc `el.X()`.
- Khi lệnh được **>= 3 page object** dùng.
- Thứ gì đặc thù hơn thì để trong `src/utils/`.
- **Bắt buộc:** khai báo chữ ký của command mới trong [src/types/wdio.d.ts](../../../src/types/wdio.d.ts) để được type-check.

Hàm này được đăng ký **một lần mỗi session** thông qua hook `before` trong config chung của WebdriverIO. Sau khi chạy, mọi spec/page trong session đều gọi được 3 command bên dưới.

---

## 2. Các import / phụ thuộc (dòng 1–2)

```ts
1  import { TIMEOUTS } from "../constants/timeouts.js"
2  import { logger } from "../utils/logger.js"
```

| Dòng | Ý nghĩa |
|------|---------|
| 1 | `TIMEOUTS` — hằng số timeout đặt tên. Ở đây dùng `TIMEOUTS.MEDIUM` = **15.000ms** làm timeout mặc định cho `waitAndClick`. Xem [src/constants/timeouts.ts](../../../src/constants/timeouts.ts). |
| 2 | `logger` — logger dùng chung, dùng để in log điều hướng, cảnh báo soft-assert và debug. Xem [src/utils/logger.ts](../../../src/utils/logger.ts). |

> 💡 Đuôi `.js` trong import (dù nguồn là `.ts`) là do chuẩn **ESM/NodeNext**: đường dẫn phải trỏ tới file output `.js`.

---

## 3. Giải thích từng khối code

### 3.1. Docblock hướng dẫn (dòng 4–14)

```ts
4  /**
5   * Custom WebdriverIO commands.
6   *
7   * Registered once per session via `before` in the shared config. Adding a
8   * command here is preferable to a free-standing helper when:
9   *   - It reads naturally as `browser.X()` or `el.X()`
10  *   - It's used by 3+ page objects
11  *
12  * Anything more specific lives in src/utils/. Declare new command signatures
13  * in src/types/wdio.d.ts so they are type-checked.
14  */
```

Đây là "kim chỉ nam" cho việc bảo trì: khi nào thêm command ở đây, và nhắc **luôn phải** khai báo type ở `wdio.d.ts` (nếu không, gọi command sẽ bị TS báo lỗi).

### 3.2. Khai báo hàm đăng ký (dòng 15)

```ts
15 export const registerCustomCommands = (): void => {
```

- Hàm không nhận tham số, trả `void`. Nó **không async** — bản thân việc `addCommand` là đồng bộ; các command bên trong mới là async khi được gọi.
- Được config gọi trong hook `before` để nạp command một lần cho cả session.

### 3.3. Command 1 — `browser.gotoRoute(route)` (dòng 16–20)

```ts
16   /** `browser.gotoRoute("/settings")` — navigate while logging the transition. */
17   browser.addCommand("gotoRoute", async function (this: WebdriverIO.Browser, route: string) {
18     logger.info(`→ navigate ${route}`)
19     await this.url(route)
20   })
```

- **Đăng ký lên `browser`** (mặc định `addCommand` gắn vào browser vì không có cờ thứ ba).
- **Tên command:** `"gotoRoute"`.
- **Tham số:** `route: string` — đường dẫn cần điều hướng tới.
- **`this: WebdriverIO.Browser`** — chú thích kiểu cho `this` (chỉ để TypeScript hiểu, không sinh code). Bên trong, `this` chính là `browser`.
- **Hành vi:**
  - **Dòng 18** — Log dòng `→ navigate <route>` (level `info`) để trace mọi lần điều hướng — giúp đọc log test dễ hiểu "đang đi đâu".
  - **Dòng 19** — `this.url(route)`: thực hiện điều hướng WebView/trình duyệt tới `route`.
- **Điểm cộng so với gọi `browser.url` trực tiếp:** mỗi lần điều hướng đều được log tự động → nhật ký test rõ ràng hơn.
- **Type tương ứng:** [wdio.d.ts](../../../src/types/wdio.d.ts) dòng 8 — `gotoRoute(route: string): Promise<void>`.

### 3.4. Command 2 — `el.waitAndClick(timeout?)` (dòng 22–30)

```ts
22   /** `el.waitAndClick()` — combined wait-for-clickable + click. */
23   browser.addCommand(
24     "waitAndClick",
25     async function (this: WebdriverIO.Element, timeout = TIMEOUTS.MEDIUM) {
26       await this.waitForClickable({ timeout })
27       await this.click()
28     },
29     true
30   )
```

- **Đăng ký lên `element`** nhờ **tham số thứ ba `true`** (dòng 29) — cờ `attachToElement`. Đây là điểm khác biệt then chốt so với command 1: command này gọi trên **phần tử** (`el.waitAndClick()`), không phải trên browser.
- **Tên command:** `"waitAndClick"`.
- **Tham số:** `timeout` **tùy chọn**, mặc định `TIMEOUTS.MEDIUM` (15s).
- **`this: WebdriverIO.Element`** — bên trong `this` là **phần tử** đang thao tác.
- **Hành vi:**
  - **Dòng 26** — `this.waitForClickable({ timeout })`: chờ phần tử **có thể click được** (hiển thị + enabled + không bị che) trong ngân sách timeout.
  - **Dòng 27** — `this.click()`: bấm phần tử.
- **Ý nghĩa:** gộp "chờ clickable + click" thành **một dòng** — mẫu rất hay lặp lại, tránh viết 2 dòng mỗi lần.
- **Type tương ứng:** [wdio.d.ts](../../../src/types/wdio.d.ts) dòng 19 — `waitAndClick(timeout?: number): Promise<void>` (đặt trong `interface Element`).

### 3.5. Command 3 — `browser.softAssert(fn, message)` (dòng 32–49)

```ts
32   /**
33    * `browser.softAssert(fn, message)` — runs an assertion without throwing,
34    * captures the failure, returns it. Useful in specs that verify many
35    * independent things in one test.
36    */
37   browser.addCommand(
38     "softAssert",
39     async function (this: WebdriverIO.Browser, fn: () => Promise<void>, message: string) {
40       try {
41         await fn()
42         return null
43       } catch (err) {
44         const e = err as Error
45         logger.warn(`[softAssert] ${message} — ${e.message}`)
46         return { message, error: e.message }
47       }
48     }
49   )
```

- **Đăng ký lên `browser`** (không có cờ thứ ba → gắn vào browser).
- **Tên command:** `"softAssert"`.
- **Tham số:**
  - `fn: () => Promise<void>` — hàm async chứa **một assertion** (ví dụ `async () => expect(x).toBe(y)`).
  - `message: string` — nhãn mô tả điều đang kiểm.
- **Hành vi ("soft assertion"):**
  - **Dòng 40–42** — Chạy `fn()` trong `try`; nếu **không ném lỗi** (assertion pass) → `return null`.
  - **Dòng 43–46** — Nếu `fn()` **ném lỗi** (assertion fail): ép kiểu `Error`, log `warn` với `[softAssert] <message> — <lỗi>`, rồi **`return { message, error: e.message }`** thay vì để lỗi văng lên.
- **Tại sao hữu ích:** trong một test cần kiểm **nhiều thứ độc lập**, "hard assert" bình thường sẽ **dừng ngay ở lỗi đầu tiên**, che mất các lỗi sau. `softAssert` cho phép **chạy hết** các kiểm tra, thu thập tất cả thất bại rồi xử lý sau (ví dụ tổng hợp và fail test một lần với đầy đủ thông tin).
- **Type tương ứng:** [wdio.d.ts](../../../src/types/wdio.d.ts) dòng 11–14 — trả `Promise<{ message: string; error: string } | null>`, **khớp đúng** giá trị hàm trả ra.

### 3.6. Log kết thúc đăng ký (dòng 51)

```ts
51   logger.debug("Custom WDIO commands registered")
```

- Sau khi cả 3 command đã `addCommand`, log ở level `debug` để xác nhận việc đăng ký hoàn tất — hữu ích khi soi log khởi động session.

---

## 4. Cách dùng / quan hệ với file khác

- **Gọi ở đâu:** hàm `registerCustomCommands()` được gọi trong hook `before` của config WebdriverIO (config chung / `wdio.*.conf.ts`), **một lần mỗi session**, để command sẵn sàng trước khi spec chạy.
- **Cặp với `wdio.d.ts`:** mỗi command ở đây phải có **khai báo type** tương ứng trong [src/types/wdio.d.ts](../../../src/types/wdio.d.ts):
  - `gotoRoute` → `interface Browser` (dòng 8)
  - `softAssert` → `interface Browser` (dòng 11–14)
  - `waitAndClick` → `interface Element` (dòng 19)
  Thiếu khai báo type → gọi command bị đỏ khi type-check; thiếu `addCommand` ở đây → lỗi runtime "not a function".
- **Phụ thuộc:** `TIMEOUTS` ([timeouts.ts](../../../src/constants/timeouts.ts)) và `logger` ([logger.ts](../../../src/utils/logger.ts)).

---

## 5. Ghi chú & điểm dễ nhầm

- **Cờ thứ ba `true` của `addCommand` = gắn lên element.** Đây là khác biệt duy nhất giữa "command trên browser" (`gotoRoute`, `softAssert`) và "command trên element" (`waitAndClick`). Quên cờ này thì `waitAndClick` sẽ nằm nhầm trên `browser` và không có `this` là phần tử.
- **`this` chỉ có kiểu đúng nhờ chú thích `this: WebdriverIO.Browser | Element`.** Chú thích này thuần compile-time; runtime WebdriverIO tự bind `this` cho đúng (browser hoặc element) tùy cách đăng ký.
- **`softAssert` KHÔNG ném lỗi** — nó "nuốt" lỗi và trả về bản ghi. Nếu spec quên kiểm giá trị trả về (khác `null`), test có thể **pass giả tạo** dù assertion bên trong đã fail. Người dùng phải chủ động xử lý mảng kết quả để fail test khi cần.
- **Phải khai báo type song song** ở `wdio.d.ts` — comment trong file đã nhấn mạnh. Đây là lỗi hay gặp nhất khi thêm command mới.
- **Dùng `function` (không dùng arrow) cho callback `addCommand`**: bắt buộc, vì arrow function không có `this` riêng — WebdriverIO cần `this` để trỏ tới browser/element.
