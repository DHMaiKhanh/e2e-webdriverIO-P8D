# Giải thích code: `src/pages/staff-token-login.page.ts`

> **File nguồn:** [src/pages/staff-token-login.page.ts](../../../src/pages/staff-token-login.page.ts)
> **Loại:** Page Object (màn login **thật** đang được E2E lái)
> **Một câu:** `StaffTokenLoginPage` điều khiển form nhập staff-token tại `/login-staff-token` — luồng login duy nhất hiện có DOM định vị được, nên là màn đăng nhập mà `ensureLoggedIn()` thực sự dùng.

---

## 1. Mục đích tổng quan

Theo docblock (dòng 5–13), đây là **form login dự phòng thật** tại `/login-staff-token` (mã nguồn app: `src/routes/login-staff-token/-components/staff-token-form.tsx`).

Bối cảnh quan trọng:

- Màn login **chính** của app là màn **QR-code**, **không có DOM hook định vị được** → E2E không lái được.
- Vì vậy form text-token này là **UI login duy nhất** mà E2E hiện có thể thao tác.
- **Không phần tử nào có `data-testid`**; selector phải "chữa cháy" bằng thuộc tính `name`/`type`/`placeholder`. Docblock (dòng 11–12) nhắc: nên đề xuất team thêm `data-testid` khi thuận tiện.

Khác với `LoginPage` (chỉ là template), `StaffTokenLoginPage` được **`ensureLoggedIn()` gọi thật** để đăng nhập một lần. Xem [ensure-logged-in.md](../../code-explained/utils/ensure-logged-in.md).

---

## 2. Các import / kế thừa (dòng 1–3)

```ts
1  import { ROUTES } from "../constants/routes.js"
2  import { SELECTORS } from "../constants/selectors.js"
3  import { BasePage } from "./base.page.js"
```

| Dòng | Ý nghĩa |
|------|---------|
| 1 | `ROUTES` — dùng `ROUTES.LOGIN_STAFF_TOKEN` = `/login-staff-token` (routes.ts dòng 12). |
| 2 | `SELECTORS` — dùng nhánh `SELECTORS.LOGIN_STAFF_TOKEN.*` (selectors.ts dòng 34–40). |
| 3 | `BasePage` — **lớp cha** kế thừa (`safeFill`, `safeClick`, `waitForLoaded`...). Xem [base.page.md](./base.page.md). |

### Khai báo lớp + hai thuộc tính bắt buộc (dòng 14–16)

```ts
14 export class StaffTokenLoginPage extends BasePage {
15   protected readonly pageName = "StaffTokenLoginPage"
16   protected readonly rootSelector = SELECTORS.LOGIN_STAFF_TOKEN.INPUT
```

- **Dòng 14** — Kế thừa `BasePage`.
- **Dòng 15** — `pageName = "StaffTokenLoginPage"` (nhãn log).
- **Dòng 16** — **Override** `rootSelector` = `SELECTORS.LOGIN_STAFF_TOKEN.INPUT`. Theo [selectors.ts](../../../src/constants/selectors.ts) dòng 37, `INPUT` = `input[placeholder="Enter Staff Token"]`. Chú thích ở đó nêu rõ: field **không có** `name`/`testid` và có `id` React tự sinh ngẫu nhiên, nên **placeholder là hook ổn định duy nhất**. `isLoaded()`/`waitForLoaded()` sẽ chờ chính ô input này.

---

## 3. Giải thích từng method / khối code

### 3.1. `open()` — navigator (dòng 18–21)

```ts
18  async open(): Promise<void> {
19    await browser.url(ROUTES.LOGIN_STAFF_TOKEN)
20    await this.waitForLoaded()
21  }
```

- **Dòng 19** — Điều hướng tới `/login-staff-token`.
- **Dòng 20** — `waitForLoaded()` (kế thừa) chờ ô input hiển thị, ném lỗi nếu không load. Sau khi `open()` trả về, form đã sẵn sàng nhập.

### 3.2. `enterToken()` — nhập token (dòng 23–25)

```ts
23  async enterToken(token: string): Promise<void> {
24    await this.safeFill(SELECTORS.LOGIN_STAFF_TOKEN.INPUT, token, "staff token input")
25  }
```

- Dùng `this.safeFill(...)` **kế thừa từ `BasePage`**: chờ input hiển thị → click focus → **`clearValue()`** (xoá giá trị cũ) → `setValue(token)`. Nhờ `clearValue`, gọi lại nhiều lần không bị nối chuỗi token cũ.
- Nhãn `"staff token input"` giúp log lỗi dễ đọc.

### 3.3. `submit()` — bấm nút gửi (dòng 27–29)

```ts
27  async submit(): Promise<void> {
28    await this.safeClick(SELECTORS.LOGIN_STAFF_TOKEN.SUBMIT_BTN, "staff token submit")
29  }
```

- Bấm nút submit qua `safeClick` (chống-flake). `SUBMIT_BTN` = `button[type="submit"]` (selectors.ts dòng 38) — cũng phải dựa vào thuộc tính `type` vì không có testid.

### 3.4. `signIn()` — luồng đăng nhập gộp (dòng 31–34)

```ts
31  async signIn(token: string): Promise<void> {
32    await this.enterToken(token)
33    await this.submit()
34  }
```

- **Method tiện dụng** gộp hai bước: nhập token rồi submit. Đây chính là hàm mà `ensureLoggedIn()` gọi (`staffTokenLoginPage.signIn(token)`). Tách nhỏ `enterToken`/`submit` cho phép spec dùng riêng khi cần (ví dụ nhập token sai rồi kiểm tra chưa submit), còn `signIn` là lối tắt cho trường hợp thường gặp.

### 3.5. Getter lỗi — `hasErrorAlert()` / `getErrorText()` (dòng 36–42)

```ts
36  async hasErrorAlert(): Promise<boolean> {
37    return $(SELECTORS.LOGIN_STAFF_TOKEN.ERROR_ALERT).isExisting()
38  }
39
40  async getErrorText(): Promise<string> {
41    return $(SELECTORS.LOGIN_STAFF_TOKEN.ERROR_ALERT).getText()
42  }
```

- **`hasErrorAlert`** — token sai thì có hiện alert lỗi không (`isExisting`).
- **`getErrorText`** — lấy text alert để `expect`.
- `ERROR_ALERT` = `'[role="alert"], .destructive, .text-destructive'` (selectors.ts dòng 39) — selector **kép** (OR) khớp nhiều cách app có thể render lỗi (thuộc tính ARIA `role="alert"` hoặc class Tailwind `destructive`), tăng khả năng bắt trúng vì không có testid.

### 3.6. Xuất instance singleton (dòng 45)

```ts
45 export const staffTokenLoginPage = new StaffTokenLoginPage()
```

- Instance dùng chung, được [index.ts](./index.md) dòng 11 re-export và `ensureLoggedIn()` import qua `@pages`.

---

## 4. Quan hệ với các page/spec khác

- **Kế thừa** [BasePage](./base.page.md): `safeFill`, `safeClick`, `waitForLoaded`.
- **Được `ensureLoggedIn()` sử dụng** — util gọi `staffTokenLoginPage.signIn(token)` sau khi điều hướng tới form. Xem [ensure-logged-in.md](../../code-explained/utils/ensure-logged-in.md) mục 4.5.
- **Được export** qua [index.ts](./index.md) dòng 11.
- **Cùng họ với** [LoginPage](./login.page.md) (template) nhưng đây là bản chạy thật.
- Selector: [SELECTORS.LOGIN_STAFF_TOKEN](../../../src/constants/selectors.ts); route: [ROUTES.LOGIN_STAFF_TOKEN](../../../src/constants/routes.ts).

---

## 5. Ghi chú & điểm dễ nhầm

- **Selector ở đây "mỏng manh" vì thiếu `data-testid`** — dựa vào `placeholder`, `type="submit"`, `role="alert"`. Nếu team đổi placeholder/nhãn là selector gãy. Docblock đã ghi nhận nợ kỹ thuật này.
- **`signIn` = `enterToken` + `submit`.** Đừng gọi trùng cả `signIn` lẫn `submit` — sẽ submit hai lần.
- **`ERROR_ALERT` là selector OR nhiều lựa chọn** — `isExisting()` trả `true` nếu **bất kỳ** biến thể nào khớp.
- **Đây (không phải `LoginPage`) là màn login E2E lái thật** trên Android/desktop. Truy cập form được vào qua route trực tiếp `/login-staff-token` (trong app thật form này ẩn sau "secret tap" trên màn About/version — xem routes.ts dòng 11).
- **`rootSelector` chính là ô input**, nên `waitForLoaded()` = chờ ô nhập token hiện ra.
