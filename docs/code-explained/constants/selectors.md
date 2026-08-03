# Giải thích code: `src/constants/selectors.ts`

> **File nguồn:** [src/constants/selectors.ts](../../../src/constants/selectors.ts)
> **Loại:** Constants
> **Một câu:** Registry (kho tập trung) toàn bộ **selector** để định vị element trong WebView, kèm 3 helper sinh selector; phân biệt rõ selector **thật** (có `data-testid`) với selector **fallback** (bám placeholder/type/text vì element chưa có testid).

---

## 1. Mục đích tổng quan

File export 3 helper (`testId`, `dataAttr`, `byText`) và một object `SELECTORS`. Comment đầu file (dòng 1–12) nêu quy ước:

- *"every interactive element should expose a stable `data-testid`"* — **lý tưởng** là mọi element tương tác đều có `data-testid` ổn định.
- *"Tests reference IDs from this file — never inline"* — spec/page **luôn** lấy selector từ file này, không gõ selector rời rạc; UI đổi thì sửa **một chỗ**.

Thực tế app P8D (Tauri WebView) **chưa** gắn `data-testid` ở nhiều nơi, nên file chia làm 2 loại:

- **Selector thật**: dựa trên `data-testid` do UI production cung cấp → ổn định.
- **Selector fallback**: bám vào `placeholder`, `type`, `role`, class hoặc text hiển thị vì element chưa có testid → **dễ vỡ hơn**, chỉ là giải pháp tạm.

---

## 2. Các helper (dòng 14–16)

```ts
14 export const testId = (id: string): string => `[data-testid="${id}"]`
15 export const dataAttr = (attr: string, value: string): string => `[data-${attr}="${value}"]`
16 export const byText = (tag: string, text: string): string => `${tag}*=${text}`
```

| Helper | Chữ ký | Sinh ra | Giải thích / khi nào dùng |
|--------|--------|---------|----------------------------|
| `testId(id)` | `(id: string) => string` | `testId("login-submit")` → `[data-testid="login-submit"]` | Sinh **CSS attribute selector** khớp element có đúng `data-testid`. Đây là cách định vị **ưu tiên & ổn định nhất**. Dùng cho mọi element đã có testid. |
| `dataAttr(attr, value)` | `(attr, value) => string` | `dataAttr("state", "open")` → `[data-state="open"]` | Tổng quát hơn `testId`: khớp **bất kỳ** thuộc tính `data-*` với giá trị cho trước. Dùng khi cần bám vào data-attribute khác ngoài `testid` (ví dụ trạng thái `data-state`, `data-type` của thư viện toast). |
| `byText(tag, text)` | `(tag, text) => string` | `byText("button", "Save")` → `button*=Save` | Sinh **selector kiểu WebdriverIO** `tag*=text` — khớp phần tử `tag` có text **chứa** `text`. Dùng khi element **không có hook ổn định**, chỉ phân biệt được bằng chữ hiển thị. Đây là dạng **fallback** dễ vỡ khi đổi ngôn ngữ/nội dung. |

> Lưu ý cú pháp `*=` là **của WebdriverIO** (khớp text chứa), không phải CSS thuần. Còn `testId`/`dataAttr` sinh ra **CSS selector** chuẩn.

---

## 3. Giải thích từng hằng số / nhóm

Object `SELECTORS` (dòng 18–90) chia thành các nhóm sau. Với mỗi nhóm ta đánh dấu selector **[THẬT]** (có `data-testid`) hay **[FALLBACK]** (bám placeholder/type/role/class/text).

### 3.1. Nhóm `LOGIN` (dòng 19–25) — **template/ví dụ, KHÔNG phải luồng thật**

```ts
19   // ---------------- Login (EXAMPLE/template — see LOGIN_STAFF_TOKEN for the real flow) ----------------
20   LOGIN: {
21     CARD: testId("login-card"),
22     SUBMIT_BTN: testId("login-submit"),
23     ERROR_MESSAGE: testId("login-error"),
24     LOADING: testId("login-loading")
25   },
```

Comment dòng 19 ghi rõ đây là **EXAMPLE/template** — luồng login thật nằm ở `LOGIN_STAFF_TOKEN`.

| Key | Selector | Loại | Ý nghĩa / khi nào dùng |
|-----|----------|------|------------------------|
| `CARD` | `[data-testid="login-card"]` | [THẬT-giả định] | Thẻ (card) bao form login. |
| `SUBMIT_BTN` | `[data-testid="login-submit"]` | [THẬT-giả định] | Nút submit login. |
| `ERROR_MESSAGE` | `[data-testid="login-error"]` | [THẬT-giả định] | Vùng hiển thị lỗi login. |
| `LOADING` | `[data-testid="login-loading"]` | [THẬT-giả định] | Trạng thái đang tải khi login. |

> **Điểm dễ nhầm:** các testid này viết theo **quy ước lý tưởng** cho một màn login-form giả định, **không** đảm bảo tồn tại trong app hiện tại. Đây là mẫu để tham khảo; đừng nhầm là luồng đăng nhập đang chạy.

### 3.2. Nhóm `LOGIN_STAFF_TOKEN` (dòng 27–40) — **luồng login THẬT**

```ts
34   LOGIN_STAFF_TOKEN: {
35     // Verified against the live Android form: the field has no name/testid and
36     // an auto-generated React id, so the placeholder is the only stable hook.
37     INPUT: 'input[placeholder="Enter Staff Token"]',
38     SUBMIT_BTN: 'button[type="submit"]',
39     ERROR_ALERT: '[role="alert"], .destructive, .text-destructive'
40   },
```

JSDoc (dòng 27–33) nêu rõ: đây là form dự phòng thật tại `/login-staff-token`; màn `/login` chính (QR) **không có DOM hook ổn định**; **không selector nào ở đây có `data-testid`** → tất cả là fallback. Kèm ghi chú nên đề xuất thêm testid (skill `volt-e2e-spec`).

| Key | Selector | Loại | Ý nghĩa / khi nào dùng |
|-----|----------|------|------------------------|
| `INPUT` | `input[placeholder="Enter Staff Token"]` | **[FALLBACK]** — bám `placeholder` | Ô nhập staff token. Comment (dòng 35–36) xác nhận: field **không có name/testid**, React id thì tự sinh ngẫu nhiên → **placeholder là hook ổn định duy nhất**. `ensure-logged-in.ts` chờ chính selector này hiển thị trước khi nhập token. |
| `SUBMIT_BTN` | `button[type="submit"]` | **[FALLBACK]** — bám thuộc tính `type` | Nút submit form. Không có testid, chỉ định vị được qua `type="submit"`. |
| `ERROR_ALERT` | `[role="alert"], .destructive, .text-destructive` | **[FALLBACK]** — bám `role`/class | Vùng báo lỗi. Là **danh sách nhiều selector** (ngăn cách bằng dấu phẩy): khớp element có `role="alert"` **hoặc** class `.destructive` **hoặc** `.text-destructive` — phòng khi UI render lỗi theo một trong các cách này. |

### 3.3. Nhóm `PASSCODE_GUARD` (dòng 42–52) — bàn phím số nhập lại mật mã

```ts
48   PASSCODE_GUARD: {
49     DIGIT: (digit: number | string): string => `button=${digit}`,
50     BACKSPACE: '[class*="icon-backspace"]',
51     ERROR_TEXT: ".text-red-500"
52   },
```

JSDoc (dòng 42–47): đây là **keypad số** cho cổng xác thực lại quyền (permission re-verification). Các nút số **không có data-testid** — chỉ phân biệt bằng text hiển thị, nên dùng locator `button=<n>`.

| Key | Selector | Loại | Ý nghĩa / khi nào dùng |
|-----|----------|------|------------------------|
| `DIGIT` | `(digit) => `button=${digit}`` | **[FALLBACK]** — hàm, bám **text** | **Route/selector dạng hàm**: nhận số (hoặc chuỗi) và trả về `button=<digit>` — selector WebdriverIO khớp `<button>` có text **đúng bằng** chữ số đó. Ví dụ `DIGIT(5)` → `button=5`. Dùng để bấm từng phím số trên keypad. Lưu ý `button=` (khớp **đúng** text) khác `button*=` (khớp **chứa** text). |
| `BACKSPACE` | `[class*="icon-backspace"]` | **[FALLBACK]** — bám **class chứa** | Nút xoá lùi. Định vị qua CSS `*=` trên class (`class` **chứa** chuỗi `icon-backspace`) vì không có testid. |
| `ERROR_TEXT` | `.text-red-500` | **[FALLBACK]** — bám **class** | Text báo lỗi passcode, định vị qua class Tailwind `.text-red-500`. |

### 3.4. Nhóm `CUSTOMER_DISPLAY` (dòng 54–61) — màn hình hướng khách hàng

```ts
59   CUSTOMER_DISPLAY: {
60     PAY_BY_METHOD: (methodId: string): string => testId(`customer-pay-by-${methodId}`)
61   },
```

JSDoc (dòng 54–58): đây là **một trong số ít vùng có `data-testid` production thật**.

| Key | Selector | Loại | Ý nghĩa / khi nào dùng |
|-----|----------|------|------------------------|
| `PAY_BY_METHOD` | `(methodId) => testId(`customer-pay-by-${methodId}`)` | **[THẬT]** — hàm, sinh **testid động** | **Selector dạng hàm** dùng lại helper `testId`: nhận `methodId` và tạo `[data-testid="customer-pay-by-<methodId>"]`. Ví dụ `PAY_BY_METHOD("cash")` → `[data-testid="customer-pay-by-cash"]`. Dùng để bấm nút thanh toán theo phương thức trên màn khách hàng. Đây là **testid thật** nên ổn định. |

### 3.5. Nhóm `APP_SHELL` (dòng 63–71) — khung app (header/sidebar/điều hướng)

```ts
64   APP_SHELL: {
65     HEADER: testId("app-header"),
66     SIDEBAR: testId("app-sidebar"),
67     USER_MENU: testId("app-user-menu"),
68     LOGOUT_BTN: testId("app-logout"),
69     NAV_HOME: testId("nav-home"),
70     NAV_SETTINGS: testId("nav-settings")
71   },
```

| Key | Selector | Loại | Ý nghĩa / khi nào dùng |
|-----|----------|------|------------------------|
| `HEADER` | `[data-testid="app-header"]` | [THẬT-quy ước] | Header của app. |
| `SIDEBAR` | `[data-testid="app-sidebar"]` | [THẬT-quy ước] | Thanh bên (sidebar). |
| `USER_MENU` | `[data-testid="app-user-menu"]` | [THẬT-quy ước] | Menu người dùng. |
| `LOGOUT_BTN` | `[data-testid="app-logout"]` | [THẬT-quy ước] | Nút đăng xuất. |
| `NAV_HOME` | `[data-testid="nav-home"]` | [THẬT-quy ước] | Link điều hướng về Home. |
| `NAV_SETTINGS` | `[data-testid="nav-settings"]` | [THẬT-quy ước] | Link điều hướng tới Settings. |

> Nhóm này theo **quy ước testid lý tưởng**; cần đối chiếu với UI thật để chắc các testid này tồn tại (khác với `CUSTOMER_DISPLAY` đã được xác nhận là testid production).

### 3.6. Nhóm `SETTINGS` (dòng 73–77) — màn cài đặt

```ts
74   SETTINGS: {
75     SAVE_BTN: testId("settings-save"),
76     SAVED_TOAST: testId("settings-saved-toast")
77   },
```

| Key | Selector | Loại | Ý nghĩa / khi nào dùng |
|-----|----------|------|------------------------|
| `SAVE_BTN` | `[data-testid="settings-save"]` | [THẬT-quy ước] | Nút lưu cài đặt. |
| `SAVED_TOAST` | `[data-testid="settings-saved-toast"]` | [THẬT-quy ước] | Toast báo đã lưu (thường đi kèm assert `MESSAGES.SETTINGS.SAVED`). |

### 3.7. Nhóm `COMMON` (dòng 79–89) — thành phần dùng chung (toast, modal, loading…)

```ts
80   COMMON: {
81     TOAST_SUCCESS: '[data-testid="toast-success"], [data-sonner-toast][data-type="success"]',
82     TOAST_ERROR: '[data-testid="toast-error"], [data-sonner-toast][data-type="error"]',
83     MODAL: '[role="dialog"]',
84     MODAL_CLOSE: testId("modal-close"),
85     MODAL_CONFIRM: testId("modal-confirm"),
86     MODAL_CANCEL: testId("modal-cancel"),
87     LOADING_SPINNER: testId("loading-spinner"),
88     EMPTY_STATE: testId("empty-state")
89   }
```

| Key | Selector | Loại | Ý nghĩa / khi nào dùng |
|-----|----------|------|------------------------|
| `TOAST_SUCCESS` | `[data-testid="toast-success"], [data-sonner-toast][data-type="success"]` | **[THẬT + FALLBACK kết hợp]** | Toast thành công. Danh sách 2 selector: ưu tiên `data-testid="toast-success"` (thật), **hoặc** fallback theo thư viện **Sonner** (`data-sonner-toast` + `data-type="success"`). Bao được cả trường hợp có/không testid. |
| `TOAST_ERROR` | `[data-testid="toast-error"], [data-sonner-toast][data-type="error"]` | **[THẬT + FALLBACK kết hợp]** | Toast lỗi. Tương tự trên, fallback theo Sonner với `data-type="error"`. |
| `MODAL` | `[role="dialog"]` | **[FALLBACK]** — bám `role` | Hộp thoại modal chung. Không dùng testid mà bám thuộc tính ARIA `role="dialog"` (khá ổn định về mặt accessibility). |
| `MODAL_CLOSE` | `[data-testid="modal-close"]` | [THẬT-quy ước] | Nút đóng modal. |
| `MODAL_CONFIRM` | `[data-testid="modal-confirm"]` | [THẬT-quy ước] | Nút xác nhận trong modal. |
| `MODAL_CANCEL` | `[data-testid="modal-cancel"]` | [THẬT-quy ước] | Nút huỷ trong modal. |
| `LOADING_SPINNER` | `[data-testid="loading-spinner"]` | [THẬT-quy ước] | Spinner đang tải. |
| `EMPTY_STATE` | `[data-testid="empty-state"]` | [THẬT-quy ước] | Trạng thái rỗng (không có dữ liệu). |

### Đóng object (dòng 90)

```ts
90 } as const
```

`as const` "đóng băng" toàn bộ registry thành literal type, giúp mỗi selector giữ đúng chuỗi/kiểu hàm khi dùng, tăng an toàn khi refactor và autocomplete.

---

## 5. Ghi chú & điểm dễ nhầm

- **Phân biệt THẬT vs FALLBACK là điều quan trọng nhất**:
  - **Đã xác nhận là testid production thật**: `CUSTOMER_DISPLAY.PAY_BY_METHOD` (JSDoc dòng 54–58).
  - **Thuần fallback (không có testid)**: cả nhóm `LOGIN_STAFF_TOKEN` (placeholder/type/role), cả nhóm `PASSCODE_GUARD` (text/class), `COMMON.MODAL` (role). Đây là những chỗ **dễ vỡ nhất** khi UI đổi copy/markup.
  - **Theo quy ước testid nhưng chưa chắc tồn tại trong app**: `LOGIN` (đánh dấu EXAMPLE/template), `APP_SHELL`, `SETTINGS`, và phần testid trong `COMMON`. Nên đối chiếu UI thật trước khi tin dùng.
- **`LOGIN` không phải luồng đăng nhập thật** — comment dòng 19 ghi rõ "EXAMPLE/template"; luồng thật là `LOGIN_STAFF_TOKEN`. Đừng viết test đăng nhập dựa trên nhóm `LOGIN`.
- **`INPUT` bám `placeholder="Enter Staff Token"`**: nếu app đổi placeholder (kể cả đổi ngôn ngữ), selector này **gãy** ngay. Đây là rủi ro đã được ghi chú và có đề xuất thêm `data-testid`.
- **Selector dạng hàm phải được gọi**: `PASSCODE_GUARD.DIGIT`, `CUSTOMER_DISPLAY.PAY_BY_METHOD` là **hàm**, phải truyền tham số mới ra selector. Dùng thẳng tên hàm như một chuỗi sẽ sai.
- **`button=` vs `button*=`**: `DIGIT` sinh `button=<n>` (khớp **đúng** text), còn helper `byText` sinh `tag*=text` (khớp **chứa** text). Chọn sai kiểu có thể khớp nhầm nhiều nút.
- **Selector nhiều lựa chọn (ngăn bằng dấu phẩy)** như `ERROR_ALERT`, `TOAST_SUCCESS`, `TOAST_ERROR` là **danh sách OR**: khớp bất kỳ mệnh đề nào — hữu ích để "bọc" cả trường hợp có testid lẫn markup của thư viện (Sonner). Khi đếm/định vị cần lưu ý có thể khớp **nhiều hơn một** element.
- **`data-sonner-toast`** cho thấy app dùng thư viện toast **Sonner**; fallback này bám vào attribute do Sonner tự gắn khi chưa có testid riêng.
