# Giải thích code: `src/utils/logger.ts`

> **File nguồn:** [src/utils/logger.ts](../../../src/utils/logger.ts)
> **Loại:** Utility (logger dùng chung toàn project)
> **Một câu:** Tạo **một** winston logger chia sẻ cho mọi config/hook/page/util — in màu ra console và ghi song song vào 2 file log (`test-run.log` xoay vòng + `errors.log` chỉ chứa lỗi).

---

## 1. Mục đích tổng quan

File này khởi tạo **một logger winston duy nhất** để cả framework dùng chung, thay vì rải rác `console.log` khắp nơi. Nó cấu hình:

- **Console transport**: in log có **màu** (colorize) cho dễ đọc khi chạy test.
- **File transport `test-run.log`**: lưu toàn bộ log, tự **xoay vòng** (rotate) khi file đầy để không phình vô hạn.
- **File transport `errors.log`**: chỉ lưu các dòng log mức `error`, tiện soi lỗi nhanh.

Ngoài ra file export thêm `childLogger(scope)` để tạo logger con gắn nhãn theo tên page/feature, và export `default` chính là `logger`. Mức log (`level`) được đọc từ [ENV.logLevel](../../../src/utils/env.ts) nên có thể chỉnh qua biến môi trường `LOG_LEVEL`.

---

## 2. Các import / phụ thuộc (dòng 1–3)

```ts
1  import path from "node:path"
2  import winston from "winston"
3  import { ENV } from "./env.js"
```

| Dòng | Ý nghĩa |
|------|---------|
| 1 | `path` (Node built-in) — dùng để ghép/giải đường dẫn thư mục `logs` một cách an toàn đa nền tảng (Windows/Linux). |
| 2 | `winston` — thư viện logging chính. |
| 3 | `ENV` — object biến môi trường strong-typed (xem [env.ts](../../../src/utils/env.ts)). Ở đây chỉ dùng `ENV.logLevel` (mặc định `"info"`, đọc từ biến `LOG_LEVEL`). Đuôi `.js` vì project chạy chuẩn **ESM/NodeNext** — import phải trỏ tới file output `.js`. |

---

## 3. Giải thích từng khối code

### 3.1. Rút gọn các format của winston (dòng 5)

```ts
5  const { combine, timestamp, printf, colorize, errors, splat } = winston.format
```

- Destructure các "format helper" từ `winston.format` để gọi ngắn gọn về sau:
  - `combine` — gộp nhiều format lại thành một chuỗi xử lý.
  - `timestamp` — chèn mốc thời gian vào log.
  - `printf` — tự định nghĩa chuỗi output cuối cùng.
  - `colorize` — tô màu theo level (chỉ dùng cho console).
  - `errors` — cho phép trích `stack` khi log một `Error`.
  - `splat` — hỗ trợ cú pháp kiểu `printf` (`%s`, `%d`…) và meta bổ sung.

### 3.2. Format cho console (dòng 7–9)

```ts
7  const consoleFormat = printf(({ level, message, timestamp: ts, stack }) => {
8    return `${ts} [${level}] ${stack || message}`
9  })
```

- Định nghĩa dòng log console dạng: `<thời gian> [<level>] <nội dung>`.
- **Dòng 8** — `stack || message`: **nếu là lỗi có stack trace thì in nguyên stack**, ngược lại in `message` thường. Nhờ vậy khi log một `Error`, console hiện cả stack để debug.
- Lưu ý: đổi tên `timestamp` thành `ts` khi destructure để không trùng tên với helper `timestamp` đã import ở dòng 5.

### 3.3. Format cho file (dòng 11–14)

```ts
11 const fileFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
12   const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ""
13   return `${ts} [${level.toUpperCase()}] ${stack || message}${rest}`
14 })
```

- Giống console nhưng **không có màu** (file text thuần) và có thêm phần meta.
- **Dòng 11** — `...meta` gom **tất cả field còn lại** ngoài `level/message/timestamp/stack` (ví dụ `scope` do `childLogger` gắn vào, hoặc dữ liệu kèm theo).
- **Dòng 12** — Nếu có meta (`Object.keys(meta).length` > 0) thì nối thêm chuỗi JSON của meta; nếu không thì để rỗng. Tránh in `{}` thừa khi không có meta.
- **Dòng 13** — Level được viết **HOA** (`level.toUpperCase()`) cho file, khác với console để lệch phong cách; kèm `stack || message` (ưu tiên stack) và `rest` (meta) ở cuối.

### 3.4. Chọn mức log + thư mục log (dòng 22–23)

```ts
22 const winstonLevel = ENV.logLevel === "silent" ? "error" : ENV.logLevel
23 const LOG_DIR = path.resolve(process.cwd(), "logs")
```

- **Dòng 22** — **Ánh xạ level của WDIO sang winston.** WDIO có mức `silent`, nhưng winston **không có** `silent` trong thang `error < warn < info < http < verbose < debug < silly` (như JSDoc dòng 19 giải thích). Do đó `silent` được map thành `error` (thực tế gần như im lặng, chỉ còn lỗi). Các giá trị khác giữ nguyên.
- **Dòng 23** — Tính đường dẫn tuyệt đối tới thư mục `logs` dưới **thư mục làm việc hiện tại** (`process.cwd()`) — tức thư mục gốc project khi chạy test.

### 3.5. Tạo logger chính (dòng 25–45)

```ts
25 export const logger = winston.createLogger({
26   level: winstonLevel,
27   format: combine(errors({ stack: true }), splat(), timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" })),
28   transports: [
29     new winston.transports.Console({
30       format: combine(colorize(), consoleFormat)
31     }),
32     new winston.transports.File({
33       filename: path.join(LOG_DIR, "test-run.log"),
34       format: fileFormat,
35       maxsize: 5 * 1024 * 1024,
36       maxFiles: 5,
37       tailable: true
38     }),
39     new winston.transports.File({
40       filename: path.join(LOG_DIR, "errors.log"),
41       level: "error",
42       format: fileFormat
43     })
44   ]
45 })
```

| Dòng | Ý nghĩa |
|------|---------|
| 26 | `level` — ngưỡng log toàn cục (mọi log **thấp hơn hoặc bằng** mức này mới được ghi). Lấy từ `winstonLevel` ở dòng 22. |
| 27 | **Format chung (áp cho mọi transport)**: `errors({ stack: true })` giữ lại stack khi log Error → `splat()` bật interpolation → `timestamp(...)` gắn mốc thời gian định dạng `YYYY-MM-DD HH:mm:ss.SSS` (đến mili-giây). Thứ tự `combine` quan trọng: xử lý errors/splat trước rồi mới đóng dấu thời gian. |
| 29–31 | **Console transport** — dùng `colorize()` (tô màu level) rồi `consoleFormat` (mục 3.2). |
| 32–38 | **File transport `test-run.log`** — ghi **mọi level** (không đặt `level` riêng nên theo level chung dòng 26). |
| 35 | `maxsize: 5 * 1024 * 1024` = **5 MB**. Vượt ngưỡng thì winston tạo file mới. |
| 36 | `maxFiles: 5` — giữ tối đa **5 file xoay vòng**, file cũ nhất bị xoá. Giới hạn dung lượng log tổng ~25 MB. |
| 37 | `tailable: true` — luôn ghi vào **cùng một tên file** (`test-run.log`) là file mới nhất; các file cũ được đánh số lùi. Tiện cho `tail -f`. |
| 39–43 | **File transport `errors.log`** — **`level: "error"`** nên **chỉ** ghi log mức `error` trở lên. File này không có `maxsize/maxFiles` nên **không xoay vòng** (giả định lượng lỗi ít). |

> 💡 Vì sao 2 transport file dùng `fileFormat` còn console dùng `consoleFormat`? File cần text thuần (không mã màu ANSI làm bẩn log), console cần màu để đọc nhanh.

### 3.6. Logger con theo scope (dòng 53)

```ts
53 export const childLogger = (scope: string): winston.Logger => logger.child({ scope })
```

- Trả về **logger con** kế thừa cấu hình của `logger` nhưng gắn sẵn meta `{ scope }`.
- Nhờ đó mọi log qua child sẽ kèm nhãn (ví dụ `"LoginPage"`) — với file, `scope` sẽ xuất hiện trong phần meta JSON ở cuối dòng (xem `fileFormat` dòng 11–13). JSDoc dòng 50–51 minh hoạ cách dùng.

### 3.7. Export mặc định (dòng 55)

```ts
55 export default logger
```

- Cho phép import cả hai kiểu: `import { logger } from "./logger.js"` hoặc `import logger from "./logger.js"`. Phần lớn code trong project dùng **named import** `{ logger }`.

---

## 4. Cách dùng / sơ đồ luồng

```ts
import { logger, childLogger } from "./logger.js"

logger.info("bắt đầu test")               // → console (màu) + test-run.log
logger.error(new Error("boom"))           // → console + test-run.log + errors.log (kèm stack)

const log = childLogger("LoginPage")
log.debug("đang chờ element")             // gắn scope=LoginPage vào meta
```

Luồng một lời gọi log:

```
logger.xxx(msg)
      │
      ▼
[27] format chung: errors → splat → timestamp
      │
      ├──► Console transport  → colorize + consoleFormat  → stdout
      ├──► File transport     → fileFormat → logs/test-run.log (xoay vòng 5MB × 5)
      └──► File transport(err)→ nếu level=error → logs/errors.log
```

---

## 5. Ghi chú & điểm dễ nhầm

- **`silent` không phải level của winston** — nếu đặt `LOG_LEVEL=silent`, code map về `error` (dòng 22), **không** tắt hẳn log. Muốn thật sự im lặng phải sửa code.
- **Thư mục `logs` tính theo `process.cwd()`** (dòng 23), tức phụ thuộc chỗ **chạy lệnh**, không phải vị trí file `logger.ts`. Chạy từ thư mục khác sẽ tạo `logs` ở nơi khác.
- **`errors.log` không xoay vòng** (không có `maxsize/maxFiles`) — nếu lỗi quá nhiều theo thời gian, file này có thể phình to; chỉ `test-run.log` mới bị giới hạn.
- **`stack || message`** (dòng 8, 13): khi log một `Error` object, bạn sẽ thấy **stack trace** thay vì chỉ message — hành vi này phụ thuộc `errors({ stack: true })` ở dòng 27.
- **Thứ tự trong `combine` có ý nghĩa**: `errors`/`splat` phải chạy trước `timestamp`; đảo thứ tự có thể làm mất stack hoặc sai định dạng.
- Đây là **singleton dùng chung** — mọi nơi import về cùng một instance, nên cấu hình một lần ở đây ảnh hưởng toàn bộ project.
