# Giải thích code: `src/specs/auth/staff-token-login.e2e.ts`

> **File nguồn:** [src/specs/auth/staff-token-login.e2e.ts](../../../../src/specs/auth/staff-token-login.e2e.ts)
> **Loại:** Spec (Mocha E2E test)
> **Một câu:** Kiểm thử form đăng nhập dự phòng bằng **staff token dạng text** tại `/login-staff-token` — form load được và báo lỗi đúng khi nhập token không hợp lệ.

---

## 1. Mục đích tổng quan

Màn hình login **chính** của app P8D là màn **quét mã QR** (`/login`) — không có "DOM hook" nào ổn định để assert trạng thái, nên E2E hiện tại **không** drive được luồng QR (nếu không thêm `data-testid` vào nó).

Vì vậy, spec này kiểm thử **lối vào login duy nhất mà E2E drive được hôm nay**: form nhập staff token dạng text tại `/login-staff-token` (nguồn app: `src/routes/login-staff-token/-components/staff-token-form.tsx`). Suite (tag `@smoke`) xác nhận 2 điều:

1. Form staff token **load thành công**.
2. Nhập một token **không hợp lệ** thì UI **hiện alert lỗi**.

Lưu ý: spec này **không** cần đăng nhập thành công (không cần `STAFF_TOKEN` thật); nó chỉ kiểm tra form hiển thị và phản hồi lỗi. Toàn bộ tương tác được ủy quyền cho page object `staffTokenLoginPage`.

---

## 2. Các import / phụ thuộc (dòng 9–10)

```ts
9  import { expect } from "@wdio/globals"
10 import { staffTokenLoginPage } from "@pages"
```

| Dòng | Ý nghĩa |
|------|---------|
| 9 | `expect` từ `@wdio/globals` — API assertion của WebdriverIO. |
| 10 | `staffTokenLoginPage` — **instance page object** đã tạo sẵn (singleton), export từ barrel [src/pages/index.ts](../../../../src/pages/index.ts) (dòng 11). Định nghĩa lớp ở [src/pages/staff-token-login.page.ts](../../../../src/pages/staff-token-login.page.ts). |

### Các method của page object được spec dùng

Từ [staff-token-login.page.ts](../../../../src/pages/staff-token-login.page.ts) (lớp `StaffTokenLoginPage extends BasePage`):

- **`open()`** (dòng 18–21): `browser.url("/login-staff-token")` rồi `waitForLoaded()`.
- **`isLoaded()`** (kế thừa từ `BasePage`, dòng 28–39): chờ `rootSelector` hiển thị; trả `true`/`false` (không ném lỗi). `rootSelector` chính là `SELECTORS.LOGIN_STAFF_TOKEN.INPUT` = `input[placeholder="Enter Staff Token"]`.
- **`signIn(token)`** (dòng 31–34): gọi `enterToken(token)` (điền ô input qua `safeFill`) rồi `submit()` (bấm nút qua `safeClick`).
- **`hasErrorAlert()`** (dòng 36–38): trả về `$(SELECTORS.LOGIN_STAFF_TOKEN.ERROR_ALERT).isExisting()` — có tồn tại phần tử báo lỗi hay không.

Các selector liên quan (từ [src/constants/selectors.ts](../../../../src/constants/selectors.ts), khối `LOGIN_STAFF_TOKEN` dòng 34–40):

```
INPUT:      input[placeholder="Enter Staff Token"]
SUBMIT_BTN: button[type="submit"]
ERROR_ALERT: [role="alert"], .destructive, .text-destructive
```

> 💡 Comment trong file selectors ghi rõ: form thật trên Android **không có** `name`/`data-testid`, id lại tự sinh bởi React, nên **placeholder** là hook ổn định duy nhất để định vị ô input.

---

## 3. Giải thích từng khối code

### 3.1. Docblock đầu file (dòng 1–8)

```ts
1  /**
2   * Covers the fallback text-token login form at /login-staff-token
3   * (src/routes/login-staff-token/-components/staff-token-form.tsx).
4   *
5   * The app's primary /login screen is QR-code based with no assertable DOM
6   * state machine hook, so this is the only login entry point E2E can drive
7   * today without adding data-testid attributes to the QR flow.
8   */
```

Giải thích **tại sao** spec tồn tại và **tại sao** chỉ test form token: màn QR chính không có DOM hook để assert, nên form token là điểm vào login duy nhất mà E2E có thể điều khiển hiện tại.

### 3.2. Khối `describe` (dòng 12)

```ts
12 describe("Staff token login @smoke", () => {
```

- Test suite Mocha tên `"Staff token login @smoke"`. Tag `@smoke` để lọc chạy nhóm smoke.

### 3.3. Hook `beforeEach` (dòng 13–15)

```ts
13   beforeEach(async () => {
14     await staffTokenLoginPage.open()
15   })
```

- **Chạy trước MỖI `it`** trong suite. Gọi `staffTokenLoginPage.open()` để: điều hướng WebView tới `/login-staff-token` và chờ form load xong (`waitForLoaded`).
- Nhờ `beforeEach`, mỗi test bắt đầu từ **trạng thái sạch, form đã mở** — không phụ thuộc test trước để lại URL ở đâu. Ví dụ test 2 (`signIn`) có thể đã điều hướng đi nơi khác, nhưng test kế tiếp vẫn được `open()` lại form.
- Nếu `open()` thất bại (form không load), `waitForLoaded` sẽ ném lỗi → test tương ứng fail ngay ở khâu setup.

**Điều kiện chạy/skip:** không có logic skip — `beforeEach` luôn chạy trước mỗi test.

### 3.4. Test 1 — Form load được (dòng 17–19)

```ts
17   it("loads the staff token form", async () => {
18     await expect(await staffTokenLoginPage.isLoaded()).toBe(true)
19   })
```

- **Dòng 18** — Gọi `isLoaded()` (chờ ô input `input[placeholder="Enter Staff Token"]` hiển thị), khẳng định kết quả bằng `true`.
- Vì `beforeEach` đã `open()` (bản thân nó đã `waitForLoaded`), test này chủ yếu là một **assertion tường minh** rằng form đã sẵn sàng, và biến trạng thái load thành một phép kiểm chứng có thể fail rõ ràng.
- `isLoaded()` trả `false` thay vì ném lỗi khi phần tử không xuất hiện (xem `BasePage.isLoaded` dòng 28–39), nên `expect(...).toBe(true)` là cách để test fail đúng nghĩa nếu form không load.

**Điều kiện chạy/skip:** không có logic skip.

### 3.5. Test 2 — Token sai thì hiện lỗi (dòng 21–24)

```ts
21   it("shows an error for an invalid staff token", async () => {
22     await staffTokenLoginPage.signIn("00000000-invalid-token")
23     await expect(await staffTokenLoginPage.hasErrorAlert()).toBe(true)
24   })
```

- **Dòng 22** — `signIn("00000000-invalid-token")`: điền một token **cố ý sai định dạng/không hợp lệ** vào ô input rồi bấm submit. (Bên trong: `enterToken` → `safeFill`, `submit` → `safeClick`.)
- **Dòng 23** — Sau khi submit token sai, khẳng định `hasErrorAlert()` trả `true` — tức đã xuất hiện phần tử báo lỗi khớp selector `ERROR_ALERT` (`[role="alert"], .destructive, .text-destructive`).
- Đây là kiểm thử **đường lỗi (negative path)**: xác nhận form phản hồi đúng cho input xấu, không cần token thật.

**Điều kiện chạy/skip:** không có logic skip.

---

## 4. Cách dùng / quan hệ với file khác

- **Page object:** mọi thao tác đi qua [staff-token-login.page.ts](../../../../src/pages/staff-token-login.page.ts), lớp này kế thừa [base.page.ts](../../../../src/pages/base.page.ts) (chứa `isLoaded`, `waitForLoaded`, `safeFill`, `safeClick`).
- **Selector:** định nghĩa tập trung ở [src/constants/selectors.ts](../../../../src/constants/selectors.ts), khối `LOGIN_STAFF_TOKEN`.
- **Route:** `/login-staff-token` khai báo ở [src/constants/routes.ts](../../../../src/constants/routes.ts) (dòng 12, `LOGIN_STAFF_TOKEN`).
- **Khác với `ensureLoggedIn`:** hàm [ensure-logged-in.ts](../../../../src/utils/ensure-logged-in.ts) dùng form này để **đăng nhập thật một lần** (cần `STAFF_TOKEN` hợp lệ). Còn spec này **không** đăng nhập thành công — nó chỉ kiểm form hiển thị và báo lỗi, nên **không** cần biến môi trường `STAFF_TOKEN`.

---

## 5. Ghi chú & điểm dễ nhầm

- **`beforeEach` (không phải `before`)**: form được mở lại **trước từng test**. Điều này quan trọng vì test 2 submit token sai có thể để lại trạng thái/điều hướng khác; `beforeEach` đảm bảo mỗi test khởi đầu ở form sạch.
- **Không phụ thuộc `STAFF_TOKEN`**: spec cố tình dùng token giả `"00000000-invalid-token"`, nên chạy được mà không cần secret nào trong `.env`.
- **Selector báo lỗi khá "rộng"**: `[role="alert"], .destructive, .text-destructive` bắt nhiều dạng hiển thị lỗi khác nhau của UI. Đây là chủ ý để bền với thay đổi nhỏ về class/markup của thông báo lỗi.
- **`isLoaded()` không ném lỗi**: nó trả `false` khi không load được (log `error`), nên phải assert `.toBe(true)` để test fail đúng — nếu quên assert, test sẽ pass giả tạo.
- **Chỉ dựa vào placeholder để tìm input**: nếu app đổi placeholder `"Enter Staff Token"` (kể cả đổi chữ hoa/thường hay dịch ngôn ngữ), selector sẽ hỏng — đây là điểm mong manh đã được ghi chú trong file selectors.
- **`@smoke` là tag lọc**, chỉ là chuỗi trong tên suite, không phải cú pháp Mocha đặc biệt.
