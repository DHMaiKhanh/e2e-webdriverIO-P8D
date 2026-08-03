# Giải thích code: `src/utils/env.ts`

> **File nguồn:** [src/utils/env.ts](../../../src/utils/env.ts)
> **Loại:** Utility (cấu hình môi trường strong-typed)
> **Một câu:** Nạp `.env` và gom **toàn bộ** biến môi trường vào một object `ENV` **strong-typed** với giá trị mặc định, để `process.env` không rò rỉ vào spec/page — giữ test xác định và dễ suy luận.

---

## 1. Mục đích tổng quan

File này là **nguồn sự thật duy nhất** cho cấu hình môi trường. Nó:

1. Nạp biến từ file `.env` (qua `dotenv/config`).
2. Chuyển đổi các chuỗi env thành **kiểu đúng** (số, boolean) qua 2 helper `num`/`bool`.
3. Đóng gói tất cả vào object hằng `ENV` với **giá trị mặc định** cho từng mục (Tauri, Web, Android, API, tài khoản test, reporting, timeouts…).

JSDoc (dòng 16–22) nêu lý do: **tập trung hoá** ở đây để `process.env` **không rò rỉ** vào spec/page object — nhờ đó test **xác định** (deterministic) và dễ suy luận khi chạy trên nhiều môi trường khác nhau.

---

## 2. Các import / phụ thuộc (dòng 1)

```ts
1  import "dotenv/config"
```

| Dòng | Ý nghĩa |
|------|---------|
| 1 | Import **side-effect** `dotenv/config` — tự động đọc file `.env` ở gốc project và nạp vào `process.env` **ngay khi file này được import**. Không có biến nào được gán; chỉ là hiệu ứng phụ nạp `.env`. |

---

## 3. Giải thích từng khối code

### 3.1. Kiểu `LogLevel` (dòng 3)

```ts
3  type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "silent"
```

- Union các mức log hợp lệ. Dùng để ép kiểu cho `ENV.logLevel` (dòng 72). Lưu ý `"silent"` ở đây là mức của **WDIO**; [logger.ts](../../../src/utils/logger.ts) sẽ map `"silent"` → `"error"` cho winston.

### 3.2. Helper `num` — ép chuỗi sang số (dòng 5–9)

```ts
5  const num = (value: string | undefined, fallback: number): number => {
6    if (!value) return fallback
7    const n = Number(value)
8    return Number.isFinite(n) ? n : fallback
9  }
```

| Dòng | Ý nghĩa |
|------|---------|
| 6 | Nếu env **không có/rỗng** → dùng `fallback`. |
| 7 | Ép sang số bằng `Number(value)`. |
| 8 | Chỉ nhận số **hữu hạn** (`Number.isFinite`) — chuỗi không phải số (ví dụ `"abc"` → `NaN`) sẽ rơi về `fallback`. Đây là **guard** chống cấu hình sai làm hỏng số. |

### 3.3. Helper `bool` — ép chuỗi sang boolean (dòng 11–14)

```ts
11 const bool = (value: string | undefined, fallback: boolean): boolean => {
12   if (value === undefined) return fallback
13   return ["1", "true", "yes", "on"].includes(value.toLowerCase())
14 }
```

| Dòng | Ý nghĩa |
|------|---------|
| 12 | Nếu env **chưa đặt** (`undefined`) → dùng `fallback`. Lưu ý phân biệt với chuỗi rỗng `""` (không phải `undefined`) sẽ đi tiếp xuống dòng 13 và cho `false`. |
| 13 | Coi là `true` nếu (viết thường) thuộc `{ "1", "true", "yes", "on" }`; mọi giá trị khác → `false`. Chấp nhận nhiều cách viết "bật" cho tiện. |

### 3.4. Object `ENV` — mở đầu (dòng 23–24)

```ts
23 export const ENV = {
24   testEnv: process.env.TEST_ENV ?? "local",
```

- Bắt đầu object hằng `ENV`. `testEnv` đọc từ `TEST_ENV`, mặc định `"local"`. Toán tử `??` (nullish coalescing) chỉ dùng fallback khi biến là `null`/`undefined`.

### 3.5. Mục Tauri (desktop) (dòng 26–35)

```ts
26   // ---- Tauri (desktop) ----
27   tauriAppPath:
28     process.env.TAURI_APP_PATH ?? "D:\\Project\\P8D\\P8D\\src-tauri\\target\\release\\volt-pos.exe",
29   tauriDriver: {
30     path: process.env.TAURI_DRIVER_PATH ?? "tauri-driver",
31     host: process.env.TAURI_DRIVER_HOST ?? "127.0.0.1",
32     port: num(process.env.TAURI_DRIVER_PORT, 4444),
33     /** Optional explicit path to msedgedriver.exe — bypasses PATH lookup. */
34     nativeDriver: process.env.MSEDGEDRIVER_PATH ?? ""
35   },
```

| Dòng | Khoá | Mặc định | Ghi chú |
|------|------|----------|---------|
| 27–28 | `tauriAppPath` | đường dẫn `volt-pos.exe` build release trên máy dev | Đường dẫn Windows nên `\\` là escape của `\`. |
| 30 | `tauriDriver.path` | `"tauri-driver"` | Lệnh/đường dẫn tới tauri-driver. |
| 31 | `tauriDriver.host` | `"127.0.0.1"` | Host driver. |
| 32 | `tauriDriver.port` | `4444` | Qua `num(...)` nên nếu env sai định dạng vẫn về `4444`. |
| 34 | `tauriDriver.nativeDriver` | `""` | Đường dẫn tường minh tới `msedgedriver.exe` để **bỏ qua tra PATH**; rỗng nghĩa là dùng PATH. |

### 3.6. Mục Web (dòng 37–40)

```ts
37   // ---- Web ----
38   webBaseUrl: process.env.WEB_BASE_URL ?? "http://localhost:1420",
39   webBrowser: process.env.WEB_BROWSER ?? "chrome",
40   headless: bool(process.env.HEADLESS, false),
```

| Dòng | Khoá | Mặc định | Ghi chú |
|------|------|----------|---------|
| 38 | `webBaseUrl` | `http://localhost:1420` | URL app khi chạy chế độ web (1420 là cổng dev mặc định của Tauri/Vite). |
| 39 | `webBrowser` | `"chrome"` | Trình duyệt cho chế độ web. |
| 40 | `headless` | `false` | Qua `bool(...)`; bật bằng `HEADLESS=1/true/yes/on`. |

### 3.7. Mục Android (dòng 42–51)

```ts
42   // ---- Android (real device via adb/Appium) ----
43   android: {
44     appPackage: process.env.ANDROID_APP_PACKAGE ?? "com.fastboy.volt_pos",
45     appActivity: process.env.ANDROID_APP_ACTIVITY ?? ".MainActivity",
46     appPath: process.env.ANDROID_APP_PATH ?? "",
47     deviceName: process.env.ANDROID_DEVICE_NAME ?? "",
48     udid: process.env.ANDROID_UDID ?? "",
49     appiumHost: process.env.APPIUM_HOST ?? "127.0.0.1",
50     appiumPort: num(process.env.APPIUM_PORT, 4723)
51   },
```

| Dòng | Khoá | Mặc định | Ghi chú |
|------|------|----------|---------|
| 44 | `appPackage` | `"com.fastboy.volt_pos"` | Package Android của app P8D (trùng `APP_ID` dùng ở ensure-logged-in). |
| 45 | `appActivity` | `".MainActivity"` | Activity khởi động. |
| 46 | `appPath` | `""` | Đường dẫn APK (nếu cần cài). Rỗng = không cài, dùng app sẵn có. |
| 47 | `deviceName` | `""` | Tên thiết bị. |
| 48 | `udid` | `""` | UDID thiết bị — **dùng bởi [ensure-network.ts](../../../src/utils/ensure-network.ts)** để nhắm đúng máy khi gọi `adb -s <udid>`. |
| 49 | `appiumHost` | `"127.0.0.1"` | Host Appium. |
| 50 | `appiumPort` | `4723` | Cổng Appium (chuẩn), qua `num(...)`. |

### 3.8. Mục API (dòng 53–55)

```ts
53   // ---- API ----
54   apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:8080",
55   apiToken: process.env.API_TOKEN ?? "",
```

- `apiBaseUrl` mặc định `http://localhost:8080`; `apiToken` mặc định rỗng (đặt khi cần gọi API cần xác thực).

### 3.9. Tài khoản test (dòng 57–68)

```ts
57   // ---- Test accounts ----
58   testUser: {
59     email: process.env.TEST_USER_EMAIL ?? "qa.user@p8d.local",
60     pin: process.env.TEST_USER_PIN ?? "1234",
61     /** Real staff token for the fallback login form. Leave empty to skip the
62      *  happy-path login test (src/specs/android/staff-token-login.e2e.ts). */
63     staffToken: process.env.STAFF_TOKEN ?? ""
64   },
65   testAdmin: {
66     email: process.env.TEST_ADMIN_EMAIL ?? "qa.admin@p8d.local",
67     pin: process.env.TEST_ADMIN_PIN ?? "9999"
68   },
```

| Dòng | Khoá | Mặc định | Ghi chú |
|------|------|----------|---------|
| 59 | `testUser.email` | `qa.user@p8d.local` | Email user test. |
| 60 | `testUser.pin` | `"1234"` | PIN dạng **chuỗi** (giữ số 0 đầu). |
| 63 | `testUser.staffToken` | `""` | **Staff token thật** cho form login dự phòng. **Để rỗng sẽ bỏ qua** test happy-path login (`src/specs/android/staff-token-login.e2e.ts`). Đây chính là giá trị mà [ensure-logged-in.ts](../../../src/utils/ensure-logged-in.ts) đọc; rỗng → ném lỗi khi buộc phải login. |
| 66–67 | `testAdmin.email` / `.pin` | `qa.admin@p8d.local` / `"9999"` | Tài khoản admin test. |

### 3.10. Reporting (dòng 70–73)

```ts
70   // ---- Reporting ----
71   allureResultsDir: process.env.ALLURE_RESULTS_DIR ?? "./reports/allure-results",
72   logLevel: (process.env.LOG_LEVEL ?? "info") as LogLevel,
73   screenshotsOnFailure: bool(process.env.SCREENSHOTS_ON_FAILURE, true),
```

| Dòng | Khoá | Mặc định | Ghi chú |
|------|------|----------|---------|
| 71 | `allureResultsDir` | `./reports/allure-results` | Thư mục kết quả Allure. |
| 72 | `logLevel` | `"info"` | Ép kiểu `as LogLevel`. **Được [logger.ts](../../../src/utils/logger.ts) dùng** để đặt mức log (và map `"silent"`→`"error"`). |
| 73 | `screenshotsOnFailure` | `true` | Qua `bool(...)`; mặc định **bật** chụp ảnh khi fail. |

### 3.11. Timeouts (dòng 75–78)

```ts
75   // ---- Timeouts ----
76   waitTimeout: num(process.env.WAIT_TIMEOUT, 15_000),
77   navigationTimeout: num(process.env.NAVIGATION_TIMEOUT, 30_000),
78   longTimeout: num(process.env.LONG_TIMEOUT, 60_000),
```

| Dòng | Khoá | Mặc định | Ghi chú |
|------|------|----------|---------|
| 76 | `waitTimeout` | `15_000` (15s) | Timeout chờ chung; `_` chỉ là dấu phân nhóm số, không ảnh hưởng giá trị. |
| 77 | `navigationTimeout` | `30_000` (30s) | Timeout điều hướng. |
| 78 | `longTimeout` | `60_000` (60s) | Timeout dài (khởi động app…). |

> Lưu ý: đây là timeout **cấu hình cho WDIO conf**, tách biệt với hằng `TIMEOUTS` trong [timeouts.ts](../../../src/constants/timeouts.ts) mà các util (wait/tauri) dùng.

### 3.12. Misc + đóng object + type (dòng 80–86)

```ts
80   // ---- Misc ----
81   retryFailedTests: num(process.env.RETRY_FAILED_TESTS, 1),
82   parallelInstances: num(process.env.PARALLEL_INSTANCES, 1)
83 } as const
84
85 export type AppEnv = typeof ENV
```

| Dòng | Ý nghĩa |
|------|---------|
| 81 | `retryFailedTests` — số lần retry test fail ở tầng WDIO, mặc định `1`. |
| 82 | `parallelInstances` — số instance chạy song song, mặc định `1`. |
| 83 | **`as const`** — đóng băng toàn bộ object thành **read-only** với kiểu literal chính xác. Ngăn code khác vô tình sửa cấu hình lúc chạy. |
| 85 | `AppEnv` = kiểu suy ra từ `ENV`, để nơi khác tham chiếu kiểu này. |

---

## 4. Cách dùng / sơ đồ luồng

```ts
import { ENV } from "./env.js"

if (!ENV.testUser.staffToken) throw new Error("cần STAFF_TOKEN")
await browser.pause(ENV.waitTimeout)
const port = ENV.android.appiumPort // 4723 nếu không đặt env
```

Luồng nạp cấu hình:

```
import "dotenv/config"  →  đọc .env vào process.env
        │
        ▼
ENV = { ...process.env.X ?? default, num(...), bool(...) }  (as const, read-only)
        │
        ├──► logger.ts đọc ENV.logLevel
        ├──► ensure-logged-in.ts đọc ENV.testUser.staffToken
        └──► ensure-network.ts đọc ENV.android.udid
```

---

## 5. Ghi chú & điểm dễ nhầm

- **`process.env` KHÔNG được đọc trực tiếp** ở spec/page — luôn đi qua `ENV` (chủ đích thiết kế, JSDoc dòng 16–22). Điều này giữ test xác định.
- **`bool` phân biệt `undefined` với `""`**: biến chưa đặt → dùng `fallback`; đặt là chuỗi rỗng → cho `false`. Đặt `HEADLESS=` (rỗng) sẽ ra `false`, không phải mặc định.
- **`num` an toàn với input rác**: chuỗi không phải số → về `fallback`, không thành `NaN`.
- **`staffToken` rỗng có ý nghĩa nghiệp vụ**: bỏ qua test happy-path login; đồng thời khiến `ensureLoggedIn()` ném lỗi nếu buộc phải login (xem [ensure-logged-in.ts](../../../src/utils/ensure-logged-in.ts)).
- **`logLevel` chỉ được ép kiểu `as LogLevel`, không kiểm tra runtime** — đặt sai giá trị (ví dụ `LOG_LEVEL=loud`) sẽ lọt qua TypeScript và có thể gây lỗi ở winston.
- **`as const` khiến `ENV` read-only** — đừng thử gán lại field lúc chạy; muốn đổi cấu hình phải qua biến môi trường/`.env`.
- Phân biệt **hai nhóm timeout**: `ENV.waitTimeout/...` (cho WDIO conf) vs hằng `TIMEOUTS` trong [timeouts.ts](../../../src/constants/timeouts.ts) (cho helper util). Chúng độc lập nhau.
