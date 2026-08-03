# Giải thích code: `src/pages/base.page.ts`

> **File nguồn:** [src/pages/base.page.ts](../../../src/pages/base.page.ts)
> **Loại:** Page Object (lớp cha trừu tượng — parent của mọi Page Object)
> **Một câu:** `BasePage` gom mọi hành vi dùng chung (chờ load, click/nhập an toàn, toast, modal, screenshot) vào một chỗ để mọi page con kế thừa mà không lặp code.

---

## 1. Mục đích tổng quan

`BasePage` là **lớp trừu tượng** (`abstract`) đứng làm gốc cho tất cả Page Object trong project (`LoginPage`, `StaffTokenLoginPage`, `CustomerDisplayPage`...). Theo docblock (dòng 7–18), nó chịu trách nhiệm:

1. **Waits / navigation / screenshot dùng chung** — mọi page đều cần chờ màn hình load, chờ route, chụp màn hình.
2. **Xử lý toast & modal** mà page nào cũng đụng tới.
3. **Một điểm duy nhất để "gắn thiết bị đo" (instrument) cho MỌI hành động** — ví dụ log — mà không làm bẩn từng page riêng lẻ.

**Quy ước quan trọng** (dòng 16–17): selector riêng của từng màn hình nằm ở lớp con; `BasePage` **chỉ** chạm tới `SELECTORS.COMMON.*` (toast/modal chung), không biết gì về selector đặc thù của page con. Nhờ vậy lớp cha không bị phụ thuộc vào chi tiết của bất kỳ màn hình cụ thể nào.

Vì các page con **kế thừa** toàn bộ helper ở đây, hiểu file này = hiểu 80% cơ chế của mọi page object.

---

## 2. Các import / kế thừa (dòng 1–5)

```ts
1  import type { ChainablePromiseElement } from "webdriverio"
2  import { SELECTORS } from "../constants/selectors.js"
3  import { TIMEOUTS } from "../constants/timeouts.js"
4  import { logger } from "../utils/logger.js"
5  import { sleep, waitForRoute } from "../utils/wait.js"
```

| Dòng | Ý nghĩa |
|------|---------|
| 1 | Import **kiểu** `ChainablePromiseElement` (dùng `import type` — chỉ dùng cho type, bị xoá khi biên dịch). Đây là kiểu trả về của `$()` trong WebdriverIO: một element "lười" có thể `await` hoặc chain tiếp. |
| 2 | `SELECTORS` — registry selector tập trung. `BasePage` chỉ dùng nhánh `SELECTORS.COMMON.*`. Xem [selectors.ts](../../../src/constants/selectors.ts). |
| 3 | `TIMEOUTS` — các mốc timeout đặt tên: `SHORT`=5s, `MEDIUM`=15s, `ANIMATION`=500ms... Xem [timeouts.ts](../../../src/constants/timeouts.ts). |
| 4 | `logger` — logger dùng chung để in log hành động ra console/file. |
| 5 | Từ [wait.ts](../../../src/utils/wait.js): `sleep(ms)` (chờ cứng, chỉ dùng cho retry) và `waitForRoute(fragment)` (chờ URL chứa một đoạn). |

> 💡 Import đuôi `.js` dù file gốc `.ts` là do project chạy chuẩn **ESM/NodeNext**: đường dẫn import phải trỏ tới file `.js` sau khi biên dịch.

### Khai báo lớp và 2 thuộc tính trừu tượng (dòng 19–24)

```ts
19 export abstract class BasePage {
20   /** Identifier shown in logs. Subclasses set this. */
21   protected abstract readonly pageName: string
22
23   /** A primary element used by `isLoaded()`. Subclasses override. */
24   protected abstract readonly rootSelector: string
```

- **Dòng 19** — `abstract class`: không thể `new BasePage()` trực tiếp; phải qua lớp con.
- **Dòng 21** — `pageName`: chuỗi tên page **bắt buộc** lớp con phải khai báo. Dùng làm nhãn trong mọi log/thông báo lỗi (ví dụ `[LoginPage] ...`). `protected` = chỉ dùng nội bộ lớp và lớp con; `abstract` = ép lớp con định nghĩa; `readonly` = không đổi sau khi gán.
- **Dòng 24** — `rootSelector`: selector của **một phần tử đại diện** cho màn hình. `isLoaded()` chờ phần tử này xuất hiện để kết luận "màn đã load". Mỗi page con **override** bằng selector riêng của nó.

> **Đây là "hợp đồng"** giữa lớp cha và lớp con: cha cung cấp logic (`isLoaded`, `waitForLoaded`...), con chỉ cần khai báo `pageName` + `rootSelector` là chạy được.

---

## 3. Giải thích từng method / khối code

### 3.1. `isLoaded()` — kiểm tra màn đã hiển thị chưa (dòng 28–39)

```ts
28  async isLoaded(timeout = TIMEOUTS.MEDIUM): Promise<boolean> {
29    try {
30      await $(this.rootSelector).waitForDisplayed({
31        timeout,
32        timeoutMsg: `[${this.pageName}] root element ${this.rootSelector} not displayed in ${timeout}ms`
33      })
34      return true
35    } catch (err) {
36      logger.error(`[${this.pageName}] not loaded: ${(err as Error).message}`)
37      return false
38    }
39  }
```

- **Dòng 28** — Tham số `timeout` mặc định `TIMEOUTS.MEDIUM` = **15s**. Trả về `Promise<boolean>` (thành công/thất bại) chứ **không ném lỗi** — đây là phiên bản "hỏi lịch sự".
- **Dòng 30–33** — Chờ `rootSelector` (do lớp con định nghĩa) **hiển thị**. Nếu quá hạn, `waitForDisplayed` ném lỗi với `timeoutMsg` có gắn `pageName` + tên selector → log lỗi dễ đọc.
- **Dòng 34** — Hiển thị kịp trong hạn → trả `true`.
- **Dòng 35–37** — Bắt lỗi timeout, ghi `logger.error`, trả `false` thay vì để lỗi lan ra. Nhờ vậy nơi gọi có thể `if (await page.isLoaded())` mà không cần try/catch.

### 3.2. `waitForLoaded()` — chờ load, ném lỗi nếu thất bại (dòng 41–45)

```ts
41  async waitForLoaded(timeout = TIMEOUTS.MEDIUM): Promise<void> {
42    const ok = await this.isLoaded(timeout)
43    if (!ok) throw new Error(`[${this.pageName}] failed to load`)
44    logger.debug(`[${this.pageName}] loaded`)
45  }
```

- Đây là phiên bản "khắt khe" của `isLoaded()`: gọi lại `isLoaded()` (dòng 42) rồi **ném lỗi** nếu `false` (dòng 43).
- **Khác biệt then chốt:** `isLoaded()` trả `boolean` để mình *quyết định*; `waitForLoaded()` *bắt buộc* màn phải load, nếu không thì dừng test ngay. Các navigator `open()` của page con (ví dụ `LoginPage.open()`) dùng hàm này để đảm bảo sau khi điều hướng thì màn thật sự sẵn sàng.
- **Dòng 44** — Ghi log `debug` xác nhận đã load.

### 3.3. `waitForRoute()` — chờ URL đạt fragment (dòng 47–49)

```ts
47  async waitForRoute(fragment: string, timeout = TIMEOUTS.MEDIUM): Promise<void> {
48    await waitForRoute(fragment, { timeout })
49  }
```

- Đây là **wrapper mỏng** bọc hàm `waitForRoute` từ [wait.ts](../../../src/utils/wait.js). Hàm util đó poll `browser.getUrl()` cho tới khi URL **chứa** `fragment` (hoặc timeout kèm `timeoutMsg` rõ ràng).
- **Tại sao bọc lại?** Để page con gọi qua `this.waitForRoute(...)` như một method của page, thống nhất phong cách hướng đối tượng — không phải import trực tiếp util rời rạc.

### 3.4. `$()` và `$$()` — cầu nối tới element (dòng 53–59)

```ts
53  protected $(selector: string): ChainablePromiseElement {
54    return $(selector)
55  }
56
57  protected $$(selector: string) {
58    return $$(selector)
59  }
```

- Hai method `protected` bọc lại global `$` (một element) và `$$` (mảng element) của WebdriverIO.
- **Tại sao có?** Cho phép lớp con truy vấn element qua `this.$(...)` / `this.$$(...)` — vừa gọn, vừa để về sau có thể chèn logic chung (log, scope...) vào một chỗ. Hiện tại chúng chỉ forward thẳng.

### 3.5. Toast — `waitForSuccessToast()` / `waitForErrorToast()` (dòng 63–73)

```ts
63  async waitForSuccessToast(timeout = TIMEOUTS.SHORT): Promise<string> {
64    const toast = await $(SELECTORS.COMMON.TOAST_SUCCESS)
65    await toast.waitForDisplayed({ timeout, timeoutMsg: "Success toast did not appear" })
66    return toast.getText()
67  }
68
69  async waitForErrorToast(timeout = TIMEOUTS.SHORT): Promise<string> {
70    const toast = await $(SELECTORS.COMMON.TOAST_ERROR)
71    await toast.waitForDisplayed({ timeout, timeoutMsg: "Error toast did not appear" })
72    return toast.getText()
73  }
```

- Cả hai chờ một toast (thông báo nổi) **hiển thị** rồi trả về **text** của nó để spec `expect(...)`.
- Selector lấy từ `SELECTORS.COMMON.TOAST_SUCCESS` / `TOAST_ERROR`. Xem [selectors.ts](../../../src/constants/selectors.ts) dòng 81–82: chúng là selector **kép** (OR bằng dấu phẩy) khớp cả `data-testid` tuỳ chỉnh lẫn toast của thư viện **sonner** (`[data-sonner-toast][data-type="success"]`) — nên bắt được toast dù UI dùng cơ chế nào.
- Timeout mặc định `TIMEOUTS.SHORT` = **5s** vì toast là hiệu ứng ngắn.

### 3.6. Modal — `confirmModal()` / `cancelModal()` / `closeModal()` (dòng 77–92)

```ts
77  async confirmModal(): Promise<void> {
78    const btn = await $(SELECTORS.COMMON.MODAL_CONFIRM)
79    await btn.waitForClickable({ timeout: TIMEOUTS.SHORT })
80    await btn.click()
81  }
82
83  async cancelModal(): Promise<void> {
84    const btn = await $(SELECTORS.COMMON.MODAL_CANCEL)
85    await btn.waitForClickable({ timeout: TIMEOUTS.SHORT })
86    await btn.click()
87  }
88
89  async closeModal(): Promise<void> {
90    const btn = await $(SELECTORS.COMMON.MODAL_CLOSE)
91    if (await btn.isExisting()) await btn.click()
92  }
```

- **`confirmModal` / `cancelModal`** (dòng 77–87) — bấm nút "Xác nhận" / "Huỷ" trong hộp thoại chung. Cả hai **chờ nút clickable** (`waitForClickable`, 5s) rồi mới `click()` — tránh click hụt khi modal còn đang animate vào.
- **`closeModal`** (dòng 89–92) — khác ở chỗ **không chờ, không bắt buộc**: chỉ `isExisting()` rồi mới click. Đây là kiểu "đóng nếu có, không có thì thôi" — an toàn khi không chắc modal đang mở (ví dụ dọn dẹp trong `afterEach`).
- Selector lấy từ `SELECTORS.COMMON.MODAL_CONFIRM/CANCEL/CLOSE` (đều là `data-testid`, xem [selectors.ts](../../../src/constants/selectors.ts) dòng 84–86).

### 3.7. `safeClick()` — click chống-flake, dùng chung cho hầu hết page (dòng 96–119)

```ts
96   /**
97    * Resilient click — waits for element, scrolls into view, clicks, retries
98    * once on stale-element / intercept. This is the click most pages should use.
99    */
100  protected async safeClick(selector: string, label?: string): Promise<void> {
101    const tag = label ?? selector
102    const el = await $(selector)
103    await el.waitForClickable({
104      timeout: TIMEOUTS.MEDIUM,
105      timeoutMsg: `[${this.pageName}] ${tag} not clickable`
106    })
107    await el.scrollIntoView({ block: "center", inline: "center" })
108    try {
109      await el.click()
110    } catch (err) {
111      if (/stale element|element click intercepted/i.test((err as Error).message)) {
112        logger.warn(`[${this.pageName}] retrying click on ${tag} after intercept`)
113        await sleep(200)
114        await (await $(selector)).click()
115      } else {
116        throw err
117      }
118    }
119  }
```

Đây là **helper quan trọng nhất** của lớp cha — hầu hết page con click qua đây (ví dụ `LoginPage.submit()`, `StaffTokenLoginPage.submit()`).

- **Dòng 100** — `protected` nên chỉ page con dùng. Nhận `selector` và `label` tuỳ chọn (nhãn dễ đọc cho log).
- **Dòng 101** — `tag = label ?? selector`: ưu tiên `label`; nếu không truyền thì lấy chính selector làm nhãn. (`??` = nullish coalescing.)
- **Dòng 103–106** — Chờ element **clickable** (nhìn thấy + không bị disable), timeout `MEDIUM`=15s, `timeoutMsg` gắn `pageName` + `tag`.
- **Dòng 107** — `scrollIntoView` kéo element vào **giữa** khung nhìn (`block/inline: "center"`) để tránh bị header/footer che khi click.
- **Dòng 108–109** — Thử `click()`.
- **Dòng 110–117 (retry một lần)** — Nếu lỗi là **"stale element"** (element cũ đã bị React render lại) hoặc **"element click intercepted"** (bị phần tử khác chắn), thì: log cảnh báo, `sleep(200)`ms, rồi **lấy lại element mới** `await $(selector)` và click lại. Nếu là lỗi khác → **ném lại** (dòng 116), không nuốt lỗi lạ.

> **Tại sao vậy?** Trong SPA React, DOM tái dựng liên tục → tham chiếu element dễ "stale". Việc query lại selector rồi click là cách chuẩn để vượt qua flake này mà không cần retry cả test.

### 3.8. `safeFill()` — nhập text an toàn (dòng 121–132)

```ts
121  /** Type into an input, clearing any existing value first. */
122  protected async safeFill(selector: string, value: string, label?: string): Promise<void> {
123    const tag = label ?? selector
124    const el = await $(selector)
125    await el.waitForDisplayed({
126      timeout: TIMEOUTS.MEDIUM,
127      timeoutMsg: `[${this.pageName}] ${tag} not visible`
128    })
129    await el.click()
130    await el.clearValue()
131    await el.setValue(value)
132  }
```

- Cặp đôi của `safeClick`, dành cho **ô input**. Ví dụ `StaffTokenLoginPage.enterToken()` gọi hàm này.
- **Dòng 125–128** — Chờ input **hiển thị** (không cần clickable vì bước sau tự click).
- **Dòng 129** — `click()` để **focus** vào ô.
- **Dòng 130** — `clearValue()` **xoá giá trị cũ** trước — tránh nối thêm vào text sẵn có (điểm dễ quên khi tự viết).
- **Dòng 131** — `setValue(value)` gõ giá trị mới.

### 3.9. `getCurrentUrl()` (dòng 134–136)

```ts
134  async getCurrentUrl(): Promise<string> {
135    return browser.getUrl()
136  }
```

- Wrapper mỏng trả về URL hiện tại. Cho page/spec đọc URL theo phong cách method của page thay vì gọi `browser` trực tiếp.

### 3.10. `screenshot()` — chụp màn hình có đặt tên (dòng 138–144)

```ts
138  async screenshot(label: string): Promise<string> {
139    const safe = label.replace(/[^a-z0-9]/gi, "_").toLowerCase()
140    const file = `./reports/screenshots/${this.pageName}-${safe}-${Date.now()}.png`
141    await browser.saveScreenshot(file)
142    logger.info(`[${this.pageName}] screenshot → ${file}`)
143    return file
144  }
```

- **Dòng 139** — "Làm sạch" `label`: thay mọi ký tự **không phải chữ/số** bằng `_` rồi hạ chữ thường → tên file an toàn cho hệ điều hành.
- **Dòng 140** — Ghép đường dẫn: `./reports/screenshots/<pageName>-<label>-<timestamp>.png`. `Date.now()` (timestamp) đảm bảo **không trùng tên** giữa các lần chụp.
- **Dòng 141–143** — Lưu ảnh, log đường dẫn, trả về path cho nơi gọi (ví dụ đính vào report).

> ⚠️ So sánh: `AndroidAppShellPage` cũng có `screenshot()` nhưng **bọc `withTimeout` và nuốt lỗi** vì trên Android việc chụp WebView có thể treo. Còn `BasePage.screenshot()` ở đây **không** guard timeout — hợp lý cho môi trường desktop/web ổn định hơn.

---

## 4. Quan hệ với các page/spec khác

- **Mọi Page Object đều kế thừa lớp này:**
  - [LoginPage](./login.page.md) — override `rootSelector = SELECTORS.LOGIN.CARD`, dùng `safeClick`, `waitForLoaded`.
  - [StaffTokenLoginPage](./staff-token-login.page.md) — dùng `safeFill` (nhập token) và `safeClick` (submit).
  - [CustomerDisplayPage](./customer-display.page.md) — dùng `safeClick` bên trong window "customer".
- **`AndroidAppShellPage` là ngoại lệ:** nó **KHÔNG** kế thừa `BasePage` (xem [app-shell.page.md](./android/app-shell.page.md)) vì nó thao tác ở tầng context native, không phải DOM một màn hình cụ thể.
- **Barrel `index.ts`** re-export các instance page để spec import qua `@pages`. Xem [index.md](./index.md).
- Selector chung nằm ở [SELECTORS.COMMON](../../../src/constants/selectors.ts); timeout ở [TIMEOUTS](../../../src/constants/timeouts.ts).

---

## 5. Ghi chú & điểm dễ nhầm

- **`isLoaded()` vs `waitForLoaded()`**: cái đầu trả `boolean` (không ném lỗi, để mình quyết định); cái sau **ném lỗi** nếu không load. Chọn đúng theo ý định.
- **Hai thuộc tính `abstract`** (`pageName`, `rootSelector`) là **bắt buộc** — quên khai báo ở lớp con thì TypeScript báo lỗi biên dịch ngay. Đó là điểm mạnh: không thể tạo page "thiếu danh tính".
- **`safeClick` chỉ retry với đúng 2 loại lỗi** (stale / intercepted). Lỗi khác được ném lại nguyên vẹn — đừng tưởng nó nuốt mọi lỗi.
- **`safeFill` luôn `clearValue()` trước khi `setValue`** — nếu bạn tự viết `setValue` thẳng có thể bị nối chuỗi vào giá trị cũ.
- **Lớp cha chỉ được chạm `SELECTORS.COMMON.*`** (quy ước dòng 16–17). Nếu thấy lớp cha tham chiếu selector đặc thù của một màn hình → đó là "mùi" phá vỡ thiết kế.
- **`screenshot()` ở đây không guard timeout** — khác bản Android. Đừng copy nhầm giữa hai lớp.
