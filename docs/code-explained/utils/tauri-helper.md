# Giải thích code: `src/utils/tauri-helper.ts`

> **File nguồn:** [src/utils/tauri-helper.ts](../../../src/utils/tauri-helper.ts)
> **Loại:** Utility (helper đặc thù cho Tauri WebView)
> **Một câu:** Bọc các thao tác chỉ có nghĩa **bên trong Tauri WebView** — gọi lệnh Tauri (`invoke`) và chuyển đổi giữa nhiều cửa sổ (main/customer) — và **tự no-op có cảnh báo** khi chạy ở chế độ trình duyệt thuần để cùng một page object dùng được cho cả hai môi trường.

---

## 1. Mục đích tổng quan

P8D là app **Tauri** (Rust + WebView) và luôn chạy **hai webview**: màn POS cho nhân viên (`"main"`) và màn hiển thị cho khách (`"customer"`, đưa ra màn hình phụ). File này gom các thao tác đặc thù Tauri:

- **Phát hiện** có đang trong Tauri hay không (`isTauriContext`).
- **Gọi lệnh Tauri** từ test (`invoke`).
- **Đọc nhãn cửa sổ hiện tại** và **chuyển cửa sổ** theo nhãn (`getCurrentWindowLabel`, `switchToWindow`).
- **Chạy một hàm trên cửa sổ khác rồi quay lại** cửa sổ cũ (`withWindow`).

Triết lý thiết kế (JSDoc dòng 5–14): khi test chạy ở **trình duyệt thuần** (`wdio.web.conf.ts`, không có Tauri), các lệnh này **trở thành no-op kèm cảnh báo** thay vì crash — nhờ đó cùng một page object dùng được cho cả Tauri lẫn web. JSDoc còn ghi chú: xoá file này nếu app chỉ còn chạy web.

---

## 2. Các import / phụ thuộc (dòng 1–3)

```ts
1  import { TIMEOUTS } from "../constants/timeouts.js"
2  import { logger } from "./logger.js"
3  import { waitUntil } from "./wait.js"
```

| Dòng | Ý nghĩa |
|------|---------|
| 1 | `TIMEOUTS` — hằng timeout đặt tên (xem [timeouts.ts](../../../src/constants/timeouts.ts)). Ở đây dùng `TIMEOUTS.MEDIUM` = **15.000 ms** làm timeout mặc định cho `switchToWindow`. |
| 2 | `logger` — logger dùng chung (xem [logger.ts](../../../src/utils/logger.ts)) để `warn` khi ngoài Tauri và `debug` khi chuyển cửa sổ thành công. |
| 3 | `waitUntil` — hàm poll điều kiện từ [wait.ts](../../../src/utils/wait.ts); dùng để **thử lại** việc tìm cửa sổ vì cửa sổ customer có thể còn đang khởi tạo. |

---

## 3. Giải thích từng khối code

### 3.1. Hằng nhãn cửa sổ `WINDOW_LABELS` + kiểu (dòng 16–28)

```ts
23 export const WINDOW_LABELS = {
24   MAIN: "main",
25   CUSTOMER: "customer"
26 } as const
27
28 export type WindowLabel = (typeof WINDOW_LABELS)[keyof typeof WINDOW_LABELS]
```

- **JSDoc (16–22)** — Giải thích 2 cửa sổ khai báo trong `src-tauri/tauri.conf.json`: `"main"` (POS nhân viên) và `"customer"` (màn khách, màn hình thứ hai). Đóng một cửa sổ sẽ **phá luôn cửa sổ kia** (theo `src-tauri/src/lib.rs`), nên test phải **chuyển cửa sổ tường minh**, không được giả định thứ tự cửa sổ.
- **Dòng 23–26** — Object hằng ánh xạ tên gợi nhớ → nhãn thật. `as const` để TypeScript suy ra kiểu **literal** (`"main"`, `"customer"`) thay vì `string` chung chung.
- **Dòng 28** — `WindowLabel` là kiểu **union** của các giá trị trong `WINDOW_LABELS`, tức `"main" | "customer"`.

### 3.2. Khai báo type toàn cục cho `window.__TAURI__` (dòng 30–41)

```ts
30 declare global {
31   interface Window {
32     __TAURI__?: {
33       core: { invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> }
34       window: any
35       event: any
36     }
37   }
38 }
```

- **Mở rộng type `Window`** để TypeScript biết trong WebView có thể có object `window.__TAURI__` do runtime Tauri chèn vào.
- `__TAURI__?` là **optional** — vì ngoài Tauri nó không tồn tại.
- `core.invoke` là cửa gọi lệnh Rust; `window`/`event` để kiểu `any` (linh hoạt, không cần khai báo chi tiết — đã tắt cảnh báo eslint tại các dòng 33/35/37). Đây chỉ là **khai báo kiểu**, không sinh code chạy.

### 3.3. `isTauriContext` — có đang trong Tauri? (dòng 43–45)

```ts
43 export const isTauriContext = async (): Promise<boolean> => {
44   return await browser.execute(() => typeof window !== "undefined" && Boolean(window.__TAURI__))
45 }
```

- Chạy đoạn JS **trong WebView** (`browser.execute`) để kiểm tra `window` tồn tại **và** có `window.__TAURI__`.
- Trả `true` khi đang trong Tauri WebView, `false` khi ở trình duyệt thuần. Đây là **guard** dùng bởi `invoke`.

### 3.4. `invoke` — gọi lệnh Tauri (dòng 47–70)

```ts
52 export const invoke = async <T = unknown>(
53   command: string,
54   args: Record<string, unknown> = {}
55 ): Promise<T | undefined> => {
56   if (!(await isTauriContext())) {
57     logger.warn(`tauri.invoke("${command}") skipped — not running inside Tauri.`)
58     return undefined
59   }
60   return browser.executeAsync<T, [string, Record<string, unknown>]>(
61     function (cmd, params, done) {
62       ;(window.__TAURI__!.core.invoke(cmd, params) as Promise<unknown>)
63         .then((res) => done(res as T))
64         // eslint-disable-next-line prefer-promise-reject-errors
65         .catch((e) => done({ __error: String(e) } as unknown as T))
66     },
67     command,
68     args
69   )
70 }
```

| Dòng | Ý nghĩa |
|------|---------|
| 52–55 | Generic `<T>` (kiểu kết quả lệnh). Nhận `command` và `args` (mặc định `{}`). Trả `Promise<T | undefined>` — `undefined` khi ngoài Tauri. |
| 56–59 | **Guard no-op**: nếu **không** trong Tauri → `warn` và **trả `undefined`**, không crash. Đây là cách để cùng page object chạy được ở web. |
| 60 | `browser.executeAsync` — chạy JS **bất đồng bộ** trong WebView; nhận callback `done` để trả kết quả về test. |
| 61–62 | Trong WebView gọi `window.__TAURI__!.core.invoke(cmd, params)` (`!` khẳng định không null vì đã qua guard). Dấu `;` đầu dòng 62 là để tránh lỗi ASI (automatic semicolon insertion). |
| 63 | Lệnh thành công → `done(res)` trả kết quả. |
| 64–65 | Lệnh lỗi → **không reject** mà `done({ __error: String(e) })` — bọc lỗi thành object có field `__error`. Lý do: `executeAsync` truyền dữ liệu qua ranh giới WebDriver, ném lỗi thô qua đó không ổn; nên **tuần tự hoá lỗi thành chuỗi** rồi trả về như dữ liệu. Caller có thể kiểm tra field `__error`. |

### 3.5. `getCurrentWindowLabel` — đọc nhãn cửa sổ hiện tại (dòng 72–88)

```ts
77 export const getCurrentWindowLabel = async (): Promise<string | undefined> => {
78   return browser.execute(() => {
79     const w = window.__TAURI__?.window
80     if (!w) return undefined
81     try {
82       const current = typeof w.getCurrentWindow === "function" ? w.getCurrentWindow() : w.getCurrent?.()
83       return current?.label
84     } catch {
85       return undefined
86     }
87   })
88 }
```

| Dòng | Ý nghĩa |
|------|---------|
| 77 | Trả `Promise<string | undefined>` — nhãn cửa sổ (`"main"`/`"customer"`) hoặc `undefined` nếu không xác định được. |
| 79–80 | Lấy API `window` của Tauri; nếu chưa có (`!w`) → trả `undefined` (ngoài Tauri hoặc JS API chưa nạp xong). |
| 82 | **Tương thích nhiều phiên bản API Tauri**: ưu tiên `getCurrentWindow()` (API mới), nếu không có thì thử `getCurrent?.()` (API cũ). `?.` để không crash nếu cũng thiếu. |
| 83 | Trả `current?.label` — nhãn của cửa sổ hiện tại. |
| 84–85 | Bọc `try/catch`: bất kỳ lỗi nào → trả `undefined` thay vì ném (JSDoc dòng 74–76: có thể window đang loading). |

### 3.6. `switchToWindow` — chuyển sang cửa sổ theo nhãn (dòng 90–116)

```ts
99  export const switchToWindow = async (
100   label: WindowLabel | string,
101   timeout = TIMEOUTS.MEDIUM
102 ): Promise<void> => {
103   await waitUntil(
104     async () => {
105       const handles = await browser.getWindowHandles()
106       for (const handle of handles) {
107         await browser.switchToWindow(handle)
108         const current = await getCurrentWindowLabel()
109         if (current === label) return handle
110       }
111       return false
112     },
113     { timeout, timeoutMsg: `Tauri window with label "${label}" was not found` }
114   )
115   logger.debug(`[tauri] switched to window "${label}"`)
116 }
```

- **JSDoc (90–98)** — Giải thích **tại sao phức tạp**: `tauri-driver` chỉ expose mỗi webview như một **window handle WebDriver trần**, **không mang nhãn**. Nên cách duy nhất đáng tin để phân biệt "customer" vs "main" là **switch vào từng handle rồi hỏi trang xem nó là cửa sổ nào**. Phải retry (`waitUntil`) vì cửa sổ customer có thể còn khởi tạo trong khi main đã sẵn sàng.
- **Dòng 100–101** — Nhận `label` cần tới; `timeout` mặc định `TIMEOUTS.MEDIUM` = **15s**.
- **Dòng 103–113** — `waitUntil` **poll** cho tới khi tìm thấy:
  - **105** — Lấy tất cả window handle.
  - **106–109** — Duyệt từng handle, **switch vào** rồi đọc nhãn (`getCurrentWindowLabel`). Nếu trùng `label` → trả `handle` (truthy) → `waitUntil` dừng thành công. Đã "đậu" lại đúng cửa sổ vì switch cuối cùng chính là cửa sổ khớp.
  - **111** — Duyệt hết mà không thấy → trả `false` → `waitUntil` chờ và thử lại.
  - **113** — Hết `timeout` mà vẫn `false` → ném lỗi với thông điệp rõ ràng.
- **Dòng 115** — Log `debug` khi chuyển thành công.

### 3.7. `withWindow` — chạy hàm trên cửa sổ khác rồi quay lại (dòng 118–133)

```ts
125 export const withWindow = async <T>(label: WindowLabel | string, fn: () => Promise<T>): Promise<T> => {
126   const originalHandle = await browser.getWindowHandle()
127   await switchToWindow(label)
128   try {
129     return await fn()
130   } finally {
131     await browser.switchToWindow(originalHandle)
132   }
133 }
```

- **JSDoc (118–124)** — Mục đích: cho phép spec "ghé" sang màn customer để kiểm tra rồi **tự quay lại** màn nhân viên tiếp tục thao tác, không phải tự quản lý handle.
- **Dòng 126** — **Nhớ handle hiện tại** trước khi chuyển.
- **Dòng 127** — Chuyển sang cửa sổ đích (`switchToWindow`).
- **Dòng 128–132** — Chạy `fn()` và **luôn** quay lại cửa sổ cũ trong khối `finally` — kể cả khi `fn` ném lỗi. Đây là mấu chốt: đảm bảo không "kẹt" ở cửa sổ sai dù có exception.
- Trả về đúng giá trị `fn` trả (generic `<T>`).

### 3.8. Object tổng hợp `tauri` (dòng 135–142)

```ts
135 export const tauri = {
136   isTauriContext,
137   invoke,
138   switchToWindow,
139   withWindow,
140   getCurrentWindowLabel,
141   WINDOW_LABELS
142 }
```

- Gom mọi hàm + hằng thành một namespace `tauri` để gọi kiểu `tauri.invoke(...)`, `tauri.WINDOW_LABELS.CUSTOMER`. Vẫn giữ các named export riêng lẻ ở trên để import lẻ khi cần.

---

## 4. Cách dùng / sơ đồ luồng

```ts
import { tauri, WINDOW_LABELS } from "./tauri-helper.js"

// Gọi lệnh Tauri (undefined nếu chạy ở web thuần)
const user = await tauri.invoke<UserDto>("get_current_user")

// Ghé màn customer đọc tổng giỏ hàng rồi tự quay lại màn hiện tại
const total = await tauri.withWindow(WINDOW_LABELS.CUSTOMER, () => customerDisplay.getCartTotal())
```

Cơ chế tìm cửa sổ (vì handle không mang nhãn):

```
switchToWindow("customer")
      │
      ▼  waitUntil(poll, timeout=15s)
getWindowHandles() → [h1, h2, ...]
      │
      └─ với mỗi handle: switchToWindow(h) → getCurrentWindowLabel()
              │
              ├─ khớp "customer" → dừng (đang đậu ở đúng cửa sổ) ✅
              └─ không khớp handle nào → false → chờ & thử lại
```

---

## 5. Ghi chú & điểm dễ nhầm

- **Ngoài Tauri, `invoke` trả `undefined` (no-op)** chứ không lỗi — code gọi phải chấp nhận khả năng `undefined` khi chạy ở web.
- **Lỗi của `invoke` được bọc thành `{ __error: "..." }`**, **không** ném exception. Muốn phát hiện lỗi lệnh Tauri, kiểm tra field `__error` trên kết quả, đừng chỉ dựa vào try/catch.
- **Handle của tauri-driver không mang nhãn** — vì thế `switchToWindow` phải switch vào từng cái để hỏi; đây là lý do nó chậm và cần retry, không phải bug.
- **Đóng một cửa sổ phá luôn cửa sổ kia** (JSDoc dòng 20–21) — đừng đóng thủ công trong test; luôn chuyển cửa sổ tường minh.
- **`withWindow` luôn khôi phục cửa sổ gốc** nhờ `finally` — an toàn kể cả khi `fn` ném lỗi. Đừng tự switch qua lại thủ công khi đã có helper này.
- `getCurrentWindowLabel` **nuốt lỗi thành `undefined`** (dòng 84–85) — nếu nhận `undefined` bất ngờ, có thể window đang loading chứ chưa hẳn là lỗi thật.
- Toàn bộ file này chỉ có ý nghĩa với build Tauri; JSDoc đầu file nhắc: **xoá file nếu app chuyển sang web-only**.
