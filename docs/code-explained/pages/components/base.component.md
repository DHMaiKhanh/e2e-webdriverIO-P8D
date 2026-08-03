# Giải thích code: `src/pages/components/base.component.ts`

> **File nguồn:** [src/pages/components/base.component.ts](../../../../src/pages/components/base.component.ts)
> **Loại:** Component (lớp cha trừu tượng cho các mảnh UI tái sử dụng)
> **Một câu:** `BaseComponent` là lớp cha cho các mảnh UI xuất hiện ở nhiều trang (header, sidebar, dialog); mọi truy vấn của nó được **giới hạn (scope) trong một phần tử gốc**, nên cùng một class component dùng lại được ở bất cứ đâu mảnh UI đó render.

---

## 1. Mục đích tổng quan

Theo docblock (dòng 4–9), `BaseComponent` là **parent cho các mảnh UI tái sử dụng** (header, sidebar, dialog...). Ý tưởng cốt lõi:

- Một component được **gắn với một `rootSelector`** (phần tử gốc).
- **Mọi truy vấn con đều tương đối so với gốc đó** — tức là tìm element *bên trong* root chứ không tìm toàn trang.
- Nhờ vậy **cùng một class component tái dùng được** ở bất kỳ trang nào mảnh UI xuất hiện, mà không lo đụng nhầm phần tử trùng tên ở nơi khác.

Điểm khác biệt so với `BasePage`: **Page** đại diện cho **cả một màn hình** (điều hướng, load...); **Component** đại diện cho **một mảnh nhỏ** lặp lại nhiều nơi, và điểm nhấn là **scope truy vấn theo root**.

---

## 2. Các import / kế thừa (dòng 1–2)

```ts
1  import type { ChainablePromiseElement } from "webdriverio"
2  import { TIMEOUTS } from "../../constants/timeouts.js"
```

| Dòng | Ý nghĩa |
|------|---------|
| 1 | Import **kiểu** `ChainablePromiseElement` (element WebdriverIO có thể `await`/chain) — dùng cho kiểu trả về của `root` và `$()`. `import type` bị xoá khi biên dịch. |
| 2 | `TIMEOUTS` — dùng `TIMEOUTS.SHORT` = 5s làm mặc định cho `isDisplayed()`. Lưu ý đường dẫn `../../constants/...` vì file nằm sâu trong `pages/components/`. Xem [timeouts.ts](../../../../src/constants/timeouts.ts). |

### Khai báo lớp + thuộc tính trừu tượng (dòng 10–11)

```ts
10 export abstract class BaseComponent {
11   protected abstract readonly rootSelector: string
```

- **Dòng 10** — `abstract class`: không thể `new BaseComponent()` trực tiếp; phải qua lớp con (như `HeaderComponent`).
- **Dòng 11** — `rootSelector` **bắt buộc** lớp con khai báo: selector của phần tử gốc mà mọi truy vấn con sẽ bám vào. Khác `BasePage`, **không có** `pageName` ở đây (component không tự log tên).

---

## 3. Giải thích từng method / khối code

### 3.1. `root` — getter phần tử gốc (dòng 13–16)

```ts
13  /** The component's root element. */
14  get root(): ChainablePromiseElement {
15    return $(this.rootSelector)
16  }
```

- Đây là **getter** (truy cập như thuộc tính: `this.root`, không phải `this.root()`).
- Trả về element ứng với `rootSelector` bằng global `$`. Đây là **mỏ neo** cho mọi truy vấn con.
- Mỗi lần đọc `root` là **query lại** `$(this.rootSelector)` — luôn lấy element "tươi", tránh giữ tham chiếu cũ đã stale.

### 3.2. `$()` — truy vấn scope trong component (dòng 18–21)

```ts
18  /** Query an element scoped within this component. */
19  protected $(selector: string): ChainablePromiseElement {
20    return this.root.$(selector)
21  }
```

- **Đây là "trái tim" của việc scope.** Khác `BasePage.$()` (gọi global `$` tìm toàn trang), bản này gọi **`this.root.$(selector)`** — tức tìm element **bên trong** phần tử gốc.
- Nhờ đó nếu trang có nhiều nút cùng selector, component chỉ chạm đúng nút **nằm trong header/sidebar/dialog của nó**, không đụng nhầm nơi khác.
- `protected` nên chỉ lớp con dùng (`this.$(...)`).

### 3.3. `isDisplayed()` — component có đang hiển thị (dòng 23–30)

```ts
23  async isDisplayed(timeout = TIMEOUTS.SHORT): Promise<boolean> {
24    try {
25      await this.root.waitForDisplayed({ timeout })
26      return true
27    } catch {
28      return false
29    }
30  }
```

- Chờ **phần tử gốc** hiển thị trong `timeout` (mặc định `SHORT`=5s).
- **Dòng 24–26** — Hiển thị kịp → `true`.
- **Dòng 27–28** — Timeout/lỗi → **`catch` không tham số**, trả `false` (không ném lỗi). Cho phép spec `if (await component.isDisplayed())` gọn gàng.

> So sánh với `BasePage.isLoaded()`: cùng ý tưởng "hỏi lịch sự trả boolean", nhưng bản component **không log** khi lỗi (`catch {}` trống) còn `isLoaded()` có `logger.error`. Component tối giản hơn.

---

## 4. Quan hệ với các page/spec khác

- **Lớp cha của các component cụ thể:** [HeaderComponent](./header.component.md) `extends BaseComponent`, override `rootSelector` và dùng `this.$(...)` để scope truy vấn trong header.
- **Không được re-export ở barrel** [index.ts](../index.md) — vì là abstract nội bộ, spec không dùng trực tiếp. Chỉ component con (như `header`) mới được export.
- Phụ thuộc [TIMEOUTS](../../../../src/constants/timeouts.ts) cho giá trị `SHORT`.

---

## 5. Ghi chú & điểm dễ nhầm

- **`$()` ở đây scope-theo-root, khác `$()` của `BasePage`** (toàn trang). Đây là khác biệt thiết kế quan trọng nhất giữa Component và Page. Trong lớp con component, luôn ưu tiên `this.$(...)` để giữ scope. (Xem lưu ý ở `HeaderComponent`: có chỗ nó dùng global `$` cho nút logout — không scope theo root.)
- **`root` là getter, gọi `this.root` (không dấu ngoặc).** Đọc nó là query lại element mới mỗi lần.
- **Không có `pageName`** như `BasePage` — component không tự dán nhãn log.
- **`isDisplayed()` nuốt lỗi im lặng** (`catch {}` rỗng) — tiện cho điều kiện `if`, nhưng nếu cần chẩn đoán vì sao không hiện thì phải log ở nơi gọi.
- **Component ≠ Page:** đừng nhét logic điều hướng (`open()`, `url()`) vào component; component chỉ lo một mảnh UI trong trang hiện tại.
