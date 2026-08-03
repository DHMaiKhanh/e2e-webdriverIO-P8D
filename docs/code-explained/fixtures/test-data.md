# Giải thích code: `src/fixtures/test-data.ts`

> **File nguồn:** [src/fixtures/test-data.ts](../../../src/fixtures/test-data.ts)
> **Loại:** Fixture (dữ liệu test tĩnh + facade có kiểu mạnh)
> **Một câu:** Một "mặt tiền" (facade) có kiểu mạnh để spec/page lấy dữ liệu test tĩnh (danh sách user) từ file JSON — kèm interface `TestUser` và helper `findUserByRole` để tìm user theo vai trò.

---

## 1. Mục đích tổng quan

File này là **điểm truy cập duy nhất** cho dữ liệu test tĩnh. Thay vì mỗi spec tự `import` file JSON thô (mất kiểu, dễ gõ sai key), tất cả đi qua module này để nhận được:

1. **Dữ liệu người dùng** đã gắn kiểu `TestUser` — có gợi ý (autocomplete) và kiểm tra kiểu.
2. **Một helper** `findUserByRole(role)` để tra cứu user theo vai trò.

Comment (dòng 3–10) nêu quy ước bảo trì: khi thêm role/record mới, **cập nhật cả file JSON lẫn interface bên dưới** — TypeScript sẽ tự "chỉ mặt" mọi spec cần sửa theo.

---

## 2. Các import / phụ thuộc (dòng 1)

```ts
1  import users from "../data/users.json" with { type: "json" }
```

- Import trực tiếp file **[src/data/users.json](../../../src/data/users.json)** làm dữ liệu nguồn.
- **`with { type: "json" }`** — cú pháp **import attributes** (chuẩn ESM mới, thay cho `assert { type: "json" }` cũ). Bắt buộc trong môi trường **ESM/NodeNext** để Node/loader biết đây là module JSON. Không có nó, import JSON có thể bị từ chối trong ESM nghiêm ngặt.
- `users` là object JSON thô (chưa gắn kiểu `TestUser`), sẽ được ép kiểu ở dòng 21.

### Nội dung file JSON nguồn

File [src/data/users.json](../../../src/data/users.json) hiện có 2 bản ghi (key `"admin"` và `"staff"`):

```json
{
  "admin": { "email": "qa.admin@p8d.local", "pin": "9999", "role": "ADMIN",  "displayName": "QA Admin", "permissions": ["*"] },
  "staff": { "email": "qa.user@p8d.local",  "pin": "1234", "role": "STAFF",  "displayName": "QA Staff", "permissions": ["order.create", "order.read"] }
}
```

Cấu trúc mỗi bản ghi khớp đúng interface `TestUser` bên dưới (email, pin, role, displayName, permissions).

---

## 3. Giải thích từng khối code

### 3.1. Docblock mô tả facade (dòng 3–10)

```ts
3  /**
4   * Strongly-typed fixture facade.
5   *
6   * Specs and page objects pull static test data through this module rather
7   * than re-importing JSON. Adding a new role / record? Update the JSON file
8   * and the type below — TypeScript will surface every spec that needs
9   * adjustment.
10  */
```

Giải thích **tại sao** có module này: tập trung truy cập dữ liệu test qua một facade có kiểu, để mọi thay đổi dữ liệu được TypeScript kiểm soát và lan tỏa lỗi tới đúng chỗ cần sửa.

### 3.2. Interface `TestUser` (dòng 12–18)

```ts
12 export interface TestUser {
13   email: string
14   pin: string
15   role: "ADMIN" | "MANAGER" | "STAFF" | "CASHIER"
16   displayName: string
17   permissions: string[]
18 }
```

- Định nghĩa **hình dạng (shape)** của một user test:
  - **`email: string`** — email đăng nhập.
  - **`pin: string`** — mã PIN (kiểu **string**, không phải number — giữ nguyên số 0 đầu như `"1234"`, `"9999"`).
  - **`role`** — **union literal**: chỉ nhận đúng một trong 4 giá trị `"ADMIN" | "MANAGER" | "STAFF" | "CASHIER"`. Gõ sai role (ví dụ `"admin"` thường) sẽ bị TS báo lỗi.
  - **`displayName: string`** — tên hiển thị.
  - **`permissions: string[]`** — mảng chuỗi quyền (ví dụ `["*"]` cho admin, `["order.create", "order.read"]` cho staff).
- **Lưu ý:** interface định nghĩa **4 role hợp lệ** nhưng file JSON hiện chỉ dùng 2 (`ADMIN`, `STAFF`). Hai role còn lại (`MANAGER`, `CASHIER`) là dự phòng cho tương lai — đây là kiểu, không phải dữ liệu.

### 3.3. Object `TEST_DATA` (dòng 20–22)

```ts
20 export const TEST_DATA = {
21   users: users as Record<string, TestUser>
22 } as const
```

- **Dòng 21** — Gắn kiểu cho dữ liệu JSON thô: `users as Record<string, TestUser>`. Ép kiểu (type assertion) để nói với TS rằng `users` là **map từ khóa string → `TestUser`** (khóa là `"admin"`, `"staff"`, …). Từ đây, `TEST_DATA.users.admin` được TS hiểu là một `TestUser`.
- **Dòng 22** — `as const` khiến toàn bộ object **readonly** và giữ **kiểu literal hẹp nhất** — tránh vô tình mutate dữ liệu test dùng chung và cho kiểu chính xác hơn.
- **Kết quả:** spec truy cập như `TEST_DATA.users.staff.pin` với đầy đủ gợi ý và kiểm kiểu.

> ⚠️ **Điểm cần biết về `as`:** ép kiểu ở dòng 21 **không** kiểm tra runtime rằng JSON thật sự khớp `TestUser`. Nếu ai đó sửa JSON sai cấu trúc, TS vẫn "tin" là đúng cho tới khi chạy mới lộ. Đây là đánh đổi có chủ ý để lấy sự tiện lợi về kiểu.

### 3.4. Helper `findUserByRole` (dòng 24–25)

```ts
24 export const findUserByRole = (role: TestUser["role"]): TestUser | undefined =>
25   Object.values(TEST_DATA.users).find((u) => u.role === role)
```

- **Tham số `role: TestUser["role"]`** — dùng **indexed access type** để lấy đúng kiểu của trường `role` (tức union `"ADMIN" | "MANAGER" | "STAFF" | "CASHIER"`). Nhờ vậy, truyền một role không hợp lệ sẽ bị TS chặn ngay khi biên dịch.
- **Trả về `TestUser | undefined`** — có thể **không tìm thấy** (ví dụ tìm `"MANAGER"` trong khi JSON chưa có bản ghi nào role đó) → trả `undefined`.
- **Thân hàm (dòng 25):**
  - `Object.values(TEST_DATA.users)` — lấy **mảng các user** (bỏ qua khóa `"admin"`/`"staff"`).
  - `.find((u) => u.role === role)` — trả về **user đầu tiên** có `role` khớp, hoặc `undefined` nếu không có.
- **Lưu ý:** nếu có **nhiều** user cùng role, `find` chỉ trả về **cái đầu tiên**. Hiện JSON mỗi role chỉ có 1 bản ghi nên không phải vấn đề.

---

## 4. Cách dùng / quan hệ với file khác

- **Nguồn dữ liệu:** [src/data/users.json](../../../src/data/users.json) — nơi chứa dữ liệu thật. Muốn thêm/sửa user thì sửa file này.
- **Cặp "dữ liệu + kiểu":** khi thêm role/record mới, phải cập nhật **đồng thời** JSON (dữ liệu) và interface `TestUser` (kiểu, nếu thêm role mới vào union) — đúng như docblock nhắc.
- **Cách spec/page dùng (ví dụ):**
  ```ts
  import { TEST_DATA, findUserByRole } from "../fixtures/test-data.js"

  const admin = TEST_DATA.users.admin          // truy cập theo khóa
  const staff = findUserByRole("STAFF")         // tra cứu theo role → TestUser | undefined
  ```
- Đóng vai trò **facade**: nếu sau này đổi nguồn dữ liệu (JSON → API, DB…), chỉ cần sửa file này, spec không phải đổi.

---

## 5. Ghi chú & điểm dễ nhầm

- **`pin` là `string`, không phải `number`.** Cố ý — để giữ số 0 đứng đầu và tránh mọi xử lý số học. So sánh cần dùng chuỗi (`"1234"`).
- **Interface có 4 role nhưng JSON chỉ 2.** `MANAGER`/`CASHIER` là kiểu dự phòng; `findUserByRole("MANAGER")` hiện trả `undefined`. Người gọi **phải xử lý `undefined`** (union trả về đã cảnh báo điều này).
- **`as Record<string, TestUser>` không xác thực runtime.** JSON sai cấu trúc vẫn qua được biên dịch. Nếu cần an toàn tuyệt đối, phải thêm validate (ví dụ Zod) — hiện tại không có.
- **`as const` làm dữ liệu readonly.** Đừng cố gán lại `TEST_DATA.users.admin.pin = ...` — sẽ bị TS chặn. Đây là dữ liệu test dùng chung, nên bất biến là đúng.
- **Import JSON cần `with { type: "json" }`** trong ESM/NodeNext. Bỏ đi có thể gây lỗi khi chạy. Đây là cú pháp mới thay cho `assert { type: "json" }`.
- **`findUserByRole` trả về bản ghi đầu tiên khớp** — nếu tương lai có nhiều user cùng role, cần cân nhắc đổi sang trả về mảng.
