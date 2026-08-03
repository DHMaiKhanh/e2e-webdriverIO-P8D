# Giải thích code: `src/utils/ensure-network.ts`

> **File nguồn:** [src/utils/ensure-network.ts](../../../src/utils/ensure-network.ts)
> **Loại:** Utility (đảm bảo thiết bị Android luôn có mạng)
> **Một câu:** "Luôn giữ app online" — bật lại WiFi + data và tắt airplane mode **trước phiên test**, ưu tiên lệnh Appium `mobile: setConnectivity`, nếu không được thì **dự phòng bằng `adb`**; luôn best-effort, **không bao giờ làm fail phiên chạy**.

---

## 1. Mục đích tổng quan

Build Android của P8D là **Tauri WebView** kéo dữ liệu **live** từ backend (tile "TODAY · LIVE" ở dashboard, đơn hàng, khách hàng, số dư gift-card…). Nếu emulator/thiết bị **tắt mạng** (WiFi/data off, hoặc airplane mode on), app vẫn render nhưng hiện "Couldn't load today's numbers", khiến **mọi assertion dựa trên dữ liệu bị flake** vì lý do **không liên quan** tới code đang test (JSDoc dòng 8–17).

Hàm `ensureNetworkOnline()` **ép bật lại các radio** trước phiên chạy để test không "đua" với thiết bị mất mạng. Nó **idempotent** (gọi bao nhiêu lần cũng an toàn) và theo chiến lược **best-effort, không bao giờ fail run** (JSDoc dòng 19–26):

1. Ưu tiên `mobile: setConnectivity` của Appium (uiautomator2) — bật WiFi + data, tắt airplane trong **một** lệnh, **không cần** cờ `--allow-insecure`.
2. Nếu lỗi (driver cũ / thiếu quyền) → **dự phòng** bằng `adb svc wifi/data enable` nhắm vào `ANDROID_UDID`.

---

## 2. Các import / phụ thuộc (dòng 1–6)

```ts
1  import { execFile } from "node:child_process"
2  import { promisify } from "node:util"
3  import { ENV } from "./env.js"
4  import { logger } from "./logger.js"
5
6  const execFileAsync = promisify(execFile)
```

| Dòng | Ý nghĩa |
|------|---------|
| 1 | `execFile` (Node built-in) — chạy một chương trình ngoài (ở đây là `adb`) **không qua shell** (an toàn hơn `exec`, tránh injection). |
| 2 | `promisify` — biến hàm callback-style thành Promise để `await`. |
| 3 | `ENV` — cấu hình môi trường (xem [env.ts](../../../src/utils/env.ts)); dùng `ENV.android.udid` để nhắm đúng thiết bị. |
| 4 | `logger` — logger dùng chung (xem [logger.ts](../../../src/utils/logger.ts)) để ghi info/warn. |
| 6 | Tạo `execFileAsync` — phiên bản Promise của `execFile` để `await execFileAsync("adb", args)`. |

---

## 3. Giải thích từng khối code

### 3.1. `ensureNetworkOnline` — đường chính qua Appium (dòng 28–48)

```ts
28 export async function ensureNetworkOnline(): Promise<void> {
29   try {
30     await browser.execute("mobile: setConnectivity", {
31       wifi: true,
32       data: true,
33       airplaneMode: false
34     })
35
36     // Verify + surface the resulting state so a still-offline device is obvious
37     // in the logs instead of silently producing "Couldn't load…" screens.
38     const state = await browser.execute("mobile: getConnectivity")
39     logger.info(`[ensureNetworkOnline] radios forced on — connectivity=${JSON.stringify(state)}`)
40     return
41   } catch (err) {
42     logger.warn(
43       `[ensureNetworkOnline] mobile:setConnectivity unavailable (${(err as Error).message}) — falling back to adb`
44     )
45   }
46
47   await ensureNetworkViaAdb()
48 }
```

| Dòng | Ý nghĩa |
|------|---------|
| 28 | Hàm async trả `Promise<void>` — chỉ side-effect (bật mạng), không trả giá trị. |
| 30–34 | Gọi lệnh Appium `mobile: setConnectivity`: **một lệnh** bật `wifi`, `data` và tắt `airplaneMode`. Đây là **cách ưu tiên** vì không cần cờ `--allow-insecure`. |
| 36–37 (comment) | Sau khi bật, **đọc lại và in trạng thái** để nếu thiết bị vẫn offline thì **hiện rõ trong log**, thay vì âm thầm sinh màn "Couldn't load…". |
| 38 | `mobile: getConnectivity` — lấy trạng thái kết nối thực tế. |
| 39 | Log info kèm JSON trạng thái. |
| 40 | **`return` ngay** — đường chính thành công thì **không** chạy dự phòng adb. |
| 41–45 | Nếu bước Appium **ném lỗi** (driver cũ / thiếu quyền): chỉ **`warn`** (không rethrow) kèm message lỗi, báo sẽ chuyển sang adb. **Đây là chỗ "không bao giờ fail run"** — nuốt lỗi thay vì để test crash. |
| 47 | Ra khỏi `try/catch`, **gọi dự phòng** `ensureNetworkViaAdb()`. Chỉ tới đây khi đường Appium đã thất bại. |

### 3.2. `ensureNetworkViaAdb` — dự phòng qua adb (dòng 50–70)

```ts
50 /** Host-side fallback: toggle the radios directly through adb. */
51 async function ensureNetworkViaAdb(): Promise<void> {
52   const target = ENV.android.udid ? ["-s", ENV.android.udid] : []
53   const steps: string[][] = [
54     ["shell", "cmd", "connectivity", "airplane-mode", "disable"],
55     ["shell", "svc", "wifi", "enable"],
56     ["shell", "svc", "data", "enable"]
57   ]
58
59   for (const step of steps) {
60     const args = [...target, ...step]
61     try {
62       await execFileAsync("adb", args)
63       logger.info(`[ensureNetworkOnline] adb ${args.join(" ")}`)
64     } catch (err) {
65       // A single failing toggle (e.g. `svc data` on a WiFi-only emulator image)
66       // must not abort the others — keep going.
67       logger.warn(`[ensureNetworkOnline] adb ${step.join(" ")} failed: ${(err as Error).message}`)
68     }
69   }
70 }
```

| Dòng | Ý nghĩa |
|------|---------|
| 51 | Hàm **private** (không export) — chỉ dùng nội bộ làm dự phòng. |
| 52 | **Nhắm đúng thiết bị**: nếu có `ENV.android.udid` thì thêm `["-s", "<udid>"]` vào lệnh adb (chọn đúng máy khi nhiều thiết bị); không có thì để rỗng (adb tự chọn thiết bị mặc định). |
| 53–57 | Ba bước adb tách rời: (1) tắt airplane mode, (2) bật WiFi, (3) bật data. Mỗi bước là mảng đối số truyền cho `execFile` (không qua shell). |
| 59–60 | Duyệt từng bước; `args = [...target, ...step]` ghép prefix chọn thiết bị + đối số bước. |
| 62–63 | Chạy `adb` và log info nếu thành công. |
| 64–68 | **Bọc try/catch cho TỪNG bước**: một bước lỗi (ví dụ `svc data` trên image emulator **chỉ có WiFi**) **không được** chặn các bước còn lại — chỉ `warn` rồi **đi tiếp** (comment dòng 65–66). Đây là điểm thiết kế quan trọng: cố hết sức, hỏng phần nào bỏ qua phần đó. |

---

## 4. Cách dùng / sơ đồ luồng

```ts
// Thường gọi trong hook before của phiên test Android
import { ensureNetworkOnline } from "./ensure-network.js"

before(async () => {
  await ensureNetworkOnline()
})
```

Sơ đồ luồng:

```
ensureNetworkOnline()
      │
      ▼
[30-34] Appium mobile:setConnectivity (wifi+data on, airplane off)
      │
   thành công? ──── có ──► [38-40] getConnectivity + log → return ✅
      │ không (throw)
      ▼
[42-44] warn (KHÔNG fail) → chuyển dự phòng
      │
      ▼
[47] ensureNetworkViaAdb()
      │
      ▼  với mỗi bước [airplane off, wifi on, data on]:
   adb [-s <udid>] shell ...
      │
      ├─ ok  → log info
      └─ lỗi → warn & ĐI TIẾP (không dừng các bước còn lại)
```

---

## 5. Ghi chú & điểm dễ nhầm

- **Không bao giờ làm fail phiên chạy** — mọi lỗi đều bị nuốt thành `warn` (dòng 41–45 và 64–68). Nếu mạng vẫn không lên, test tiếp theo mới lộ ra chứ hàm này không throw.
- **Đường Appium là ưu tiên vì không cần `--allow-insecure`** — chỉ khi nó lỗi mới rơi xuống adb (JSDoc dòng 21–26).
- **`ANDROID_UDID` quyết định nhắm máy nào** khi dùng adb (dòng 52). Nhiều thiết bị cùng cắm mà **không** đặt `udid` → adb có thể báo "more than one device" và các bước fail (nhưng chỉ warn).
- **Từng toggle adb được cô lập** — `svc data` fail trên emulator chỉ-WiFi là **bình thường**, không phải bug; WiFi và airplane vẫn được xử lý.
- **Idempotent**: gọi lại nhiều lần vô hại — bật cái đã bật không gây tác dụng phụ.
- Hàm dùng `browser.execute("mobile: ...")` nên **cần một session WebdriverIO/Appium đang chạy** ở nhánh chính; nhánh adb thì độc lập với session (chạy lệnh host).
- `mobile: setConnectivity`/`getConnectivity` là tính năng của **driver uiautomator2** — driver khác/cũ hơn có thể không hỗ trợ, và đó chính là lúc nhánh adb phát huy tác dụng.
