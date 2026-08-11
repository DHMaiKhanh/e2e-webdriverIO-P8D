# RUN — E2E Test Dashboard

Câu lệnh chạy **dashboard React** hiển thị kết quả test (pass/fail/broken/skip,
tỉ lệ pass, tổng hợp theo tính năng, nguyên nhân lỗi). App nằm ở folder
[`dashboard/`](dashboard/).

> Chạy các lệnh trong **PowerShell**, từ thư mục gốc repo `WebdriverIO_P8D`.

---

## 1. Cài đặt (chỉ lần đầu)

```powershell
cd dashboard
npm install
```

## 2. Mở dashboard

```powershell
cd dashboard
npm run dev
```

- Tự đọc `reports/allure-results` → sinh `public/results.json` → mở
  **http://localhost:5188** trên trình duyệt.
- Dừng server: `Ctrl + C`.

---

## 3. Quy trình đầy đủ: chạy test → xem kết quả

```powershell
# (a) chạy bộ test — chọn 1 lệnh phù hợp (từ thư mục gốc repo)
npm run test                # mặc định (local)
npm run test:android:emu    # Android emulator
npm run test:smoke          # chỉ @smoke

# (b) sinh lại dữ liệu cho dashboard rồi mở
cd dashboard
npm run data                # reports/allure-results  ->  public/results.json
npm run dev                 # mở dashboard
```

Nếu dashboard **đang mở sẵn**: sau khi chạy `npm run data`, chỉ cần bấm nút
**↻ Làm mới** trên trang (không cần khởi động lại server).

> `npm run dev` đã tự chạy `data` trước khi mở, nên nếu chưa mở lần nào bạn có
> thể bỏ bước `npm run data` và chạy thẳng `npm run dev`.

### Gộp thành 1 lệnh (chạy từ thư mục gốc repo)

```powershell
# xoá kết quả cũ -> chạy test -> mở dashboard (đã tự sinh data)
Remove-Item -Recurse -Force reports\allure-results -ErrorAction SilentlyContinue; npm run test:android:emu; cd dashboard; npm run dev
```

Đổi `npm run test:android:emu` thành lệnh test bạn cần (`npm run test`,
`npm run test:smoke`, …).

> ⚠️ **Luôn chạy từ thư mục gốc `WebdriverIO_P8D`**, KHÔNG chạy trong `dashboard/`.
> `dashboard/package.json` không có script test — sẽ báo `Missing script: "test"`.

---

## 3b. Chuẩn bị trước khi chạy test Android (bắt buộc)

Config WDIO tự bật một Appium server riêng ở cổng **4723** (hook `onPrepare`).
Nếu cổng 4723 đang bị chiếm sẵn (Appium zombie từ lần chạy trước, hoặc MCP server
`appium-mcp`), Appium của WDIO không start được → **toàn bộ specs false-fail**
với `EADDRINUSE` / `ECONNREFUSED` (KHÔNG phải test lỗi thật).

**Trước mỗi lần chạy lại**, dọn zombie Appium + giải phóng cổng 4723 (an toàn kể
cả khi không có gì để kill):

```powershell
# giải phóng cổng 4723 + kill mọi tiến trình node ...appium còn sót
Get-NetTCPConnection -LocalPort 4723 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'appium' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
```

Kiểm tra nhanh trước khi chạy:

```powershell
adb devices                                   # phải thấy: emulator-5554  device
Get-NetTCPConnection -LocalPort 4723 -EA SilentlyContinue   # không ra gì = cổng trống
```

> Nếu lỗi 4723 cứ lặp lại: thủ phạm thường là MCP server **`appium-mcp`** (nó cũng
> bind Appium lên 4723). Tắt `appium-mcp` trong lúc chạy bộ WDIO để hai bên không
> tranh cổng.

### Gộp thành 1 lệnh có kèm dọn cổng (Android)

```powershell
Get-NetTCPConnection -LocalPort 4723 -State Listen -EA SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -EA SilentlyContinue }; Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'appium' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -EA SilentlyContinue }; Remove-Item -Recurse -Force reports\allure-results -EA SilentlyContinue; npm run test:android:emu; cd dashboard; npm run dev
```

---

## 4. Các lệnh trong `dashboard/`

| Lệnh | Tác dụng |
|------|----------|
| `npm run dev` | Sinh data + mở dashboard ở chế độ dev (http://localhost:5188) |
| `npm run data` | Chỉ đọc lại `reports/allure-results` và ghi `public/results.json` |
| `npm run build` | Build tĩnh ra `dist/` (deploy lên host tĩnh bất kỳ) |
| `npm run preview` | Xem thử bản build tĩnh trong `dist/` |

---

## 5. Xem đúng số của **một lần chạy sạch**

Allure gộp nhiều lần chạy nên dashboard mặc định hiển thị *trạng thái mới nhất của
mỗi test*. Muốn số của đúng 1 lần chạy:

```powershell
# xoá kết quả cũ TRƯỚC khi chạy test
Remove-Item -Recurse -Force reports\allure-results -ErrorAction SilentlyContinue

# chạy test (ví dụ)
npm run test:android:emu

# sinh lại data
cd dashboard; npm run data
```

---

## 6. Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|-----------|-----------|
| Dashboard báo *"Không đọc được results.json"* | Chạy `npm run data` trong `dashboard/` |
| Dashboard trống / 0 test | Chưa có `reports/allure-results` — chạy test trước |
| Port 5188 bận | `npm run dev -- --port 5199` |
| Số liệu cũ | Bấm **↻ Làm mới**, hoặc chạy lại `npm run data` |
| Test Android **toàn fail** `EADDRINUSE` / `ECONNREFUSED` `127.0.0.1:4723` | Appium zombie giữ cổng 4723 — chạy đoạn dọn cổng ở [mục 3b](#3b-chuẩn-bị-trước-khi-chạy-test-android-bắt-buộc) trước khi run lại |
| `npm error Missing script: "test"` | Đang đứng trong `dashboard/` — `cd` về thư mục gốc repo rồi chạy `npm run …` |
