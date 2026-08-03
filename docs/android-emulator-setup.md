# Chạy app Volt POS trên Emulator (Android) — Setup & Recipe

Tài liệu này tổng hợp toàn bộ những gì đã được cấu hình sẵn trong repo test
này để chạy app **Volt POS** (`com.fastboy.volt_pos`) trên **emulator Android
P8_Dual**, cùng các bước chuẩn bị thủ công cần làm trước khi chạy.

> **TL;DR** — Framework test đã cấu hình xong config/script/env để trỏ vào
> emulator `P8_Dual`. Nhưng repo này **không** tự tạo emulator, **không** tự cài
> APK, và **không** tự khởi động dev server. Bạn phải boot emulator + chạy dev
> server (ở repo app) + tạo adb reverse tunnel, rồi mới chạy được các DOM spec.

---

## 1. Đã setup sẵn trong repo

| Thành phần        | Chi tiết                                                                 | File |
| ----------------- | ------------------------------------------------------------------------ | ---- |
| Config Android    | Appium + UiAutomator2, tự spawn Appium server trong `onPrepare`          | [`config/wdio.android.conf.ts`](../config/wdio.android.conf.ts) |
| App target        | package `com.fastboy.volt_pos`, activity `.MainActivity`                 | [`src/utils/env.ts`](../src/utils/env.ts#L44-L45) |
| Emulator target   | `.env` đã trỏ `ANDROID_UDID=emulator-5554` (emulator P8_Dual)            | [`.env`](../.env#L35) |
| npm scripts       | `test:android`, `test:android:emu`, `android:open`, `android:reverse`    | [`package.json`](../package.json#L14-L17) |
| Specs Android     | `device-smoke`, `staff-token-login`, `open-and-hold`                     | [`src/specs/android/`](../src/specs/android/) |

### Điểm quan trọng về config

- **Appium server tự động**: `onPrepare` trong config sẽ `spawn` một Appium
  server local ở `127.0.0.1:4723` với cờ `--allow-insecure chromedriver_autodownload`,
  và poll `/status` cho tới khi server sẵn sàng. `onComplete` sẽ kill nó khi
  chạy xong. Bạn **không** cần khởi động Appium thủ công.
- **`appium:noReset: true`**: không xoá dữ liệu app giữa các lần chạy.
- **Cài APK hay dùng app có sẵn**: nếu `ANDROID_APP_PATH` có giá trị →
  Appium cài APK đó (`appium:app`). Nếu để trống → attach vào app đã cài sẵn
  trên emulator qua `appPackage` + `appActivity`.
- **Tauri WebView interop**: `enableWebviewDetailsCollection: false` và
  `nativeWebScreenshot: true` được bật để tránh việc `getContexts` bị treo trên
  WebView của Tauri (WebView này không trả lời protocol command trên per-page
  socket mặc định).
- **`baseUrl: http://tauri.localhost`**: cho phép page object điều hướng theo
  path giống config web/desktop.

---

## 2. Điều kiện tiên quyết (chuẩn bị ngoài repo này)

Những thứ sau **không** nằm trong repo test — coi như đã provision sẵn hoặc
phải làm 1 lần trên máy:

1. **Android SDK**: đặt `ANDROID_HOME` / `ANDROID_SDK_ROOT`, có `platform-tools`
   (`adb`) và `emulator` trên PATH.
2. **Emulator AVD tên `P8_Dual`** đã được tạo. (Repo này không tạo AVD.)
3. **Debug APK của Volt POS** đã cài lên emulator (`app-arm64-debug.apk`).
4. **Repo app** `D:\Project\P8D\P8D` có sẵn để chạy Vite dev server, vì debug
   APK **không bundle** frontend — nó load UI từ dev server `http://127.0.0.1:1420`.
5. `adb devices` phải liệt kê được emulator (`emulator-5554`) trước khi chạy test.

### Vì sao phải là emulator, không phải máy P8D thật?

App là một **Tauri webview**. Muốn tự động hoá DOM (login, order, thanh toán…)
thì Appium phải attach chromedriver vào WebView qua CDP.

- ✅ **Emulator P8_Dual**: WebView renderer trả lời CDP → DOM automation chạy được.
- ❌ **Máy P8D thật** (`AA61B4325C0500135`): ROM bị MDM khoá, renderer của WebView
  bị kill → `switchContext(WEBVIEW_*)` treo. Trên máy thật chỉ chạy được
  **native smoke test** (`device-smoke.e2e.ts`).

---

## 3. Recipe chạy đầy đủ (DOM specs)

> **Nguyên tắc**: các npm script (`test:android`, `test:android:emu`,
> `android:open`…) **chỉ chạy test** — chúng **không** tự boot emulator, **không**
> tự chạy dev server. Bạn phải bật sẵn emulator + dev server + tunnel trước.

### 3.1. Runbook Windows PowerShell — 3 cửa sổ (khuyến nghị)

Cần **3 cửa sổ PowerShell** vì emulator và dev server là tiến trình blocking phải
giữ chạy. Đây là luồng đã kiểm chứng trực tiếp trên máy dev.

#### 🪟 Cửa sổ 1 — Emulator (giữ chạy)

```powershell
# 1. Kiểm tra AVD có sẵn  →  phải thấy: P8_Dual
& "$env:ANDROID_HOME\emulator\emulator.exe" -list-avds

# 2. Boot emulator (blocking — giữ cửa sổ này chạy)
& "$env:ANDROID_HOME\emulator\emulator.exe" -avd P8_Dual -no-snapshot-load
```

Mở cửa sổ khác kiểm tra emulator đã lên (đợi ~30–60s cho Android boot xong):

```powershell
adb devices                 # phải thấy: emulator-5554   device
```

#### 🪟 Cửa sổ 2 — Dev server của app (giữ chạy)

Debug APK **không bundle** frontend — nó load UI từ Vite dev server, nên bước này
bắt buộc cho DOM specs. Chạy ở **repo app**, không phải repo test:

```powershell
cd D:\Project\P8D\P8D
$env:TAURI_DEV_HOST="127.0.0.1"; npm run dev:android
```

> ✅ Đợi tới khi thấy dòng `Local:  http://127.0.0.1:1420/` → ready. **Giữ nguyên
> cửa sổ này.** `TAURI_DEV_HOST=127.0.0.1` ép IPv4 để `adb reverse` tới được
> (script `dev:android` = `cross-env APP_TARGET=android npm run dev`).

#### 🪟 Cửa sổ 3 — Tunnel + chạy app (repo test)

```powershell
cd D:\Project\P8D\WebdriverIO_P8D

# 4. Mở tunnel cổng 1420/1421 vào emulator
npm run android:reverse

# 5. Chạy app + DOM test lên
npm run test:android:emu
```

### 3.2. Bản rút gọn (emulator + dev server đã chạy sẵn)

Chỉ cần 2 lệnh cuối ở repo test:

```powershell
npm run android:reverse
npm run test:android:emu
```

### 3.3. Chỉ mở app xem, không chạy DOM test

Không cần dev server — chạy spec native mở-và-giữ:

```powershell
npm run android:open        # mở app + giữ session (open-and-hold.e2e.ts)
npm run android:dump        # dump page source để xem cấu trúc màn hình
```

### 3.4. Checklist nhanh (thứ tự bắt buộc)

| # | Bước               | Lệnh                                                              | Ghi chú                                       |
| - | ------------------ | ---------------------------------------------------------------- | --------------------------------------------- |
| 1 | Khởi động emulator | `& "$env:ANDROID_HOME\emulator\emulator.exe" -avd P8_Dual -no-snapshot-load` | Blocking — cửa sổ riêng, chờ boot xong |
| 2 | Kiểm tra           | `adb devices`                                                    | Phải thấy `emulator-5554  device`             |
| 3 | Dev server (repo app) | `cd D:\Project\P8D\P8D; $env:TAURI_DEV_HOST="127.0.0.1"; npm run dev:android` | Blocking — chờ `Local: …1420/` ready |
| 4 | Reverse port       | `npm run android:reverse`                                        | Cần `emulator-5554` tồn tại (bước 2 pass)     |
| 5 | Chạy test          | `npm run test:android:emu`                                       | Tự set `ANDROID_WEBVIEW_READY=1`              |

> **Lưu ý**: bước 3 (dev server) chỉ cần cho **DOM specs** (login, order, thanh
> toán…). Với native smoke (`device-smoke.e2e.ts`) hoặc `android:open` thì bỏ qua
> bước 3.

### 3.5. Lệnh kiểm tra khi cần chẩn đoán

```powershell
# Emulator đã boot xong chưa (trả về 1 khi xong)
adb -s emulator-5554 shell getprop sys.boot_completed

# APK Volt POS đã cài trên emulator chưa
adb -s emulator-5554 shell pm list packages | Select-String volt_pos

# Kiểm tra tunnel adb reverse đang mở
adb -s emulator-5554 reverse --list

# Reset adb nếu adb devices không thấy gì
adb kill-server; adb start-server
```

### 3.6. Bản bash tương đương (macOS/Linux, hoặc Git Bash)

```bash
# 1. Boot emulator
"$ANDROID_HOME/emulator/emulator" -avd P8_Dual -no-snapshot-load

# 2. Ở repo app (D:\Project\P8D\P8D): chạy Android dev server
TAURI_DEV_HOST=127.0.0.1 npm run dev:android

# 3. Tunnel port dev-server vào emulator
npm run android:reverse        # adb reverse tcp:1420 + tcp:1421

# 4. Chạy DOM specs (tự set ANDROID_WEBVIEW_READY=1)
npm run test:android:emu
```

### `ANDROID_WEBVIEW_READY=1` để làm gì?

Cờ này **un-skip** các webview spec. Không có nó, các spec DOM sẽ tự skip để
suite không bị treo trên máy có renderer chết. Script `test:android:emu` đã set
sẵn cờ này.

Lần tương tác DOM đầu tiên **chậm (~10–15s)** vì hard navigation phải re-mount
lại toàn bộ SPA qua tunnel dưới ARM translation — các spec đã chờ `EXTRA_LONG`
cho việc này.

---

## 4. Danh sách npm scripts liên quan Android

| Script                       | Việc nó làm                                                   |
| ---------------------------- | ------------------------------------------------------------- |
| `npm run test:android`       | Chạy config Android qua Appium (real device hoặc emulator)    |
| `npm run test:android:emu`   | Như trên + `ANDROID_WEBVIEW_READY=1` (mở các webview spec)    |
| `npm run android:open`       | Chỉ chạy spec `open-and-hold.e2e.ts` (mở app + giữ session)   |
| `npm run android:dump`       | Chạy spec `dump-page-source.e2e.ts` (dump cấu trúc màn hình)  |
| `npm run android:login`      | Chạy spec `login-once.e2e.ts` (`ANDROID_WEBVIEW_READY=1`)     |
| `npm run android:reverse`    | `adb reverse tcp:1420` + `tcp:1421` cho emulator-5554         |

---

## 5. Các spec Android

- [`src/specs/android/device-smoke.e2e.ts`](../src/specs/android/device-smoke.e2e.ts)
  — **native only** (install / launch / foreground / webview-alive / screenshot).
  Chạy trên **bất kỳ** device/emulator nào, **không cần** dev server.
- [`src/specs/android/staff-token-login.e2e.ts`](../src/specs/android/staff-token-login.e2e.ts)
  — test login DOM thật, **cần** recipe emulator ở mục 3.
- [`src/specs/android/open-and-hold.e2e.ts`](../src/specs/android/open-and-hold.e2e.ts)
  — mở app và giữ session.

---

## 6. Biến môi trường Android (`.env`)

```ini
# ----- Android (real device via adb/Appium) -----
ANDROID_APP_PACKAGE=com.fastboy.volt_pos
ANDROID_APP_ACTIVITY=.MainActivity
# Để trống -> dùng app đã cài sẵn; điền path APK -> Appium sẽ cài APK đó.
ANDROID_APP_PATH=
ANDROID_DEVICE_NAME=
# Emulator P8_Dual (WebView renderer trả lời CDP -> DOM automation OK).
# Máy P8D thật (AA61B4325C0500135) bị MDM kill renderer -> chỉ native-only.
ANDROID_UDID=emulator-5554
APPIUM_HOST=127.0.0.1
APPIUM_PORT=4723
```

Toàn bộ giá trị đọc qua [`src/utils/env.ts`](../src/utils/env.ts) — **không**
truy cập `process.env` trực tiếp trong spec/page object.

---

## 7. Troubleshooting nhanh

| Triệu chứng                                   | Nguyên nhân / cách xử lý                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `adb devices` không thấy emulator             | Emulator chưa boot xong, hoặc UDID khác `emulator-5554` → sửa `ANDROID_UDID`.       |
| DOM spec tự skip                              | Thiếu `ANDROID_WEBVIEW_READY=1` → dùng `npm run test:android:emu`.                  |
| UI trắng / không load được frontend           | Chưa chạy dev server ở repo app, hoặc chưa `npm run android:reverse`.               |
| `switchContext(WEBVIEW_*)` treo               | Đang chạy trên máy P8D thật (MDM kill renderer) → chỉ chạy được `device-smoke`.     |
| Appium port bận (`4723`)                      | Còn Appium server cũ đang chạy → kill process, hoặc đổi `APPIUM_PORT`.              |
| Tương tác DOM đầu tiên rất chậm               | Bình thường (~10–15s) do re-mount SPA qua tunnel + ARM translation.                 |

---

## 8. Tham chiếu thêm

- Tổng quan repo & conventions: [`README.md`](../README.md)
- Playbook bring-up máy P8D (ở repo app): `docs/p8d-device-bring-up-playbook.md`, Phụ lục A.
