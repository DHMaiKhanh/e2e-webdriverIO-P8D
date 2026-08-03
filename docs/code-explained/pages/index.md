# Giải thích code: `src/pages/index.ts`

> **File nguồn:** [src/pages/index.ts](../../../src/pages/index.ts)
> **Loại:** Barrel (file gom export — "cửa hàng một điểm dừng" cho mọi Page Object/Component)
> **Một câu:** Barrel gom mọi Page Object và Component ra một điểm export duy nhất, để spec `import { loginPage } from "@pages"` gọn gàng thay vì đào vào từng file.

---

## 1. Mục đích tổng quan

Theo docblock (dòng 1–9), file này là **page-object barrel**. Vai trò:

- Spec/util **import từ một chỗ** (`@pages`) thay vì trỏ vào từng file lẻ. Ví dụ `import { loginPage } from "@pages"` thay vì `import { loginPage } from "../pages/login.page.js"`.
- Giữ import gọn gàng và **cho phép thay đổi cách hiện thực một page ở hậu trường** mà không phải sửa spec (spec chỉ biết tới alias `@pages`).
- **Quy ước** (dòng 8): mỗi page/component mới **phải được thêm export ở đây**.

> Alias `@pages` được cấu hình trong `tsconfig`/`wdio.conf` để trỏ về đúng file `src/pages/index` này. Bản thân barrel **không chứa logic** — chỉ là các câu `export ... from ...`.

---

## 2. Các import / kế thừa

File này **không import** để dùng nội bộ; nó chỉ **re-export** (xuất lại) các thứ từ nơi khác. Không có lớp/hàm nào được định nghĩa ở đây.

---

## 3. Giải thích từng khối code

### 3.1. Re-export các Page Object (dòng 10–13)

```ts
10 export { loginPage, LoginPage } from "./login.page.js"
11 export { staffTokenLoginPage, StaffTokenLoginPage } from "./staff-token-login.page.js"
12 export { customerDisplayPage, CustomerDisplayPage } from "./customer-display.page.js"
13 export { androidAppShellPage, AndroidAppShellPage } from "./android/app-shell.page.js"
```

Mỗi dòng xuất lại **hai thứ** từ một file page: **instance singleton** (viết thường, ví dụ `loginPage`) và **class** (viết hoa, ví dụ `LoginPage`).

| Dòng | Xuất ra | Từ file | Ghi chú |
|------|---------|---------|---------|
| 10 | `loginPage`, `LoginPage` | `./login.page.js` | Page mẫu/template. Xem [login.page.md](./login.page.md). |
| 11 | `staffTokenLoginPage`, `StaffTokenLoginPage` | `./staff-token-login.page.js` | Màn login **thật** mà `ensureLoggedIn()` dùng. Xem [staff-token-login.page.md](./staff-token-login.page.md). |
| 12 | `customerDisplayPage`, `CustomerDisplayPage` | `./customer-display.page.js` | Màn hướng khách (cửa sổ Tauri "customer"). Xem [customer-display.page.md](./customer-display.page.md). |
| 13 | `androidAppShellPage`, `AndroidAppShellPage` | `./android/app-shell.page.js` | Entry point cho Android (chuyển context WebView). Chú ý đường dẫn có thư mục con `android/`. Xem [app-shell.page.md](./android/app-shell.page.md). |

- **Tại sao xuất cả instance lẫn class?** Thường ngày spec dùng **instance** singleton (không phải `new`). Nhưng vẫn export **class** để nơi khác có thể tự tạo instance riêng hoặc dùng cho kiểu (type) khi cần.
- Đuôi `.js` (dù nguồn `.ts`) là do chuẩn **ESM/NodeNext**.

### 3.2. Re-export Component (dòng 15–16)

```ts
15 // Components
16 export { header, HeaderComponent } from "./components/header.component.js"
```

- **Dòng 15** — Comment phân nhóm, tách phần Page với phần Component cho dễ đọc.
- **Dòng 16** — Xuất lại instance `header` và class `HeaderComponent` từ thư mục con `components/`. Xem [header.component.md](./components/header.component.md).

> Lưu ý: `BaseComponent` (lớp cha của component) **không** được re-export ở đây — vì nó là lớp trừu tượng nội bộ, spec không dùng trực tiếp. Tương tự, `BasePage` cũng không xuất ở barrel (chỉ page con import trực tiếp).

---

## 4. Quan hệ với các page/spec khác

- **Điểm nhập của mọi spec/util** cần page object. Ví dụ [ensure-logged-in.ts](../../../src/utils/ensure-logged-in.ts) dòng 1: `import { androidAppShellPage, staffTokenLoginPage } from "@pages"` — hai symbol này đến từ dòng 13 và 11 của barrel.
- Là **danh mục trung tâm**: nhìn file này biết ngay project có những page/component nào để E2E lái.

---

## 5. Ghi chú & điểm dễ nhầm

- **Thêm page mới thì phải thêm dòng export ở đây**, nếu không `@pages` sẽ không thấy nó (import từ spec sẽ báo lỗi "không có export").
- **`app-shell` nằm trong thư mục con** `android/` — đường dẫn re-export là `./android/app-shell.page.js`, khác các page cùng cấp.
- **Barrel không có logic** — mọi hành vi nằm ở file gốc. Đừng tìm code xử lý ở đây.
- **Không re-export lớp base** (`BasePage`, `BaseComponent`) là có chủ ý: chúng là abstract nội bộ, dùng qua kế thừa chứ không import thẳng từ spec.
- **Instance (thường) vs class (hoa):** dùng instance cho thao tác hằng ngày; dùng class khi cần kiểu hoặc tạo instance mới.
