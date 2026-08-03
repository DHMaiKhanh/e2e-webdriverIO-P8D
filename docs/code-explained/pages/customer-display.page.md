# Giải thích code: `src/pages/customer-display.page.ts`

> **File nguồn:** [src/pages/customer-display.page.ts](../../../src/pages/customer-display.page.ts)
> **Loại:** Page Object (màn hình hướng khách hàng trên cửa sổ Tauri thứ hai)
> **Một câu:** `CustomerDisplayPage` thao tác màn hình "customer" (cửa sổ Tauri thứ hai); mỗi method tự chuyển sang window "customer", chạy hành động, rồi **tự khôi phục** window đang active — nên spec luồng thu ngân có thể "ghé" kiểm tra màn khách mà không phải quản lý cửa sổ thủ công.

---

## 1. Mục đích tổng quan

Theo docblock (dòng 5–13), P8D là app POS chạy **hai cửa sổ Tauri**: màn nhân viên ("main") và **màn hướng khách hàng ("customer")** — thường đặt ở màn hình/monitor thứ hai (mã nguồn app: `src/routes/customer/`).

Điểm cốt lõi trong thiết kế page này:

- **Mỗi method đều bọc trong `withWindow(WINDOW_LABELS.CUSTOMER, ...)`** — tự động: chuyển sang window "customer" → chạy hành động → **chuyển lại** window ban đầu (dù thành công hay lỗi).
- Nhờ đó spec đang lái luồng checkout phía nhân viên có thể **tạm ghé** sang màn khách để assert rồi quay lại **mà không cần tự `switchToWindow` qua lại**.

Đây là ứng dụng trực tiếp của helper `withWindow` trong [tauri-helper.ts](../../../src/utils/tauri-helper.js).

---

## 2. Các import / kế thừa (dòng 1–3)

```ts
1  import { SELECTORS } from "../constants/selectors.js"
2  import { WINDOW_LABELS, withWindow } from "../utils/tauri-helper.js"
3  import { BasePage } from "./base.page.js"
```

| Dòng | Ý nghĩa |
|------|---------|
| 1 | `SELECTORS` — dùng `SELECTORS.CUSTOMER_DISPLAY.PAY_BY_METHOD(methodId)` (selectors.ts dòng 59–61). |
| 2 | Từ [tauri-helper.ts](../../../src/utils/tauri-helper.js): `WINDOW_LABELS` (hằng nhãn cửa sổ, `CUSTOMER="customer"`, dòng 23–26) và `withWindow` (chạy hàm trong một cửa sổ rồi khôi phục cửa sổ cũ, dòng 125–133). |
| 3 | `BasePage` — **lớp cha** kế thừa (ở đây dùng `safeClick`). Xem [base.page.md](./base.page.md). |

### Khai báo lớp + hai thuộc tính bắt buộc (dòng 14–16)

```ts
14 export class CustomerDisplayPage extends BasePage {
15   protected readonly pageName = "CustomerDisplayPage"
16   protected readonly rootSelector = "body"
```

- **Dòng 14** — Kế thừa `BasePage`.
- **Dòng 15** — `pageName = "CustomerDisplayPage"` (nhãn log).
- **Dòng 16** — `rootSelector = "body"`. Khác các page khác, ở đây dùng thẳng `"body"` thay vì một selector đặc trưng. Lý do: màn khách có thể render nhiều nội dung khác nhau tuỳ trạng thái giỏ hàng, nên không có một phần tử "gốc" cố định; `"body"` luôn tồn tại. (Page này cũng không gọi `waitForLoaded()`/`isLoaded()` nên `rootSelector` chủ yếu để thoả "hợp đồng" abstract của lớp cha.)

---

## 3. Giải thích từng method / khối code

### 3.1. `isPaymentMethodVisible()` — kiểm tra nút thanh toán có hiện (dòng 18–22)

```ts
18  async isPaymentMethodVisible(methodId: string): Promise<boolean> {
19    return withWindow(WINDOW_LABELS.CUSTOMER, async () => {
20      return $(SELECTORS.CUSTOMER_DISPLAY.PAY_BY_METHOD(methodId)).isExisting()
21    })
22  }
```

- **Dòng 19** — Bọc trong `withWindow(WINDOW_LABELS.CUSTOMER, fn)`: trước khi chạy `fn`, driver chuyển sang cửa sổ "customer"; sau khi xong, tự chuyển về cửa sổ cũ.
- **Dòng 20** — Bên trong cửa sổ khách, kiểm tra nút "thanh toán bằng phương thức `methodId`" **có tồn tại** không. `PAY_BY_METHOD(methodId)` là selector **factory**: theo [selectors.ts](../../../src/constants/selectors.ts) dòng 60, nó trả `testId(\`customer-pay-by-${methodId}\`)` → ví dụ `methodId="cash"` cho ra `[data-testid="customer-pay-by-cash"]`. (Chú thích selectors.ts dòng 55–58: đây là một trong số ít khu vực app có `data-testid` production thật.)
- **Dòng 21** — `return` giá trị boolean ra ngoài; `withWindow` trả về đúng giá trị của `fn` (generic `<T>`), nên `isPaymentMethodVisible` nhận lại boolean từ trong cửa sổ khách.

### 3.2. `selectPaymentMethod()` — bấm chọn phương thức (dòng 24–28)

```ts
24  async selectPaymentMethod(methodId: string): Promise<void> {
25    return withWindow(WINDOW_LABELS.CUSTOMER, async () => {
26      await this.safeClick(SELECTORS.CUSTOMER_DISPLAY.PAY_BY_METHOD(methodId), `customer pay-by-${methodId}`)
27    })
28  }
```

- Cũng bọc trong `withWindow(...CUSTOMER...)` (dòng 25).
- **Dòng 26** — Bên trong cửa sổ khách, dùng `this.safeClick(...)` **kế thừa từ `BasePage`** để bấm nút phương thức thanh toán (chống-flake). Nhãn động `` `customer pay-by-${methodId}` `` giúp log lỗi rõ đang thao tác phương thức nào.

> Lưu ý cách viết: dù `fn` bên trong không trả gì, method vẫn `return withWindow(...)` để **chờ** helper hoàn tất (bao gồm cả bước chuyển cửa sổ về lại). Kiểu trả về khớp `Promise<void>`.

### 3.3. Xuất instance singleton (dòng 31)

```ts
31 export const customerDisplayPage = new CustomerDisplayPage()
```

- Instance dùng chung. Lưu ý: [index.ts](./index.md) hiện re-export `customerDisplayPage`/`CustomerDisplayPage` (dòng 12).

---

## 4. Quan hệ với các page/spec khác

- **Kế thừa** [BasePage](./base.page.md): dùng `safeClick`.
- **Phụ thuộc mạnh** vào [tauri-helper.ts](../../../src/utils/tauri-helper.js):
  - `withWindow` (dòng 125–133 của tauri-helper) — lưu handle cửa sổ hiện tại, `switchToWindow(label)`, chạy `fn`, rồi `finally` chuyển lại handle cũ.
  - `switchToWindow` (dòng 99–116) — vì tauri-driver không gắn nhãn cho handle, nó lần lượt switch qua từng handle và hỏi trang "bạn là cửa sổ nào" (`getCurrentWindowLabel`) cho tới khi trùng `label`.
  - Cảnh báo trong docblock helper (dòng 18–22): đóng bất kỳ cửa sổ nào sẽ huỷ cửa sổ kia, nên **luôn switch tường minh**, đừng giả định thứ tự cửa sổ.
- **Được export** qua [index.ts](./index.md) dòng 12.
- Selector: [SELECTORS.CUSTOMER_DISPLAY](../../../src/constants/selectors.ts) dòng 59–61.

---

## 5. Ghi chú & điểm dễ nhầm

- **Mọi thao tác đều tự chuyển cửa sổ.** Đừng tự `switchToWindow` trước rồi gọi các method này — chúng đã tự lo (và tự quay về), gọi lồng nhau chỉ gây rối handle.
- **`withWindow` luôn khôi phục cửa sổ gốc trong `finally`** — kể cả khi `fn` ném lỗi. Nhờ đó lỗi assert ở màn khách không để driver "kẹt" lại cửa sổ customer.
- **`PAY_BY_METHOD` là selector factory nhận `methodId`** — không phải chuỗi cố định. `methodId` phải khớp id phương thức thanh toán thật trong app (ví dụ `cash`, `card`...).
- **`rootSelector = "body"`** ở đây mang tính hình thức (thoả abstract của cha), page này không dùng `waitForLoaded()`.
- **Chỉ chạy đúng trong môi trường Tauri đa cửa sổ.** Ở chế độ browser thuần, các helper Tauri trở thành no-op/cảnh báo (xem docblock tauri-helper dòng 10–14) → hành vi màn khách sẽ không đúng như trên app thật.
