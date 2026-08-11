# Chạy Volt POS trên emulator → vào thẳng Home tiệm 14 (khỏi login)

## Chọn nhanh: dùng lệnh nào?

| Muốn gì | Lệnh | Có build? |
|---|---|---|
| **Chạy bản MỚI NHẤT của app** (giữ session) | `powershell -ExecutionPolicy Bypass -File .\update-volt.ps1` | ✅ build rồi cài đè |
| **Mở nhanh** bản đang cài (khỏi build) | `powershell -ExecutionPolicy Bypass -File .\run-volt.ps1` | ❌ chỉ mở |

> Cả hai đều vào **thẳng Home tiệm 14, không cần login** (session đã lưu). Khác nhau: `update-volt.ps1` build code mới nhất trước khi mở (mất vài phút), `run-volt.ps1` mở luôn bản đang có.

---

## Cập nhật app lên bản mới nhất — `update-volt.ps1` (giữ session)

```powershell
powershell -ExecutionPolicy Bypass -File .\update-volt.ps1
```

**Mỗi lần chạy = build code mới nhất + cài đè + mở app, KHÔNG mất session** (không phải login/duyệt device lại). Một lệnh làm hết:
1. Boot emulator nếu chưa chạy (boot song song trong lúc build).
2. **Build APK x86_64 debug** mới nhất từ repo app (`D:\Project\P8D\P8D`) — Vite + Rust + Gradle, vài phút.
3. **`adb install -r`** (reinstall **giữ data** → giữ `credentials`/`device_id`/DB → session còn nguyên).
4. Force-stop + mở app + resize cửa sổ + in version đã cài.

**Vì sao KHÔNG dùng `p8 build` để cập nhật?** `p8 build` **`adb uninstall` trước** khi cài (để né lỗi chữ ký) → xoá sạch login/device_id/DB → **bắt login bằng Staff Token mới + duyệt device lại trên portal mỗi lần**. `update-volt.ps1` build cùng toolchain nhưng **bỏ bước uninstall**, nên session sống. Nếu install lỗi, script **không tự uninstall** (để không lỡ tay xoá session).

Tuỳ chọn:
```powershell
.\update-volt.ps1 -NoBuild            # bỏ build, chỉ cài lại APK mới nhất đã build + mở
.\update-volt.ps1 -Target aarch64     # build cho máy Kozen thật (mặc định x86_64 cho emulator)
.\update-volt.ps1 -Scale 0.5          # cửa sổ to/nhỏ (0.30 nhỏ, 0.50 lớn)
```

**Lưu ý thật:**
- Mỗi lần chạy sẽ **build lại** (vài phút) — cái giá của "luôn mới nhất". Muốn mở nhanh không build → dùng `run-volt.ps1`.
- Giữ data nghĩa là code mới **migrate DB cũ** khi khởi động (splash "Migrating…" + sync) — bình thường OK; nếu schema đổi không tương thích thì fallback `p8 build` một lần (chấp nhận login lại).
- Cần sẵn toolchain (`p8 setup --android`): NDK, MSYS2 perl, LLVM libclang.
- File phụ trợ: [build-android.mjs](build-android.mjs) (build-only, script gọi tự động).

**Đã verify end-to-end 2026-08-10:** `versionName 0.1.0 → 0.1.9`, vào thẳng Home tiệm 14, không login/approve.

---

## Mở nhanh (khỏi build) — `run-volt.ps1`

```powershell
powershell -ExecutionPolicy Bypass -File .\run-volt.ps1
```

Kết quả:
- Emulator **P8_Dual** mở lên với **cửa sổ lớn sẵn** (góc trái màn hình, ~394×881 px) — không còn cửa sổ nhỏ/đen phải kéo tay.
- App **Volt POS** vào **thẳng Home "Volt POS 14 Dev"**, **không cần nhập Staff Token** (session tiệm 14 đã lưu sẵn).
- **Không build** — mở đúng bản APK đang cài trên máy.

Muốn cửa sổ to/nhỏ hơn:
```powershell
powershell -ExecutionPolicy Bypass -File .\run-volt.ps1 -Scale 0.5   # 0.30 nhỏ hơn, 0.50 lớn hơn
```

---

## Script làm những gì (`run-volt.ps1`)

1. **Ghim cỡ cửa sổ lớn cố định** — sửa `window.scale` trong `%USERPROFILE%\.android\avd\P8_Dual.avd\emulator-user.ini` (mặc định `-1` = auto → emulator chọn cửa sổ nhỏ).
2. **Boot emulator kèm DNS** — chạy `emulator -avd P8_Dual -dns-server 8.8.8.8,8.8.4.4 -no-snapshot-load` (nếu emulator chưa chạy). AVD này hay boot với DNS chết nếu không truyền `-dns-server`.
3. **Chờ** `sys.boot_completed=1` + ~15s cho WiFi/DNS lên.
4. **Mở app** `com.fastboy.volt_pos`.
5. **Dời cửa sổ về (40,40)** bằng Win32 `MoveWindow` — vì emulator hay mở cửa sổ lòi lên trên mép màn hình.

---

## Vì sao "khỏi login"?

Session (access/refresh token + merchant_id + khóa mã hóa DB) được app lưu trong file **`credentials`** (đã mã hóa) ở thư mục riêng của app trên máy ảo. File này **sống qua restart/reboot** đến khi token bị thu hồi/hết hạn. Vì đã login tiệm 14 thành công 1 lần → mỗi lần mở app chỉ cần sync lại rồi vào Home.

`device_id` được lưu riêng trong **keyring** (không nằm trong `credentials`), nên thiết bị vẫn "được duyệt" (approved) kể cả khi xóa session.

> **Lưu ý token:** Staff Token là loại **dùng-một-lần** (single-use). Token `53ce351e` đã dùng để login tiệm 14 rồi → **không login lại được bằng nó nữa**. Không sao — vì session đã lưu, không cần token cho các lần chạy sau.

**Chỉ cần token MỚI khi mất session**, tức là khi:
- Bấm **Log out** trong app, hoặc
- Chạy **`p8 build`** (uninstall + cài lại → xóa sạch data), hoặc
- Chạy **`p8 clear`** / `adb shell pm clear com.fastboy.volt_pos` (reset device_id/login/DB), hoặc
- Token hết hạn / bị thu hồi phía server.

---

## Login lại tiệm khác (khi cần token mới)

Nút "Log out" trong app là **DEV-only** nên bản `p8 build` không hiện. Cách logout bằng adb mà **không làm mất device approval** (chỉ xóa session, giữ device_id):

```powershell
adb -s emulator-5554 shell run-as com.fastboy.volt_pos rm credentials
adb -s emulator-5554 shell am force-stop com.fastboy.volt_pos
adb -s emulator-5554 shell monkey -p com.fastboy.volt_pos -c android.intent.category.LAUNCHER 1
```

Rồi trên màn **QR login** ("Welcome back"):
1. **Tap ẩn 5 lần thật nhanh** vào icon scan ở giữa card → ra màn **"Sign in / Enter your Staff Token"**.
   (Toạ độ icon trên 1080×2400: ~`540,660` khi QR còn sống, ~`540,864` khi QR đã hết hạn — cửa sổ co lại.)
2. Nhập Staff Token mới → bấm **Sign in** → chờ "Syncing database… 100%" → Home.

> Tiệm nào hiện ra là do **Staff Token** quyết định, không phải do lệnh build. Header **"Your store / $0.00"** = store mặc định/rỗng (không phải tiệm thật).

---

## Xử lý sự cố nhanh

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| App kẹt ở **QR login** khi mở | Session đã mất | Login lại bằng token mới (mục trên) |
| **"error sending request"** khi sync | DNS emulator chết | Script đã truyền `-dns-server`; nếu vẫn lỗi, kill emulator rồi chạy lại script |
| **"Couldn't load / check your connection"** | Backend `:8080` down (chỉ ảnh hưởng luồng desktop) | Xem `memory` P8D backend :8080 |
| Sync đứng ở **403 "Waiting for device approval"** | device_id mới, chưa duyệt portal | Cần admin duyệt thiết bị trên GCI Business portal (thao tác thủ công phía backend) |
| `adb` báo **"more than one device"** | Có Kozen cắm USB cùng lúc | Luôn dùng `adb -s emulator-5554 ...` |

---

## Thông tin liên quan

- Package: `com.fastboy.volt_pos`
- AVD: `P8_Dual` — serial `emulator-5554`
- Emulator: `C:\Android\Sdk\emulator\emulator.exe`
- Repo app: `D:\Project\P8D\P8D` · Repo test: `d:\Project\P8D\WebdriverIO_P8D`
