# Order History — Tính năng & Test case (Volt POS / P8D, Android/Emulator)

Tài liệu này mô tả **tính năng Order History (lịch sử đơn hàng)** của app
**Volt POS / P8D** (`com.fastboy.volt_pos`) và đề xuất bộ **test case E2E** cho nó.

> **TL;DR**
> - "Order History" trong app **không phải 1 màn duy nhất** mà là **3 bề mặt**:
>   1. **Danh sách Orders toàn tiệm** (tab **Orders** ở nav dưới / thẻ *Orders* ở Home)
>      — lọc theo **ngày**, **trạng thái**, **bộ lọc nâng cao** (staff/payment), **tìm kiếm**.
>   2. **Order detail / biên lai** của đơn đã hoàn tất — xem lại thông tin thanh toán,
>      giao dịch, tip; hành động **Send receipt / Reprint receipt / Cancel order**.
>   3. **Lịch sử đơn theo khách** (Customer › tab **Orders**) — mọi đơn của 1 khách,
>      **không giới hạn theo ngày**.
> - Tài liệu dựng bằng cách **quét trực tiếp emulator** (`emulator-5554`, tiệm
>   *Volt POS 14 Dev*) qua **Appium MCP** — lần này **kết nối được**: dùng context
>   `WEBVIEW_com.fastboy.volt_pos` để bật cây accessibility → đọc được **text + toạ độ**
>   từng element (xem [phần phương pháp](#0-phương-pháp--phạm-vi-quét)).
> - **Repo hiện chưa có page object / spec nào cho Order History.** Các test case ở
>   [mục 4](#4-danh-sách-test-case-đề-xuất) là **đề xuất** (🆕). Đây là tài liệu **bổ sung**
>   cho [`order-test-cases.md`](./order-test-cases.md) (đó tập trung *tạo/sửa/checkout*;
>   tài liệu này tập trung *duyệt/tìm/xem lại* đơn cũ).

---

## 0. Phương pháp & phạm vi quét

| Hạng mục | Chi tiết |
| -------- | -------- |
| Thiết bị | Emulator `emulator-5554`, màn 1080×2400, app `com.fastboy.volt_pos/.MainActivity` |
| Phiên | Đã đăng nhập sẵn, tiệm **Volt POS 14 Dev** (dữ liệu dev đầy đơn test) |
| Công cụ | **Appium MCP** (UiAutomator2). Session tạo với `noReset:true` (không xoá phiên login) |
| Kỹ thuật đọc DOM | Switch context sang `WEBVIEW_com.fastboy.volt_pos` **một lần** → bật a11y bridge → `page source` trả về cây có **text + `bounds`** thực (device px). Thao tác (tap/scroll) chạy ở **`NATIVE_APP`** với toạ độ device px. |
| Đã đi qua | Home → Orders list (Pending & Successful-Unsettled) → Filter sheet → Search → Date picker → Order detail (đơn *Unsettled*) → Customers → Customer profile (tab Orders / History) |
| **Chưa** thực hiện | **Không** bấm *Cancel order* / *Reprint* / *Send receipt* / *Apply* filter thật → **không tạo/không sửa/không huỷ giao dịch nào** (chỉ đọc) |

> App là **Tauri + WebView**: cây native chỉ có 1 node `android.webkit.WebView`.
> Sau khi switch sang WebView context thì các node con hiện ra dưới dạng
> `android.widget.*` với **text = nhãn accessibility** (vd cả 1 order card gộp thành
> 1 `Button` với text `"#OD… Walk-in · … Pending … $X"`). Đa số element **chưa có
> `data-testid`** → selector đề xuất ở [mục 5](#5-selector--route-cần-bổ-sung) vẫn nên
> đi kèm việc app gắn testid để test bền. (Đối chiếu memory *P8D WebView IS debuggable*.)

---

## 1. "Order History" là gì? (bức tranh tổng thể)

```
                         ┌───────────────────── Bề mặt 1: DANH SÁCH TOÀN TIỆM ─────────────────────┐
 Home ─► [Orders] (nav / thẻ) ─► Orders list
                                   ├─ Điều hướng NGÀY  ‹ | 📅 Today · Aug 11 | ›  (mở Date picker)
                                   ├─ Tab TRẠNG THÁI  All / Pending / Re-open / Successful-Unsettled / Successful-Settled
                                   ├─ 🔍 Search (order # hoặc customer)
                                   ├─ ⿻ Filter (Sort by · Staff · Payment method)
                                   └─ (chạm 1 đơn) ──────────────┐
                                                                 ▼
                         ┌───────────────────── Bề mặt 2: ORDER DETAIL / BIÊN LAI ─────────────────┐
                          Order detail (đơn đã hoàn tất = "receipt")
                            ├─ Order information (Cashier / Customer)
                            ├─ Nhóm technician + dòng dịch vụ + giá
                            ├─ Subtotal / Tip / Total paid
                            ├─ Tip breakdown theo technician
                            ├─ Payment details (Card/Cash… + brand ··last4 + status)
                            ├─ Transaction (brand, Transaction ID, Date & time)
                            └─ Hành động: Send receipt · Reprint receipt · Cancel order

                         ┌───────────────────── Bề mặt 3: LỊCH SỬ ĐƠN THEO KHÁCH ──────────────────┐
 Home ─► [Customers] ─► Find Customer ─► (chạm 1 khách) ─► Customer profile
                                                             ├─ Stats: Points / Visits / Lifetime / Last visit
                                                             └─ Tabs:  [Orders]  Rewards  History
                                                                        │        (loyalty) (lịch hẹn)
                                                                        └─ list mọi đơn của khách (mọi ngày) ─► Order detail
```

### Điểm vào (entry points)

| Điểm vào | Vị trí | Dẫn tới |
| -------- | ------ | ------- |
| **Orders** (thẻ) | Home › "Orders — View & filter orders" | Orders list |
| **Orders** (tab) | Thanh nav dưới cùng | Orders list |
| **Customers** (thẻ) | Home › "Customers — Profiles & history" | Find Customer → profile → tab Orders |

---

## 2. Các màn hình (screen-by-screen)

### 2.1. Orders list — danh sách & bộ lọc

Header: tiêu đề **"Orders"** + nút **Search orders** (kính lúp) + nút **Filter orders** (phễu).

| Vùng | Element (nhãn a11y quan sát được) | Ghi chú |
| ---- | --------------------------------- | ------- |
| Điều hướng ngày | `Previous day` ‹ · **`Today · Aug 11`** (mở date picker) · `Next day` › | `Next day` **disabled** khi đang ở ngày mới nhất (hôm nay) |
| Tab trạng thái | `All` · `Pending` · `Re-open` · `Successful - Unsettled` · `Successful - Settled` | Cuộn ngang; tab đang chọn nền đen. Xem [mục 3](#3-trạng-thái-đơn-order-status) |
| Nút Search | `Search orders` → ô "**Search order # or customer**" | Mở ô tìm kiếm; icon đổi thành **Close search** (✕) |
| Nút Filter | `Filter orders` → bottom sheet **Filter** | Bộ lọc nâng cao — xem [2.2](#22-filter-sheet--bộ-lọc-nâng-cao) |
| Order card | 1 `Button` gộp: **mã đơn**, **khách** (`Walk-in · <tên>`), **badge trạng thái**, **danh sách dịch vụ** (`… +N more`), **thời gian**, **tổng tiền** | Chạm để mở chi tiết |

**Giải phẫu 1 order card** (ví dụ thật quan sát được):

```
#OD260811-32637619   Walk-in · Amelia            [Pending]
123abc, 123abc +24 more
🕓 08/11/2026 04:03 PM                            $2,000.48
```

- **Mã đơn**: `#OD` + `YYMMDD` + `-` + 8 chữ số (vd `#OD260811-32637619` = 2026-08-11).
- **Badge trạng thái** trên card: `Pending` · `In Use · <device>` · `Unsettled` (tuỳ tab/đơn).
  - `In Use · TEST-POS-2`, `In Use · K1352`, `In Use · ThomasK1352` = đơn **đang mở/khoá trên 1 máy POS khác** (cơ chế chống sửa đồng thời).
- **Thời gian** định dạng `MM/DD/YYYY hh:mm AM/PM`. Đơn *Success* có icon ✓ xanh; đơn *Pending/In Use* có icon 🕓.
- **Tổng tiền** định dạng `$#,##0.00`.

### 2.2. Filter sheet — bộ lọc nâng cao

Bottom sheet **"Filter"** + nút **Clear all** (góc phải) + nút **Apply** (dưới cùng).

| Nhóm | Kiểu | Giá trị quan sát được |
| ---- | ---- | --------------------- |
| **SORT BY** | radio (chọn 1) | **Date completed** (mặc định) · **Last updated** |
| **STAFF** | ô *Search staff* + **checkbox nhiều** | Amelia, Isabella, Luna, Sophia, Olivia2, Thong, Lizzie Wade, Erin, Lami, … |
| **PAYMENT METHOD** | **checkbox nhiều** | **Card · Cash · Gift Card · Other** |

### 2.3. Search — tìm kiếm

- Ô nhập **"Search order # or customer"** (tìm theo **mã đơn** *hoặc* **khách**).
- Khi mở search, layout đẩy xuống: ô search ở trên, rồi date nav + tab trạng thái + list.
- Nút góc phải đổi thành **Close search** (✕) để đóng.

### 2.4. Date picker — chọn ngày

Bottom sheet **"Select date"**:

| Vùng | Element | Ghi chú |
| ---- | ------- | ------- |
| Preset nhanh | **Today** (chọn sẵn) · **Yesterday** · **Last 7 days** · … | Cuộn ngang (còn preset khác bên phải) |
| Lịch tháng | `‹` **August 2026** `›` + lưới ngày | Ngày **tương lai bị disable** (mờ); hôm nay tô xanh |
| Dòng tóm tắt | *"Showing orders for Tue, Aug 11, 2026"* | Cập nhật theo ngày đang chọn |
| Nút | **View orders** | Áp dụng ngày → đóng sheet, nạp lại list |

### 2.5. Order detail / biên lai (đơn đã hoàn tất)

Header: nút **Back**, **mã đơn**, nút **Send receipt** (icon share góc phải).

| Khối | Nội dung quan sát được (đơn `#OD260811-32683488`) |
| ---- | ------------------------------------------------- |
| Tóm tắt | **`Aug 11, 2026 · 4:05 PM`** · `Walk-in · Hiha1` · badge **`Unsettled`** |
| **Order information** | **Cashier**: `Merri` · **Customer**: `Walk-in` |
| Nhóm technician | avatar `HI` · **`Hiha1 · 2 services`** · `$92.40` |
| Dòng dịch vụ | `Signature Deluxe Pedicure  $46.20` (×2) |
| Tổng tiền | **Subtotal** `$92.40` · **Tip** `$0.40` · **Total paid** `$92.80` |
| **Tip** (breakdown) | `Hiha1  $0.40` (tip quy theo technician) |
| **Payment details** | `Card  $92.80` · `Visa ··0043` · `Aug 11, 2026 · 4:04 PM` · badge **`Successful`** |
| **Transaction** | **Card**: `Visa ···· 0043` · **Transaction ID**: `4DD1-A574-D603` · **Date & time**: `Aug 11, 2026 · 4:04 PM` |
| Hành động (dưới) | **Cancel order** (đỏ) · **Reprint receipt** · (header) **Send receipt** |

> Với đơn **Open/In Use** (chưa thanh toán) thì màn detail là *ticket có nút Charge*
> (xem [`order-test-cases.md` §2.2](./order-test-cases.md)); tài liệu này mô tả **detail của
> đơn đã hoàn tất** = biên lai chỉ-đọc + hành động hậu-bán (Cancel/Reprint/Send receipt).

### 2.6. Lịch sử đơn theo khách (Customer profile)

Từ **Home › Customers › (chọn khách)**:

- **Find Customer**: ô *Search name or phone* + list khách (tên, SĐT che `•••-•••-2052`, **điểm**).
- **Customer profile**:
  - Header: Back · "Customer" · **Edit customer** (bút chì).
  - Stats: **Points** (`18810`) · **Visits** (`6`) · **Lifetime** (`$726.69`) · **Last visit** (`May 22`).
  - **Tabs**: **Orders** (mặc định) · **Rewards** · **History**.
    - **Orders** = *lịch sử đơn của khách* (mọi ngày): mỗi dòng `<ngày> · <mã đơn> · <tổng>`
      (vd `May 22, 2026 · #OD260522-24196587 · $52.42`). Chạm → mở Order detail.
    - **Rewards** = ưu đãi/điểm khả dụng (ngoài phạm vi tài liệu này).
    - **History** = **lịch sử lịch hẹn** (vd `May 20, 2026 · 2:15 PM · Acrylic Refill · Luna · Confirmed`) — *không phải* order.
  - Nút dưới: **Redeem** · **Add to order**.

---

## 3. Trạng thái đơn (order status)

Quan sát trực tiếp từ **tab lọc** và **badge trên card/detail**:

| Trạng thái | Tab lọc | Badge card | Ý nghĩa |
| ---------- | :-----: | ---------- | ------- |
| Pending | ✅ `Pending` | `Pending` | Đơn nháp/chưa thanh toán, chưa bị khoá máy khác |
| Đang mở trên máy khác | *(nằm trong Pending)* | `In Use · <device>` | Đơn đang được thao tác/khoá trên 1 POS khác (vd `TEST-POS-2`, `K1352`) |
| Re-open | ✅ `Re-open` | — | Đơn đã hoàn tất được **mở lại** để chỉnh |
| Thành công, chưa chốt sổ | ✅ `Successful - Unsettled` | `Unsettled` | Đã thanh toán nhưng **chưa settle/batch** |
| Thành công, đã chốt sổ | ✅ `Successful - Settled` | *(Settled)* | Đã thanh toán **và** đã settle |
| Đã huỷ | *(chưa quan sát được tab riêng)* | *(chưa quan sát)* | Sinh ra khi bấm **Cancel order** — cần xác nhận thêm |

> ⚠️ Danh sách trạng thái/tab ở trên là **quan sát trực tiếp trên tiệm dev 14** ngày
> 2026-08-11. "Cancelled/Void/Refund" **chưa** thấy tab/badge tương ứng → test nên đọc
> tập trạng thái từ nguồn dữ liệu/cấu hình app, **không hard-code** 5 giá trị này.

---

## 4. Danh sách test case đề xuất

Ký hiệu: **P** = độ ưu tiên (P0 cao nhất). **Loại**: `@smoke` (luồng sống còn) /
`@regression`. Trạng thái **🆕** = chưa có spec, đề xuất mới.

### 4.1. Orders list — hiển thị & duyệt — `order-history-list.e2e.ts`

| # | Test case | Kiểm tra | P | Loại |
| - | --------- | -------- | - | ---- |
| 1 | Mở Orders hiển thị danh sách | Có tiêu đề "Orders", nút Search + Filter, dải tab trạng thái, ≥0 card | P0 | @smoke |
| 2 | Mỗi order card đủ trường | Mã `#OD…`, khách `Walk-in · <tên>`, badge trạng thái, dịch vụ (`… +N more`), thời gian, tổng tiền | P1 | @regression |
| 3 | Định dạng mã đơn | Mã khớp regex `#OD\d{6}-\d{8}`, phần `YYMMDD` = ngày đang lọc | P2 | @regression |
| 4 | Định dạng tiền & thời gian | Tổng tiền `$#,##0.00`; thời gian `MM/DD/YYYY hh:mm AM/PM` | P2 | @regression |
| 5 | Chạm 1 đơn mở đúng detail | Tap card → Order detail có **đúng mã đơn** đã chạm | P0 | @smoke |
| 6 | Cuộn danh sách nạp thêm | Cuộn xuống → hiện thêm card, không lỗi/không trùng | P2 | @regression |
| 7 | Trạng thái rỗng | Ngày/bộ lọc không có đơn → empty state, không lỗi | P1 | @regression |

### 4.2. Lọc theo trạng thái (tab) — `order-history-status.e2e.ts`

| # | Test case | Kiểm tra | P | Loại |
| - | --------- | -------- | - | ---- |
| 1 | Đủ tab trạng thái | Thấy `All / Pending / Re-open / Successful - Unsettled / Successful - Settled` | P0 | @smoke |
| 2 | Chọn **Pending** | Mọi card có badge *Pending* hoặc *In Use · …* | P1 | @regression |
| 3 | Chọn **Successful - Unsettled** | Mọi card badge *Unsettled* + icon ✓ xanh | P1 | @regression |
| 4 | Chọn **Successful - Settled** | Danh sách đổi sang đơn đã settle | P1 | @regression |
| 5 | Chọn **Re-open** | Chỉ còn đơn đã mở lại | P2 | @regression |
| 6 | Chọn **All** | Gộp mọi trạng thái trong ngày | P1 | @regression |
| 7 | Tab đang chọn được đánh dấu | Tab active nền đen; đổi tab → active chuyển đúng | P2 | @regression |
| 8 | Badge **In Use · \<device\>** | Đơn đang mở máy khác hiển thị tên device, và (kỳ vọng) mở ra ở chế độ khoá/không cho sửa | P1 | @regression |

### 4.3. Điều hướng ngày & Date picker — `order-history-date.e2e.ts`

| # | Test case | Kiểm tra | P | Loại |
| - | --------- | -------- | - | ---- |
| 1 | Nhãn ngày mặc định | Mở list → nhãn `Today · <MMM d>` = hôm nay | P1 | @regression |
| 2 | Lùi ngày (‹) | Bấm *Previous day* → nhãn lùi 1 ngày, list nạp lại theo ngày | P1 | @regression |
| 3 | **Next day** bị chặn ở hôm nay | Ở hôm nay, nút *Next day* **disabled** (không đi tương lai) | P1 | @regression |
| 4 | Mở Date picker | Bấm nhãn ngày → sheet "Select date" (preset + lịch tháng) | P0 | @smoke |
| 5 | Preset **Yesterday** | Chọn Yesterday → dòng "Showing orders for …" = hôm qua | P1 | @regression |
| 6 | Preset **Last 7 days** | Chọn → list gộp 7 ngày gần nhất | P2 | @regression |
| 7 | Ngày tương lai bị disable | Trong lịch, ngày > hôm nay không bấm được | P1 | @regression |
| 8 | **View orders** áp dụng ngày | Chọn ngày quá khứ có đơn → View orders → list đúng ngày đó | P0 | @smoke |

### 4.4. Bộ lọc nâng cao (Filter sheet) — `order-history-filter.e2e.ts`

| # | Test case | Kiểm tra | P | Loại |
| - | --------- | -------- | - | ---- |
| 1 | Mở Filter sheet | Bấm *Filter orders* → sheet có SORT BY / STAFF / PAYMENT METHOD / Apply / Clear all | P0 | @smoke |
| 2 | Sort **Date completed** vs **Last updated** | Đổi radio → thứ tự list đổi tương ứng | P1 | @regression |
| 3 | Lọc theo **1 staff** | Tick 1 nhân viên → chỉ còn đơn có nhân viên đó | P1 | @regression |
| 4 | Lọc **nhiều staff** | Tick ≥2 → list là hợp của các nhân viên (OR) | P2 | @regression |
| 5 | Tìm staff trong ô search | Gõ tên vào *Search staff* → danh sách nhân viên lọc còn khớp | P2 | @regression |
| 6 | Lọc **Payment method** | Tick *Card* → chỉ còn đơn thanh toán Card (tương tự Cash/Gift Card/Other) | P1 | @regression |
| 7 | Kết hợp Staff + Payment | Tick staff + payment → list thoả **cả hai** điều kiện | P1 | @regression |
| 8 | **Apply** áp dụng bộ lọc | Bấm Apply → sheet đóng, list phản ánh bộ lọc | P0 | @smoke |
| 9 | **Clear all** xoá bộ lọc | Bấm Clear all → mọi lựa chọn bỏ chọn, list về mặc định | P1 | @regression |

### 4.5. Tìm kiếm — `order-history-search.e2e.ts`

| # | Test case | Kiểm tra | P | Loại |
| - | --------- | -------- | - | ---- |
| 1 | Mở/đóng ô search | Bấm Search → hiện ô "Search order # or customer"; bấm Close → ẩn | P1 | @regression |
| 2 | Tìm theo **mã đơn** | Gõ 1 phần mã `#OD…` → chỉ còn đơn khớp | P0 | @smoke |
| 3 | Tìm theo **tên khách** | Gõ tên khách → chỉ còn đơn của khách đó | P1 | @regression |
| 4 | Không kết quả | Gõ chuỗi vô nghĩa → empty state, không lỗi | P2 | @regression |
| 5 | Xoá query khôi phục list | Xoá chữ trong ô → list trở lại như trước khi search | P2 | @regression |

### 4.6. Order detail / biên lai (đơn đã hoàn tất) — `order-history-detail.e2e.ts`

| # | Test case | Kiểm tra | P | Loại |
| - | --------- | -------- | - | ---- |
| 1 | Hiển thị đúng biên lai | Header mã đơn + badge trạng thái; có Order information, nhóm technician, dòng dịch vụ | P0 | @smoke |
| 2 | Subtotal = tổng các dòng | Σ giá dòng dịch vụ = **Subtotal** | P0 | @smoke |
| 3 | Total paid = Subtotal + Tip | `Total paid` khớp `Subtotal + Tip` | P0 | @smoke |
| 4 | Tip breakdown theo technician | Σ tip theo từng KTV = **Tip** tổng | P2 | @regression |
| 5 | **Payment details** đúng | Hiện phương thức + brand `··last4` + thời gian + badge trạng thái (`Successful`) | P1 | @regression |
| 6 | **Transaction** đúng | Card brand `···· last4`, có **Transaction ID**, **Date & time** | P1 | @regression |
| 7 | **Order information** | Cashier + Customer hiển thị đúng | P2 | @regression |
| 8 | Đủ nút hành động | Có **Send receipt** (header), **Reprint receipt**, **Cancel order** | P1 | @regression |
| 9 | **Send receipt** mở lựa chọn | Bấm → hộp gửi biên lai (Email/Text) *(không gửi thật)* | P2 | @regression |
| 10 | **Cancel order** mở dialog lý do | Bấm → dialog xác nhận + chọn/nhập **lý do** *(không xác nhận huỷ thật)* | P1 | @regression |
| 11 | Back giữ nguyên list | Back → về Orders list đúng tab/ngày/bộ lọc trước đó | P1 | @regression |

### 4.7. Lịch sử đơn theo khách (Customer profile) — `order-history-customer.e2e.ts`

| # | Test case | Kiểm tra | P | Loại |
| - | --------- | -------- | - | ---- |
| 1 | Mở profile khách | Home › Customers › (chọn khách) → có stats Points/Visits/Lifetime/Last visit | P1 | @regression |
| 2 | Tab **Orders** = lịch sử đơn | Tab Orders liệt kê `<ngày> · <mã đơn> · <tổng>`, **nhiều ngày** khác nhau | P0 | @smoke |
| 3 | **Visits** khớp số đơn | Số ở stat *Visits* nhất quán với số đơn lịch sử (theo định nghĩa app) | P2 | @regression |
| 4 | **Lifetime** khớp tổng chi | Lifetime ≈ Σ tổng các đơn thành công của khách | P2 | @regression |
| 5 | Chạm 1 đơn mở detail | Tap 1 dòng → Order detail đúng mã đơn | P0 | @smoke |
| 6 | Đổi tab **Rewards / History** | Đổi tab → nội dung đúng loại (Rewards = ưu đãi; History = lịch hẹn, *không* phải order) | P2 | @regression |
| 7 | SĐT khách được che | Hiện `•••-•••-2052` (không lộ số đầy đủ) | P2 | @regression |

---

## 5. Selector & Route cần bổ sung

Repo **chưa có** selector/route riêng cho Order History. Đề xuất bổ sung — **ưu tiên app
gắn `data-testid`**. Cột "*tạm*" là selector bám text/nhãn a11y quan sát được (dùng được
ngay nhưng dễ vỡ).

### Route (bổ sung vào [`src/constants/routes.ts`](../src/constants/routes.ts))

| Hằng số đề xuất | Giá trị (suy đoán — cần xác nhận trong router app) |
| --------------- | ------- |
| `ROUTES.APP.ORDERS` | `/orders` (danh sách) |
| `ROUTES.APP.ORDER_DETAIL(orderId)` | `/order/${orderId}` |
| `ROUTES.APP.CUSTOMERS` | `/customers` |
| `ROUTES.APP.CUSTOMER_DETAIL(customerId)` | `/customer/${customerId}` (tab mặc định Orders) |

### Selector (bổ sung vào [`src/constants/selectors.ts`](../src/constants/selectors.ts))

| Nhóm | Khoá | Selector đề xuất (⚠️ cần app thêm testid) | *tạm* (text/nhãn a11y) |
| ---- | ---- | ----------------------------------------- | ---------------------- |
| `ORDER_HISTORY` | `SEARCH_BTN` | `[data-testid="orders-search"]` | `button[aria-label="Search orders"]` |
| | `FILTER_BTN` | `[data-testid="orders-filter"]` | `button[aria-label="Filter orders"]` |
| | `DATE_PREV` / `DATE_NEXT` | `[data-testid="orders-date-prev/next"]` | `button[aria-label="Previous/Next day"]` |
| | `DATE_LABEL` | `[data-testid="orders-date-label"]` | `button*=Today ·` |
| | `STATUS_TAB(name)` | `[data-testid="orders-tab-${name}"]` | text tab: `All`/`Pending`/`Re-open`/`Successful - Unsettled`/`Successful - Settled` |
| | `SEARCH_INPUT` | `[data-testid="orders-search-input"]` | `input[placeholder="Search order # or customer"]` |
| | `ORDER_CARD(id)` | `[data-testid="order-card-${id}"]` | `*=#OD` (khớp mã đơn) |
| `ORDER_FILTER` | `SORT(option)` | `[data-testid="filter-sort-${option}"]` | radio text `Date completed`/`Last updated` |
| | `STAFF_SEARCH` | `[data-testid="filter-staff-search"]` | `input[placeholder="Search staff"]` |
| | `STAFF_OPTION(name)` | `[data-testid="filter-staff-${name}"]` | text tên nhân viên |
| | `PAYMENT(method)` | `[data-testid="filter-pay-${method}"]` | text `Card`/`Cash`/`Gift Card`/`Other` |
| | `APPLY` / `CLEAR_ALL` | `[data-testid="filter-apply/clear"]` | `button*=Apply` / `button*=Clear all` |
| `ORDER_DETAIL` | `STATUS_BADGE` | `[data-testid="order-status"]` | text `Unsettled`/`Pending`/… |
| | `CASHIER` / `CUSTOMER` | `[data-testid="order-cashier/customer"]` | theo nhãn "Cashier"/"Customer" |
| | `SUBTOTAL`/`TIP`/`TOTAL_PAID` | `[data-testid="order-subtotal/tip/total-paid"]` | text dòng tương ứng |
| | `PAYMENT_DETAILS` / `TRANSACTION_ID` | `[data-testid="order-payment/transaction-id"]` | theo nhãn "Payment details"/"Transaction ID" |
| | `SEND_RECEIPT` / `REPRINT` / `CANCEL` | `[data-testid="order-send/reprint/cancel"]` | `button*=Send receipt` / `Reprint receipt` / `Cancel order` |
| `CUSTOMER` | `SEARCH_INPUT` | `[data-testid="customer-search"]` | `input[placeholder="Search name or phone"]` |
| | `PROFILE_TAB(name)` | `[data-testid="customer-tab-${name}"]` | text `Orders`/`Rewards`/`History` |
| | `ORDER_ROW(id)` | `[data-testid="customer-order-${id}"]` | `*=#OD` trong tab Orders |

> Selector `[data-testid="customer-pay-by-${methodId}"]` (màn khách hàng) đã tồn tại —
> xem [`selectors.ts`](../src/constants/selectors.ts) & [`CustomerDisplayPage`](../src/pages/customer-display.page.ts).

---

## 6. Gợi ý cấu trúc spec / page object

Theo convention repo ([`src/specs/README.md`](../src/specs/README.md)): 1 page object/feature,
selector tập trung ở `selectors.ts`, không `browser.pause()` (dùng [`src/utils/wait.ts`](../src/utils/wait.ts)),
không đọc `process.env` trực tiếp, tái dùng phiên qua [`ensureLoggedIn()`](../src/utils/ensure-logged-in.ts).

### Page object đề xuất (`src/pages/`)

| File | Trách nhiệm |
| ---- | ----------- |
| `order-history.page.ts` | mở list, đổi tab trạng thái, đổi ngày + date picker, mở/đóng search, mở filter, mở 1 đơn |
| `order-filter.page.ts` | chọn sort, tick staff/payment, Apply/Clear all |
| `order-receipt.page.ts` | đọc badge/subtotal/tip/total paid/payment details/transaction id, đọc nút Cancel/Reprint/Send |
| `customer.page.ts` | tìm khách, mở profile, đổi tab Orders/Rewards/History, mở 1 đơn lịch sử |

### Bộ khung spec mẫu (khớp style repo)

```ts
import { expect } from "@wdio/globals"
import { ensureLoggedIn } from "../../utils/ensure-logged-in.js"
import { orderHistoryPage, orderReceiptPage } from "@pages"

describe("Order History — browse & view @regression", () => {
  before(async () => {
    await ensureLoggedIn()                     // tái dùng phiên đã đăng nhập (login-once)
  })

  it("filters by a completed status and opens a receipt", async () => {
    await orderHistoryPage.open()
    await orderHistoryPage.selectStatus("Successful - Unsettled")
    const { id, total } = await orderHistoryPage.readFirstCard()

    await orderHistoryPage.openOrder(id)
    expect(await orderReceiptPage.getOrderId()).toEqual(id)
    // Total paid = Subtotal + Tip
    const [sub, tip, paid] = await orderReceiptPage.getMoneyRows()
    expect(paid).toEqual(sub + tip)
    expect(paid).toEqual(total)                // khớp tổng trên card
  })

  it("blocks navigating to a future day", async () => {
    await orderHistoryPage.open()
    expect(await orderHistoryPage.isNextDayEnabled()).toBe(false)   // ở hôm nay
  })
})
```

> Điều kiện tiên quyết chạy được (emulator + dev server + `adb reverse` +
> `ANDROID_WEBVIEW_READY=1`) giống suite Android hiện có — xem
> [`login-test-cases.md` §4–§5](./login-test-cases.md) và
> [`android-emulator-setup.md`](./android-emulator-setup.md).

---

## 7. Giới hạn & lưu ý khi tự động hóa

- **Chỉ đọc là an toàn.** *Cancel order* huỷ đơn thật, *Send receipt* gửi email/tin nhắn thật,
  *Reprint* in thật, *Apply* filter thì OK. Case chạm các nút mutate chỉ nên chạy trên
  **đơn/tiệm test cô lập** và nên **dọn** sau đó. Tài liệu này *không* bấm nút mutate nào.
- **Badge `In Use · <device>`**: đơn đang khoá trên POS khác → mở ra có thể ở chế độ
  chỉ-đọc/khoá. Test đồng thời (2 thiết bị) cần dữ liệu riêng.
- **`data-testid` còn thiếu** cho hầu hết element → selector *tạm* bám text/nhãn a11y,
  dễ vỡ khi đổi UI/ngôn ngữ. Ưu tiên app gắn testid cho: nút Search/Filter, tab trạng thái,
  order card (kèm `data-order-id`), các dòng tiền ở receipt, nút Cancel/Reprint/Send.
- **Dữ liệu dev "bẩn"**: list đầy đơn test (`Walk-in · Amelia`, `Hiha1`, giá `$2,000.48`…).
  Test lọc/tìm nên **tạo dữ liệu riêng** hoặc bám **mã đơn cụ thể**, không dựa thứ tự/nội dung.
- **Ngày cố định theo hệ thống emulator** (đang là 2026-08-11). Test date-nav nên tính ngày
  **tương đối** từ ngày thiết bị, không hard-code `Aug 11`.
- **Tập trạng thái/preset ngày** đọc lúc quét (5 tab, preset Today/Yesterday/Last 7 days…):
  nên đọc động từ UI/cấu hình, không hard-code, phòng khi app thêm bớt.
- **Phiên đăng nhập dùng chung / token dùng 1 lần** (memory dự án): dùng `ensureLoggedIn()`,
  **không** đăng nhập lại giữa chừng.

---

## 8. Cách chạy (khi đã có spec)

Giống suite Android hiện có (xem [`login-test-cases.md` §5](./login-test-cases.md)):

```powershell
# Điều kiện: emulator-5554 đang chạy + dev server P8D + adb reverse (xem doc login/emulator)
adb devices                                     # phải thấy: emulator-5554  device

# Chạy nhóm spec Order History (khi đã tạo file trong src/specs/android/)
npm run test:android:emu -- --spec ./src/specs/android/order-history-list.e2e.ts
npm run test:android:emu -- --spec ./src/specs/android/order-history-detail.e2e.ts

# Hoặc chạy theo tag
cross-env TEST_TAGS=@smoke npm run test:android:emu
```

> ⚠️ Trước mỗi lần chạy lại: **kill Appium `:4723` cũ** để tránh false-fail
> (memory *Appium :4723 zombie on re-run*). Screenshot mỗi case: `./reports/screenshots/`;
> Allure: `npm run report:allure`.

---

## 9. Tham chiếu

- Order (tạo/sửa/checkout/thanh toán): [`order-test-cases.md`](./order-test-cases.md)
- Thanh toán chi tiết (Charge/tender/dual pricing): [`payment-test-cases.md`](./payment-test-cases.md)
- Login & convention chạy test: [`login-test-cases.md`](./login-test-cases.md)
- Setup emulator + recipe DOM WebView: [`android-emulator-setup.md`](./android-emulator-setup.md)
- Lộ trình đọc source: [`cau-truc-du-an.md`](./cau-truc-du-an.md)
- Selector/Route hiện có: [`selectors.ts`](../src/constants/selectors.ts) · [`routes.ts`](../src/constants/routes.ts)
