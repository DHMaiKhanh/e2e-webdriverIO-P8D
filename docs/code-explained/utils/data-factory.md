# Giải thích code: `src/utils/data-factory.ts`

> **File nguồn:** [src/utils/data-factory.ts](../../../src/utils/data-factory.ts)
> **Loại:** Utility (factory sinh dữ liệu test)
> **Một câu:** Sinh **fixture giống dữ liệu production** (ID kiểu uuidv7, tiền dạng số nguyên cent) bằng `faker`, cho phép `overrides` để ghim những field cần assert.

---

## 1. Mục đích tổng quan

File cung cấp một **factory** tạo dữ liệu giả cho test (khách hàng, sản phẩm, email, PIN). Điểm quan trọng (theo JSDoc dòng 5–11): dữ liệu sinh ra có **hình dạng như bản ghi thật** — ID là `uuidv7`, tiền là **số nguyên cent** — nên khi đi qua các validator giống hệt bản ghi thật thì vẫn hợp lệ ("round-trip through the same validators").

Mỗi hàm nhận tham số `overrides` (mặc định `{}`) để **ghim (pin)** bất kỳ field nào bạn cần khẳng định trong assertion, phần còn lại để faker tự sinh ngẫu nhiên.

---

## 2. Các import / phụ thuộc (dòng 1–3)

```ts
1  import { faker } from "@faker-js/faker"
2  import { v7 as uuidv7 } from "uuid"
3  import { toCents } from "./currency.js"
```

| Dòng | Ý nghĩa |
|------|---------|
| 1 | `faker` — thư viện sinh dữ liệu giả (tên, email, số điện thoại, tên sản phẩm…). |
| 2 | `v7 as uuidv7` — hàm tạo **UUID phiên bản 7** (có thành phần thời gian, **sắp xếp được theo thứ tự tạo**), đổi tên cho rõ nghĩa. |
| 3 | `toCents` — helper tiền từ [currency.ts](../../../src/utils/currency.ts): đổi đô-la sang **số nguyên cent** theo đúng quy ước tiền của project. |

> 💡 Vì sao dùng **uuidv7** thay vì uuidv4? uuidv7 có phần timestamp nên các ID **tăng dần theo thời gian tạo**, giống ID thật trong DB (dễ sắp xếp, giống production hơn).

---

## 3. Giải thích từng khối code

### 3.1. Kiểu `FakeCustomer` (dòng 13–20)

```ts
13 export interface FakeCustomer {
14   id: string
15   firstName: string
16   lastName: string
17   email: string
18   phone: string
19   createdAt: string
20 }
```

- Định nghĩa **hình dạng** một khách hàng giả: `id`, `firstName`, `lastName`, `email`, `phone`, `createdAt` — tất cả kiểu `string`. `createdAt` là chuỗi ISO (xem dòng 37).

### 3.2. Kiểu `FakeProduct` (dòng 22–27)

```ts
22 export interface FakeProduct {
23   id: string
24   name: string
25   priceCents: number
26   categoryId: string
27 }
```

- Hình dạng một sản phẩm giả: `id`, `name`, `categoryId` là `string`; **`priceCents` là `number`** — nhấn mạnh giá lưu bằng **cent nguyên** (không phải đô-la float), khớp quy ước tiền.

### 3.3. `factory.customer` (dòng 30–40)

```ts
30   customer(overrides: Partial<FakeCustomer> = {}): FakeCustomer {
31     return {
32       id: uuidv7(),
33       firstName: faker.person.firstName(),
34       lastName: faker.person.lastName(),
35       email: faker.internet.email().toLowerCase(),
36       phone: faker.phone.number({ style: "international" }),
37       createdAt: new Date().toISOString(),
38       ...overrides
39     }
40   },
```

| Dòng | Ý nghĩa |
|------|---------|
| 30 | Nhận `overrides` kiểu `Partial<FakeCustomer>` (mọi field đều tuỳ chọn), mặc định `{}`. Trả về `FakeCustomer` đầy đủ. |
| 32 | `id` = uuidv7 mới (giống ID thật). |
| 33–34 | Họ và tên ngẫu nhiên qua faker. |
| 35 | Email ngẫu nhiên, **ép chữ thường** (`toLowerCase()`) cho nhất quán (email thường không phân biệt hoa/thường). |
| 36 | Số điện thoại kiểu **quốc tế** (`style: "international"`). |
| 37 | `createdAt` = thời điểm hiện tại dạng **chuỗi ISO** (`new Date().toISOString()`). |
| 38 | **`...overrides` đặt CUỐI cùng** — nên bất kỳ field nào truyền vào sẽ **ghi đè** giá trị faker phía trên. Đây là cách "ghim" field cần assert. |

### 3.4. `factory.product` (dòng 42–50)

```ts
42   product(overrides: Partial<FakeProduct> = {}): FakeProduct {
43     return {
44       id: uuidv7(),
45       name: faker.commerce.productName(),
46       priceCents: toCents(faker.number.float({ min: 10, max: 250, fractionDigits: 2 })),
47       categoryId: uuidv7(),
48       ...overrides
49     }
50   },
```

| Dòng | Ý nghĩa |
|------|---------|
| 44 | `id` = uuidv7 mới. |
| 45 | Tên sản phẩm ngẫu nhiên (`faker.commerce.productName()`). |
| 46 | **Giá**: faker sinh số thực trong `[10, 250]` với 2 chữ số thập phân (ví dụ `73.45`), rồi **`toCents(...)`** đổi sang cent nguyên (`7345`). Nhờ đi qua `toCents`, giá tuân đúng quy ước tiền của project. |
| 47 | `categoryId` = uuidv7 riêng (giả lập tham chiếu tới danh mục). |
| 48 | `...overrides` cuối cùng để ghi đè. |

### 3.5. `factory.testEmail` (dòng 52–55)

```ts
52   /** A unique stable-looking email under our test domain. */
53   testEmail(prefix = "qa"): string {
54     return `${prefix}.${faker.string.alphanumeric(6).toLowerCase()}@p8d.test`
55   },
```

- Sinh email **duy nhất** dưới domain test `@p8d.test`.
- **Dòng 54** — Dạng `<prefix>.<6 ký tự alphanumeric chữ thường>@p8d.test`, ví dụ `qa.a1b2c3@p8d.test`. `prefix` mặc định `"qa"`, có thể đổi để phân loại.
- "stable-looking" nghĩa là **trông giống email thật** nhưng vẫn ngẫu nhiên đủ để tránh trùng giữa các lần chạy.

### 3.6. `factory.pin` (dòng 57–60)

```ts
57   /** 4-digit PIN string. */
58   pin(): string {
59     return faker.string.numeric(4)
60   }
```

- Trả về chuỗi **4 chữ số** (ví dụ `"0472"`). Dùng `faker.string.numeric(4)` nên **giữ dạng chuỗi**, không mất số 0 ở đầu (khác với dùng `number`).

---

## 4. Cách dùng / sơ đồ luồng

```ts
import { factory } from "./data-factory.js"

// Khách hàng ngẫu nhiên hoàn toàn
const c = factory.customer()

// Ghim email để assert, các field khác vẫn ngẫu nhiên
const c2 = factory.customer({ email: "known@p8d.test" })

// Sản phẩm với giá cố định (đơn vị cent)
const p = factory.product({ priceCents: 1999 })

const email = factory.testEmail("staff") // staff.x7q2p9@p8d.test
const pin = factory.pin()                // "4821"
```

Nguyên tắc override:

```
{ ...các field faker sinh sẵn, ...overrides }
                                     ▲
                    overrides đặt CUỐI → luôn thắng, "ghim" field cần assert
```

---

## 5. Ghi chú & điểm dễ nhầm

- **`...overrides` phải nằm cuối** object (dòng 38, 48) thì mới ghi đè được giá trị faker. Đây là chủ ý thiết kế — đảo vị trí sẽ khiến override **không có tác dụng**.
- **`priceCents` là cent, không phải đô-la** — khi override giá, nhớ truyền cent (ví dụ `1999` cho $19.99), khớp interface `FakeProduct` và quy ước tiền của project.
- **ID dùng uuidv7** (có timestamp, sắp xếp được) — không phải uuidv4 ngẫu nhiên thuần; chọn vậy để giống ID production.
- **`pin()` trả chuỗi**, giữ số 0 đầu; đừng ép sang `number` nếu không muốn mất chữ số đầu.
- Dữ liệu **ngẫu nhiên mỗi lần gọi** — muốn giá trị cố định để assert thì phải truyền qua `overrides`.
- Email ở `customer()` và `testEmail()` khác nhau: `customer().email` dùng domain của faker; `testEmail()` dùng domain nội bộ `@p8d.test`.
