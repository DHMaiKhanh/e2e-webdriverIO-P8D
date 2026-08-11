# Payment / Checkout — Tính năng & Test case (Volt POS / P8D)

Tài liệu này mô tả chi tiết **luồng thanh toán (Charge / tender)** của app
**Volt POS / P8D** (`com.fastboy.volt_pos`) và liệt kê **toàn bộ test case E2E** cho
4 phương thức: **Card, Cash, Gift card, Other** — trọng tâm là **Cash**,
**Gift card (thẻ `1880`)** và **Other** theo yêu cầu, cộng phần **Tip** dùng chung.

> **TL;DR**
> - Từ *Review order* → **Charge $X** → màn **Payment method** (Card / Cash / Gift card / Other).
> - **Dual pricing**: Cash & Gift card = **giá gốc**; Card & Other = **giá gốc + phí dịch vụ 10%**.
> - Mọi phương thức đều có nút **Tip** (preset % + nhập tay).
> - **Giảm giá tại Review order (trước Charge)**: *Apply Promotion/Reward* (§8.8) + **Item discount** theo từng dịch vụ % hoặc $ (§8.9). Quét thấy **Item discount trừ Total thật**, còn **Reward hiện chưa trừ tiền** (khớp AC VP-2096 chưa done).
> - **Order actions** (chi tiết đơn đã thanh toán): **Cancel order** (chọn lý do), **Reprint receipt**, **Send receipt** (Email/Text) — §8.10. **Reopen** hiện **chưa thấy** trên P8 — §8.11.
> - Tài liệu được dựng bằng cách **thao tác thật trên emulator qua Appium MCP** — xem [§0](#0-phương-pháp--phạm-vi). Bổ sung §8.8–§8.11 từ lần quét theo issue **VP-2096 (Order Flow)**.
> - **Không** case nào bấm *Accept cash / Redeem / Record payment* / *Cancel order* / *Send* hoàn tất → **không tạo giao dịch/không gửi thật**.

---

## 0. Phương pháp & phạm vi

| Hạng mục | Chi tiết |
| -------- | -------- |
| Thiết bị | Emulator `emulator-5554`, màn **1080×2400**, app `com.fastboy.volt_pos/.MainActivity` |
| Phiên | Đã đăng nhập, tiệm **Volt POS 14 Dev** (dữ liệu dev) |
| Công cụ | **Appium MCP** (UiAutomator2) — session `create`, `noReset:true`; drive bằng **screenshot + tap toạ độ** |
| Đơn dùng để quét | `#OD260803-12729529` — 1 dịch vụ `tsdas`, base **$12.22** |
| Đã đi qua | Payment method → **Card** (unavailable) → **Cash** (+ Quick cash $100) → **Gift card** (thẻ `1880`) → **Other** → **Add Tip** → **staff passcode** → **Payment complete / receipt** |
| Quét bổ sung (VP-2096) | **Apply Promotion/Reward** (Promo & Rewards) · **Item discount** (áp `$0.01` rồi gỡ) · **Order detail** đơn Paid → **Cancel order** (dialog lý do, bấm *Back*) · **Send receipt** (Share → Email) · **Reprint** · tab **Re-open** (rỗng) — xem §8.8–§8.11 |
| Đã finalize (có chủ đích) | **1 giao dịch**: Gift card `1880`, passcode `8888` → *Approved $12.22*, đơn `#OD260803-12729529` (kiểm chứng charge hoạt động) |
| **Chưa** finalize | Cash / Other / Card — dừng trước Accept/Record; đơn verify `#OD260803-14498911` bỏ dở (chưa charge) |

> **App là Tauri + WebView và KHÔNG bật WebView debugging** → Appium chỉ thấy **1 node
> `android.webkit.WebView` đục** (không có DOM/`data-testid`, `find_element` theo css
> **không** hoạt động). Vì vậy tự động hoá hiện phải drive bằng **ảnh chụp + toạ độ**;
> selector `data-testid` ở [§8](#8-selector-đề-xuất) là **đề xuất cần app bổ sung** để test bền.

---

## 1. Tổng quan luồng thanh toán

```
Review order ─► [Charge $X] ─► Payment method (SELECT METHOD)
                                   ├─ Card       $13.44   (giá gốc + phí 10%) ─► Card payment ─► ⚠️ "unavailable" trên emulator (cần Kozen P8 + BambooPay)
                                   ├─ Cash       $12.22   (giá gốc)      ─► Cash payment ─► [Accept cash] ─► SUCCESS
                                   ├─ Gift card  $12.22   (giá gốc)      ─► Redeem Gift Card ─► [Redeem] ─► SUCCESS
                                   └─ Other      $13.44   (giá gốc + phí)─► Other payment ─► [Record payment] ─► SUCCESS
                          (mỗi màn tender đều có nút [Tip] → Add Tip)
```

> **Cổng hoàn tất chung:** mọi **[Accept cash] / [Redeem] / [Record payment]** đều mở modal
> **"Enter staff code to complete payment"** (PIN **4 số** của manager/staff) → sau khi đúng mã
> → màn **"Payment complete"** (badge *Approved*) → **Send receipt** (Email / Text / Print / No receipt)
> → **+ New order**. ✅ Đã kiểm chứng end-to-end với **Gift card `1880`** (passcode `8888` → *Gift card · Approved · $12.22*).

Số liệu ví dụ lấy từ đơn `#OD260803-12729529` (base $12.22). **Tỷ lệ %, cách làm tròn
phụ thuộc cấu hình tiệm** → test nên assert giá trị **tính từ đơn**, không hard-code.

> **Trước khi Charge** (ở màn *Review order*) còn 2 cửa giảm giá: **Apply Promotion/Reward**
> (§8.8) và **Item discount** theo từng dịch vụ (§8.9) → trừ vào **Subtotal/Total**.
> **Sau khi thanh toán**, đơn nằm ở **Orders → Successful** với **Order detail** cho các
> **Order actions**: *Cancel order / Reprint receipt / Send receipt* (§8.10). *Reopen* là
> một tab trạng thái nhưng chưa thấy action trên P8 (§8.11).

---

## 2. Màn Payment method — chọn phương thức

Header: **"Payment method"** + mã đơn. Mục **SELECT METHOD**:

| Phương thức | Mô tả phụ | Số tiền (đơn mẫu) | Ghi chú giá |
| ----------- | --------- | ----------------- | ----------- |
| **Card** | Credit / debit, tap… | **$13.44** | giá gốc **+ phí 10%** |
| **Cash** | Pay with bills & coins… | **$12.22** | **giá gốc** |
| **Gift card** | Redeem stored balance… | **$12.22** | **giá gốc** |
| **Other** | Manual / external… | **$13.44** | giá gốc **+ phí 10%** |

⇒ Card/Other **cao hơn** Cash/Gift card đúng bằng phí dịch vụ 10% (xem [§7 dual pricing](#7-dual-pricing--mô-hình-tính-tiền)).

### 2.1. Card payment — yêu cầu thiết bị (không chạy được trên emulator)

Tap **Card** → màn **"Card payment"** nhưng ở trạng thái **không khả dụng**:

| Vùng | Nội dung quan sát | Ghi chú |
| ---- | ----------------- | ------- |
| Tiêu đề | **Card payment** + mã đơn | |
| Trạng thái | **"Card payment unavailable"** (icon thẻ) | không có luồng nhập/quẹt thẻ |
| Hướng dẫn | *"Connect this order to a **Kozen P8** with the **BambooPay** app to take card payments."* | cần **phần cứng Kozen P8** + app **BambooPay** ghép với đơn |
| Nút dưới | **Choose another method** | quay lại Payment method |

> **Trên emulator/simulator không có terminal Kozen P8 → Card luôn "unavailable".** Đây là
> giới hạn môi trường, không phải lỗi. Luồng nhập/tap thẻ thật chỉ kiểm thử được trên
> **thiết bị thật đã ghép Kozen P8 + BambooPay**. Test case Card ở [§8.6](#86-card-payment--card-paymente2ets)
> vì vậy chỉ cover **trạng thái unavailable** cho E2E emulator.

---

## 3. Cash payment — nhập tiền mặt

Header: **"Cash payment"** + mã đơn.

| Vùng | Element / giá trị quan sát | Ghi chú |
| ---- | -------------------------- | ------- |
| Ô nhận tiền | **CASH RECEIVED** `$0.00` | cập nhật khi bấm Quick cash / keypad |
| Bảng tính | **Subtotal** `$12.22` · **Service fee (10%)** `$1.22` · **Cash discount (10%)** `-$1.22` · **Amount due** `$12.22` · **Change due** `$0.00` (xanh) | phí bị chiết khấu triệt tiêu |
| **QUICK CASH** | **Exact** · **$100** · **$120** · **$150** | điền nhanh số tiền nhận |
| Keypad | `1..9`, `0` | nhập tay số tiền nhận |
| Nút dưới | **Tip** · **Accept cash** | Accept = hoàn tất ⚠️ (không bấm khi test scan) |

**Quan sát đã kiểm chứng:** bấm **$100** → CASH RECEIVED `$100.00`, **Change due `$87.78`**
(= `100.00 − 12.22`), nút **Accept cash** chuyển **sáng/bật**.

Công thức: **`Change due = Cash received − Amount due`** (đủ tiền mới cho Accept).

---

## 4. Gift card — Redeem (thẻ `1880`)

Header: **"Redeem Gift Card"** + mã đơn.

| Vùng | Element / giá trị quan sát | Ghi chú |
| ---- | -------------------------- | ------- |
| Bảng tính | **AMOUNT DUE** `$12.22`; Subtotal `$12.22` · Service fee (10%) `$1.22` · Cash discount (10%) `-$1.22` | giống Cash (giá gốc) |
| Ô nhập | **"Gift card code"** + nút **quét QR/scan** (icon xanh) | nhập mã hoặc quét |
| Thẻ (sau khi nhập `1880`) | Card tím **AVAILABLE BALANCE `$9,748.91`**, số ẩn **•••• •••• •••• 1880** | thẻ hợp lệ, dư > amount due |
| Áp dụng | **Amount due** `$12.22` · **Applying from gift card** `-$12.22` | trừ đúng số phải trả |
| Nút dưới | **Tip** · **Redeem $12.22** | Redeem = hoàn tất ⚠️ (không bấm khi test scan) |

**Quan sát đã kiểm chứng:** gõ `1880` vào ô code → app tự tra và hiển thị thẻ với
**số dư $9,748.91**; nút đổi thành **Redeem $12.22** và **bật**.

---

## 5. Other payment — thủ công / ngoài hệ thống

Header: **"Other payment"** + mã đơn.

| Vùng | Element / giá trị quan sát | Ghi chú |
| ---- | -------------------------- | ------- |
| Ô nhận tiền | **AMOUNT RECEIVED** `$13.44` (điền sẵn = amount due) | sửa được bằng keypad |
| Bảng tính | Subtotal `$12.22` · **Service fee (10%)** `$1.22` · **Amount due** `$13.44` · **Remaining** `$0.00` (xanh) | **KHÔNG** có cash discount → giữ phí |
| Keypad | `1..9`, **C** (clear), `0`, xoá lùi | nhập số tiền nhận |
| Nút dưới | **Tip** · **Record payment** | Record = hoàn tất ⚠️ (không bấm khi test scan) |

Công thức: **`Remaining = Amount due − Amount received`**.

---

## 6. Add Tip — dùng chung mọi phương thức

Bấm **Tip** ở Cash / Gift card / Other → màn **"Add Tip"**:

| Vùng | Element |
| ---- | ------- |
| Hiển thị | **TIP AMOUNT** `$0.00` |
| Preset % | **10% · 15% · 20% · 25% · 30% · 0%** (mặc định `0%` đang chọn) |
| Keypad | `1..9`, **C**, `0`, xoá lùi (nhập tip tuỳ ý) |
| Nút dưới | **Add tip** |

### 6.1. Hoàn tất thanh toán — Staff passcode & Send receipt (chung mọi phương thức)

Bấm **Accept cash / Redeem / Record payment** → **KHÔNG** hoàn tất ngay mà bật **modal passcode**:

| Bước | Element / quan sát | Ghi chú |
| ---- | ------------------ | ------- |
| Modal passcode | **"Enter staff code to complete payment"** — *"Ask a manager to enter their staff code."* | 4 chấm ••••, keypad `1..9`/`C`/`0`/⌫ |
| Tuỳ chọn | Checkbox **"Skip passcode for the next 30 minutes"** | bỏ hỏi mã trong 30' |
| Sau khi đúng mã | Màn **"Payment complete"** ✓ + số tiền + badge **"<method> · Approved"** | ✅ đã kiểm chứng: gift card `1880`, mã `8888` → *Gift card · Approved · $12.22* |
| Send receipt | **Email receipt** · **Text receipt** · **Print receipt** (*No printer connected* → disable) · **No receipt** (Skip sending) | chọn cách gửi biên nhận |
| Kết thúc | Nút **+ New order** | mở đơn mới |

> Passcode là **PIN staff/manager 4 số** (dev hiện dùng `8888`). Test **không hard-code** mã
> vào repo — đọc từ biến môi trường/secret. Đây là **cổng bảo mật** trước khi tạo giao dịch thật.

---

## 7. Dual pricing — mô hình tính tiền

```
Base (giá gốc dịch vụ) ......................... $12.22   ← "Subtotal"
  + Service fee 10% ............................ +$1.22
  = Giá thẻ (Card price) ....................... $13.44   ← Card / Other / "Total" ở Review
Cash / Gift card:
  Service fee +$1.22  −  Cash discount −$1.22 = 0
  ⇒ Amount due = base = ........................ $12.22   ← Cash / Gift card
```

**Kết luận cần test:**
- **Card / Other** → tính **giá có phí 10%** (`$13.44`).
- **Cash / Gift card** → phí 10% bị **triệt tiêu** bởi cash discount 10% → **giá gốc** (`$12.22`).
- **Change due** (Cash) = `Cash received − Amount due`; **Remaining** (Other) = `Amount due − Amount received`.

---

## 8. Danh sách test case

Ký hiệu: **P** = ưu tiên (P0 cao nhất). **Loại**: `@smoke` (sống còn) / `@regression`.
Tất cả **🆕** (repo chưa có spec thanh toán riêng).

> **§8.1–§8.7** = Payment method / Cash / Gift card / Other / Tip / Card / Finalize (đã có).
> **§8.8–§8.11** bổ sung theo **VP-2096 (Order Flow)** — phần còn thiếu: **Promotion & Reward**,
> **Item discount**, **Order actions (Cancel/Reprint/Send receipt)**, **Reopen & Sync**.

### 8.1. Payment method (chọn phương thức) — `payment-method.e2e.ts`

| # | Test case | Bước / Kỳ vọng | P | Loại |
| - | --------- | -------------- | - | ---- |
| PM-01 | Charge mở màn Payment method | Bấm **Charge $X** → màn "Payment method" đúng mã đơn | P0 | @smoke |
| PM-02 | Đủ 4 phương thức | Hiện **Card / Cash / Gift card / Other** kèm mô tả phụ | P0 | @smoke |
| PM-03 | Card hiển thị giá có phí | Card = **giá gốc + 10%** (vd `$13.44`) | P0 | @smoke |
| PM-04 | Cash hiển thị giá gốc | Cash = **giá gốc** (vd `$12.22`), nhỏ hơn Card | P0 | @smoke |
| PM-05 | Gift card = giá Cash | Gift card = giá gốc (= Cash) | P1 | @regression |
| PM-06 | Other = giá Card | Other = giá có phí (= Card) | P1 | @regression |
| PM-07 | Chọn phương thức mở đúng màn | Tap Cash→"Cash payment"; Gift card→"Redeem Gift Card"; Other→"Other payment" | P0 | @smoke |
| PM-08 | Back giữ nguyên đơn | Back từ Payment method → về Review/detail, đơn không đổi | P1 | @regression |

### 8.2. Cash payment — `cash-payment.e2e.ts`

| # | Test case | Bước / Kỳ vọng | P | Loại |
| - | --------- | -------------- | - | ---- |
| CASH-01 | Bảng tính đủ dòng | Hiện Subtotal, Service fee (10%), Cash discount (10%), Amount due, Change due | P0 | @smoke |
| CASH-02 | Dual pricing đúng | `Amount due = Subtotal` (phí 10% bị cash discount 10% triệt tiêu) | P0 | @smoke |
| CASH-03 | CASH RECEIVED mặc định | Vào màn → CASH RECEIVED = `$0.00`, Change due = `$0.00`, Accept cash **disable** | P1 | @regression |
| CASH-04 | Quick cash **Exact** | Bấm Exact → CASH RECEIVED = Amount due, Change due = `$0.00`, Accept **bật** | P1 | @regression |
| CASH-05 | Quick cash **$100** | CASH RECEIVED = `$100.00`, **Change due = `$87.78`** (= 100 − 12.22) | P0 | @smoke |
| CASH-06 | Quick cash **$120 / $150** | Change due = `120/150 − amount due` tương ứng | P2 | @regression |
| CASH-07 | Nhập keypad | Gõ số tiền qua keypad → CASH RECEIVED cập nhật đúng format tiền | P1 | @regression |
| CASH-08 | Thiếu tiền chặn Accept | CASH RECEIVED < Amount due → **Accept cash** disable/chặn | P0 | @regression |
| CASH-09 | Đủ tiền cho Accept | CASH RECEIVED ≥ Amount due → **Accept cash** bật | P1 | @regression |
| CASH-10 | Change due không âm | Cash received đúng bằng due → Change due = `$0.00` (không hiện số âm) | P2 | @regression |
| CASH-11 | Thêm Tip → tổng tăng | Tip $5 → Amount due (hoặc tổng) tăng theo tip, tính lại Change due | P2 | @regression |
| CASH-12 | Back giữ giỏ | Back từ Cash payment → về Payment method, đơn/giá không đổi | P1 | @regression |
| CASH-13 | Accept cash → SUCCESS ⚠️ | *(chỉ chạy trên đơn/tiệm test cô lập)* Accept → đơn chuyển **Success/Settled** | P1 | @regression |

### 8.3. Gift card — Redeem (thẻ `1880`) — `gift-card-payment.e2e.ts`

| # | Test case | Bước / Kỳ vọng | P | Loại |
| - | --------- | -------------- | - | ---- |
| GC-01 | Màn Redeem hiển thị đúng | Header "Redeem Gift Card", AMOUNT DUE = giá gốc, ô "Gift card code" + nút scan | P0 | @smoke |
| GC-02 | Nhập thẻ hợp lệ `1880` | Gõ `1880` → hiện thẻ **•••• 1880**, **AVAILABLE BALANCE `$9,748.91`** | P0 | @smoke |
| GC-03 | Áp dụng đúng số tiền | Sau khi nhận thẻ: **Applying from gift card = `-$12.22`** (= amount due) | P0 | @smoke |
| GC-04 | Nút Redeem bật + đúng số | Nút đổi thành **Redeem $12.22** và **bật** khi thẻ đủ dư | P0 | @smoke |
| GC-05 | Dual pricing (giá gốc) | AMOUNT DUE = giá gốc (`$12.22`) — có Service fee + Cash discount triệt tiêu | P1 | @regression |
| GC-06 | Mã thẻ không hợp lệ | Gõ mã sai/không tồn tại → báo lỗi/không hiện thẻ, **Redeem** vẫn disable | P1 | @regression |
| GC-07 | Thẻ dư ít hơn amount due | Nhập thẻ balance < amount due → chỉ áp phần dư / yêu cầu phương thức bù (kiểm tra hành vi) | P2 | @regression |
| GC-08 | Nút scan QR mở camera | Bấm icon scan → mở luồng quét mã thẻ | P2 | @regression |
| GC-09 | Thêm Tip trên gift card | Bấm Tip → nhập tip → tổng phải redeem tăng theo | P2 | @regression |
| GC-10 | Back giữ giỏ | Back → về Payment method, thẻ nhập dở không áp vào đơn | P1 | @regression |
| GC-11 | Redeem → hoàn tất ⚠️ | *(đơn/tiệm test cô lập)* Redeem → **modal staff code** → nhập PIN → **"Gift card · Approved"**, đơn rời Pending. ✅ **đã kiểm chứng** (mã `8888`) | P0 | @smoke |
| GC-12 | Số dư thẻ sau redeem | *Kiểm tra thận trọng:* số dư thẻ 1880 là **dữ liệu server/dùng chung** (quan sát thấy dao động do sync/hoạt động khác) → **không** assert giảm đúng `$12.22` cứng; nên assert `sau ≤ trước` hoặc verify qua giao dịch/back-end | P2 | @regression |

### 8.4. Other payment — `other-payment.e2e.ts`

| # | Test case | Bước / Kỳ vọng | P | Loại |
| - | --------- | -------------- | - | ---- |
| OTH-01 | Màn Other hiển thị đúng | Header "Other payment", AMOUNT RECEIVED điền sẵn = amount due, có Remaining | P0 | @smoke |
| OTH-02 | Dual pricing (giá có phí) | Amount due = **giá gốc + 10%** (`$13.44`), **không** có dòng Cash discount | P0 | @smoke |
| OTH-03 | Remaining tính đúng | Sửa AMOUNT RECEIVED → `Remaining = Amount due − Amount received` | P1 | @regression |
| OTH-04 | Nhận đủ → Record bật | AMOUNT RECEIVED ≥ Amount due → Remaining `$0.00`, **Record payment** bật | P1 | @regression |
| OTH-05 | Nhận thiếu | AMOUNT RECEIVED < Amount due → Remaining > 0 (kiểm tra chặn/cho phép ghi thiếu) | P1 | @regression |
| OTH-06 | Nút **C** (clear) | Bấm C → AMOUNT RECEIVED về `$0.00` | P2 | @regression |
| OTH-07 | Xoá lùi 1 ký tự | Bấm ⌫ → xoá chữ số cuối của AMOUNT RECEIVED | P2 | @regression |
| OTH-08 | Thêm Tip trên Other | Tip → tổng phải trả tăng theo tip | P2 | @regression |
| OTH-09 | Record payment → SUCCESS ⚠️ | *(đơn/tiệm test cô lập)* Record → đơn Success bằng phương thức khác | P1 | @regression |

### 8.5. Add Tip (dùng chung) — `tip.e2e.ts`

| # | Test case | Bước / Kỳ vọng | P | Loại |
| - | --------- | -------------- | - | ---- |
| TIP-01 | Mở màn Add Tip | Bấm **Tip** ở bất kỳ phương thức → màn "Add Tip", TIP AMOUNT `$0.00`, `0%` đang chọn | P0 | @smoke |
| TIP-02 | Preset % tính đúng | Chọn `20%` → TIP AMOUNT = `20% × base` (kiểm tra công thức làm tròn) | P1 | @regression |
| TIP-03 | Đủ 6 preset | Hiện **10/15/20/25/30/0%** | P2 | @regression |
| TIP-04 | Nhập tip tuỳ ý | Gõ keypad → TIP AMOUNT theo số nhập | P1 | @regression |
| TIP-05 | `0%` = không tip | Chọn `0%` → TIP AMOUNT `$0.00` | P2 | @regression |
| TIP-06 | Add tip cập nhật tổng | **Add tip** → quay lại màn tender, Amount due/tổng tăng đúng bằng tip | P1 | @regression |

### 8.6. Card payment — `card-payment.e2e.ts`

> Trên **emulator không có Kozen P8** → Card ở trạng thái **unavailable**. Các case E2E
> emulator chỉ kiểm được trạng thái này; luồng nhập/tap thẻ thật đánh dấu **📱 device-only**
> (chỉ chạy trên thiết bị thật đã ghép terminal).

| # | Test case | Bước / Kỳ vọng | P | Loại |
| - | --------- | -------------- | - | ---- |
| CARD-01 | Card hiển thị giá có phí | Payment method → Card = `$13.44` (giá gốc + 10%) | P1 | @regression |
| CARD-02 | Mở màn Card payment | Tap Card → header **"Card payment"** đúng mã đơn | P1 | @regression |
| CARD-03 | Trạng thái unavailable (emulator) | Không có terminal → hiện **"Card payment unavailable"** + hướng dẫn *Kozen P8 / BambooPay* | P0 | @smoke |
| CARD-04 | Nút **Choose another method** | Bấm → quay lại màn **Payment method** (4 phương thức), đơn không đổi | P0 | @smoke |
| CARD-05 | Không có ô nhập thẻ khi unavailable | Màn unavailable **không** hiển thị form nhập số thẻ / nút quẹt | P2 | @regression |
| CARD-06 | 📱 Ghép terminal → khả dụng | *(device-only)* Đã ghép Kozen P8 + BambooPay → Card mở luồng nhập/tap thẻ | P1 | @regression |
| CARD-07 | 📱 Thanh toán thẻ thành công | *(device-only, đơn test)* Hoàn tất qua terminal → đơn **Success/Settled** | P1 | @regression |

### 8.7. Hoàn tất & biên nhận (staff passcode + receipt) — `payment-complete.e2e.ts`

| # | Test case | Bước / Kỳ vọng | P | Loại |
| - | --------- | -------------- | - | ---- |
| FIN-01 | Bấm finalize bật modal passcode | Accept cash / Redeem / Record payment → modal **"Enter staff code to complete payment"** | P0 | @smoke |
| FIN-02 | Mã đúng → hoàn tất | Nhập PIN đúng (dev `8888`) → **"Payment complete"** + badge **"<method> · Approved"** | P0 | @smoke |
| FIN-03 | Mã sai bị từ chối | Nhập PIN sai → báo lỗi/không hoàn tất, đơn **không** chuyển Success | P1 | @regression |
| FIN-04 | Huỷ modal giữ giỏ | Đóng/Back modal passcode → về màn tender, chưa tạo giao dịch | P1 | @regression |
| FIN-05 | Skip passcode 30' | Tick **"Skip passcode for the next 30 minutes"** → lần finalize sau trong 30' không hỏi mã | P2 | @regression |
| FIN-06 | Màn Send receipt | Sau Approved hiện **Email / Text / Print / No receipt**; Print *disable* khi "No printer connected" | P1 | @regression |
| FIN-07 | No receipt kết thúc | Chọn **No receipt** → đóng luồng, quay về Orders (đơn đã Settled) | P1 | @regression |
| FIN-08 | Email/Text receipt | Nhập email/SĐT → gửi biên nhận (⚠️ gửi thật — chỉ chạy với địa chỉ test) | P2 | @regression |
| FIN-09 | New order | Bấm **+ New order** → mở luồng tạo order mới | P2 | @regression |

> ⚠️ Mọi case gắn **⚠️** (bấm Accept cash / Redeem / Record payment + nhập passcode) tạo **giao
> dịch thật** → chỉ chạy trên **đơn/tiệm test cô lập** và **tự dọn** sau khi chạy.
> Trong lần scan này **chỉ 1 giao dịch được hoàn tất có chủ đích** để kiểm chứng: **Gift card `1880`,
> passcode `8888` → Approved $12.22** (đơn `#OD260803-12729529`). Các phương thức khác chỉ dừng
> trước bước finalize.

### 8.8. Promotion & Reward (Apply Promotion/Reward) — `promotion-reward.e2e.ts`

**Tính năng & quan sát (Appium MCP):** Ở **Review order** (trước Charge) có nút **Apply Promotion/Reward**
→ mở bottom sheet **"Promo & Rewards"** (nút ✕):
- Mục **Promotions**: đơn mẫu hiện **"No promotions available"** (tiệm dev chưa cấu hình promotion).
- Mục **Rewards**: danh sách reward (quan sát 1 reward **"aahaha"**); tap để chọn → **viền xanh + ✓**;
  nút **Apply to order** từ **disable → bật**.
- ⚠️ **Bất thường:** chọn `aahaha` → **Apply to order** → sheet đóng nhưng **Total KHÔNG đổi** (`$13.44`),
  **không** xuất hiện dòng reward/discount. Trùng với **AC "Promotion, Reward & Item Discount"** đang
  **chưa tick** trong VP-2096 → **reward hiện chưa trừ tiền**. Test phải **assert reward thực sự giảm Total**
  và coi trạng thái hiện tại là **known-gap/bug**.

| # | Test case | Bước / Kỳ vọng | P | Loại |
| - | --------- | -------------- | - | ---- |
| PROMO-01 | Mở Promo & Rewards | Review order → **Apply Promotion/Reward** → sheet **"Promo & Rewards"** đúng mã đơn | P0 | @smoke |
| PROMO-02 | Không có promotion | Tiệm chưa cấu hình → mục Promotions hiện **"No promotions available"** | P1 | @regression |
| PROMO-03 | Có promotion (khi có data) | Tiệm có promotion → liệt kê promotion; chọn → **Total giảm** theo promotion | P1 | @regression |
| RWD-01 | Danh sách reward | Mục **Rewards** liệt kê reward khả dụng của tiệm | P1 | @regression |
| RWD-02 | Chọn reward | Tap reward → **✓ + viền xanh**, nút **Apply to order** **bật** | P0 | @smoke |
| RWD-03 | Bỏ chọn reward | Tap lại reward đang chọn → bỏ ✓, **Apply to order** disable lại | P2 | @regression |
| RWD-04 | ⚠️ Reward trừ tiền đúng | Apply to order → **Total giảm đúng giá trị reward** + hiện dòng reward/discount (**hiện FAIL — known gap VP-2096**) | P0 | @regression |
| RWD-05 | Đóng sheet giữ đơn | ✕ / back → về Review order, đơn/giá không đổi | P1 | @regression |

### 8.9. Item discount (giảm giá từng dịch vụ) — `item-discount.e2e.ts`

**Tính năng & quan sát:** Tap 1 **dòng dịch vụ** trong Review order → mở sheet item:
- **PRICE** (vd `$12.22`, có chevron › — sửa giá) · **Note** ("Add note") · **Apply discount** (toggle OFF) · **Save**.
- Bật **Apply discount** → sheet **"Discount"**: chuyển **% ↔ $**, ô hiển thị (`0%` / `$0.00`),
  keypad `1..9`/`.`/`0`/⌫, nút **OK**. Mode **$** nhập kiểu **cents** (gõ `1` → `$0.01`).
- **OK** → về item sheet (toggle ON + dòng discount) → **Save**.
- **✅ Đã kiểm chứng:** áp **$0.01** → line-item hiện nhãn xanh **"$0.01 off · −$0.01"**; totals thêm dòng
  **Item discount −$0.01**; **Total `$13.44 → $13.43`**; nút **Charge $13.43** cập nhật. **Reversible:** mở
  lại item → tắt toggle → Save → discount biến mất, Total trở lại. **Item discount HOẠT ĐỘNG** (khác reward).

| # | Test case | Bước / Kỳ vọng | P | Loại |
| - | --------- | -------------- | - | ---- |
| IDISC-01 | Mở item sheet | Tap dịch vụ → sheet **Price / Note / Apply discount / Save** | P0 | @smoke |
| IDISC-02 | Toggle mở Discount keypad | Bật **Apply discount** → sheet **"Discount"** (% / $, keypad, OK) | P0 | @smoke |
| IDISC-03 | Mode **%** | Chọn `%`, nhập `N` → hiển thị `N%` | P1 | @regression |
| IDISC-04 | Mode **$** | Chọn `$`, nhập cents (gõ `1` → `$0.01`) → hiển thị `$X.XX` | P1 | @regression |
| IDISC-05 | Áp discount trừ đúng | Save discount `D` → item hiện **"D off · −D"**, totals có **Item discount −D**, **Total = Subtotal − D** | P0 | @smoke |
| IDISC-06 | Charge cập nhật | Sau discount → nút **Charge** = Total mới | P1 | @regression |
| IDISC-07 | Gỡ discount | Mở lại item → tắt toggle → Save → dòng **Item discount** mất, Total về cũ | P1 | @regression |
| IDISC-08 | Discount đúng dòng | Đơn nhiều item → discount chỉ áp dòng được chỉnh, các dòng khác giữ giá | P2 | @regression |
| IDISC-09 | Sửa Price | Đổi **PRICE** trong item sheet → Save → giá dòng + Total tính lại | P2 | @regression |
| IDISC-10 | Note item | Nhập **Note** → Save → note lưu vào item | P2 | @regression |
| IDISC-11 | Discount không vượt giá | Nhập discount > giá item → chặn/clamp (không cho Total âm) | P1 | @regression |

### 8.10. Order actions — Cancel / Reprint / Send receipt (chi tiết đơn) — `order-actions.e2e.ts`

**Tính năng & quan sát:** Từ **Orders → Successful**, tap 1 đơn đã **Paid** → **Order detail**:
- Header: mã đơn + **icon Share** (Send receipt). Badge **Unsettled** (đã Paid, chưa settle/batch).
- **Order information**: **Cashier**, **Customer**. Line items nhóm theo **Store/kỹ thuật viên**.
  Totals: **Subtotal / Tax / Tip / Total paid**. **Payment details**: phương thức (vd **Cash**),
  **"Got $X"**, thời gian, badge **Successful**.
- Footer: **Cancel order** (đỏ) · **Reprint receipt**.
- **Cancel order** → dialog **"Cancel this order?"**: cảnh báo *"This voids the order and reverses its
  payment. This can't be undone."*; **chọn lý do** (radio, mặc định *Customer request*): **Customer request /
  Service issue / Incorrect order / Duplicate payment / Promotion / discount error / Staff mistake / Other**;
  nút **Back** / **Cancel order**.
- **Send receipt** (icon Share) → sheet **"Send receipt"**: **Email receipt** (Enter an email) /
  **Text receipt** (Enter a phone number). Chọn Email → dialog **"Customer email"** + nút **Send**.
  ⇒ **Khác** màn post-payment (§6.1) — ở đó Send receipt có thêm **Print** + **No receipt**.
- **Reprint receipt**: trên emulator không có máy in → không mở dialog rõ (nghi **no-op/toast**); luồng in
  thật cần máy in kết nối.

> ⚠️ **Cancel order tạo tác động thật** (void đơn + **đảo ngược payment**) và **Send** gửi email/SMS thật →
> chỉ chạy trên **đơn/tiệm test cô lập** / **địa chỉ test**.

| # | Test case | Bước / Kỳ vọng | P | Loại |
| - | --------- | -------------- | - | ---- |
| OACT-01 | Order detail đủ thông tin | Đơn Paid → hiện **Order information**, line items, **Subtotal/Tax/Tip/Total paid**, **Payment details** (method / Got / time / **Successful**) | P0 | @smoke |
| OACT-02 | Nút actions hiện đúng | Đơn **Paid/Unsettled** → có **Cancel order**, **Reprint receipt**, **Share** | P1 | @regression |
| OCAN-01 | Mở dialog Cancel | **Cancel order** → dialog **"Cancel this order?"** + cảnh báo *void/reverse payment* | P0 | @smoke |
| OCAN-02 | Danh sách lý do | Hiện **7 lý do**, mặc định **"Customer request"** | P1 | @regression |
| OCAN-03 | Back giữ đơn | **Back** → đóng dialog, đơn vẫn **Successful** (chưa void) | P0 | @smoke |
| OCAN-04 | ⚠️ Cancel → void | Chọn lý do → **Cancel order** → đơn chuyển **Canceled**, payment đảo ngược *(đơn/tiệm cô lập)* | P1 | @regression |
| ORCP-01 | Reprint receipt | Bấm **Reprint** → (có máy in) in lại; (emulator) không lỗi | P2 | @regression |
| OSND-01 | Sheet Send receipt | **Share** → **"Send receipt"** có **Email + Text** (**KHÔNG** có Print/No receipt như post-payment) | P1 | @regression |
| OSND-02 | Email input | **Email receipt** → dialog **"Customer email"** + nút **Send** (disable đến khi email hợp lệ) | P1 | @regression |
| OSND-03 | Text input | **Text receipt** → nhập SĐT + **Send** | P2 | @regression |
| OSND-04 | ⚠️ Gửi thật | Nhập địa chỉ **test** → **Send** → biên nhận gửi đi *(chỉ chạy với địa chỉ test)* | P2 | @regression |

### 8.11. Reopen & Sync (POS ↔ Portal ↔ P8) — `reopen-sync.e2e.ts`

**Reopen — gap quan sát:** Orders có tab lọc **Re-open** nhưng hiện **rỗng** ("No orders match these filters");
**không** tìm thấy nút **Reopen** trong **Order detail** của đơn đã thanh toán trên P8 (chỉ **Cancel / Reprint /
Send**). ⇒ **Cần xác nhận với dev**: Reopen có được hỗ trợ trên P8 hay chỉ POS/Portal; nếu có, entry point ở đâu.

**Sync (yêu cầu VP-2096) — integration/cross-device:** không drive được chỉ bằng Appium trên P8; cần
**POS + Portal + P8** (hoặc verify backend).

| # | Test case | Bước / Kỳ vọng | P | Loại |
| - | --------- | -------------- | - | ---- |
| REOPEN-01 | Tab Re-open | Orders → **Re-open** → list đúng đơn đã reopen (hiện rỗng ở tiệm dev) | P2 | @regression |
| REOPEN-02 | (nếu hỗ trợ) Reopen đơn | Đơn Settled/Canceled → **Reopen** → về **Pending/Open**, sửa được, vào tab Re-open *(cần dev xác nhận có action trên P8)* | P1 | @regression |
| SYNC-01 | Service sync | Đổi/thêm service ở Portal/POS → P8 thấy sau sync | P1 | @regression |
| SYNC-02 | Staff sync | Thêm/sửa staff ở Portal/POS → P8 danh sách kỹ thuật viên cập nhật | P1 | @regression |
| SYNC-03 | Promotion/Reward/Discount sync | Cấu hình ở Portal → P8 hiện trong **Promo & Rewards** | P1 | @regression |
| SYNC-04 | Order & Payment settings sync | Đổi dual pricing / phí / passcode ở Portal → P8 áp đúng | P1 | @regression |
| SYNC-05 | Order POS → P8 | Tạo đơn trên **POS** → hiện trên **P8** (đúng list/trạng thái) | P0 | @smoke |
| SYNC-06 | Order P8 → POS | Tạo/charge đơn trên **P8** → hiện trên **POS** | P0 | @smoke |

> Các case **SYNC-*** là **kiểm thử tích hợp đa thiết bị** (ngoài phạm vi Appium-P8 đơn lẻ) — cần harness
> POS/Portal hoặc kiểm tra thủ công + backend. **REOPEN-02** phụ thuộc việc dev xác nhận Reopen có trên P8.

---

## 9. Selector đề xuất (cần app bổ sung `data-testid`)

Hiện WebView **không có DOM/testid truy cập được** → tự động hoá đang phải dùng toạ độ.
Đề xuất app gắn `data-testid` để test bền:

| Màn | Khoá đề xuất | Selector đề xuất |
| --- | ------------ | ---------------- |
| Payment method | `PAY_METHOD(id)` | `[data-testid="pay-method-${id}"]` — id: `card`/`cash`/`gift-card`/`other` |
| | `METHOD_AMOUNT(id)` | `[data-testid="pay-method-amount-${id}"]` |
| Cash | `CASH_RECEIVED` | `[data-testid="cash-received"]` |
| | `QUICK_CASH(label)` | `[data-testid="quick-cash-${label}"]` (Exact/100/120/150) |
| | `KEYPAD(n)` | `[data-testid="keypad-${n}"]` |
| | `AMOUNT_DUE` / `CHANGE_DUE` | `[data-testid="amount-due"]` / `[data-testid="change-due"]` |
| | `TIP_BTN` / `ACCEPT_CASH` | `[data-testid="tip"]` / `[data-testid="accept-cash"]` |
| Gift card | `GIFT_CODE_INPUT` | `[data-testid="gift-card-code"]` |
| | `GIFT_SCAN_BTN` | `[data-testid="gift-card-scan"]` |
| | `GIFT_BALANCE` | `[data-testid="gift-card-balance"]` |
| | `REDEEM_BTN` | `[data-testid="gift-card-redeem"]` |
| Other | `AMOUNT_RECEIVED` / `REMAINING` | `[data-testid="amount-received"]` / `[data-testid="remaining"]` |
| | `CLEAR_BTN` / `RECORD_PAYMENT` | `[data-testid="keypad-clear"]` / `[data-testid="record-payment"]` |
| Tip | `TIP_PRESET(pct)` / `ADD_TIP` | `[data-testid="tip-preset-${pct}"]` / `[data-testid="add-tip"]` |
| Staff passcode | `PASSCODE_DIGIT(n)` / `SKIP_PASSCODE` | `[data-testid="staff-passcode-${n}"]` / `[data-testid="skip-passcode-30m"]` (đã có `PASSCODE_GUARD.DIGIT` trong repo) |
| Payment complete | `APPROVED_BADGE` / `RECEIPT(type)` / `NEW_ORDER` | `[data-testid="payment-approved"]` / `[data-testid="receipt-${type}"]` (email/text/print/none) / `[data-testid="new-order"]` |
| Review order | `APPLY_PROMO_REWARD` | `[data-testid="apply-promo-reward"]` |
| Promo & Rewards | `PROMO_ITEM(id)` / `REWARD_ITEM(id)` / `APPLY_TO_ORDER` | `[data-testid="promo-item-${id}"]` / `[data-testid="reward-item-${id}"]` / `[data-testid="promo-reward-apply"]` |
| Item sheet | `ITEM_PRICE` / `ITEM_NOTE` / `ITEM_DISCOUNT_TOGGLE` / `ITEM_SAVE` | `[data-testid="item-price"]` / `[data-testid="item-note"]` / `[data-testid="item-discount-toggle"]` / `[data-testid="item-save"]` |
| Discount keypad | `DISCOUNT_MODE(mode)` / `DISCOUNT_KEY(n)` / `DISCOUNT_OK` | `[data-testid="discount-mode-${mode}"]` (percent/amount) / `[data-testid="discount-key-${n}"]` / `[data-testid="discount-ok"]` |
| | `ITEM_DISCOUNT_LINE` | `[data-testid="item-discount-line"]` (dòng "Item discount −$X" ở totals) |
| Order detail | `ORDER_SHARE` / `CANCEL_ORDER` / `REPRINT_RECEIPT` | `[data-testid="order-share"]` / `[data-testid="cancel-order"]` / `[data-testid="reprint-receipt"]` |
| Cancel dialog | `CANCEL_REASON(key)` / `CANCEL_CONFIRM` / `CANCEL_BACK` | `[data-testid="cancel-reason-${key}"]` (customer-request/service-issue/…) / `[data-testid="cancel-confirm"]` / `[data-testid="cancel-back"]` |
| Send receipt (detail) | `SEND_RECEIPT(type)` / `RECEIPT_INPUT` / `RECEIPT_SEND` | `[data-testid="send-receipt-${type}"]` (email/text) / `[data-testid="receipt-input"]` / `[data-testid="receipt-send"]` |
| Orders list | `STATUS_TAB(key)` | `[data-testid="orders-status-${key}"]` (all/pending/re-open/successful/canceled) |

> Đã tồn tại: `[data-testid="customer-pay-by-${methodId}"]` cho **customer display** —
> xem [`selectors.ts`](../src/constants/selectors.ts) và [`CustomerDisplayPage`](../src/pages/customer-display.page.ts).

---

## 10. Lưu ý khi tự động hoá

- **Finalize cần staff passcode.** Accept cash / Redeem / Record payment **không** hoàn tất ngay
  mà mở modal **"Enter staff code"** (PIN 4 số; dev `8888`) → mới tạo giao dịch thật. Test đọc mã
  từ env/secret, **không** hard-code vào repo.
- **Số dư gift card là dữ liệu server/dùng chung.** Khi kiểm chứng thực tế, số dư thẻ `1880`
  **dao động không theo đúng −$12.22** (quan sát tăng do sync/hoạt động khác) → **đừng** assert
  số dư giảm chính xác; xác nhận thành công qua badge **"Approved"** + trạng thái đơn (Settled),
  hoặc kiểm tra ở back-end.
- **Đơn nháp phát sinh:** vào *Review order* đã tạo đơn **Open/"In Use"** (vd `#OD260803-12729529`,
  `#OD260803-14498911`) trước cả khi Charge → test tạo order sẽ để lại đơn nháp; nên dọn sau khi chạy.
- **Dual pricing phụ thuộc cấu hình tiệm** (tỷ lệ %, làm tròn): assert theo giá trị *tính
  từ đơn* thay vì hard-code `10%`/`$1.22`/`$13.44`.
- **WebView không debug được** → chưa dùng được selector DOM; hoặc app bật
  `setWebContentsDebuggingEnabled(true)` để chromedriver đọc DOM, hoặc test drive bằng
  ảnh + toạ độ (kém bền).
- **Phiên đăng nhập dùng chung / token 1 lần** (memory dự án): tái dùng phiên, **không**
  đăng nhập lại giữa chừng.
- **Reward chưa trừ tiền (known gap VP-2096).** Chọn reward + *Apply to order* → **Total không đổi**,
  không có dòng discount → đúng với AC "Promotion/Reward/Item Discount" **chưa done**. Đừng viết test
  cho là pass mặc định; assert reward **thực sự** giảm Total và đánh dấu là known-fail đến khi dev fix.
- **Item discount thì hoạt động.** Đã kiểm chứng trừ đúng vào Total (`$13.44 → $13.43` với `$0.01`) +
  hiện nhãn "**X off · −X**" và dòng "**Item discount**"; **reversible** (tắt toggle → Save). Assert theo
  **giá trị tính từ đơn**, hỗ trợ cả **%** và **$** (mode $ nhập cents).
- **Cancel order là thao tác không thể hoàn tác** — *"voids the order and reverses its payment"* — và
  **bắt chọn lý do** (7 mục). Chỉ chạy case ⚠️ trên **đơn/tiệm test cô lập**; case an toàn dừng ở **Back**.
- **2 luồng Send receipt khác nhau:** (a) **post-payment** (§6.1) = Email/Text/**Print**/**No receipt**;
  (b) **order detail** (§8.10, icon Share) = **chỉ Email/Text**. Test đúng luồng theo ngữ cảnh.
- **Reopen chưa thấy trên P8.** Có tab lọc *Re-open* (đang rỗng) nhưng order detail **không** có nút Reopen
  → xác nhận với dev trước khi viết REOPEN-02 (có thể là POS/Portal-only).
- **Sync là test đa thiết bị** (POS ↔ Portal ↔ P8) — không tự động hoá được chỉ trên P8; cần harness riêng
  hoặc verify thủ công/backend (SYNC-01…06).

---

## 11. Tham chiếu

- Tổng quan tính năng Order + test case rộng hơn: [`order-test-cases.md`](./order-test-cases.md)
- Luồng tạo order (Select Staff → Add service → Review): [`order-test-cases.md` §2.3](./order-test-cases.md)
- Selector/Route hiện có: [`selectors.ts`](../src/constants/selectors.ts) · [`routes.ts`](../src/constants/routes.ts)
