# Giải thích code: `src/types/wdio.d.ts`

> **File nguồn:** [src/types/wdio.d.ts](../../../src/types/wdio.d.ts)
> **Loại:** Type declaration (ambient / khai báo mở rộng type)
> **Một câu:** File khai báo type "ambient" mở rộng namespace `WebdriverIO` để TypeScript biết về các **lệnh tùy biến** (custom commands) đã thêm vào `browser` và `element`, giúp chúng được type-check thay vì báo lỗi "property không tồn tại".

---

## 1. Mục đích tổng quan

Đây là file `.d.ts` — **chỉ chứa khai báo type, không có code chạy**. Nhiệm vụ: khi ta thêm custom command bằng `browser.addCommand(...)` lúc runtime (trong [src/hooks/custom-commands.ts](../../../src/hooks/custom-commands.ts)), **TypeScript không tự biết** những command đó tồn tại. Nếu không khai báo, gọi `browser.gotoRoute(...)` hay `el.waitAndClick()` sẽ bị báo lỗi biên dịch "Property does not exist".

File này **augment (bồi đắp)** các interface có sẵn của WebdriverIO — `WebdriverIO.Browser` và `WebdriverIO.Element` — để thêm chữ ký (signature) cho từng custom command. Nhờ đó:

- Gõ `browser.gotoRoute(` là editor gợi ý đúng tham số.
- Truyền sai kiểu tham số sẽ bị bắt lỗi khi biên dịch.
- Kiểu trả về (`Promise<...>`) được biết chính xác.

Đây là **hợp đồng type** phản chiếu phần **hiện thực runtime** ở `custom-commands.ts`. Hai file phải **khớp nhau**: mỗi command khai báo ở đây phải có `addCommand` tương ứng, và ngược lại.

---

## 2. Các import / phụ thuộc (dòng 1–3)

```ts
1  /// <reference types="@wdio/globals/types" />
2  /// <reference types="@wdio/mocha-framework" />
3  /// <reference types="expect-webdriverio" />
```

Đây là **triple-slash directives** — cách khai báo phụ thuộc type trong file `.d.ts` (không phải `import` thường):

| Dòng | Ý nghĩa |
|------|---------|
| 1 | Nạp type toàn cục của `@wdio/globals` — làm cho `browser`, `$`, `$$`, `driver`… có kiểu sẵn ở phạm vi global mà không cần import trong từng spec. |
| 2 | Nạp type của framework Mocha (`describe`, `it`, `before`, `beforeEach`…). |
| 3 | Nạp type của `expect-webdriverio` — bổ sung các matcher đặc thù WebdriverIO cho `expect` (ví dụ `toBeDisplayed`, `toHaveText`…). |

> 💡 `/// <reference types="..." />` bảo TypeScript "kéo type từ package này vào". Trong file khai báo, đây là cách chuẩn để đảm bảo namespace `WebdriverIO` đã tồn tại trước khi ta augment nó.

---

## 3. Giải thích từng khối code

### 3.1. Mở rộng namespace `WebdriverIO` (dòng 5)

```ts
5  declare namespace WebdriverIO {
```

- `declare namespace WebdriverIO { ... }` — **augmentation** (bồi đắp) vào namespace `WebdriverIO` mà package `@wdio/globals` đã định nghĩa sẵn. Vì cùng tên namespace, các interface bên trong sẽ được **hợp nhất (declaration merging)** với interface gốc của WebdriverIO, chứ không thay thế.
- Nhờ declaration merging của TypeScript, các thành viên ta thêm vào `interface Browser`/`interface Element` được **cộng dồn** vào định nghĩa gốc.

### 3.2. Mở rộng `interface Browser` — 2 command trên `browser` (dòng 6–15)

```ts
6    interface Browser {
7      /** Navigate to an app route and log the transition. */
8      gotoRoute(route: string): Promise<void>
9
10     /** Run an async assertion, suppress the throw, and return a record of the failure. */
11     softAssert(
12       fn: () => Promise<void>,
13       message: string
14     ): Promise<{ message: string; error: string } | null>
15   }
```

Khai báo 2 method mới trên đối tượng `browser` toàn cục:

- **`gotoRoute(route: string): Promise<void>`** (dòng 8)
  - Nhận 1 tham số `route` kiểu string (đường dẫn route).
  - Trả `Promise<void>` — chỉ side-effect (điều hướng + log), không trả giá trị.
  - **Runtime tương ứng:** [custom-commands.ts](../../../src/hooks/custom-commands.ts) dòng 17–20 — `browser.addCommand("gotoRoute", …)`: log `→ navigate <route>` rồi `this.url(route)`.

- **`softAssert(fn, message): Promise<{ message; error } | null>`** (dòng 11–14)
  - Tham số `fn: () => Promise<void>` — một hàm async chứa assertion.
  - Tham số `message: string` — nhãn mô tả điều đang kiểm.
  - Trả về `Promise<{ message: string; error: string } | null>`: **`null`** nếu assertion pass; **object `{ message, error }`** nếu fail (đã "nuốt" throw, không làm dừng test).
  - **Runtime tương ứng:** [custom-commands.ts](../../../src/hooks/custom-commands.ts) dòng 37–49 — chạy `fn()` trong `try/catch`; pass → `return null`; fail → log `warn` và `return { message, error: e.message }`.
  - Kiểu trả về ở khai báo type **khớp chính xác** object mà hiện thực trả ra.

### 3.3. Mở rộng `interface Element` — command trên phần tử (dòng 17–20)

```ts
17   interface Element {
18     /** Wait for clickable then click — combined for one-liners. */
19     waitAndClick(timeout?: number): Promise<void>
20   }
```

- **`waitAndClick(timeout?: number): Promise<void>`**
  - Được thêm vào **`Element`** (không phải `Browser`), nên gọi trên **phần tử**: `el.waitAndClick()` hoặc `$("...").waitAndClick()`.
  - Tham số `timeout?` **tùy chọn** (dấu `?`) kiểu number — khớp với default `timeout = TIMEOUTS.MEDIUM` (15s) ở hiện thực.
  - Trả `Promise<void>`.
  - **Runtime tương ứng:** [custom-commands.ts](../../../src/hooks/custom-commands.ts) dòng 23–30 — `browser.addCommand("waitAndClick", fn, true)`. Tham số thứ ba `true` là **cờ "attachToElement"**: đăng ký command lên **element** thay vì trên browser, đúng với việc khai báo nó ở `interface Element`.

---

## 4. Cách dùng / quan hệ với file khác

- **Cặp đôi bắt buộc đi cùng nhau:**
  - **File này (`wdio.d.ts`)** = phần **type** (compile-time). Cho TypeScript biết chữ ký command.
  - **[src/hooks/custom-commands.ts](../../../src/hooks/custom-commands.ts)** = phần **hiện thực** (runtime). Thực sự `addCommand(...)` để command tồn tại khi chạy.
  - Comment trong `custom-commands.ts` (dòng 12–13) nhắc thẳng: *"Declare new command signatures in src/types/wdio.d.ts so they are type-checked."*
- **Nếu chỉ có 1 trong 2:**
  - Có runtime nhưng thiếu type ở đây → gọi command bị TS báo "property không tồn tại" (đỏ trong editor, fail build type-check).
  - Có type ở đây nhưng thiếu `addCommand` → TS không phàn nàn, nhưng lúc chạy sẽ ném lỗi runtime "not a function".
- **Được nạp tự động** nhờ cấu hình `include`/`types` trong `tsconfig` (các file `.d.ts` trong project). Không ai `import` file này — nó tác động toàn cục qua ambient declaration.

---

## 5. Ghi chú & điểm dễ nhầm

- **File `.d.ts` không sinh JS**: nó thuần khai báo. Xóa nó **không** làm command biến mất lúc chạy — chỉ làm mất type-check (editor báo lỗi). Ngược lại, xóa `addCommand` trong hooks mới thực sự làm command hỏng lúc chạy.
- **`Browser` vs `Element`**: đặt command vào đúng interface quyết định gọi nó ở đâu. `gotoRoute`/`softAssert` ở `Browser` → gọi `browser.X()`. `waitAndClick` ở `Element` → gọi `el.X()`. Đặt sai chỗ sẽ lệch với cờ `attachToElement` (`true`) ở `addCommand`.
- **Declaration merging** là lý do dùng `declare namespace WebdriverIO` cùng tên: TS **gộp** thêm vào interface gốc, không đè. Nếu đổi tên namespace thì việc merge sẽ không xảy ra và command sẽ không được nhận diện trên `browser` gốc.
- **`timeout?` phải tùy chọn** để khớp default ở hiện thực (`timeout = TIMEOUTS.MEDIUM`). Nếu khai báo bắt buộc (không `?`), gọi `el.waitAndClick()` không truyền tham số sẽ bị TS báo lỗi — không đúng với thiết kế "one-liner".
- **Kiểu trả về của `softAssert` phải khớp tuyệt đối** với object hiện thực trả ra (`{ message: string; error: string } | null`). Lệch một field là type và runtime "nói dối" nhau.
