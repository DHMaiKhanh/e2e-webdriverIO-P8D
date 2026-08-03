# Giải thích code: `src/pages/android/app-shell.page.ts`

> **File nguồn:** [src/pages/android/app-shell.page.ts](../../../../src/pages/android/app-shell.page.ts)
> **Loại:** Page Object (entry point cho các lần chạy Android native — thao tác ở tầng context, KHÔNG kế thừa `BasePage`)
> **Một câu:** `AndroidAppShellPage` chuyển session WebdriverIO từ context `NATIVE_APP` sang context `WEBVIEW_*` của app (Tauri WebView đóng gói thành app Android), có retry chống treo — nhờ đó mọi selector DOM mới hoạt động được trên Android.

---

## 1. Mục đích tổng quan

Theo docblock (dòng 10–18), app đang test là **Tauri WebView bọc thành app Android native**. Hệ quả:

- Mọi selector DOM (`SELECTORS.*`) **chỉ resolve được** khi WebdriverIO **rời context `NATIVE_APP`** và **vào context `WEBVIEW_*`** của app.
- Các Page Object viết cho cấu hình web/desktop (`LoginPage`, `StaffTokenLoginPage`...) **tái dùng nguyên trên Android** — miễn là `switchToWebview()` đã chạy trước.

Vì thế `AndroidAppShellPage` là **cửa ngõ (entry point)** cho mọi lần chạy Android: gọi `switchToWebview()` một lần rồi các page DOM khác mới thao tác được. Đây là lý do [ensure-logged-in.ts](../../../../src/utils/ensure-logged-in.ts) gọi `androidAppShellPage.switchToWebview()` ngay sau khi bật app.

> **Lưu ý thiết kế:** khác các page khác, lớp này **KHÔNG `extends BasePage`** — nó thao tác ở tầng **context/driver native**, không phải ở tầng DOM của một màn hình cụ thể, nên không cần `rootSelector`/`pageName` hay các helper DOM.

---

## 2. Các import / kế thừa (dòng 1–8)

```ts
1  import { TIMEOUTS } from "../../constants/timeouts.js"
2  import { logger } from "../../utils/logger.js"
3  import { sleep, withTimeout } from "../../utils/wait.js"
4
5  /** Each chromedriver call gets this long before we give up and retry — the
6   * webview devtools attach can hang indefinitely on a dead handshake instead
7   * of erroring, so a per-attempt timeout is required to make retries fire. */
8  const CONTEXT_ATTEMPT_TIMEOUT = 15_000
```

| Dòng | Ý nghĩa |
|------|---------|
| 1 | `TIMEOUTS` — dùng `TIMEOUTS.LONG` = 30s làm hạn tổng mặc định cho `switchToWebview`. Đường dẫn `../../` vì file ở `pages/android/`. |
| 2 | `logger` — log tiến trình chuyển context (info/warn). |
| 3 | Từ [wait.ts](../../../../src/utils/wait.js): `sleep(ms)` (chờ giữa các lần thử) và **`withTimeout(promise, ms, label)`** — đua một promise với timeout, **reject** thay vì treo mãi. |
| 5–8 | **Hằng `CONTEXT_ATTEMPT_TIMEOUT = 15_000`** (15s): hạn cho **mỗi** lần gọi chromedriver. Comment giải thích **tại sao cần**: thao tác "attach devtools" của WebView có thể **treo vô hạn trên một handshake chết** mà **không tự báo lỗi** — nếu không có timeout mỗi-lần-thử thì retry **không bao giờ kích hoạt**. `15_000` dùng dấu `_` phân tách hàng nghìn cho dễ đọc. |

### Khai báo lớp (dòng 19)

```ts
19 export class AndroidAppShellPage {
```

- Lớp **thường** (không `abstract`, không `extends`). Không có `pageName`/`rootSelector`.

---

## 3. Giải thích từng method / khối code

### 3.1. `switchToWebview()` — chuyển sang context WebView, có retry (dòng 20–47)

```ts
20  /** Switch the session into the app's webview context. Retries while the
21   * webview is still attaching (common right after app launch). */
22  async switchToWebview(timeout = TIMEOUTS.LONG): Promise<void> {
23    const deadline = Date.now() + timeout
24    let lastContexts: string[] = []
25    while (Date.now() < deadline) {
26      try {
27        const contexts = (await withTimeout(
28          browser.getContexts() as Promise<string[]>,
29          CONTEXT_ATTEMPT_TIMEOUT,
30          "getContexts"
31        )) as string[]
32        lastContexts = contexts
33        const webview = contexts.find((c) => c.toString().startsWith("WEBVIEW"))
34        if (webview) {
35          await withTimeout(browser.switchContext(webview), CONTEXT_ATTEMPT_TIMEOUT, "switchContext")
36          logger.info(`[AndroidAppShell] switched to context ${webview}`)
37          return
38        }
39      } catch (err) {
40        logger.warn(`[AndroidAppShell] context attempt failed, retrying: ${(err as Error).message}`)
41      }
42      await sleep(500)
43    }
44    throw new Error(
45      `[AndroidAppShell] no WEBVIEW context appeared within ${timeout}ms (saw: ${JSON.stringify(lastContexts)})`
46    )
47  }
```

Đây là method **quan trọng nhất** của file. Nó **poll lặp lại** cho tới khi tìm và chuyển được vào context WebView, hoặc hết hạn.

- **Dòng 22** — `timeout` tổng mặc định `TIMEOUTS.LONG` = **30s**.
- **Dòng 23** — `deadline` = thời điểm phải dừng (bây giờ + 30s). Vòng lặp chạy tới khi quá mốc này.
- **Dòng 24** — `lastContexts` lưu danh sách context lần cuối thấy được — dùng cho thông báo lỗi cuối (dòng 45) để chẩn đoán.
- **Dòng 25** — Vòng `while` lặp cho tới `deadline`.
- **Dòng 27–31** — Gọi `browser.getContexts()` (liệt kê mọi context: `NATIVE_APP`, `WEBVIEW_...`) nhưng **bọc `withTimeout(..., 15s, "getContexts")`**: nếu chromedriver treo quá 15s thì reject để vòng lặp thử lại, thay vì treo vô hạn.
- **Dòng 32** — Lưu lại danh sách vừa thấy.
- **Dòng 33** — Tìm context đầu tiên có tên bắt đầu bằng `"WEBVIEW"` (ví dụ `WEBVIEW_com.fastboy.volt_pos`).
- **Dòng 34–38** — Nếu tìm thấy: `switchContext(webview)` (cũng bọc `withTimeout` 15s), log, và **`return`** — thoát hàm thành công.
- **Dòng 39–41** — Nếu `getContexts`/`switchContext` **ném lỗi hoặc timeout**: **không thoát**, chỉ log `warn` rồi để vòng lặp thử lại. Đây là chỗ retry phát huy tác dụng.
- **Dòng 42** — Giữa các lần thử, `sleep(500)`ms để WebView có thời gian "attach" (rất hay xảy ra ngay sau khi app vừa mở).
- **Dòng 44–46** — Nếu hết `deadline` mà **chưa từng thấy** WEBVIEW: **ném lỗi** kèm `timeout` và danh sách context cuối cùng (`lastContexts`) — cực hữu ích để biết lúc đó chỉ có mỗi `NATIVE_APP` hay có gì khác.

> **Tại sao phải phức tạp vậy?** Trên emulator (đặc biệt emulator ARM giả lập), WebView cần vài giây mới sẵn sàng, và lệnh chromedriver có thể **treo im lặng**. Kết hợp **timeout mỗi-lần-thử (`withTimeout`)** + **vòng lặp retry với deadline tổng** là mẫu chuẩn để việc chuyển context ổn định.

### 3.2. `getBodyText()` — đọc text màn hình hiện tại (dòng 49–53)

```ts
49  /** Raw text of whatever screen is currently showing — used for diagnostics
50   * when the app lands somewhere unexpected (e.g. an error/support screen). */
51  async getBodyText(): Promise<string> {
52    return $("body").getText()
53  }
```

- Lấy **toàn bộ text** của `<body>` trong WebView hiện tại.
- **Mục đích chẩn đoán** (comment dòng 49–50): khi app rơi vào màn không mong đợi (màn lỗi/hỗ trợ), spec đọc text này để biết đang đứng ở đâu. Chỉ dùng được **sau khi** `switchToWebview()` thành công (vì cần context WebView để `$("body")` có nghĩa).

### 3.3. `screenshot()` — chụp màn hình chẩn đoán, best-effort (dòng 55–70)

```ts
55  /** Best-effort diagnostic screenshot. The webview screenshot handshake can
56   * hang indefinitely on a dead handshake just like getContexts/switchContext,
57   * so it's timeout-guarded; failure here is logged, not thrown, since a
58   * missing screenshot shouldn't take down the rest of the test. */
59  async screenshot(label: string): Promise<string | undefined> {
60    const safe = label.replace(/[^a-z0-9]/gi, "_").toLowerCase()
61    const file = `./reports/screenshots/android-${safe}-${Date.now()}.png`
62    try {
63      await withTimeout(browser.saveScreenshot(file), CONTEXT_ATTEMPT_TIMEOUT, "saveScreenshot")
64      logger.info(`[AndroidAppShell] screenshot → ${file}`)
65      return file
66    } catch (err) {
67      logger.warn(`[AndroidAppShell] screenshot failed, continuing: ${(err as Error).message}`)
68      return undefined
69    }
70  }
```

- **Dòng 59** — Trả `Promise<string | undefined>`: **có thể là `undefined`** nếu chụp thất bại (điểm khác biệt then chốt so với `BasePage.screenshot()` luôn trả `string`).
- **Dòng 60–61** — Làm sạch `label` (thay ký tự không phải chữ/số bằng `_`, hạ chữ thường) và ghép path `./reports/screenshots/android-<label>-<timestamp>.png`. Tiền tố `android-` phân biệt với ảnh của các page desktop.
- **Dòng 62–65** — `saveScreenshot` bọc **`withTimeout` 15s** (vì handshake chụp WebView cũng có thể treo như `getContexts`/`switchContext`). Thành công → log + trả path.
- **Dòng 66–69** — **Best-effort**: nếu lỗi/timeout thì **chỉ log `warn` và trả `undefined`**, **KHÔNG ném lỗi**. Comment (dòng 57–58) giải thích lý do: thiếu một tấm ảnh chẩn đoán **không được phép** làm sập cả test.

> Đối chiếu với [BasePage.screenshot()](../base.page.md#310-screenshot--chụp-màn-hình-có-đặt-tên-dòng-138144): bản BasePage **không** guard timeout và **ném lỗi** nếu chụp fail — hợp lý cho môi trường desktop ổn định. Bản Android **guard + nuốt lỗi** vì WebView emulator dễ treo.

### 3.4. Xuất instance singleton (dòng 73)

```ts
73 export const androidAppShellPage = new AndroidAppShellPage()
```

- Instance dùng chung `androidAppShellPage`, được [index.ts](../index.md) dòng 13 re-export và [ensure-logged-in.ts](../../../../src/utils/ensure-logged-in.ts) import qua `@pages`.

---

## 4. Quan hệ với các page/spec khác

- **Là điều kiện tiên quyết cho mọi page DOM trên Android.** `ensureLoggedIn()` gọi `androidAppShellPage.switchToWebview()` (ensure-logged-in.ts dòng 34) **trước** khi dùng `staffTokenLoginPage`/các selector DOM. Xem [ensure-logged-in.md](../../../code-explained/utils/ensure-logged-in.md) mục 4.1.
- **KHÔNG kế thừa `BasePage`** — khác với [LoginPage](../login.page.md)/[StaffTokenLoginPage](../staff-token-login.page.md)/[CustomerDisplayPage](../customer-display.page.md). Nó là tầng "shell/context", không phải một màn hình DOM.
- **Được export** qua barrel [index.ts](../index.md) dòng 13.
- Phụ thuộc `withTimeout`/`sleep` từ [wait.ts](../../../../src/utils/wait.js) và `TIMEOUTS.LONG` từ [timeouts.ts](../../../../src/constants/timeouts.ts).

---

## 5. Ghi chú & điểm dễ nhầm

- **Phải gọi `switchToWebview()` trước** khi bất kỳ selector DOM nào hoạt động trên Android. Quên bước này → mọi `$()` thao tác nhầm trên context `NATIVE_APP` và không tìm thấy element web.
- **Hai lớp timeout lồng nhau:** `timeout` **tổng** (30s, tham số `switchToWebview`) bao ngoài; `CONTEXT_ATTEMPT_TIMEOUT` **mỗi-lần-thử** (15s) bọc từng lệnh chromedriver. Cả hai đều cần: một cái giới hạn tổng thời gian, một cái đảm bảo retry thực sự nổ ra khi lệnh treo.
- **`withTimeout` là mấu chốt chống treo** — vì lệnh chromedriver có thể "treo im lặng" không tự reject; nếu bỏ `withTimeout`, vòng retry vô dụng.
- **`screenshot()` có thể trả `undefined`** và **không ném lỗi** — khác `BasePage.screenshot()`. Nơi gọi phải xử lý khả năng `undefined`.
- **`getBodyText()`/`screenshot()` chỉ có nghĩa sau khi đã vào WebView.** Gọi khi còn ở `NATIVE_APP` sẽ không cho kết quả DOM như mong đợi.
- **Tên context bắt đầu bằng `"WEBVIEW"`** (dòng 33) — dùng `startsWith` chứ không so khớp chính xác, vì hậu tố (package name) thay đổi theo app.
