# Giải thích code: `src/pages/components/header.component.ts`

> **File nguồn:** [src/pages/components/header.component.ts](../../../../src/pages/components/header.component.ts)
> **Loại:** Component (mảnh UI tái sử dụng — mẫu/template)
> **Một câu:** `HeaderComponent` là component **ví dụ** làm khuôn: mô hình hoá thanh header xuất hiện trên nhiều trang, scope truy vấn theo root và phơi ra các hành động rõ ý định (mở user menu, đăng xuất).

---

## 1. Mục đích tổng quan

Theo docblock (dòng 4–10), `HeaderComponent` là **component EXAMPLE giữ làm template**. Nó minh hoạ cách mô hình hoá một mảnh UI xuất hiện ở **nhiều trang**:

- **Scope mọi truy vấn theo component root** (kế thừa `BaseComponent`).
- **Phơi ra các action rõ ý định** — tên method nói lên hành vi (`openUserMenu`, `logout`) thay vì để spec tự mò selector.

Đây là bản mẫu để nhân bản khi cần component mới (sidebar, dialog...). Selector của nó trỏ tới `SELECTORS.APP_SHELL.*` (header/user-menu/logout) — là các `data-testid` mẫu của app shell.

---

## 2. Các import / kế thừa (dòng 1–3)

```ts
1  import { SELECTORS } from "../../constants/selectors.js"
2  import { TIMEOUTS } from "../../constants/timeouts.js"
3  import { BaseComponent } from "./base.component.js"
```

| Dòng | Ý nghĩa |
|------|---------|
| 1 | `SELECTORS` — dùng nhánh `SELECTORS.APP_SHELL.*` (selectors.ts dòng 64–71). Đường dẫn `../../` vì file ở sâu trong `pages/components/`. |
| 2 | `TIMEOUTS` — dùng `TIMEOUTS.SHORT` = 5s cho các `waitForClickable`. |
| 3 | `BaseComponent` — **lớp cha** kế thừa (cung cấp `root`, `$()` scope-theo-root, `isDisplayed()`). Xem [base.component.md](./base.component.md). |

### Khai báo lớp + override rootSelector (dòng 11–12)

```ts
11 export class HeaderComponent extends BaseComponent {
12   protected readonly rootSelector = SELECTORS.APP_SHELL.HEADER
```

- **Dòng 11** — Kế thừa `BaseComponent`.
- **Dòng 12** — **Override** `rootSelector` = `SELECTORS.APP_SHELL.HEADER`. Theo [selectors.ts](../../../../src/constants/selectors.ts) dòng 65, `HEADER` = `testId("app-header")` = `[data-testid="app-header"]`. Mọi truy vấn qua `this.$(...)` sẽ tìm **bên trong** phần tử header này.

---

## 3. Giải thích từng method / khối code

### 3.1. `openUserMenu()` — mở menu người dùng (dòng 14–18)

```ts
14  async openUserMenu(): Promise<void> {
15    const menu = await this.$(SELECTORS.APP_SHELL.USER_MENU)
16    await menu.waitForClickable({ timeout: TIMEOUTS.SHORT })
17    await menu.click()
18  }
```

- **Dòng 15** — Dùng **`this.$(...)`** (scope-theo-root, kế thừa từ `BaseComponent`) để tìm nút user-menu **bên trong header**. `USER_MENU` = `testId("app-user-menu")` (selectors.ts dòng 67).
- **Dòng 16–17** — Chờ nút **clickable** (5s) rồi `click()`. Chờ trước khi click tránh bấm hụt khi UI chưa render xong.

### 3.2. `logout()` — đăng xuất (dòng 20–25)

```ts
20  async logout(): Promise<void> {
21    await this.openUserMenu()
22    const btn = await $(SELECTORS.APP_SHELL.LOGOUT_BTN)
23    await btn.waitForClickable({ timeout: TIMEOUTS.SHORT })
24    await btn.click()
25  }
```

- **Dòng 21** — Trước tiên gọi lại `openUserMenu()` — vì nút logout thường nằm trong dropdown, phải mở menu ra đã. Tái dùng method thay vì lặp code.
- **Dòng 22** — ⚠️ **Chú ý:** dùng **global `$`** (không phải `this.$`) để tìm nút logout. Nghĩa là tìm trên **toàn trang**, không scope trong header. Lý do hợp lý: dropdown/menu bung ra thường render trong một **portal** ở cuối `<body>` — **bên ngoài** DOM của header — nên phải tìm toàn trang mới thấy. `LOGOUT_BTN` = `testId("app-logout")` (selectors.ts dòng 68).
- **Dòng 23–24** — Chờ clickable rồi click.

### 3.3. Xuất instance singleton (dòng 28)

```ts
28 export const header = new HeaderComponent()
```

- Instance dùng chung `header`, được [index.ts](../index.md) dòng 16 re-export cùng class `HeaderComponent`.

---

## 4. Quan hệ với các page/spec khác

- **Kế thừa** [BaseComponent](./base.component.md): dùng `this.$(...)` (scope) cho user-menu; `root`/`isDisplayed()` sẵn sàng khi cần.
- **Được export** qua barrel [index.ts](../index.md) dòng 16: `export { header, HeaderComponent } from "./components/header.component.js"`.
- Selector: [SELECTORS.APP_SHELL](../../../../src/constants/selectors.ts) dòng 64–71 (là `data-testid` mẫu của app shell).

---

## 5. Ghi chú & điểm dễ nhầm

- **`openUserMenu` scope theo root (`this.$`) nhưng `logout` dùng global `$`.** Không phải nhầm — nút trong dropdown thường ở portal ngoài header. Khi tự viết component có dropdown, nhớ cân nhắc điều này: phần bung ra có thể nằm ngoài root.
- **`logout()` tự mở menu trước** — không cần gọi `openUserMenu()` thủ công rồi mới `logout()` (sẽ mở hai lần).
- **Đây là component EXAMPLE.** `SELECTORS.APP_SHELL.*` là các `data-testid` mẫu (`app-header`, `app-user-menu`, `app-logout`) — nếu app thật chưa gắn các testid này thì component chưa lái được UI thật, cần chỉnh selector cho khớp.
- **`waitForClickable` trước mọi `click`** — mẫu tốt để tránh flake, giữ nếp này ở component mới.
