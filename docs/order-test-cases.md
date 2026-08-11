# Order — Tính năng & Test case (Volt POS / P8D, Android/Emulator)

Tài liệu này mô tả **tính năng Order** của app **Volt POS / P8D**
(`com.fastboy.volt_pos`) và đề xuất bộ **test case E2E** cho nó.

> **TL;DR**
> - Order trong app = **một salon ticket**: gán *khách hàng* → gán *kỹ thuật viên (technician)*
>   → thêm *dịch vụ / sản phẩm / gift card* → (tuỳ chọn) *khuyến mãi/điểm thưởng*
>   → **Charge** (thanh toán) bằng Card / Cash / Gift card / Other.
> - Toàn bộ tài liệu này được dựng bằng cách **thao tác trực tiếp trên emulator**
>   (`emulator-5554`, phiên đã đăng nhập tiệm *Volt POS 14 Dev*) qua `adb` +
>   ảnh chụp UiAutomator — vì Appium MCP chưa kết nối được trong phiên làm việc.
>   Xem [phần phương pháp](#0-phương-pháp--phạm-vi-khám-phá).
> - **Repo hiện chưa có page object / spec nào cho Order.** Các test case ở
>   [mục 4](#4-danh-sách-test-case-đề-xuất) là **đề xuất** (🆕), kèm gợi ý
>   selector + cấu trúc spec ở [mục 5](#5-selector--route-cần-bổ-sung)–[mục 6](#6-gợi-ý-cấu-trúc-spec--page-object).

---

## 0. Phương pháp & phạm vi khám phá

| Hạng mục | Chi tiết |
| -------- | -------- |
| Thiết bị | Emulator `emulator-5554`, màn 1080×2400, app `com.fastboy.volt_pos/.MainActivity` |
| Phiên | Đã đăng nhập sẵn, hiển thị tiệm **Volt POS 14 Dev** (dữ liệu dev đầy đơn test) |
| Công cụ | `adb shell input tap` + `adb exec-out screencap` (Appium MCP không đăng ký được tool → fallback) |
| Đã đi qua | Home → Orders list → Order detail → Payment method → Cash payment → Add service (2 bước) → New Sale |
| **Chưa** thực hiện | **Không** bấm *Accept cash* / *Charge* hoàn tất → **không tạo giao dịch thật**; **không** commit đơn New Sale |

> Vì đây là app **Tauri + WebView**, đa số element **chưa có `data-testid`** (giống
> phần login — xem [`login-test-cases.md`](./login-test-cases.md)). Do đó test case
> dưới đây mô tả *hành vi cần kiểm tra*, còn selector cụ thể là **đề xuất** và
> nên đi kèm việc app gắn `data-testid` để test bền.

---

## 1. Tính năng Order là gì? (bức tranh tổng thể)

**Order = phiếu dịch vụ (salon ticket)** trong một POS tiệm nail/salon. Một order gồm:

- **1 khách hàng** (có điểm loyalty — *pts*).
- **1..n nhóm theo kỹ thuật viên (technician)**; mỗi nhóm chứa **các dòng dịch vụ**.
- (tuỳ chọn) **sản phẩm** và **gift card** (không cần technician).
- (tuỳ chọn) **khuyến mãi / điểm thưởng** (*Apply Promotion/Reward*).
- **Tổng tiền** (Subtotal → Total) và bước **Charge** (chọn phương thức thanh toán).

### Vòng đời một order

```
                 ┌──────────────── Tạo mới (New Sale) ────────────────┐
                 ▼                                                     │
 Home ─► New Sale ─► Select Staff (Step 1/2) ─► Add service (Step 2/2) ─► Review ─► [PENDING]
                 │        (chọn technician)         (chọn dịch vụ)                     │
                 │                                                                     ▼
 Home ─► Orders ─► Orders list ──(chạm 1 đơn)──► Order detail (ticket)  ◄──────────────┘
                    (lọc ngày/          │  ├─ Add service / Add product / Add gift card
                     trạng thái/        │  ├─ Apply Promotion/Reward
                     search)            │  ├─ Xoá dòng dịch vụ (nút ✕)
                                        │  └─ Charge $X
                                        ▼
                              Payment method (Card / Cash / Gift card / Other)
                                        │
                                        ▼
                              Cash payment (tender) ─► Accept cash ─► [SUCCESS]
```

### Điểm vào (entry points)

| Điểm vào | Vị trí | Dẫn tới |
| -------- | ------ | ------- |
| **New Sale** | Home › Quick Actions (thẻ xanh) | Tạo order mới → Select Staff |
| **Orders** (thẻ) | Home › "Orders — View & filter orders" | Orders list |
| **Orders** (tab) | Thanh nav dưới cùng | Orders list |
| **Sale** (tab) | Thanh nav dưới cùng | Lưới dịch vụ/sản phẩm (bán nhanh) |
| Nút scan (giữa) | Thanh nav dưới cùng | Quét mã (QR/giftcard) — ngoài phạm vi tài liệu này |

---

## 2. Các màn hình trong luồng Order (screen-by-screen)

### 2.1. Orders list — danh sách & bộ lọc

Tiêu đề **"Orders"** + icon **Search** (góc phải).

| Vùng | Element | Ghi chú |
| ---- | ------- | ------- |
| Bộ lọc ngày | `‹`  **Today · Aug 3**  `›` | Điều hướng lùi/tới theo ngày |
| Tab trạng thái | **All / Pending / Re-open / Success / …** | Cuộn ngang; tab đang chọn nền đen |
| Ô tìm kiếm | Icon kính lúp (mở ô search) | Tìm theo mã đơn / tên / SĐT khách |
| Order card (mỗi đơn) | Mã đơn, tên/SĐT khách, địa chỉ, "about N hours ago", **tổng tiền**, **badge trạng thái** | Chạm để mở chi tiết |

- **Mã đơn**: dạng `#OD` + `YYMMDD` + số thứ tự — ví dụ `#OD260803-39681496`
  (26 = 2026, 08 = tháng 8, 03 = ngày 3).
- Ví dụ dữ liệu dev: `aaaa dddd · advfsdbdzb2 / 123abc, adssaddas / $13.81 / Pending`,
  `7777777665 / $0.00 / Pending`, `Unknown 1420 / Pending`.

### 2.2. Order detail (ticket) — trái tim của tính năng

Header: nút back, **mã đơn**, dòng phụ trạng thái + số dịch vụ (vd *"Open · 2 services"*).

| Khối | Nội dung quan sát được | Hành động |
| ---- | ---------------------- | --------- |
| **Khách hàng** | Avatar chữ cái, tên (*aaaa dddd*), SĐT ẩn (`***-***-0555`), **điểm** (`0 pts`) | menu **⋮** (đổi/bỏ khách…) |
| **Nhóm technician** | Tên KTV (*advfsdbdzb2*), *"2 services"*, tổng tiền nhóm (`$13.81`) | menu **⋮** |
| **Dòng dịch vụ** | Tên dịch vụ + giá (`123abc $4.40`, `adssaddas $9.41`), nút **✕** | ✕ = xoá dòng |
| **Nút thêm** | **+ Add service** · **Add product** · **Add gift card** | mở luồng thêm |
| **Ưu đãi** | **Apply Promotion/Reward** | mở chọn KM/điểm |
| **Tổng tiền** | **Subtotal** `$13.81` · **Total** `$13.81` | chỉ đọc |
| **Thanh toán** | Nút xanh **Charge $13.81 →** | → Payment method |

### 2.3. Add service — luồng 2 bước

**Step 1 · Select Staff** ("Step 1 of 2 · choose a technician"):

- Ô **Search staff**.
- Nhóm **NO TECHNICIAN NEEDED**: **Add product**, **Add gift card** (mặt hàng không cần KTV).
- Nhóm **TECHNICIANS**: danh sách KTV (vd `888`, `24234`, `abc xyz31`, `advfsdbdzb2`);
  KTV đang gán được tô nền xanh.

**Step 2 · Add service** (sau khi chọn KTV):

- Thẻ KTV đang chọn + nút **Change** (đổi KTV).
- Ô **Search services**.
- Chip **danh mục**: **All / Quick Pay / Gift Card / …** (cuộn ngang).
- **Lưới dịch vụ**: mỗi thẻ có *chấm màu danh mục* + *tên* + *thời lượng* (`30m`/`1h`)
  + *giá* (vd `tsdas $12.22`, `123abc 1h $56.00`, `adssaddas 30m $0.00`).
- Nút dưới cùng: **Review order · $X →**.

> **New Sale** (tạo order mới) dùng **chung** luồng này: bắt đầu ngay tại
> *Select Staff (Step 1/2)*, chọn KTV → chọn dịch vụ → *Review order*.

### 2.4. Payment method — chọn phương thức

Header: **"Payment method"** + mã đơn. Mục **SELECT METHOD**:

| Phương thức | Mô tả | Số tiền (ví dụ đơn `#OD260803-39681496`) |
| ----------- | ----- | ---------------------------------------- |
| **Card** | Credit / debit, tap… | **$13.81** |
| **Cash** | Pay with bills & coins… | **$12.55** |
| **Gift card** | Redeem stored balance… | **$12.55** |
| **Other** | Manual / external… | **$13.81** |

> Card/Other **cao hơn** Cash/Gift card — do cơ chế **dual pricing** ở [mục 3](#3-dual-pricing--service-fee--cash-discount).

### 2.5. Cash payment (tender) — nhập tiền mặt

Header: **"Cash payment"** + mã đơn.

| Vùng | Element | Ghi chú |
| ---- | ------- | ------- |
| Ô nhận tiền | **CASH RECEIVED** `$0.00` | cập nhật khi bấm keypad |
| Bảng tính | **Subtotal** `$12.55` · **Service fee (10%)** `$1.26` · **Cash discount (10%)** `-$1.26` · **Amount due** `$12.55` · **Change due** `$0.00` (xanh) | Change due tự tính |
| **QUICK CASH** | **Exact** · **$100** · **$120** · **$150** | điền nhanh số tiền nhận |
| Keypad | `1..9`, `0`, xoá | nhập tay số tiền nhận |
| Nút dưới | **Tip** · **Accept cash** | Accept = hoàn tất (⚠️ tạo giao dịch) |

---

## 3. Dual pricing — Service fee & Cash discount

Đây là **logic tính tiền quan trọng nhất** của Order, quan sát trực tiếp trên đơn
`#OD260803-39681496`:

```
Giá gốc dịch vụ (base / cash price) ............ $12.55   ← "Subtotal" ở màn Cash
  + Service fee 10% ............................ +$1.26   (12.55 × 10% ≈ 1.26, làm tròn)
  = Giá thẻ (Card price) ....................... $13.81   ← "Total" ở Order detail & giá Card/Other
Cash / Gift card:
  Service fee +$1.26  −  Cash discount −$1.26 = 0
  ⇒ Amount due = base = ........................ $12.55   ← giá Cash/Gift card
```

**Kết luận cần test:**
- Thanh toán **Card / Other** → tính **giá có phí 10%** (`$13.81`).
- Thanh toán **Cash / Gift card** → phí 10% bị **triệt tiêu** bởi chiết khấu 10% →
  quay về **giá gốc** (`$12.55`).
- **Change due** = `Cash received − Amount due` (không âm; đủ tiền mới cho Accept).

> Tỷ lệ 10% và cách làm tròn phụ thuộc **cấu hình tiệm** → test nên đọc kỳ vọng từ
> dữ liệu/của đơn, **không** hard-code `10%`/`$1.26` cho mọi tiệm.

---

## 4. Danh sách test case đề xuất

Ký hiệu: **P** = độ ưu tiên (P0 cao nhất). **Loại**: `@smoke` (luồng sống còn) /
`@regression`. Trạng thái **🆕** = chưa có spec, đề xuất mới.

### 4.1. Orders list & bộ lọc — `orders-list.e2e.ts`

| # | Test case | Kiểm tra | P | Loại |
| - | --------- | -------- | - | ---- |
| 1 | Mở màn Orders hiển thị danh sách | Có tiêu đề "Orders", có ≥0 order card, có tab trạng thái | P0 | @smoke |
| 2 | Mỗi order card hiển thị đủ trường | Mã `#OD…`, tên/SĐT khách, thời gian, tổng tiền, badge trạng thái | P1 | @regression |
| 3 | Lọc theo trạng thái **Pending** | Chọn tab Pending → mọi card có badge *Pending* | P1 | @regression |
| 4 | Lọc theo **Success / Re-open / All** | Đổi tab → danh sách đổi theo đúng trạng thái | P1 | @regression |
| 5 | Điều hướng ngày (‹ / ›) | Bấm ‹ → nhãn ngày lùi 1 ngày, danh sách nạp lại theo ngày | P2 | @regression |
| 6 | Tìm kiếm theo mã/SĐT | Gõ mã đơn/SĐT → chỉ còn đơn khớp | P1 | @regression |
| 7 | Trạng thái rỗng | Ngày/bộ lọc không có đơn → hiện empty state, không lỗi | P2 | @regression |
| 8 | Chạm 1 đơn mở đúng chi tiết | Tap card → Order detail có đúng mã đơn đã chạm | P0 | @smoke |

### 4.2. Order detail / chỉnh sửa ticket — `order-detail.e2e.ts`

| # | Test case | Kiểm tra | P | Loại |
| - | --------- | -------- | - | ---- |
| 1 | Hiển thị đúng ticket | Header mã đơn + "Open · N services"; có khối khách, nhóm KTV, dòng dịch vụ | P0 | @smoke |
| 2 | Subtotal = tổng các dòng | Σ giá dòng dịch vụ = Subtotal hiển thị | P0 | @smoke |
| 3 | Total khớp nút Charge | Số ở **Total** = số trên nút **Charge $X** | P0 | @smoke |
| 4 | Xoá 1 dòng dịch vụ (✕) | Bấm ✕ → dòng biến mất, Subtotal/Total & số "N services" giảm tương ứng | P1 | @regression |
| 5 | Thêm dịch vụ cập nhật tổng | Add service → chọn dịch vụ → Total tăng đúng bằng giá dịch vụ | P1 | @regression |
| 6 | Điểm loyalty khách hiển thị | Khối khách hiện `N pts` đúng | P2 | @regression |
| 7 | SĐT khách được che | Hiện dạng `***-***-0555` (không lộ số đầy đủ) | P2 | @regression |
| 8 | Đơn rỗng không cho Charge | Order không có dịch vụ/sản phẩm → nút Charge disable hoặc chặn | P1 | @regression |

### 4.3. Thêm dịch vụ / sản phẩm / gift card — `order-add-items.e2e.ts`

| # | Test case | Kiểm tra | P | Loại |
| - | --------- | -------- | - | ---- |
| 1 | Add service — Step 1 hiện KTV | Có nhóm "Technicians" + "No technician needed" | P0 | @smoke |
| 2 | Chọn KTV → sang Step 2 | Chọn 1 KTV → màn "Add service" hiện tên KTV + lưới dịch vụ | P0 | @smoke |
| 3 | Tìm dịch vụ | Gõ vào "Search services" → lưới lọc còn dịch vụ khớp | P1 | @regression |
| 4 | Lọc theo danh mục (chip) | Chọn chip *Quick Pay* → chỉ còn dịch vụ thuộc danh mục | P1 | @regression |
| 5 | Đổi KTV (Change) | Bấm **Change** → quay lại chọn KTV, chọn KTV khác được | P2 | @regression |
| 6 | Chọn dịch vụ → Review order | Nút "Review order · $X" cập nhật đúng tổng sau khi chọn | P0 | @smoke |
| 7 | Add product (không cần KTV) | Vào "No technician needed › Add product" → chọn sản phẩm → thêm vào đơn | P1 | @regression |
| 8 | Add gift card | Vào "Add gift card" → tạo/chọn gift card → thêm vào đơn | P2 | @regression |
| 9 | Thời lượng & giá dịch vụ đúng | Thẻ dịch vụ hiển thị đúng `30m/1h` + giá theo catalog | P2 | @regression |

### 4.4. Checkout & phương thức thanh toán — `order-payment-method.e2e.ts`

| # | Test case | Kiểm tra | P | Loại |
| - | --------- | -------- | - | ---- |
| 1 | Charge mở màn Payment method | Bấm Charge → màn "Payment method" đúng mã đơn | P0 | @smoke |
| 2 | Đủ 4 phương thức | Hiện **Card / Cash / Gift card / Other** | P0 | @smoke |
| 3 | Card = giá có phí | Card hiển thị **giá thẻ** (vd `$13.81`) | P0 | @smoke |
| 4 | Cash = giá gốc | Cash hiển thị **giá gốc** (vd `$12.55`), thấp hơn Card | P0 | @smoke |
| 5 | Gift card = giá gốc | Gift card = giá Cash | P1 | @regression |
| 6 | Other = giá thẻ | Other = giá Card | P2 | @regression |
| 7 | Chọn 1 phương thức mở đúng màn | Tap Cash → "Cash payment"; tap Card → luồng thẻ | P1 | @regression |
| 8 | Back giữ nguyên đơn | Back từ Payment method → về Order detail, đơn không đổi | P1 | @regression |

### 4.5. Cash payment (tender) & dual pricing — `order-cash-payment.e2e.ts`

| # | Test case | Kiểm tra | P | Loại |
| - | --------- | -------- | - | ---- |
| 1 | Bảng tính hiển thị đủ dòng | Subtotal, Service fee (10%), Cash discount (10%), Amount due, Change due | P0 | @smoke |
| 2 | Dual pricing đúng | `Amount due = Subtotal` (phí 10% bị chiết khấu 10% triệt tiêu) | P0 | @smoke |
| 3 | Quick cash **Exact** | Bấm Exact → Cash received = Amount due, Change due = `$0.00` | P1 | @regression |
| 4 | Quick cash **$100** | Cash received = `$100.00`, Change due = `100 − amount due` | P1 | @regression |
| 5 | Nhập keypad | Gõ `2 0 0` → Cash received = `$2.00` (hoặc `$200` tuỳ format) | P1 | @regression |
| 6 | Thiếu tiền chặn Accept | Cash received < Amount due → **Accept cash** bị chặn/disable | P0 | @regression |
| 7 | Change due tính đúng | Cash received `$20` với due `$12.55` → Change due `$7.45` | P1 | @regression |
| 8 | Thêm **Tip** | Bấm Tip nhập tiền tip → Amount due (hoặc tổng) tăng theo tip | P2 | @regression |
| 9 | Accept cash → SUCCESS ⚠️ | (Chỉ chạy trên dữ liệu test cô lập) Accept → đơn chuyển *Success* | P1 | @regression |

> ⚠️ Case 4.5#9 và mọi case bấm **Accept/Charge** tạo **giao dịch thật** → chỉ chạy
> với đơn/tiệm test riêng, không chạy trên dữ liệu thật. Xem [mục 7](#7-giới-hạn--lưu-ý-khi-tự-động-hóa).

### 4.6. Tạo order mới (New Sale) — `order-create.e2e.ts`

| # | Test case | Kiểm tra | P | Loại |
| - | --------- | -------- | - | ---- |
| 1 | New Sale mở Select Staff | Home › New Sale → "Select Staff (Step 1 of 2)" | P0 | @smoke |
| 2 | Tạo order tối thiểu | Chọn KTV → chọn 1 dịch vụ → Review → xuất hiện order **Pending** mới | P0 | @smoke |
| 3 | Gán khách cho order | Trong luồng review/detail gán 1 khách → khối khách hiển thị đúng | P1 | @regression |
| 4 | Order mới xuất hiện ở list | Sau tạo, quay lại Orders list (tab Pending) thấy đơn vừa tạo | P1 | @regression |
| 5 | Huỷ tạo giữa chừng | Back khỏi Select Staff khi chưa chọn gì → không tạo đơn rác | P2 | @regression |

---

## 5. Selector & Route cần bổ sung

Repo **chưa có** selector/route riêng cho Order (ngoài `ROUTES.APP.ORDER_CHECKOUT`
và `SELECTORS.CUSTOMER_DISPLAY.PAY_BY_METHOD`). Đề xuất bổ sung — **ưu tiên app gắn
`data-testid`** để test bền (giống khuyến nghị ở phần login):

### Route (bổ sung vào [`src/constants/routes.ts`](../src/constants/routes.ts))

| Hằng số đề xuất | Giá trị |
| --------------- | ------- |
| `ROUTES.APP.ORDERS` | `/orders` (danh sách) |
| `ROUTES.APP.ORDER_DETAIL(orderId)` | `/order/${orderId}` |
| `ROUTES.APP.ORDER_CHECKOUT(orderId)` | `/order/${orderId}/checkout` — **đã có** |
| `ROUTES.APP.NEW_SALE` | luồng New Sale / Select Staff |

> Các route trên là **suy đoán** theo điều hướng UI + hằng số sẵn có; cần xác nhận
> lại trong router của repo app (`src/routes/...`) trước khi dùng để `browser.url(...)`.

### Selector (bổ sung vào [`src/constants/selectors.ts`](../src/constants/selectors.ts))

| Nhóm | Khoá | Selector đề xuất (⚠️ cần app thêm testid) |
| ---- | ---- | ----------------------------------------- |
| `ORDERS_LIST` | `STATUS_TAB(name)` | `[data-testid="orders-tab-${name}"]` — *tạm*: `button*=Pending` |
| | `SEARCH` | `[data-testid="orders-search"]` |
| | `DATE_PREV` / `DATE_NEXT` | `[data-testid="orders-date-prev/next"]` |
| | `ORDER_CARD(id)` | `[data-testid="order-card-${id}"]` — *tạm*: `*=#OD` |
| `ORDER_DETAIL` | `SERVICE_ROW(name)` | `[data-testid="order-line-${name}"]` |
| | `REMOVE_LINE(name)` | `[data-testid="order-line-remove-${name}"]` — *tạm*: nút ✕ trong dòng |
| | `ADD_SERVICE` / `ADD_PRODUCT` / `ADD_GIFT` | `button*=Add service` / `Add product` / `Add gift card` |
| | `APPLY_PROMO` | `button*=Apply Promotion` |
| | `SUBTOTAL` / `TOTAL` | `[data-testid="order-subtotal/total"]` |
| | `CHARGE_BTN` | `[data-testid="order-charge"]` — *tạm*: `button*=Charge` |
| `ADD_SERVICE` | `STAFF_ROW(name)` | `[data-testid="staff-${name}"]` — *tạm*: text KTV |
| | `SERVICE_CARD(name)` | `[data-testid="service-${name}"]` |
| | `CATEGORY_CHIP(name)` | `button*=${name}` (All/Quick Pay/Gift Card) |
| | `REVIEW_ORDER_BTN` | `button*=Review order` |
| `PAYMENT` | `METHOD(id)` | `[data-testid="pay-method-${id}"]` — id: `card`/`cash`/`gift-card`/`other` |
| `CASH_PAYMENT` | `CASH_RECEIVED` | `[data-testid="cash-received"]` |
| | `QUICK_CASH(label)` | `button*=${label}` (Exact/$100/$120/$150) |
| | `KEYPAD(n)` | `button=${n}` (giống `PASSCODE_GUARD.DIGIT`) |
| | `AMOUNT_DUE` / `CHANGE_DUE` | `[data-testid="amount-due/change-due"]` |
| | `TIP_BTN` / `ACCEPT_CASH` | `button*=Tip` / `button*=Accept cash` |

> Selector `[data-testid="customer-pay-by-${methodId}"]` cho **màn hình khách hàng**
> (customer display) đã tồn tại — xem [`selectors.ts:59-61`](../src/constants/selectors.ts#L59-L61)
> và [`CustomerDisplayPage`](../src/pages/customer-display.page.ts).

---

## 6. Gợi ý cấu trúc spec / page object

Theo convention repo ([`src/specs/README.md`](../src/specs/README.md)): 1 page object/feature,
selector tập trung ở `selectors.ts`, không `browser.pause()` (dùng `src/utils/wait.ts`),
không đọc `process.env` trực tiếp.

### Page object đề xuất (`src/pages/`)

| File | Trách nhiệm |
| ---- | ----------- |
| `orders-list.page.ts` | mở list, đổi tab trạng thái, đổi ngày, search, mở 1 đơn |
| `order-detail.page.ts` | đọc subtotal/total, xoá dòng, mở Add service, bấm Charge |
| `add-service.page.ts` | chọn KTV (Step 1), chọn dịch vụ + lọc danh mục (Step 2), Review |
| `payment.page.ts` | đọc 4 phương thức + số tiền, chọn phương thức |
| `cash-payment.page.ts` | đọc bảng tính, quick cash, keypad, đọc change due, (Accept) |

### Bộ khung spec mẫu (khớp style repo)

```ts
import { expect } from "@wdio/globals"
import { ensureLoggedIn } from "../../utils/ensure-logged-in.js"
import { ordersListPage, orderDetailPage, paymentPage } from "@pages"

describe("Order — checkout @regression", () => {
  before(async () => {
    await ensureLoggedIn()            // dùng lại phiên đã đăng nhập (login-once)
  })

  it("opens an order and shows a total matching the Charge button", async () => {
    await ordersListPage.open()
    await ordersListPage.selectStatus("Pending")
    await ordersListPage.openFirstOrder()

    const total = await orderDetailPage.getTotal()
    expect(await orderDetailPage.getChargeAmount()).toEqual(total)
  })

  it("shows cash cheaper than card (dual pricing)", async () => {
    await orderDetailPage.charge()
    const card = await paymentPage.getAmount("card")
    const cash = await paymentPage.getAmount("cash")
    expect(cash).toBeLessThan(card)   // phí 10% bị chiết khấu 10% triệt tiêu
  })
})
```

> Điều kiện tiên quyết chạy được (dev server + `adb reverse` + `ANDROID_WEBVIEW_READY=1`)
> giống hệt phần login — xem [`login-test-cases.md` §4–§5](./login-test-cases.md#4-điều-kiện-tiên-quyết).

---

## 7. Giới hạn & lưu ý khi tự động hóa

- **WebView chưa có `data-testid`** cho đa số element Order → selector đề xuất còn
  bám text/cấu trúc, dễ vỡ. Cần app gắn testid (ưu tiên cho: nút Charge, dòng dịch
  vụ + nút ✕, 4 phương thức thanh toán, keypad tiền mặt).
- **Bấm Charge/Accept tạo giao dịch thật.** Case đi tới cuối (SUCCESS) chỉ nên chạy
  trên **tiệm/đơn test cô lập**, và nên tự **dọn** (huỷ/hoàn) sau khi chạy. Trong tài
  liệu này *không* case nào được bấm hoàn tất.
- **Phiên đăng nhập dùng chung / token dùng 1 lần** (xem memory dự án): tái dùng phiên
  qua [`ensureLoggedIn()`](../src/utils/ensure-logged-in.ts) — **không** đăng nhập lại
  giữa chừng làm hỏng phiên.
- **Dual pricing phụ thuộc cấu hình tiệm** (tỷ lệ %, làm tròn): assert theo giá trị
  *tính từ đơn* thay vì hard-code `10%`/`$1.26`.
- **Dữ liệu dev "bẩn"**: list đầy đơn test (tên `aaaa dddd`, SĐT `7777777665`,
  `Unknown 1420`…). Test lọc/tìm kiếm nên tạo dữ liệu riêng hoặc bám mã đơn cụ thể,
  không dựa vào thứ tự/nội dung sẵn có.
- **Chưa cover**: chỉnh sửa khách hàng (menu ⋮), Apply Promotion/Reward (chi tiết),
  luồng thanh toán **Card** (nhập/tap thẻ), **Gift card** redeem, in hoá đơn, refund,
  màn hình **customer display** đồng bộ khi thanh toán.

---

## 8. Cách chạy (khi đã có spec)

Giống suite Android hiện có (xem [`login-test-cases.md` §5](./login-test-cases.md#5-câu-lệnh-chạy-test-login)):

```powershell
# Điều kiện: emulator-5554 đang chạy + dev server P8D + adb reverse (xem doc login §4)
adb devices                                     # phải thấy: emulator-5554  device

# Chạy nhóm spec Order (khi đã tạo file trong src/specs/android/)
npm run test:android:emu -- --spec ./src/specs/android/orders-list.e2e.ts
npm run test:android:emu -- --spec ./src/specs/android/order-detail.e2e.ts

# Hoặc chạy theo tag
cross-env TEST_TAGS=@smoke npm run test:android:emu
```

- Screenshot mỗi case: `./reports/screenshots/`
- Allure report: `npm run report:allure` (dọn cũ: `npm run report:clean`)

---

## 9. Tham chiếu

- Tổng quan login & convention chạy test: [`login-test-cases.md`](./login-test-cases.md)
- Setup emulator + recipe DOM WebView: [`android-emulator-setup.md`](./android-emulator-setup.md)
- Lộ trình đọc source: [`cau-truc-du-an.md`](./cau-truc-du-an.md)
- Selector/Route hiện có: [`selectors.ts`](../src/constants/selectors.ts) · [`routes.ts`](../src/constants/routes.ts)
