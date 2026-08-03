# Giải thích code: `src/utils/wait.ts`

> **File nguồn:** [src/utils/wait.ts](../../../src/utils/wait.ts)
> **Loại:** Utility (các helper chờ đợi cho SPA / WebView)
> **Một câu:** Bộ helper "chờ có chủ đích" (`waitUntil`, `waitForStable`, `sleep`, `withTimeout`, `waitForRoute`) thay cho `browser.pause()` thô — mỗi hàm nói rõ **tại sao** đang chờ, giảm flake và giúp lỗi dễ đọc.

---

## 1. Mục đích tổng quan

JSDoc đầu file (dòng 4–10) nêu triết lý: `browser.pause()` (chờ cứng) là **nguồn flake số một**. File này cung cấp các helper chờ **có điều kiện** — mỗi hàm diễn đạt *lý do* của việc chờ (chờ predicate đúng, chờ DOM ổn định, chờ đổi route, chờ có timeout…), nhờ đó khi fail thì thông điệp dễ hiểu và có thể thay đổi cách chờ về sau.

Các hàm export: `waitUntil` (chờ theo predicate), `waitForStable` (chờ một vùng UI "đứng yên"), `sleep` (chờ cứng, dùng hạn chế), `withTimeout` (đua promise với timeout để không treo mãi), `waitForRoute` (chờ URL chứa fragment).

---

## 2. Các import / phụ thuộc (dòng 1–2)

```ts
1  import { TIMEOUTS } from "../constants/timeouts.js"
2  import { logger } from "./logger.js"
```

| Dòng | Ý nghĩa |
|------|---------|
| 1 | `TIMEOUTS` — hằng timeout đặt tên (xem [timeouts.ts](../../../src/constants/timeouts.ts)). Dùng: `MEDIUM` = **15.000 ms** (mặc định `waitUntil`, `waitForRoute`), `SHORT` = **5.000 ms** (mặc định `waitForStable`). |
| 2 | `logger` — logger dùng chung (xem [logger.ts](../../../src/utils/logger.ts)); chỉ dùng để `warn` trong `waitForStable` khi UI không kịp ổn định. |

---

## 3. Giải thích từng khối code

### 3.1. Kiểu tuỳ chọn `WaitOptions` (dòng 12–16)

```ts
12 export interface WaitOptions {
13   timeout?: number
14   interval?: number
15   timeoutMsg?: string
16 }
```

- `timeout` — tổng thời gian chờ tối đa (ms).
- `interval` — khoảng cách giữa hai lần kiểm tra (ms).
- `timeoutMsg` — thông điệp lỗi khi hết giờ. Tất cả optional, mỗi hàm có mặc định riêng.

### 3.2. `waitUntil` — chờ theo predicate (dòng 18–32)

```ts
18 /** Generic predicate-based wait. Returns the awaited value. */
19 export const waitUntil = async <T>(
20   predicate: () => Promise<T | false | null | undefined>,
21   options: WaitOptions = {}
22 ): Promise<T> => {
23   const { timeout = TIMEOUTS.MEDIUM, interval = 250, timeoutMsg = "waitUntil timed out" } = options
24   const deadline = Date.now() + timeout
25   let lastResult: T | false | null | undefined
26   while (Date.now() < deadline) {
27     lastResult = await predicate()
28     if (lastResult) return lastResult as T
29     await sleep(interval)
30   }
31   throw new Error(`${timeoutMsg} (after ${timeout}ms)`)
32 }
```

| Dòng | Ý nghĩa |
|------|---------|
| 19–20 | Generic `<T>`. `predicate` là hàm async trả về **giá trị `T`** (khi thành công) **hoặc** `false/null/undefined` (khi chưa đạt). |
| 23 | Mặc định: `timeout = MEDIUM` (15s), `interval = 250ms`, `timeoutMsg` mặc định. |
| 24 | Tính **hạn chót** = thời điểm hiện tại + timeout. |
| 26–30 | Vòng lặp tới khi quá hạn: chạy `predicate`; nếu kết quả **truthy** → **`return` chính giá trị đó** (đây là điểm mạnh: trả luôn value, không chỉ boolean). Nếu chưa đạt → `sleep(interval)` rồi lặp. |
| 28 | `if (lastResult) return lastResult as T` — mọi giá trị **truthy** đều coi là "đạt". Lưu ý: nếu `T` có thể là `0`/`""` (falsy) thì sẽ **không** được nhận là đạt (xem mục 5). |
| 31 | Hết giờ → ném `Error` kèm `timeoutMsg` và số ms đã chờ. |

> 💡 Khác với `browser.waitUntil` của WDIO, đây là bản **tự viết** trả về **giá trị** predicate (hữu ích khi bạn cần chính đối tượng tìm được, ví dụ `switchToWindow` trả handle).

### 3.3. `waitForStable` — chờ vùng UI "đứng yên" (dòng 34–56)

```ts
34 /** Wait for a UI region to be "stable" — useful after route transitions. */
35 export const waitForStable = async (selector: string, options: WaitOptions = {}): Promise<void> => {
36   const { timeout = TIMEOUTS.SHORT, interval = 200 } = options
37   const deadline = Date.now() + timeout
38   let prevHtml = ""
39   let stableSince = 0
40   while (Date.now() < deadline) {
41     const el = await $(selector)
42     const exists = await el.isExisting()
43     if (exists) {
44       const html = await el.getHTML(false)
45       if (html === prevHtml) {
46         if (stableSince === 0) stableSince = Date.now()
47         if (Date.now() - stableSince >= interval * 2) return
48       } else {
49         prevHtml = html
50         stableSince = 0
51       }
52     }
53     await sleep(interval)
54   }
55   logger.warn(`waitForStable: ${selector} did not stabilize within ${timeout}ms`)
56 }
```

Ý tưởng: **so sánh HTML của một vùng qua nhiều lần đọc**; khi HTML **không đổi** đủ lâu thì coi là ổn định (thường dùng sau khi chuyển route để chờ giao diện vẽ xong).

| Dòng | Ý nghĩa |
|------|---------|
| 36 | Mặc định `timeout = SHORT` (5s), `interval = 200ms`. |
| 38–39 | `prevHtml` = HTML lần đọc trước; `stableSince` = mốc thời gian bắt đầu "đứng yên" (0 = chưa ổn định). |
| 41–42 | Lấy element theo `selector`, kiểm tra có tồn tại chưa. |
| 44 | `el.getHTML(false)` — lấy HTML **bên trong** element (`false` = không kèm thẻ ngoài). |
| 45–47 | Nếu HTML **giống** lần trước: lần đầu giống thì ghi mốc `stableSince`; nếu đã giữ nguyên **≥ `interval * 2`** (ở đây ~400ms) → coi là ổn định → **`return`**. Yêu cầu giữ nguyên qua **2 chu kỳ** để chắc chắn không phải trùng ngẫu nhiên một nhịp. |
| 48–50 | Nếu HTML **đổi**: cập nhật `prevHtml` và **reset** `stableSince = 0` (bắt đầu đếm lại). |
| 53 | Chờ `interval` rồi lặp. |
| 55 | Hết giờ mà chưa ổn định → **chỉ `warn`, KHÔNG ném lỗi**. Đây là chờ "mềm": không làm fail test, chỉ ghi cảnh báo. |

### 3.4. `sleep` — chờ cứng dạng Promise (dòng 58–63)

```ts
58 /**
59  * Promise-resolving sleep. Use sparingly — prefer waitUntil/waitForStable.
60  * The only legitimate use is for animation timing where the DOM doesn't
61  * actually change but a transition is mid-flight.
62  */
63 export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
```

- Trả về Promise resolve sau `ms` mili-giây (bọc `setTimeout`).
- **JSDoc (59–61)** — Dùng **hạn chế**; lý do hợp lệ **duy nhất** là **timing animation** — khi DOM không thực sự đổi nhưng transition đang chạy dở. Mọi trường hợp khác nên dùng `waitUntil`/`waitForStable`.
- Đây cũng là hàm được `waitUntil`/`waitForStable`/`retry` dùng nội bộ để giãn cách.

### 3.5. `withTimeout` — đua promise với timeout (dòng 65–82)

```ts
65 /** Race a promise against a timeout — rejects instead of hanging forever.
66  * Needed for Appium/chromedriver calls that can hang on a dead HTTP request
67  * (e.g. webview devtools attach) without ever rejecting on their own. */
68 export const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
69   return new Promise<T>((resolve, reject) => {
70     const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
71     promise.then(
72       (value) => {
73         clearTimeout(timer)
74         resolve(value)
75       },
76       (err) => {
77         clearTimeout(timer)
78         reject(err)
79       }
80     )
81   })
82 }
```

| Dòng | Ý nghĩa |
|------|---------|
| 65–67 (JSDoc) | **Tại sao cần**: một số lời gọi Appium/chromedriver có thể **treo vô hạn** trên HTTP request chết (ví dụ attach devtools của webview) mà **không bao giờ tự reject**. Hàm này ép có kết quả trong thời gian giới hạn. |
| 68 | Nhận `promise` cần bảo vệ, `ms` giới hạn, `label` để báo lỗi. |
| 70 | Đặt `setTimeout`: nếu tới hạn trước → **reject** với thông điệp `"<label> timed out after <ms>ms"`. |
| 71–80 | "Đua": nếu `promise` **xong trước** (resolve/reject) → **huỷ timer** (`clearTimeout`) rồi truyền tiếp kết quả/lỗi. Việc `clearTimeout` tránh rò bộ đếm. |
| — | Ai **về đích trước** thắng: hoặc promise gốc, hoặc timeout. Nhờ vậy không bao giờ treo mãi. |

### 3.6. `waitForRoute` — chờ URL chứa fragment (dòng 84–97)

```ts
84 /** Wait for the page to reach the given URL fragment. */
85 export const waitForRoute = async (fragment: string, options: WaitOptions = {}): Promise<void> => {
86   const { timeout = TIMEOUTS.MEDIUM } = options
87   await browser.waitUntil(
88     async () => {
89       const url = await browser.getUrl()
90       return url.includes(fragment)
91     },
92     {
93       timeout,
94       timeoutMsg: `Expected URL to contain "${fragment}" within ${timeout}ms`
95     }
96   )
97 }
```

| Dòng | Ý nghĩa |
|------|---------|
| 86 | Mặc định `timeout = MEDIUM` (15s). |
| 87–91 | Dùng **`browser.waitUntil` của WDIO** (không phải `waitUntil` tự viết ở trên) để poll `browser.getUrl()` cho tới khi URL **chứa** `fragment`. |
| 94 | Thông điệp lỗi rõ ràng nếu URL không đạt trong thời gian cho phép. |
| — | Dùng khi chờ SPA điều hướng tới một route (ví dụ chờ rời `/login`). |

---

## 4. Cách dùng / sơ đồ luồng

```ts
import { waitUntil, waitForStable, sleep, withTimeout, waitForRoute } from "./wait.js"

// Chờ tới khi lấy được đối tượng (trả về chính đối tượng đó)
const el = await waitUntil(async () => (await $("#ready").isDisplayed()) && $("#ready"))

// Chờ vùng danh sách vẽ xong sau khi đổi route (không fail nếu chưa kịp)
await waitForStable("#order-list")

// Bảo vệ một lời gọi hay treo
await withTimeout(browser.getUrl(), 5000, "getUrl")

// Chờ điều hướng tới trang home
await waitForRoute("/home")

await sleep(300) // chỉ cho animation
```

Phân biệt nhanh:

```
waitUntil    → chờ predicate truthy, TRẢ VỀ value, hết giờ thì THROW
waitForStable→ chờ HTML đứng yên ~2 nhịp, hết giờ chỉ WARN (không throw)
sleep        → chờ cứng, chỉ cho animation
withTimeout  → đua 1 promise với timeout, chống treo vô hạn
waitForRoute → chờ URL chứa fragment (dùng browser.waitUntil của WDIO)
```

---

## 5. Ghi chú & điểm dễ nhầm

- **`waitUntil` coi mọi giá trị falsy là "chưa đạt"** (dòng 28) — nếu predicate của bạn có thể trả về `0`, `""` hay `false` **hợp lệ**, nó sẽ bị hiểu nhầm là chưa xong. Trả về đối tượng/`true` cho các trường hợp "đạt".
- **`waitForStable` không làm fail test** — hết giờ chỉ `warn` (dòng 55). Đừng dùng nó như một assertion; nó chỉ giúp giảm flake sau chuyển route.
- **Có HAI `waitUntil` khác nhau**: `waitUntil` tự viết trong file này (trả value, throw khi timeout) và `browser.waitUntil` của WDIO dùng trong `waitForRoute`. Đừng nhầm lẫn hành vi.
- **`sleep` là "necessary evil"** — JSDoc nói rõ chỉ dùng cho animation; lạm dụng sẽ tái tạo đúng vấn đề flake mà file này muốn tránh.
- **`withTimeout` sinh ra để chống treo** của Appium/chromedriver, không phải để "rút ngắn" thao tác chậm hợp lệ — đặt `ms` đủ rộng cho thao tác bình thường.
- `waitForStable` yêu cầu HTML **giống nhau qua ~2 chu kỳ** (`interval * 2`) mới coi là ổn định — nếu vùng UI có nội dung tự đổi liên tục (đồng hồ, animation số) thì **sẽ không bao giờ "ổn định"** và chỉ dừng khi hết giờ.
