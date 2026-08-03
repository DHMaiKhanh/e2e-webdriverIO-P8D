# Giải thích code: `src/specs/android/dump-page-source.e2e.ts`

> **File nguồn:** [src/specs/android/dump-page-source.e2e.ts](../../../../src/specs/android/dump-page-source.e2e.ts)
> **Loại:** Spec (Mocha E2E, Android) — công cụ dump/khảo sát, KHÔNG phải test
> **Chạy khi nào:** **LUÔN chạy** — `describe` thường, KHÔNG skip logic. Thường gọi riêng qua `npm run android:dump`.
> **Một câu:** Chụp "bản đồ" màn hình hiện tại (DOM WebView + cây native + bảng selector gợi ý) vào `reports/page-source/` để viết/sửa test nhanh và đảm bảo selector khớp đúng những gì app render.

---

## 1. Mục đích tổng quan

Đây là **công cụ khảo sát selector**, không có assertion, không bao giờ fail vì trạng thái app (docblock dòng 1–24). Mỗi lần chạy nó ghi ra `reports/page-source/`:

- `native-source-<ts>.xml` — cây phân cấp native uiautomator2 (bắt được cả dialog hệ thống, prompt staff token...).
- `webview-dom-<ts>.html` — toàn bộ DOM sống của WebView (soi selector).
- `selectors-<ts>.md` — ⭐ bảng các phần tử ứng viên + selector gợi ý.
- Thêm một screenshot tham chiếu.

**Quy trình dùng** (docblock dòng 19–23): lái app tới màn hình muốn test → chạy dump → lặp lại cho từng màn hình. File `selectors-*.md` sinh ra trở thành nguồn để viết spec thật.

---

## 2. Các import / phụ thuộc (dòng 25–30)

```ts
25 import { mkdir, writeFile } from "node:fs/promises"
26 import path from "node:path"
27 import { androidAppShellPage } from "@pages"
28 import { logger } from "../../utils/logger.js"
29
30 const OUT_DIR = path.resolve(process.cwd(), "reports/page-source")
```

| Dòng | Ý nghĩa |
|------|---------|
| 25 | `mkdir`, `writeFile` từ Node fs/promises — tạo thư mục & ghi file kết quả. |
| 26 | `path` — ghép/chuẩn hoá đường dẫn đa nền tảng. |
| 27 | `androidAppShellPage` — vào WebView, chụp screenshot. Xem [pages/android/app-shell.page.ts](../../../../src/pages/android/app-shell.page.ts). |
| 28 | `logger` — logger dùng chung. |
| 30 | **`OUT_DIR`** — thư mục xuất, `<cwd>/reports/page-source` (đường dẫn tuyệt đối hoá từ thư mục làm việc). |

> Đây là spec duy nhất trong nhóm dùng trực tiếp API filesystem của Node để ghi artifact.

---

## 3. Điều kiện chạy suite (skip logic)

**KHÔNG có skip logic.** Dòng 70 là `describe` thường:

```ts
70 describe("Android page-source dump (selector map)", () => {
```

Suite luôn chạy khi được nạp; thực tế được gọi riêng qua `npm run android:dump`. Nó không cần gate ENV vì không assertion — kể cả khi WebView không vào được, bước native vẫn dump ra XML (xem 4.2).

---

## 4. Giải thích từng khối

Ngoài suite, file có **các hàm/kiểu trợ giúp cấp module** (dòng 32–68) rồi mới tới `it` (dòng 71–167).

### 4.1. Kiểu & hàm trợ giúp (dòng 32–68)

```ts
32 /** One candidate element the selector map surfaces. */
33 interface Candidate {
34   tag: string
35   id?: string
36   testid?: string
...
45 }
```

- **Dòng 33–45** — Interface `Candidate`: mô tả một phần tử ứng viên (tag, id, testid, name, role, type, ariaLabel, placeholder, text, classes, visible). Đây là "hình dạng" mỗi hàng trong bảng selector.

```ts
47 /** A filesystem-safe timestamp for output filenames (no `:` for Windows). */
48 const stamp = (): string => new Date().toISOString().replace(/[:.]/g, "-")
```

- **Dòng 48** — `stamp()` tạo timestamp an toàn cho tên file: thay `:` và `.` bằng `-` (Windows không cho phép `:` trong tên file). Ví dụ `2026-08-02T10-30-00-000Z`.

```ts
56 const suggestSelector = (c: Candidate): string => {
57   if (c.testid) return `[data-testid="${c.testid}"]`
58   if (c.id) return `#${c.id}`
59   if (c.name) return `${c.tag}[name="${c.name}"]`
60   if (c.role && c.text) return `//*[@role="${c.role}" and normalize-space()="${c.text}"]`
61   if (c.text && (c.tag === "button" || c.tag === "a")) return `${c.tag}=${c.text}`
62   if (c.placeholder) return `${c.tag}[placeholder="${c.placeholder}"]`
63   if (c.role) return `[role="${c.role}"]`
64   return "(no stable attr — add a data-testid in the app)"
65 }
```

- **Dòng 56–65** — `suggestSelector()` sinh selector mà người viết test hay chọn nhất, theo **thứ tự ưu tiên**: `data-testid` → `id` → `name` → `role`+text (XPath) → text (button/link) → `placeholder` → `role`. Nếu không có attr ổn định nào (dòng 64) → gợi ý "thêm data-testid vào app". Thứ tự này **phản chiếu cách viết `SELECTORS.*`** trong repo, để output dán thẳng vào page object được.

```ts
68 const cell = (v: string | undefined): string => (v ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim()
```

- **Dòng 68** — `cell()` làm sạch giá trị cho ô bảng markdown: escape `|` (kẻo vỡ bảng), gộp mọi khoảng trắng thành 1 space, trim. `v ?? ""` xử lý undefined.

### 4.2. Test case duy nhất — bắt đầu & dump native (dòng 71–85)

```ts
71   it("captures the current screen's DOM, native tree, and selector map", async () => {
72     await mkdir(OUT_DIR, { recursive: true })
73     const ts = stamp()
74
75     // 1. Native uiautomator2 hierarchy — grab this while still in NATIVE_APP ...
78     try {
79       const nativeXml = await browser.getPageSource()
80       const file = path.join(OUT_DIR, `native-source-${ts}.xml`)
81       await writeFile(file, nativeXml, "utf8")
82       logger.info(`[dump] native source → ${file} (${nativeXml.length} chars)`)
83     } catch (err) {
84       logger.warn(`[dump] native source failed: ${(err as Error).message}`)
85     }
```

- **Dòng 72** — Tạo `OUT_DIR` (đệ quy, không lỗi nếu đã tồn tại).
- **Dòng 73** — Một `ts` duy nhất dùng chung cho mọi file lần chạy này (để các file cùng lần trùng timestamp, dễ ghép cặp).
- **Dòng 79–81** — **Bước 1**: `getPageSource()` lấy cây native XML **khi vẫn còn ở context `NATIVE_APP`** (context mặc định ngay sau attach). Comment (75–77) giải thích: phải lấy trước khi vào WebView để bắt được cả bề mặt chỉ có ở native (dialog hệ thống, prompt staff token).
- **Dòng 83–84** — Lỗi → warning, không fail.

### 4.3. Vào WebView + dump DOM (dòng 87–100)

```ts
87     // 2. Switch into the Tauri webview so DOM APIs resolve.
88     await androidAppShellPage.switchToWebview(30_000)
89
90     // 3. Full live DOM ...
92     let dom = ""
93     try {
94       dom = (await browser.execute(() => document.documentElement.outerHTML)) as string
95       const file = path.join(OUT_DIR, `webview-dom-${ts}.html`)
96       await writeFile(file, dom, "utf8")
97       logger.info(`[dump] webview DOM → ${file} (${dom.length} chars)`)
98     } catch (err) {
99       logger.warn(`[dump] webview DOM failed: ${(err as Error).message}`)
100    }
```

- **Dòng 88** — **Bước 2**: vào WebView (timeout 30s) để các API DOM hoạt động. Lưu ý: lệnh này **không** bọc try/catch — nếu vào WebView thất bại thì test dừng ở đây (nhưng file native XML ở bước 1 đã ghi xong).
- **Dòng 94** — **Bước 3**: `browser.execute(() => document.documentElement.outerHTML)` chạy JS **trong** WebView để lấy toàn bộ DOM sống — "ground truth" cho mọi CSS/XPath selector.
- **Dòng 95–97** — Ghi ra `webview-dom-<ts>.html`.

### 4.4. Thu thập ứng viên selector (dòng 102–132)

```ts
105    let candidates: Candidate[] = []
106    try {
107      candidates = (await browser.execute(() => {
108        const pick = (el: Element): unknown => {
109          const rect = el.getBoundingClientRect()
...
122            visible: rect.width > 0 && rect.height > 0
123          }
124        }
125        const nodes = document.querySelectorAll(
126          "[id],[data-testid],[data-test],[name],[role],[aria-label],[placeholder],button,a[href],input,select,textarea"
127        )
128        return Array.from(nodes).map(pick)
129      })) as Candidate[]
130    } catch (err) {
131      logger.warn(`[dump] selector collection failed: ${(err as Error).message}`)
132    }
```

- **Dòng 107–129** — **Bước 4**: chạy JS trong WebView để quét phần tử. Hàm `pick` (108–124) trích các thuộc tính cần cho `Candidate`, và tính `visible` = có kích thước dương (`rect.width > 0 && rect.height > 0`).
- **Dòng 125–127** — `querySelectorAll` chọn phần tử **có hook ổn định** (`id`, `data-testid`, `data-test`, `name`, `role`, `aria-label`, `placeholder`) **hoặc mang tính tương tác** (`button`, `a[href]`, `input`, `select`, `textarea`).
- **Dòng 128** — Map mỗi node qua `pick`. Toàn bộ chạy qua `browser.execute` nên logic chạy **trong trình duyệt WebView**, trả kết quả về Node.

### 4.5. Sắp xếp + dựng bảng markdown (dòng 134–161)

```ts
134    // Visible elements first ...
135    candidates.sort((a, b) => Number(b.visible) - Number(a.visible))
136
137    const rows = candidates
138      .map((c) => {
139        const label = c.text || c.ariaLabel || c.placeholder || ""
140        return `| \`${cell(suggestSelector(c))}\` | ${cell(c.tag)} | ${cell(label)} | ${c.visible ? "✓" : ""} |`
141      })
142      .join("\n")
143
144    const md = [
145      `# Selector map — ${ts}`,
...
159    const mdFile = path.join(OUT_DIR, `selectors-${ts}.md`)
160    await writeFile(mdFile, md, "utf8")
161    logger.info(`[dump] selector map → ${mdFile} (${candidates.length} candidates)`)
```

- **Dòng 135** — Sắp xếp: phần tử **visible lên trước** (đó là những thứ thật sự tương tác được). `Number(b.visible) - Number(a.visible)` ép boolean thành 0/1.
- **Dòng 137–142** — Dựng từng hàng bảng: cột selector gợi ý (qua `suggestSelector` + `cell`), tag, nhãn (text/aria/placeholder), và dấu `✓` nếu visible.
- **Dòng 144–157** — Ghép nội dung markdown hoàn chỉnh (tiêu đề, chú thích file kèm, thứ tự ưu tiên selector, header bảng, các hàng).
- **Dòng 159–160** — Ghi `selectors-<ts>.md` — file quan trọng nhất của công cụ.

### 4.6. Screenshot + kết thúc (dòng 163–166)

```ts
163    // 5. Screenshot for a visual reference alongside the DOM.
164    await androidAppShellPage.screenshot("dump")
165
166    logger.info(`[dump] done — see ${OUT_DIR}`)
```

- **Dòng 164** — Chụp screenshot tham chiếu trực quan (nhãn `"dump"`), best-effort.
- **Dòng 166** — Log hoàn tất. **Không có `expect`** — toàn bộ giá trị nằm ở các file artifact.

---

## 5. Sơ đồ luồng test

```
describe "Android page-source dump (selector map)"  (luôn chạy, thường gọi riêng)
        │
        ▼
it "captures the current screen's DOM, native tree, and selector map"
        │
[72] mkdir(OUT_DIR) ──► [73] ts = stamp()
        │
[79-81] Bước 1: getPageSource() (NATIVE) → native-source-<ts>.xml   (try/catch)
        │
[88] Bước 2: switchToWebview(30s)   ← nếu fail, dừng nhưng XML đã ghi
        │
[94-96] Bước 3: outerHTML → webview-dom-<ts>.html                    (try/catch)
        │
[107-128] Bước 4: querySelectorAll + pick → candidates[]            (try/catch)
        │
[135] sort visible-first ──► [137-142] dựng rows ──► [159-160] selectors-<ts>.md
        │
[164] screenshot("dump") ──► [166] done
```

---

## 6. Ghi chú & điểm dễ nhầm

- **Đây là công cụ, không phải test**: không assertion, không fail vì app-state. Đừng kỳ vọng nó "pass/fail" theo nghĩa nghiệp vụ — giá trị là các file trong `reports/page-source/`.
- **Native XML lấy TRƯỚC khi vào WebView** (bước 1 trước bước 2) là chủ ý: chỉ ở context `NATIVE_APP` mới thấy dialog hệ thống / prompt token native.
- **`switchToWebview(30_000)` ở dòng 88 KHÔNG bọc try/catch**: nếu WebView không vào được (thiết bị MDM-locked), test dừng tại đây — nhưng file native XML đã ghi thành công. Ba bước WebView (DOM, candidates, screenshot) mỗi bước lại tự bọc try/catch riêng.
- **`stamp()` thay `:`/`.`** để tương thích Windows — nếu không tên file sẽ không hợp lệ.
- **Thứ tự ưu tiên trong `suggestSelector`** cố tình khớp với quy ước `SELECTORS.*` của repo (data-testid trước hết) để output dán thẳng vào page object.
- **`browser.execute(() => ...)`** ở dòng 94, 107 chạy JS **bên trong** WebView (không phải Node) — đó là lý do dùng được `document`, `getBoundingClientRect`...
