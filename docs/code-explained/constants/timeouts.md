# Giải thích code: `src/constants/timeouts.ts`

> **File nguồn:** [src/constants/timeouts.ts](../../../src/constants/timeouts.ts)
> **Loại:** Constants
> **Một câu:** Tập trung toàn bộ mốc thời gian chờ (timeout) vào một nơi, đặt tên theo **loại tình huống** thay vì rải "số ma thuật" khắp spec/page.

---

## 1. Mục đích tổng quan

File này export đúng **một object hằng số** `TIMEOUTS` (kèm một type phụ trợ). Ý tưởng cốt lõi:

- Thay vì viết `waitForDisplayed({ timeout: 60000 })` rải rác, ta viết `waitForDisplayed({ timeout: TIMEOUTS.EXTRA_LONG })`.
- Khi cần **tinh chỉnh** thời gian chờ, ta chỉnh theo **nhóm loại** (category) tại một chỗ duy nhất, thay vì đi sửa từng call-site.
- Tên hằng số mô tả **ngữ cảnh dùng** (element xuất hiện, gọi API, khởi động app…), giúp người đọc spec hiểu ngay "vì sao lại chờ lâu/nhanh".

Comment đầu file (dòng 1–4) nói rõ triết lý này: *"Prefer these named constants over magic numbers… Tune by category, not per-call-site."*

---

## 2. Các helper (nếu có)

File này **không có helper/hàm** — chỉ thuần một object hằng số và một type. (Phần này giữ để đồng bộ cấu trúc tài liệu.)

---

## 3. Giải thích từng hằng số / nhóm

```ts
5  export const TIMEOUTS = {
6    /** Element appearance / disappearance — most common */
7    SHORT: 5_000,
8    /** Default WDIO `waitFor*` budget */
9    MEDIUM: 15_000,
10   /** Network requests, API responses */
11   LONG: 30_000,
12   /** App startup, splash → home, large data sync */
13   EXTRA_LONG: 60_000,
14   /** Animation / transition delays. Avoid using — prefer waitForStable. */
15   ANIMATION: 500
16 } as const
```

> Cú pháp `5_000` là **số có dấu gạch dưới ngăn cách** trong JS/TS — chỉ để dễ đọc, `5_000 === 5000`. Vậy các giá trị là **mili-giây**: `5_000` = 5 giây, `60_000` = 60 giây.

| Key | Giá trị | Ý nghĩa / khi nào dùng |
|-----|---------|------------------------|
| `SHORT` | `5_000` (5 giây) | Chờ một element **xuất hiện / biến mất**. Đây là loại chờ **phổ biến nhất**. Ví dụ trong `ensure-logged-in.ts`, `waitUntil(..., { timeout: TIMEOUTS.SHORT })` dùng 5s để kiểm tra URL đã settle về màn thật chưa. |
| `MEDIUM` | `15_000` (15 giây) | **Ngân sách mặc định** cho các lệnh `waitFor*` của WebdriverIO. Dùng khi thao tác cần chờ vừa phải, không phải element đơn giản nhưng cũng chưa tới mức gọi mạng. |
| `LONG` | `30_000` (30 giây) | Chờ **request mạng / phản hồi API**. Dùng cho những thao tác phụ thuộc backend, nơi độ trễ mạng có thể lớn. |
| `EXTRA_LONG` | `60_000` (60 giây) | Chờ **khởi động app, chuyển splash → home, đồng bộ dữ liệu lớn**. Đây là mốc lâu nhất, dành cho tình huống nặng như boot app hoặc lần đầu sync. Trong `ensure-logged-in.ts` dùng cho `waitForDisplayed` ô nhập token và `waitUntil` rời màn login vì emulator ARM giả lập khởi động rất chậm. |
| `ANIMATION` | `500` (0,5 giây) | Độ trễ cho **animation / transition**. JSDoc **khuyến cáo hạn chế dùng** (`Avoid using — prefer waitForStable`): pause cứng là "necessary evil", nên ưu tiên chờ theo điều kiện (`waitForStable`/`waitUntil`) để test nhanh và ổn định hơn. Dù vậy `ensure-logged-in.ts` vẫn dùng `browser.pause(TIMEOUTS.ANIMATION)` một lần cho transition. |

### Type phụ trợ (dòng 18)

```ts
18 export type TimeoutKey = keyof typeof TIMEOUTS
```

- `keyof typeof TIMEOUTS` tạo ra **union các key hợp lệ**: `"SHORT" | "MEDIUM" | "LONG" | "EXTRA_LONG" | "ANIMATION"`.
- Dùng khi cần một tham số chỉ nhận đúng một trong các tên timeout ở trên (ví dụ một helper `wait(kind: TimeoutKey)`), giúp TypeScript báo lỗi nếu truyền tên sai.

---

## 5. Ghi chú & điểm dễ nhầm

- **`as const` (dòng 16) rất quan trọng**: nó "đóng băng" object thành literal type. Nhờ vậy `SHORT` có type `5000` chứ không phải `number`, và `TimeoutKey` mới suy ra được đúng union các key. Nếu bỏ `as const`, type sẽ nới lỏng và mất tính an toàn.
- **Đơn vị luôn là mili-giây** (chuẩn của WebdriverIO/`setTimeout`). Đừng nhầm `5_000` là 5 mili-giây — đó là 5 **giây**.
- **`ANIMATION` là ngoại lệ về triết lý**: cả 4 mốc kia là "chờ tối đa bao lâu" (dùng cho `waitFor*`/`waitUntil` — dừng sớm khi điều kiện đạt), còn `ANIMATION` thường dùng cho `pause` — **chờ cứng đủ 500ms** bất kể xong sớm hay không. Đó là lý do JSDoc khuyên tránh lạm dụng.
- **Chỉnh theo nhóm, không chỉnh theo chỗ gọi**: nếu test flaky vì chờ chưa đủ, hãy cân nhắc nâng giá trị của **đúng category** tại file này — mọi call-site dùng chung sẽ được hưởng, thay vì vá lẻ từng nơi.
