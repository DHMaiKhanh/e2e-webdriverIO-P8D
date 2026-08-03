# Giải thích code: `src/constants/messages.ts`

> **File nguồn:** [src/constants/messages.ts](../../../src/constants/messages.ts)
> **Loại:** Constants
> **Một câu:** Gom các **chuỗi UI / thông báo lỗi** mà test dùng để assert vào một nơi, phản chiếu **đúng từng chữ** những gì người dùng nhìn thấy trên app.

---

## 1. Mục đích tổng quan

File export một object `MESSAGES` (kèm type phụ trợ). Nó là "nguồn sự thật" cho các chuỗi text mà **assertion** trong spec sẽ so khớp.

Comment đầu file (dòng 1–4) nêu rõ nguyên tắc:

- *"Mirror exactly what users see"* — chuỗi ở đây phải **giống hệt** copy hiển thị trong app (đúng dấu câu, hoa/thường, khoảng trắng).
- *"change here when the app copy changes"* — khi app đổi câu chữ, **sửa một chỗ này** là mọi assertion tự cập nhật, tránh chuỗi rải rác trong nhiều spec.

Nhờ đó, test kiểm tra thông báo (ví dụ "đăng nhập sai", "lưu thành công") sẽ tham chiếu `MESSAGES.*` thay vì viết literal string.

---

## 2. Các helper (nếu có)

File này **không có helper/hàm** — chỉ là object hằng số lồng nhau và một type. (Phần này giữ để đồng bộ cấu trúc tài liệu.)

---

## 3. Giải thích từng hằng số / nhóm

```ts
5  export const MESSAGES = {
6    LOGIN: {
7      INVALID_CREDENTIALS: "Invalid email or PIN",
8      REDIRECTING: "Sign in successful. Redirecting..."
9    },
10
11   SETTINGS: {
12     SAVED: "Settings saved successfully"
13   },
14
15   COMMON: {
16     NETWORK_ERROR: "Network error. Please try again.",
17     UNAUTHORIZED: "Session expired. Please sign in again.",
18     GENERIC_ERROR: "Something went wrong"
19   }
20 } as const
```

### Nhóm `LOGIN` (dòng 6–9) — thông báo màn đăng nhập

| Key | Giá trị | Ý nghĩa / khi nào dùng |
|-----|---------|------------------------|
| `INVALID_CREDENTIALS` | `"Invalid email or PIN"` | Thông báo khi đăng nhập **sai email hoặc PIN**. Dùng để assert luồng login thất bại hiển thị đúng lỗi. |
| `REDIRECTING` | `"Sign in successful. Redirecting..."` | Thông báo **đăng nhập thành công** đang chuyển hướng. Dùng để xác nhận login thành công trước khi router điều hướng đi. |

### Nhóm `SETTINGS` (dòng 11–13) — thông báo màn cài đặt

| Key | Giá trị | Ý nghĩa / khi nào dùng |
|-----|---------|------------------------|
| `SAVED` | `"Settings saved successfully"` | Thông báo (thường là toast) khi **lưu cài đặt thành công**. Dùng để assert sau khi bấm nút lưu trong Settings. |

### Nhóm `COMMON` (dòng 15–19) — thông báo dùng chung toàn app

| Key | Giá trị | Ý nghĩa / khi nào dùng |
|-----|---------|------------------------|
| `NETWORK_ERROR` | `"Network error. Please try again."` | Lỗi **mạng** chung. Dùng để assert khi thao tác thất bại do mất kết nối / request lỗi. |
| `UNAUTHORIZED` | `"Session expired. Please sign in again."` | Thông báo **hết phiên đăng nhập** (session expired), yêu cầu đăng nhập lại. Dùng để assert luồng bị đá về login khi token hết hạn. |
| `GENERIC_ERROR` | `"Something went wrong"` | Lỗi **chung chung** khi không rơi vào loại cụ thể nào. Dùng làm fallback assert cho các tình huống lỗi không xác định. |

### Type phụ trợ (dòng 22)

```ts
22 export type MessageKey = keyof typeof MESSAGES
```

- `keyof typeof MESSAGES` cho ra union các **key nhóm cấp cao nhất**: `"LOGIN" | "SETTINGS" | "COMMON"`.
- Lưu ý: type này chỉ bao các **nhóm**, **không** đi vào các key con (`INVALID_CREDENTIALS`…). Nếu cần type cho từng chuỗi con, phải viết thêm (xem phần ghi chú).

---

## 5. Ghi chú & điểm dễ nhầm

- **Phải khớp từng ký tự với UI thật**: dấu ba chấm trong `"...Redirecting..."`, dấu chấm cuối `"...try again."`, viết hoa "Session"/"PIN"… Chỉ cần lệch một khoảng trắng hay dấu câu là assertion `toHaveText`/so khớp chuỗi sẽ **fail**. Khi app đổi copy, cập nhật đúng chuỗi ở đây.
- **Assertion nên dùng "chứa" hay "bằng"?** Nếu app render thêm khoảng trắng/biểu tượng quanh text, cân nhắc so khớp kiểu *contains* thay vì *equals* — nhưng bản thân hằng số vẫn nên phản chiếu đúng nguyên văn.
- **`MessageKey` chỉ tới nhóm, không tới chuỗi**: đừng tưởng `MessageKey` là `"INVALID_CREDENTIALS" | ...`. Nó là `"LOGIN" | "SETTINGS" | "COMMON"`.
- **`as const` (dòng 20)** giữ cho mỗi chuỗi là literal type (ví dụ type của `SAVED` là đúng chuỗi `"Settings saved successfully"`), tăng an toàn khi so khớp và refactor.
- **Chỉ là dữ liệu tĩnh**: file không đọc biến môi trường, không format động — thuần chuỗi cố định. Mọi chuỗi có tham số/động phải xử lý ở nơi khác.
