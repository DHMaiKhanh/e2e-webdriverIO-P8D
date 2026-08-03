# Giải thích code: `src/constants/routes.ts`

> **File nguồn:** [src/constants/routes.ts](../../../src/constants/routes.ts)
> **Loại:** Constants
> **Một câu:** Gom toàn bộ **đường dẫn (route)** của app vào một nơi, phản chiếu cây router của ứng dụng để spec tham chiếu `ROUTES.*` thay vì viết chuỗi URL trực tiếp.

---

## 1. Mục đích tổng quan

File export object `ROUTES` (kèm type `AppRoute`). Comment đầu file (dòng 1–5) nêu nguyên tắc:

- *"Mirror the application's router tree here"* — cấu trúc `ROUTES` phản chiếu cây route thật của app.
- *"keep this file in sync when routes are added"* — khi app thêm route mới, **cập nhật ở đây**.
- *"specs reference these, never inline URL strings"* — spec **luôn** dùng `ROUTES.LOGIN` thay vì gõ `"/login"` trực tiếp, để đổi route chỉ sửa một chỗ.

Ví dụ thực tế: `ensure-logged-in.ts` dùng `ROUTES.ROOT` và `ROUTES.LOGIN_STAFF_TOKEN` để điều hướng WebView.

---

## 2. Các helper (nếu có)

File **không có helper độc lập**, nhưng có **một route dạng hàm** (builder) là `ROUTES.APP.ORDER_CHECKOUT(orderId)` — sinh URL động theo `orderId`. Xem chi tiết ở bảng dưới.

---

## 3. Giải thích từng hằng số / nhóm

```ts
6  export const ROUTES = {
7    ROOT: "/",
8    SPLASHSCREEN: "/splashscreen",
9    /** QR-code login screen — no locatable DOM hooks today, see LOGIN_STAFF_TOKEN selectors. */
10   LOGIN: "/login",
11   /** Fallback text-token login form, reached via a secret tap on the About/version info. */
12   LOGIN_STAFF_TOKEN: "/login-staff-token",
13   /** Customer-facing display — always the second Tauri window (label "customer"). */
14   CUSTOMER: "/customer/",
15
16   APP: {
17     HOME: "/",
18     SETTINGS: "/settings",
19     ORDER_CHECKOUT: (orderId: string): string => `/order/${orderId}/checkout`
20   }
21 } as const
```

### Route cấp cao nhất (dòng 7–14)

| Key | Giá trị | Ý nghĩa / khi nào dùng |
|-----|---------|------------------------|
| `ROOT` | `"/"` | **Gốc app**. Điều hướng về đây để router SPA tự quyết định màn hình (đã auth → màn thật; chưa auth → bị đá về `/login`). `ensure-logged-in.ts` dùng `browser.url(ROUTES.ROOT)` mở đầu luồng. |
| `SPLASHSCREEN` | `"/splashscreen"` | Màn **splash chuyển tiếp tạm thời** lúc boot. Chỉ xuất hiện thoáng qua; logic login coi URL chứa `splashscreen` là "chưa settle", không phải màn thật. |
| `LOGIN` | `"/login"` | Màn **đăng nhập bằng QR code**. JSDoc (dòng 9) nêu rõ: **hiện không có DOM hook định vị được** → không thao tác tự động trực tiếp trên màn này, phải dùng luồng `LOGIN_STAFF_TOKEN`. |
| `LOGIN_STAFF_TOKEN` | `"/login-staff-token"` | **Form login dự phòng bằng token dạng text**. JSDoc (dòng 11): vào được qua một **thao tác chạm "bí mật"** lên phần About/thông tin phiên bản. Đây là **UI login duy nhất có element định vị được** hôm nay, nên test tự động dùng route này để đăng nhập. |
| `CUSTOMER` | `"/customer/"` | **Màn hình hướng khách hàng** (customer-facing display). JSDoc (dòng 13): luôn là **cửa sổ Tauri thứ hai** (label `"customer"`). Lưu ý có **dấu `/` ở cuối**. |

### Nhóm `APP` — route bên trong app đã đăng nhập (dòng 16–20)

| Key | Giá trị | Ý nghĩa / khi nào dùng |
|-----|---------|------------------------|
| `APP.HOME` | `"/"` | Trang **chủ trong app** sau khi đã đăng nhập. (Trùng giá trị với `ROOT` vì gốc `/` của session đã auth chính là home.) |
| `APP.SETTINGS` | `"/settings"` | Trang **cài đặt**. Dùng khi test điều hướng tới màn Settings. |
| `APP.ORDER_CHECKOUT` | `(orderId) => `/order/${orderId}/checkout`` | **Route dạng hàm (builder)**: nhận `orderId: string`, trả về đường dẫn checkout của đúng đơn hàng đó, ví dụ `ORDER_CHECKOUT("A123")` → `"/order/A123/checkout"`. Dùng khi cần vào màn thanh toán của một đơn cụ thể. |

### Type phụ trợ (dòng 23)

```ts
23 export type AppRoute = (typeof ROUTES.APP)[keyof typeof ROUTES.APP]
```

- Lấy **type của các giá trị** bên trong `ROUTES.APP`.
- Kết quả là union: `"/"` (HOME) `| "/settings"` (SETTINGS) `| ((orderId: string) => string)` (ORDER_CHECKOUT).
- Lưu ý: vì `ORDER_CHECKOUT` là **hàm**, `AppRoute` bao gồm cả kiểu **string** lẫn kiểu **hàm trả string** — không phải thuần chuỗi.

---

## 5. Ghi chú & điểm dễ nhầm

- **`LOGIN` (QR) vs `LOGIN_STAFF_TOKEN` (text)**: đây là điểm dễ nhầm nhất. Màn `/login` mặc định dùng QR và **không có DOM hook** để tự động hoá; muốn login bằng script phải đi qua `/login-staff-token`. Đó là lý do `ensure-logged-in.ts` điều hướng tới `ROUTES.LOGIN_STAFF_TOKEN`, không phải `ROUTES.LOGIN`.
- **`CUSTOMER` có dấu `/` cuối** (`"/customer/"`) trong khi các route khác thì không — giữ nguyên đúng như file nguồn, đừng "chuẩn hoá" bỏ dấu này.
- **`ROOT` và `APP.HOME` trùng giá trị `"/"`** nhưng khác ngữ nghĩa: `ROOT` là điểm vào chung để router phân luồng, `APP.HOME` là trang chủ khi đã đăng nhập. Chọn hằng số theo **ý định**, không theo giá trị.
- **`ORDER_CHECKOUT` là hàm, không phải chuỗi**: phải **gọi** nó (`ORDER_CHECKOUT(orderId)`) mới ra URL. Nếu lỡ dùng thẳng `ROUTES.APP.ORDER_CHECKOUT` như một string sẽ sai.
- **So khớp URL trong test thường dùng `includes`**: các luồng như `ensure-logged-in.ts` kiểm tra `url.includes("login")`/`includes("splashscreen")` — dựa trên **một phần** chuỗi route, nên đổi tên route (ví dụ đổi `/login`) có thể ảnh hưởng logic so khớp.
- **`as const` (dòng 21)** giữ các giá trị là literal, giúp `AppRoute` suy ra chính xác và tránh gán nhầm chuỗi lạ.
