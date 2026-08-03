# Login — Tổng quan test case & cách chạy (Android/Emulator)

Tài liệu này tổng hợp toàn bộ phần **test login** của app **Volt POS / P8D**
(`com.fastboy.volt_pos`): app có mấy màn login, màn nào tự động hóa được, các
spec hiện có cover những case gì, và **câu lệnh chạy**.

> **TL;DR** — Chạy toàn bộ test login trên emulator:
> ```powershell
> npm run test:android:emu -- --spec ./src/specs/android/staff-token-login.e2e.ts --spec ./src/specs/android/login-staff-token-form.e2e.ts
> ```
> (baseline khi chưa có token: **8 passing, 1 skipped**; nay `.env` đã set
> `STAFF_TOKEN=14ea0a94` nên case happy-path cũng chạy). Cần dev server +
> `adb reverse` chạy sẵn — xem [Điều kiện tiên quyết](#4-điều-kiện-tiên-quyết).
>
> Muốn **login 1 lần rồi các lần sau tự bỏ qua login** → xem
> [mục 6](#6-đăng-nhập-1-lần-dùng-lại-phiên-login-once-stay-logged-in)
> (`npm run android:login`).

---

## 1. Phần login của P8D có gì?

App có **2 màn đăng nhập**:

| Màn | Route | DOM hook | Tự động hóa được? |
| --- | ----- | -------- | ----------------- |
| **QR-code login** (chính) | [`/login`](../src/constants/routes.ts#L9) | Không có element có locator ổn định | ❌ Chưa — không có gì để bám selector |
| **Staff-token form** (fallback) | [`/login-staff-token`](../src/constants/routes.ts#L11) | `input[placeholder]`, `button[type=submit]` | ✅ Có — đây là màn duy nhất drive được |

Vì màn QR không có DOM hook, **toàn bộ test login hiện nay bám vào form
staff-token**. Nguồn UI thật:
`src/routes/login-staff-token/-components/staff-token-form.tsx` (ở repo app).

Form này **chưa có `data-testid`** — selector đang phải fallback vào
`placeholder` / `type`. Nếu team thêm được `data-testid` thì test sẽ bền hơn
(xem [selectors.ts:34-40](../src/constants/selectors.ts#L34-L40)).

---

## 2. Hai file spec login (chia theo mục đích)

Test login được tách làm 2 file cho rõ trách nhiệm:

### a) [`staff-token-login.e2e.ts`](../src/specs/android/staff-token-login.e2e.ts) — **kết quả AUTH**

Trả lời câu hỏi *"token này có cho vào app không?"* (cần đi qua backend).

### b) [`login-staff-token-form.e2e.ts`](../src/specs/android/login-staff-token-form.e2e.ts) — **hành vi FORM**

Trả lời câu hỏi *"cái form có hoạt động đúng không?"* — cấu trúc, nhập liệu,
validate phía client, khả năng thử lại. **Không case nào cần `STAFF_TOKEN`** nên
tất cả đều **chạy thật** (không skip).

---

## 3. Danh sách test case (đã verify trên emulator P8_Dual)

### `staff-token-login.e2e.ts` — `P8D Android — staff token login @regression`

| # | Test case | Kiểm tra | Trạng thái |
| - | --------- | -------- | ---------- |
| 1 | loads the staff-token form | Form hiện input + có chữ "Staff Token" | ✅ pass |
| 2 | cannot submit an empty staff token | Token rỗng → vẫn ở luồng login | ✅ pass |
| 3 | does not sign in with an invalid staff token | Token sai → vẫn ở luồng login | ✅ pass |
| 4 | signs in with a valid staff token and leaves the login flow | Token đúng → rời màn login | ✅ chạy khi có token — `.env` hiện set `STAFF_TOKEN=14ea0a94` (đã verify token này đăng nhập thành công, [mục 6](#6-đăng-nhập-1-lần-dùng-lại-phiên-login-once-stay-logged-in)) |

### `login-staff-token-form.e2e.ts` — `P8D Android — staff token login form @regression`

| # | Test case | Kiểm tra | Trạng thái |
| - | --------- | -------- | ---------- |
| 1 | renders the token input, submit button and Staff Token label | Input hiển thị + có nút submit + có label "Staff Token" | ✅ pass |
| 2 | starts with an empty token field on a fresh visit | Mở form mới → field rỗng, không dính giá trị cũ / autofill | ✅ pass |
| 3 | reflects a typed token in the field | Gõ token → field nhận đúng giá trị (form còn sống, không phải render chết) | ✅ pass |
| 4 | does not authenticate a whitespace-only token | Token toàn khoảng trắng → vẫn ở luồng login | ✅ pass |
| 5 | lets the operator retry after a rejected token | Sau lần nhập sai → mở lại form, nhập lại được (form không bị khóa) | ✅ pass |

**Baseline (khi `.env` chưa có token): 8 passing, 1 skipped** — case #4 file (a)
bị skip. Từ khi set `STAFF_TOKEN=14ea0a94`, case #4 **chạy thật** (không còn skip).

---

## 4. Điều kiện tiên quyết

Test login cần drive được DOM trong WebView, nên phải có (giống recipe DOM ở
[`android-emulator-setup.md`](./android-emulator-setup.md)):

1. **Emulator P8_Dual** đang chạy → `adb devices` thấy `emulator-5554  device`
   (khớp `ANDROID_UDID=emulator-5554` trong [`.env`](../.env)).
2. **Dev server P8D** đang chạy (ở repo app `D:\Project\P8D\P8D`):
   ```powershell
   $env:TAURI_DEV_HOST="127.0.0.1"; npm run dev:android
   ```
3. **Reverse port** dev-server vào emulator:
   ```powershell
   npm run android:reverse
   ```
4. App `com.fastboy.volt_pos` đã cài sẵn trên emulator.

> Thiếu bước 2–3 → form không load được UI (màn trắng) → test fail/timeout.

---

## 5. Câu lệnh chạy test login

Cờ `ANDROID_WEBVIEW_READY=1` là bắt buộc để **un-skip** các webview spec — script
`test:android:emu` đã set sẵn cờ này (xem [package.json:17](../package.json#L17)).

### Quy trình đầy đủ từ đầu (copy-paste, PowerShell)

Mỗi bước 1–3 mở ở **terminal riêng** và để chạy nền; bước 4 chạy ở terminal của repo test này.

```powershell
# 1. Boot emulator P8_Dual (terminal riêng) — bỏ qua nếu adb devices đã thấy emulator-5554
& "$env:ANDROID_HOME\emulator\emulator.exe" -avd P8_Dual -no-snapshot-load

# 2. Dev server P8D (terminal riêng, ở repo app D:\Project\P8D\P8D)
$env:TAURI_DEV_HOST="127.0.0.1"; npm run dev:android

# 3. Reverse port dev-server vào emulator (ở repo test này)
npm run android:reverse

# 4. Chạy CẢ HAI file test login
npm run test:android:emu -- --spec ./src/specs/android/staff-token-login.e2e.ts --spec ./src/specs/android/login-staff-token-form.e2e.ts
```

> Kiểm tra nhanh trước bước 4: `adb devices` phải thấy `emulator-5554  device`.

### Chạy CẢ HAI file login (khuyến nghị)

```powershell
npm run test:android:emu -- --spec ./src/specs/android/staff-token-login.e2e.ts --spec ./src/specs/android/login-staff-token-form.e2e.ts
```

### Chạy từng file riêng

```powershell
# Chỉ test kết quả auth
npm run test:android:emu -- --spec ./src/specs/android/staff-token-login.e2e.ts

# Chỉ test hành vi form
npm run test:android:emu -- --spec ./src/specs/android/login-staff-token-form.e2e.ts
```

### Chạy toàn bộ suite Android (bao gồm cả 2 file login + smoke + open-hold)

```powershell
npm run test:android:emu
```

> **Lưu ý PowerShell**: `cross-env` là package cài **local** trong
> `node_modules/.bin`, **không** gọi trực tiếp được (`cross-env : not recognized`).
> Luôn chạy qua `npm run ...` (như trên) hoặc `npx cross-env ...`.

### Bật case happy-path (đăng nhập thành công)

Case `signs in with a valid staff token` tự **skip** khi không có token thật.
Muốn nó chạy: điền token thật vào [`.env`](../.env):
```ini
STAFF_TOKEN=<staff-token-thật>
```
rồi chạy lại lệnh ở trên — không cần sửa code.

> Hiện `.env` **đã set sẵn** `STAFF_TOKEN=14ea0a94` (token này đã verify đăng nhập
> thành công — xem [mục 6](#6-đăng-nhập-1-lần-dùng-lại-phiên-login-once-stay-logged-in)),
> nên case happy-path này sẽ **chạy thật** thay vì skip.

### Kiểm tra môi trường trước khi chạy (quick check)

Chạy nhanh 2 lệnh này để chắc emulator + dev server đã sẵn sàng (tránh test
timeout vì màn trắng):

```powershell
adb devices                                                      # phải thấy: emulator-5554  device
(Invoke-WebRequest http://127.0.0.1:1420 -UseBasicParsing).StatusCode   # phải trả về 200
```

### Xem kết quả sau khi chạy

- **Screenshot** của mỗi case nằm ở `./reports/screenshots/`
  (đặt tên theo label, ví dụ `android-login-form-structure-*.png`).
- **Allure report**:
  ```powershell
  npm run report:allure     # generate + mở report trên trình duyệt
  npm run report:clean      # xoá reports + logs cũ trước khi chạy lại
  ```

### Bảng tổng hợp tất cả câu lệnh

| Mục đích | Lệnh |
| -------- | ---- |
| Boot emulator | `& "$env:ANDROID_HOME\emulator\emulator.exe" -avd P8_Dual -no-snapshot-load` |
| Dev server (repo app) | `$env:TAURI_DEV_HOST="127.0.0.1"; npm run dev:android` |
| Reverse port | `npm run android:reverse` |
| Check môi trường | `adb devices` |
| **Chạy cả 2 file login** | `npm run test:android:emu -- --spec ./src/specs/android/staff-token-login.e2e.ts --spec ./src/specs/android/login-staff-token-form.e2e.ts` |
| Chạy file auth | `npm run test:android:emu -- --spec ./src/specs/android/staff-token-login.e2e.ts` |
| Chạy file form | `npm run test:android:emu -- --spec ./src/specs/android/login-staff-token-form.e2e.ts` |
| **Login 1 lần / dùng lại phiên** | `npm run android:login` — xem [mục 6](#6-đăng-nhập-1-lần-dùng-lại-phiên-login-once-stay-logged-in) |
| Chạy toàn bộ suite Android | `npm run test:android:emu` |
| Mở Allure report | `npm run report:allure` |
| Xoá report/log cũ | `npm run report:clean` |

---

## 6. Đăng nhập 1 lần, dùng lại phiên (login once, stay logged in)

Mục tiêu: **login đúng 1 lần**, các lần chạy test sau **tự bỏ qua** bước login —
cho tới khi phiên server hết hạn thì tự login lại đúng 1 lần.

### Cơ chế

- Config Android bật `appium:noReset: true`
  ([wdio.android.conf.ts:76](../config/wdio.android.conf.ts#L76)) → Appium **không
  xóa dữ liệu app** giữa các phiên. Tauri WebView vì thế **giữ nguyên phiên auth**
  mà mutation `exchangeImpersonationToken` tạo ra — qua từng spec, từng lần
  `npm run test:android`, và cả sau khi khởi động lại.
- Guard [`ensureLoggedIn()`](../src/utils/ensure-logged-in.ts): mở app → vào `/` →
  **chỉ login khi bị đá về `/login`**; nếu đã đăng nhập thì `return` ngay (no-op).
- Vì vậy sau lần login đầu, mọi lần chạy sau đều là no-op. Khi phiên server hết
  hạn, guard **tự login lại đúng 1 lần** (self-healing) — không thao tác thủ công.

### Đã verify — 3 lần chạy liên tiếp trên emulator P8_Dual

| Run | Guard làm gì | Kết quả |
| --- | ------------ | ------- |
| 1 | phiên cũ còn sống → **skip login** | ✅ pass |
| 2 | phiên hết → **login 1 lần** với token `14ea0a94` | ✅ pass |
| 3 | phiên từ run 2 vẫn còn → **skip login** | ✅ pass (10.3s) |

Run 3 chứng minh đúng yêu cầu: app khởi động lại + phiên Appium mới vẫn **tự bỏ
qua login**. (Log tương ứng ở `logs/test-run.log`, dòng `[ensureLoggedIn]`.)

### Cách dùng

```powershell
# Chạy 1 lần để tạo phiên đăng nhập (hoặc xác nhận phiên đang có)
npm run android:login
```

Trong spec cần trạng thái "đã đăng nhập", thay phần login thủ công bằng:

```ts
import { ensureLoggedIn } from "../../utils/ensure-logged-in.js"

before(async () => {
  await ensureLoggedIn()   // tự bỏ qua nếu app đã đăng nhập
})
```

### File liên quan

| Thành phần | Nơi định nghĩa |
| ---------- | -------------- |
| Guard login-once | [`ensureLoggedIn()`](../src/utils/ensure-logged-in.ts) |
| Spec chạy 1 lần (tag `@setup`) | [`login-once.e2e.ts`](../src/specs/android/login-once.e2e.ts) |
| npm script | `android:login` — [package.json:16](../package.json#L16) |
| Token | `STAFF_TOKEN=14ea0a94` trong [.env:49](../.env#L49) |

> **"Mãi mãi" = cho tới khi phiên server hết hạn.** Phiên impersonation có thời
> hạn; khi hết, `ensureLoggedIn` tự login lại 1 lần. **Không** dùng được kiểu
> inject `localStorage` (Playwright `storageState`) ở app này, vì auth là
> cookie/session của WebView chứ không phải một key `localStorage` đơn giản.

---

## 7. Selector & Page Object dùng cho login

| Thành phần | Nơi định nghĩa |
| ---------- | -------------- |
| Selector form staff-token | [`SELECTORS.LOGIN_STAFF_TOKEN`](../src/constants/selectors.ts#L34-L40) |
| Route login | [`ROUTES.LOGIN` / `ROUTES.LOGIN_STAFF_TOKEN`](../src/constants/routes.ts#L9-L12) |
| Page Object form | [`StaffTokenLoginPage`](../src/pages/staff-token-login.page.ts) (`enterToken` / `submit` / `signIn`) |
| Chuyển vào WebView | [`AndroidAppShellPage.switchToWebview()`](../src/pages/android/app-shell.page.ts#L22) |

Selector hiện tại (chưa có `data-testid`):
```ts
INPUT:      'input[placeholder="Enter Staff Token"]'
SUBMIT_BTN: 'button[type="submit"]'
ERROR_ALERT:'[role="alert"], .destructive, .text-destructive'
```

---

## 8. Giới hạn & phần chưa cover (gap)

- **QR-code login (`/login`)**: chưa tự động hóa được vì không có DOM hook ổn
  định. Cần app thêm `data-testid` hoặc test ở tầng native/ảnh QR mới drive được.
- **Nội dung thông báo lỗi**: các spec chỉ assert *"vẫn ở luồng login"* (invariant
  an toàn), **không** assert text lỗi cụ thể — vì `ERROR_ALERT` selector còn suy
  đoán và app chưa gắn testid cho alert. Khi có testid, nên thêm case assert
  đúng message lỗi.
- **`clearValue()` trên WebView**: xóa field bằng `clearValue()` **không ăn** với
  React controlled input trong WebView Tauri (đã kiểm chứng — field giữ giá trị
  cũ). Vì vậy test chỉ verify "gõ vào nhận đúng giá trị", không verify "xóa".
  Trong thực tế mỗi case đều `browser.url(...)` mở form mới (field rỗng sẵn) nên
  không vướng hạn chế này.
- **Đăng xuất (logout)**: chưa có test. Nay đã có token thật (`14ea0a94`) +
  guard [`ensureLoggedIn()`](../src/utils/ensure-logged-in.ts) đưa được vào app
  (xem [mục 6](#6-đăng-nhập-1-lần-dùng-lại-phiên-login-once-stay-logged-in)), nên
  test logout đã khả thi — chỉ còn thiếu selector cho nút/hành động đăng xuất.

---

## 9. Tham chiếu thêm

- Setup emulator & recipe DOM đầy đủ: [`android-emulator-setup.md`](./android-emulator-setup.md)
- Tổng quan repo & conventions: [`README.md`](../README.md)
