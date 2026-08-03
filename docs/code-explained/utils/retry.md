# Giải thích code: `src/utils/retry.ts`

> **File nguồn:** [src/utils/retry.ts](../../../src/utils/retry.ts)
> **Loại:** Utility (thử lại thao tác bất đồng bộ)
> **Một câu:** Thử lại một thao tác async có thể **chập chờn tạm thời** (network, timing) theo số lần / delay / backoff cấu hình được; nếu hết lượt vẫn lỗi thì ném lỗi **lần cuối cùng**.

---

## 1. Mục đích tổng quan

Một số thao tác trong test không hỏng vì code sai mà vì **chập chờn nhất thời** — mạng lag, dữ liệu chưa kịp sync, race timing. File này cung cấp hàm `retry()` để **tự thử lại** thao tác đó vài lần trước khi bỏ cuộc, thay vì để test fail ngay lần đầu.

Hàm hỗ trợ: số lần thử (`attempts`), delay giữa các lần (`delayMs`), **hệ số backoff** để giãn delay sau mỗi lần fail (`backoff`), và `label` để log dễ đọc. Nếu **tất cả** lần thử đều lỗi, hàm ném **lỗi của lần cuối** (giữ nguyên nguyên nhân gốc để debug).

---

## 2. Các import / phụ thuộc (dòng 1–2)

```ts
1  import { logger } from "./logger.js"
2  import { sleep } from "./wait.js"
```

| Dòng | Ý nghĩa |
|------|---------|
| 1 | `logger` — logger dùng chung (xem [logger.ts](../../../src/utils/logger.ts)); dùng để `warn` mỗi khi một lần thử thất bại. |
| 2 | `sleep` — hàm chờ dạng Promise từ [wait.ts](../../../src/utils/wait.ts): `sleep(ms)` = `new Promise(r => setTimeout(r, ms))`. Dùng để giãn cách giữa các lần thử. |

---

## 3. Giải thích từng khối code

### 3.1. Kiểu tuỳ chọn `RetryOptions` (dòng 4–13)

```ts
4  export interface RetryOptions {
5    /** Max attempts including the first. Default 3. */
6    attempts?: number
7    /** Delay between attempts in ms. Default 500. */
8    delayMs?: number
9    /** Multiply the delay after each failure. Default 1 (constant). */
10   backoff?: number
11   /** Label for logging. */
12   label?: string
13 }
```

| Field | Mặc định | Ý nghĩa |
|-------|----------|---------|
| `attempts` | `3` | **Tổng** số lần thử, **bao gồm cả lần đầu**. `attempts: 3` = 1 lần đầu + 2 lần thử lại. |
| `delayMs` | `500` | Delay (ms) giữa các lần thử. |
| `backoff` | `1` | Hệ số **nhân delay** sau mỗi lần fail. `1` = delay **không đổi** (constant). `2` = delay tăng gấp đôi mỗi lần (exponential backoff). |
| `label` | `"operation"` | Nhãn hiển thị trong log cảnh báo, giúp biết thao tác nào đang retry. |

### 3.2. Chữ ký hàm + JSDoc (dòng 15–21)

```ts
15 /**
16  * Retry an async operation that may be transiently flaky (network, timing).
17  * Throws the last error if all attempts fail.
18  *
19  *   await retry(() => api.fetchOrder(id), { attempts: 5, label: "fetchOrder" })
20  */
21 export const retry = async <T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> => {
```

- **Generic `<T>`** — kiểu trả về theo đúng kết quả của `fn`. `fn` là một hàm **không tham số** trả `Promise<T>`.
- `options` mặc định `{}` (không truyền gì cũng chạy được với toàn giá trị mặc định).
- Trả về `Promise<T>` — chính là giá trị `fn` trả về khi thành công.

### 3.3. Đọc option + khởi tạo trạng thái (dòng 22–24)

```ts
22   const { attempts = 3, delayMs = 500, backoff = 1, label = "operation" } = options
23   let lastError: unknown
24   let delay = delayMs
```

- **Dòng 22** — Destructure kèm **giá trị mặc định** (khớp bảng ở mục 3.1).
- **Dòng 23** — `lastError` giữ lỗi **gần nhất** để ném ra nếu hết lượt. Kiểu `unknown` (an toàn hơn `any`).
- **Dòng 24** — `delay` khởi đầu bằng `delayMs`; biến này sẽ **tự nhân với `backoff`** sau mỗi lần fail (dòng 34).

### 3.4. Vòng lặp thử lại (dòng 26–37)

```ts
26   for (let attempt = 1; attempt <= attempts; attempt++) {
27     try {
28       return await fn()
29     } catch (err) {
30       lastError = err
31       logger.warn(`[retry] ${label} failed (attempt ${attempt}/${attempts}): ${(err as Error).message}`)
32       if (attempt < attempts) {
33         await sleep(delay)
34         delay *= backoff
35       }
36     }
37   }
```

| Dòng | Ý nghĩa |
|------|---------|
| 26 | Lặp `attempt` từ `1` đến `attempts` (tính cả lần đầu). |
| 28 | **Thử chạy `fn`**. Nếu thành công → **`return` ngay** giá trị, thoát cả hàm (không chờ thêm). Đây là "happy path". |
| 29–30 | Nếu ném lỗi → lưu vào `lastError`. |
| 31 | Ghi log **cảnh báo** (`warn`) kèm `label`, số lần (`attempt/attempts`) và message lỗi. `err as Error` để lấy `.message`. |
| 32 | **Chỉ chờ khi vẫn còn lượt** (`attempt < attempts`). Ở lần cuối thì **không** chờ vô ích rồi mới thoát vòng lặp. |
| 33 | `await sleep(delay)` — giãn cách trước lần thử kế. |
| 34 | `delay *= backoff` — **nhân delay theo backoff** cho lần sau. Với `backoff = 1` delay giữ nguyên; với `backoff > 1` delay tăng dần (giảm áp lực lên hệ thống đang lỗi). |

### 3.5. Ném lỗi cuối cùng (dòng 38)

```ts
38   throw lastError
```

- Chỉ tới đây khi **mọi** lần thử đều fail (vòng `for` kết thúc mà chưa `return`).
- Ném **lỗi của lần cuối** (`lastError`) — giữ nguyên nguyên nhân gốc, không nuốt lỗi, để test hiển thị đúng lý do hỏng.

---

## 4. Cách dùng / sơ đồ luồng

```ts
import { retry } from "./retry.js"

// Thử tối đa 5 lần, delay 500ms cố định
const order = await retry(() => api.fetchOrder(id), { attempts: 5, label: "fetchOrder" })

// Exponential backoff: 300ms, 600ms, 1200ms...
await retry(() => syncData(), { attempts: 4, delayMs: 300, backoff: 2, label: "sync" })
```

Sơ đồ luồng:

```
retry(fn, options)
      │
      ▼
attempt = 1 .. attempts
      │
      ├─► [28] fn() thành công? ── có ──► return kết quả ✅ (thoát ngay)
      │        │ không (throw)
      │        ▼
      │   [30-31] lưu lastError + log warn
      │        │
      │   [32] còn lượt? ── có ──► [33] sleep(delay) → [34] delay *= backoff → lặp tiếp
      │                    └ không ─► ra khỏi vòng lặp
      ▼
[38] throw lastError ❌ (hết lượt vẫn lỗi)
```

---

## 5. Ghi chú & điểm dễ nhầm

- **`attempts` tính cả lần đầu** — `attempts: 3` nghĩa là 1 lần chạy + 2 lần retry, **không phải** 3 lần retry.
- **`backoff = 1` (mặc định) là delay không đổi** — muốn giãn delay theo cấp số nhân phải đặt `backoff > 1`.
- **Lần thử cuối không sleep** (dòng 32 chặn) — tránh chờ vô nghĩa rồi mới ném lỗi.
- **Chỉ thích hợp cho lỗi "chập chờn tạm thời"** (network/timing). Với lỗi **xác định** (dữ liệu sai, assert sai logic) thì retry chỉ làm test **chậm** mà vẫn fail — đừng dùng để che giấu bug thật.
- **Lỗi cuối được ném ra**, không phải lỗi đầu — nếu các lần fail vì lý do khác nhau, message cuối cùng mới là cái bạn thấy.
- Cần đảm bảo `fn` **an toàn khi gọi lại nhiều lần** (idempotent). Nếu `fn` gây side-effect (ví dụ tạo bản ghi), retry có thể tạo trùng.
