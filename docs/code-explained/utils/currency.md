# Giải thích code: `src/utils/currency.ts`

> **File nguồn:** [src/utils/currency.ts](../../../src/utils/currency.ts)
> **Loại:** Utility (helper tiền tệ)
> **Một câu:** Các hàm xử lý tiền **an toàn** dựa trên thư viện `currency.js`, theo quy ước tiền luôn lưu bằng **số nguyên cent** để tránh sai số dấu phẩy động.

---

## 1. Mục đích tổng quan

Số học tiền tệ bằng `number` float trong JavaScript rất dễ sai (ví dụ `0.1 + 0.2 !== 0.3`). File này gói mọi phép tính tiền qua thư viện [`currency.js`](https://currency.js.org/) và áp một **quy ước bắt buộc**: *tiền luôn lưu dưới dạng số nguyên cent* (ví dụ `$12.34` → `1234`).

JSDoc (dòng 3–13) nêu rõ luật: **test không được dùng `Math.round()` hay số học float trực tiếp** — mọi thao tác tiền phải đi qua các hàm ở đây. Nhờ đó cộng/trừ/nhân phần trăm nhiều dòng hàng vẫn nhất quán, và có sẵn hàm so sánh với dung sai làm tròn.

---

## 2. Các import / phụ thuộc (dòng 1)

```ts
1  import currency from "currency.js"
```

| Dòng | Ý nghĩa |
|------|---------|
| 1 | Import thư viện `currency.js` — thư viện tính tiền chính xác. `currency(value, options)` tạo một đối tượng tiền; các thuộc tính/method dùng trong file: `.intValue` (giá trị nguyên theo cent), `.value` (số thực), `.format()` (chuỗi hiển thị), `.add()`, `.subtract()`, `.multiply()`. Tuỳ chọn `{ fromCents: true }` báo cho lib biết input **đã là cent**. |

---

## 3. Giải thích từng khối code

### 3.1. `toCents` — đổi tiền sang cent (dòng 14)

```ts
14 export const toCents = (amount: number | string): number => currency(amount).intValue
```

- Nhận `amount` là số thực **hoặc** chuỗi (ví dụ `12.34` hoặc `"12.34"`) — dạng "đơn vị đô-la".
- `currency(amount).intValue` trả về **giá trị nguyên theo cent**: `12.34` → `1234`.
- **Không** truyền `fromCents` vì input ở đây là đô-la (đơn vị lớn), cần lib nhân lên thành cent.

### 3.2. `fromCents` — đổi cent về đô-la (dòng 16)

```ts
16 export const fromCents = (cents: number): number => currency(cents, { fromCents: true }).value
```

- Chiều ngược lại của `toCents`.
- `{ fromCents: true }` báo input `1234` **đã là cent**; `.value` trả số thực `12.34`.
- Trả về `number` (đô-la thực) chứ không phải chuỗi — dùng khi cần con số để tính tiếp.

### 3.3. `formatMoney` — định dạng hiển thị (dòng 18–21)

```ts
18 export const formatMoney = (cents: number, opts: { symbol?: string; precision?: number } = {}): string => {
19   const { symbol = "$", precision = 2 } = opts
20   return currency(cents, { fromCents: true, symbol, precision }).format()
21 }
```

- **Dòng 18** — Nhận `cents` (số nguyên cent) và một object tuỳ chọn `opts` (mặc định `{}`).
- **Dòng 19** — Đặt mặc định: `symbol = "$"`, `precision = 2` (2 chữ số thập phân). Cho phép override để đổi ký hiệu tiền (ví dụ `"€"`) hoặc số lẻ.
- **Dòng 20** — `{ fromCents: true }` để hiểu input là cent, rồi `.format()` sinh chuỗi hiển thị: `1234` → `"$12.34"`.
- Trả về **chuỗi** — dùng để hiển thị/so sánh với UI, không dùng để tính toán tiếp.

### 3.4. `sumCents` — cộng danh sách cent (dòng 23–24)

```ts
23 export const sumCents = (values: number[]): number =>
24   values.reduce((acc, v) => currency(acc, { fromCents: true }).add(currency(v, { fromCents: true })).intValue, 0)
```

- Cộng một **mảng cent** lại thành tổng cent.
- **Dòng 24** — `reduce` với accumulator khởi đầu `0`. Mỗi bước: bọc `acc` và `v` thành đối tượng currency (`fromCents: true`), `.add(...)` cộng chính xác, `.intValue` lấy lại số nguyên cent cho vòng sau.
- Dùng `.add()` của lib thay vì `acc + v` để **tránh trôi sai số** khi cộng nhiều dòng hàng. Kết quả vẫn là số nguyên cent.

### 3.5. `subtractCents` — trừ hai giá trị cent (dòng 26–27)

```ts
26 export const subtractCents = (a: number, b: number): number =>
27   currency(a, { fromCents: true }).subtract(currency(b, { fromCents: true })).intValue
```

- Trả về `a - b` theo cent, dùng `.subtract()` của lib để giữ độ chính xác. Cả hai đầu vào đều là cent (`fromCents: true`), kết quả là số nguyên cent.

### 3.6. `applyPercentage` — nhân theo phần trăm (dòng 29–30)

```ts
29 export const applyPercentage = (cents: number, percent: number): number =>
30   currency(cents, { fromCents: true }).multiply(percent / 100).intValue
```

- Tính `cents × (percent / 100)` — ví dụ thuế/giảm giá.
- `percent` được chia 100 trước (ví dụ `10` → hệ số `0.1`), rồi `.multiply()` nhân chính xác; `.intValue` trả về **số nguyên cent** (lib tự làm tròn theo quy tắc của nó).

### 3.7. `expectMoneyEqual` — so sánh có dung sai (dòng 32–41)

```ts
32 /**
33  * Verify two money amounts match within a 1-cent rounding tolerance.
34  * Arithmetic over many line items can drift; assert with `expectMoneyEqual`
35  * rather than `===`.
36  */
37 export const expectMoneyEqual = (
38   actualCents: number,
39   expectedCents: number,
40   toleranceCents = 1
41 ): boolean => Math.abs(actualCents - expectedCents) <= toleranceCents
```

- **JSDoc (32–36)** — Giải thích **tại sao** cần hàm này: cộng dồn nhiều dòng hàng có thể **trôi 1 cent** do làm tròn, nên **không nên** so sánh bằng `===` mà so sánh có **dung sai**.
- **Dòng 37–41** — Trả `true` nếu `|actual - expected| <= toleranceCents`. Mặc định dung sai `1` cent.
- Đây là chỗ **hiếm hoi** `Math.abs` được dùng — nhưng chỉ để **so sánh khoảng cách**, không phải để tính tiền (không vi phạm luật ở JSDoc đầu file).

---

## 4. Cách dùng / sơ đồ luồng

```ts
import { toCents, fromCents, formatMoney, sumCents, subtractCents, applyPercentage, expectMoneyEqual } from "./currency.js"

toCents(12.34)          // 1234
fromCents(1234)         // 12.34
formatMoney(1234)       // "$12.34"
formatMoney(1234, { symbol: "€" }) // "€12.34"
sumCents([100, 250])    // 350
subtractCents(500, 150) // 350
applyPercentage(1000, 10) // 100  (10% của $10.00)
expectMoneyEqual(999, 1000) // true (lệch 1 cent, trong dung sai)
```

Quy ước dữ liệu xuyên suốt:

```
đô-la (12.34) ──toCents──► cent nguyên (1234) ──[tính toán: sum/subtract/percent]──► cent nguyên
                                   │
                                   ├── fromCents ──► đô-la (để tính tiếp)
                                   └── formatMoney ──► "$12.34" (để hiển thị)
```

---

## 5. Ghi chú & điểm dễ nhầm

- **Đơn vị đầu vào/ra rất dễ nhầm**: `toCents` nhận **đô-la**; còn `fromCents`, `formatMoney`, `sumCents`, `subtractCents`, `applyPercentage` đều nhận/trả **cent**. Truyền nhầm đơn vị sẽ lệch 100 lần.
- **Luôn dùng các hàm này thay cho `Math.round()`/float** (theo JSDoc dòng 6–7) — đây là quy ước bắt buộc của project để test tiền nhất quán.
- **So sánh tiền dùng `expectMoneyEqual`, không dùng `===`** — cộng dồn nhiều dòng hàng có thể lệch 1 cent do làm tròn (JSDoc dòng 33–35).
- `formatMoney` trả **chuỗi** — không đưa kết quả này trở lại các hàm tính toán (chúng cần số cent).
- Việc làm tròn ở `applyPercentage`/`sumCents` do **`currency.js`** quyết định (`.intValue`), không phải `Math.round` — hành vi nhất quán theo lib.
