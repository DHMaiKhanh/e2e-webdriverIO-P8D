# Giải thích code: `src/pages/login.page.ts`

> **File nguồn:** [src/pages/login.page.ts](../../../src/pages/login.page.ts)
> **Loại:** Page Object (mẫu/template minh hoạ quy ước)
> **Một câu:** `LoginPage` là một Page Object **ví dụ** giữ làm khuôn mẫu — minh hoạ đầy đủ quy ước viết page (kế thừa `BasePage`, khai báo `pageName`/`rootSelector`, có `open()`, getter truy vấn, method hành động).

---

## 1. Mục đích tổng quan

Theo docblock (dòng 5–16), `LoginPage` **là một EXAMPLE/template**, không phải màn login thật đang được E2E lái. Nó tồn tại để chỉ ra **các quy ước mà mọi page object nên tuân theo**:

- **extend BasePage** — kế thừa toàn bộ helper dùng chung.
- **khai báo `pageName` + `rootSelector`** — hoàn thành "hợp đồng" abstract của lớp cha.
- **cung cấp `open()` (navigator), các getter truy vấn, và method hành động.**
- **tham chiếu selector từ `SELECTORS`, không bao giờ viết chuỗi selector inline.**

> ⚠️ Màn login **thực tế** mà test hiện lái được là form staff-token (`/login-staff-token`), xem [staff-token-login.page.md](./staff-token-login.page.md). Màn `/login` chính là màn **QR-code** không có DOM hook ổn định (xem [routes.ts](../../../src/constants/routes.ts) dòng 9 và [selectors.ts](../../../src/constants/selectors.ts) dòng 19). Vì thế `LoginPage` được giữ như bộ khung mẫu để nhân bản khi viết page mới.

---

## 2. Các import / kế thừa (dòng 1–3)

```ts
1  import { ROUTES } from "../constants/routes.js"
2  import { SELECTORS } from "../constants/selectors.js"
3  import { BasePage } from "./base.page.js"
```

| Dòng | Ý nghĩa |
|------|---------|
| 1 | `ROUTES` — hằng số route. Ở đây dùng `ROUTES.LOGIN` = `/login`. Xem [routes.ts](../../../src/constants/routes.ts). |
| 2 | `SELECTORS` — registry selector. Dùng nhánh `SELECTORS.LOGIN.*`. Xem [selectors.ts](../../../src/constants/selectors.ts) dòng 20–25. |
| 3 | `BasePage` — **lớp cha** mà `LoginPage` kế thừa. Xem [base.page.md](./base.page.md). |

### Khai báo lớp + hai thuộc tính bắt buộc (dòng 17–19)

```ts
17 export class LoginPage extends BasePage {
18   protected readonly pageName = "LoginPage"
19   protected readonly rootSelector = SELECTORS.LOGIN.CARD
```

- **Dòng 17** — `LoginPage extends BasePage`: nhận hết `isLoaded`, `waitForLoaded`, `safeClick`, `safeFill`, toast/modal helper... từ lớp cha.
- **Dòng 18** — **Hiện thực hoá** `pageName` (abstract trong `BasePage`) = `"LoginPage"`. Chuỗi này xuất hiện trong mọi log/thông báo lỗi của page.
- **Dòng 19** — **Override** `rootSelector` = `SELECTORS.LOGIN.CARD`. Theo [selectors.ts](../../../src/constants/selectors.ts) dòng 21, `LOGIN.CARD` = `testId("login-card")` = `[data-testid="login-card"]`. Đây là phần tử mà `isLoaded()`/`waitForLoaded()` của lớp cha sẽ chờ để xác nhận màn login đã hiển thị.

---

## 3. Giải thích từng method / khối code

### 3.1. `open()` — navigator (dòng 23–26)

```ts
23  async open(): Promise<void> {
24    await browser.url(ROUTES.LOGIN)
25    await this.waitForLoaded()
26  }
```

- **Dòng 24** — Điều hướng tới `/login` (`ROUTES.LOGIN`).
- **Dòng 25** — Gọi `this.waitForLoaded()` **kế thừa từ `BasePage`**: chờ `rootSelector` (`login-card`) hiển thị, **ném lỗi nếu không load**. Nhờ đó khi `open()` trả về, ta chắc chắn màn hình đã sẵn sàng để thao tác — mẫu chuẩn cho mọi navigator.

### 3.2. Getter truy vấn — `hasErrorMessage()` / `getErrorMessage()` (dòng 30–36)

```ts
30  async hasErrorMessage(): Promise<boolean> {
31    return $(SELECTORS.LOGIN.ERROR_MESSAGE).isExisting()
32  }
33
34  async getErrorMessage(): Promise<string> {
35    return $(SELECTORS.LOGIN.ERROR_MESSAGE).getText()
36  }
```

- **`hasErrorMessage`** (dòng 30–32) — trả `true/false` xem thông báo lỗi **có tồn tại** trong DOM không. `SELECTORS.LOGIN.ERROR_MESSAGE` = `testId("login-error")` (selectors.ts dòng 23).
- **`getErrorMessage`** (dòng 34–36) — lấy **text** của thông báo lỗi để spec `expect`.
- Đây là các **query getter** thuần đọc, không gây side-effect — quy ước tách bạch giữa "hỏi trạng thái" và "thực hiện hành động".

### 3.3. Hành động — `submit()` (dòng 40–42)

```ts
40  async submit(): Promise<void> {
41    await this.safeClick(SELECTORS.LOGIN.SUBMIT_BTN, "login submit")
42  }
```

- Bấm nút submit qua `this.safeClick(...)` **kế thừa từ `BasePage`** — được click chống-flake (chờ clickable, scroll vào giữa, retry khi stale/intercepted).
- Tham số thứ hai `"login submit"` là **label** cho log — khi lỗi sẽ hiện `[LoginPage] login submit not clickable` thay vì in nguyên selector khó đọc.
- `SELECTORS.LOGIN.SUBMIT_BTN` = `testId("login-submit")` (selectors.ts dòng 22).

### 3.4. Xuất instance singleton (dòng 45)

```ts
45 export const loginPage = new LoginPage()
```

- Tạo sẵn **một instance dùng chung** và export ra. Spec/util import **instance** `loginPage` (không phải tự `new`). Barrel [index.ts](./index.md) re-export cả `loginPage` (instance) lẫn `LoginPage` (class).
- **Tại sao singleton?** Page Object không giữ state riêng (mọi state nằm ở trình duyệt), nên một instance tái dùng khắp nơi là đủ và gọn.

---

## 4. Quan hệ với các page/spec khác

- **Kế thừa** [BasePage](./base.page.md): `open()` dùng `waitForLoaded()`, `submit()` dùng `safeClick()`.
- **Được export** qua [index.ts](./index.md) dòng 10: `export { loginPage, LoginPage } from "./login.page.js"`.
- **Là bản mẫu** cho page thật [StaffTokenLoginPage](./staff-token-login.page.md) — cấu trúc gần giống nhưng thao tác trên form token thật.
- Selector ở [SELECTORS.LOGIN](../../../src/constants/selectors.ts), route ở [ROUTES.LOGIN](../../../src/constants/routes.ts).

---

## 5. Ghi chú & điểm dễ nhầm

- **Đây là TEMPLATE, không phải luồng login thật.** `SELECTORS.LOGIN.*` trỏ tới các `data-testid` (`login-card`, `login-submit`...) mà màn QR thật **không có** (xem chú thích selectors.ts dòng 19). Muốn login thật, dùng `StaffTokenLoginPage`.
- **`open()` sẽ ném lỗi nếu `login-card` không xuất hiện** (do `waitForLoaded`). Trên app thật (màn QR), phần tử này không tồn tại → `open()` sẽ fail. Đó là chủ ý: file này để làm khuôn, không phải để chạy trên UI thật.
- **Tách getter (đọc) và action (ghi):** `hasErrorMessage`/`getErrorMessage` chỉ đọc; `submit` mới gây side-effect. Giữ nếp này khi viết page mới.
- **Luôn dùng `SELECTORS`, không viết selector inline** — đúng quy ước để khi UI đổi chỉ sửa một chỗ.
