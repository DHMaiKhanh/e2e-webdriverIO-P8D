# P8D · E2E Test Dashboard (React)

Dashboard React hiển thị kết quả sau khi chạy toàn bộ test WebdriverIO: **pass /
fail / broken / skip**, tỉ lệ pass, tổng hợp **theo tính năng**, và **nguyên nhân
lỗi** của từng test (message + stack trace). Nằm trong folder riêng, tách hẳn khỏi
bộ test.

```
dashboard/
├── scripts/build-data.mjs   # Allure results  →  public/results.json (parser, không phụ thuộc gì)
├── public/results.json      # dữ liệu dashboard (tự sinh)
└── src/                     # app React + TS (Vite)
    ├── App.tsx              # topbar · KPI · donut · feature bars · bảng lỗi
    ├── components/          # Donut, FeatureBars
    ├── format.ts, types.ts, theme.css
```

## Chạy

```bash
cd dashboard
npm install         # lần đầu
npm run dev         # tự chạy build-data rồi mở http://localhost:5188
```

- `npm run data` — chỉ đọc lại `../reports/allure-results` và ghi `public/results.json`.
- `npm run build` — build tĩnh ra `dist/` (deploy được lên host tĩnh bất kỳ).
- Nút **↻ Làm mới** trên dashboard đọc lại `results.json` (chạy `npm run data`
  sau mỗi lần chạy test để cập nhật số liệu).

## Luồng dữ liệu

1. Bộ test WDIO dùng **Allure reporter** → đổ file `*-result.json` vào
   `reports/allure-results/`.
2. `build-data.mjs` đọc tất cả, **gộp theo `historyId` giữ lần chạy mới nhất**
   (retry & lần chạy cũ tự thu về trạng thái hiện tại), tách ra:
   - `id` (VD `CASH-01`), `tags` (`@smoke`…), `title`
   - `feature` = tên `describe` (VD *Cash payment*), `area` = thư mục spec
   - `status`, `durationMs`, và `error` (message + trace) nếu fail/broken
3. Ghi ra `public/results.json` theo schema trong [`src/types.ts`](src/types.ts).
4. App React đọc `results.json` và render.

> Vì Allure gộp nhiều lần chạy, dashboard phản ánh **trạng thái mới nhất của mỗi
> test**. Muốn 1 lần chạy sạch: xoá `reports/allure-results/` trước khi chạy test.

## Thiết kế màu

Dùng **status palette** chuẩn của skill `dataviz` (cố định, không đổi theo theme):
pass `#0ca30c` · failed `#d03b3b` · broken `#ec835a` · skipped `#fab219`. Mỗi
trạng thái luôn đi kèm nhãn + icon (không chỉ dựa vào màu). Có sáng/tối (nút góc
phải: Auto → Sáng → Tối).
