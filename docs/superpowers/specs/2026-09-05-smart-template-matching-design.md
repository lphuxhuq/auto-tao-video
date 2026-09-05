# Thiết kế Cơ chế Tự động Ánh xạ Template Phù hợp với Bài báo (Smart Template Matching)

## 1. Tổng quan (Overview)

Hiện tại, khi AI Agent tạo video từ bài báo, việc lựa chọn template cho từng phân cảnh (`scenes`) chưa có bộ quy tắc phân loại rõ ràng theo thể loại tin tức (pháp luật, tài chính, công nghệ, xã hội...), dẫn tới việc:
- Sử dụng template chưa làm nổi bật được bản chất của bài viết (ví dụ: tin pháp luật thiếu điểm nhấn số liệu bị can/tiền án, tin kinh tế thiếu so sánh tăng giảm...).
- Dễ mắc lỗi vi phạm giới hạn ký tự hoặc cấu trúc của Zod Schema trong `src/render/script-schema.ts` (ví dụ: trường `statement` vượt quá 80 ký tự, dùng nhầm `items` thay vì `bullets` cho `feature-list`, dùng nhầm `subtext` thay vì `context` cho `stat-hero`).

Mục tiêu của thiết kế này là hoàn thiện bộ quy tắc thông minh trong **Skill `create-news-video`** (áp dụng cho cả Antigravity IDE và Claude Code), giúp AI tự động phân tích ngữ cảnh bài báo và chọn các template trực quan tối ưu nhất, đồng thời tuân thủ nghiêm ngặt 100% schema.

---

## 2. Ma trận Phân loại Thể loại Tin tức & Ánh xạ Template (Topic Classification Matrix)

Khi phân tích bài báo ở Step 2, AI Agent phải tự động xác định thể loại chính:

### 2.1. Pháp luật / Trọng án / An ninh trật tự (Legal & Crime)
- **Đặc trưng:** Có số người bị khởi tố/truy tố, số tiền thiệt hại/thu lợi bất chính, thủ đoạn tinh vi, lời khai hoặc kết luận cơ quan điều tra.
- **Công thức phân cảnh đề xuất (5–6 scenes):**
  1. `hook`: Tít giật gân, nêu bật hành vi phạm pháp lớn nhất hoặc vụ án triệt phá.
  2. `stat-hero`: Nêu bật con số ấn tượng nhất (Số bị can: `74 BỊ CAN`, Số tiền: `2,4 TỶ ĐỒNG`, Tang vật...).
  3. `callout`: Trích dẫn thủ đoạn tinh vi, lời khai hoặc hành vi cốt lõi (`statement` ≤ 80 chars).
  4. `feature-list`: Liệt kê 2–3 thủ đoạn phạm tội, các bên liên quan, hoặc quy định bị vi phạm.
  5. `callout`: Cảnh báo người dân, hệ lụy hoặc kết luận của cơ quan công an.
  6. `outro`: Kêu gọi theo dõi diễn biến vụ án.

### 2.2. Kinh tế / Tài chính / Bất động sản / Tiền tệ (Economy & Finance)
- **Đặc trưng:** Biến động giá vàng/chứng khoán/nhà đất, tỷ lệ tăng trưởng, quy định/thuế mới, so sánh trước và sau.
- **Công thức phân cảnh đề xuất (5–6 scenes):**
  1. `hook`: Biến động giá hoặc chính sách mới tác động mạnh đến túi tiền người dân.
  2. `stat-hero`: Mức giá đỉnh/đáy, phần trăm tăng trưởng, số tiền đầu tư (vd: `82.5 TRIỆU/LƯỢNG`, `15.4% TĂNG TRƯỞNG`).
  3. `comparison`: So sánh trước vs sau, hoặc giá trong nước vs thế giới (`left` vs `right`).
  4. `feature-list`: 2–3 điều kiện áp dụng hoặc quyền lợi/rủi ro cần nắm rõ.
  5. `callout`: Tác động trực tiếp tới người mua/người đầu tư hoặc lời khuyên chuyên gia.
  6. `outro`: Kêu gọi theo dõi bản tin kinh tế.

### 2.3. Công nghệ / AI / Thiết bị điện tử (Tech, Gadgets & AI)
- **Đặc trưng:** Ra mắt sản phẩm mới, bản cập nhật phần mềm, điểm benchmark, cấu hình, giá bán.
- **Công thức phân cảnh đề xuất (5–6 scenes):**
  1. `hook`: Tính năng đột phá hoặc nâng cấp lớn nhất của thiết bị/công nghệ.
  2. `stat-hero`: Điểm benchmark, thời lượng pin, giá bán hoặc dung lượng (vd: `200 MEGAPIXEL`, `$999`).
  3. `comparison`: So sánh model mới vs model cũ, hoặc đối đầu 2 hãng (vd: iOS vs Android, GPT vs Claude).
  4. `feature-list`: Danh sách 2–3 tính năng mới đáng giá nhất.
  5. `callout`: Đánh giá tổng quan, đối tượng nên nâng cấp hoặc ngày mở bán chính thức.
  6. `outro`: Kêu gọi theo dõi công nghệ.

### 2.4. Đời sống / Xã hội / Giao thông / Thời tiết (Society & Life)
- **Đặc trưng:** Quy định giao thông mới, mức phạt mới, thời tiết cực đoan, y tế, giáo dục.
- **Công thức phân cảnh đề xuất (5–6 scenes):**
  1. `hook`: Tình huống cấp bách, thông tin ảnh hưởng trực tiếp đến người dân.
  2. `stat-hero`: Mức phạt cao nhất, mốc thời gian bắt đầu có hiệu lực (vd: `TỪ 1/1/2026`, `30 TRIỆU ĐỒNG`).
  3. `feature-list`: Các trường hợp vi phạm / các đối tượng được áp dụng / các khu vực chịu ảnh hưởng.
  4. `comparison` hoặc `callout`: So sánh mức xử phạt cũ vs mới hoặc lời nhắc nhở an toàn.
  5. `outro`: Kêu gọi chia sẻ cho người thân và follow kênh.

---

## 3. Ràng buộc Kỹ thuật & Checklist Chống Lỗi Zod Schema (Schema Guards)

Mỗi template khi được AI sinh ra BẮT BUỘC phải tuân thủ chuẩn xác các giới hạn:

| Template | Trường | Giới hạn | Quy tắc định dạng |
| :--- | :--- | :--- | :--- |
| `hook` | `headline` | max 40 ký tự | Câu ngắn, viết in hoa hoặc nhấn mạnh, giật tít |
| `hook` | `subhead` | max 40 ký tự | Tùy chọn, giải thích phụ |
| `stat-hero` | `value` | max 20 ký tự | Con số + đơn vị ngắn gọn (vd: `2,4 TỶ ĐỒNG`, `74 BỊ CAN`, `15%`) |
| `stat-hero` | `label` | max 40 ký tự | Nhãn của con số (vd: `Tổng tiền lương và thưởng`, `Bị can bị truy tố`) |
| `stat-hero` | `context` | max 50 ký tự | **Đúng tên trường `context` (KHÔNG được dùng `subtext`)** |
| `callout` | `statement` | **max 80 ký tự** | **TUYỆT ĐỐI KHÔNG vượt quá 80 ký tự. Chỉ 1 câu đơn gọn gàng.** |
| `callout` | `tag` | max 20 ký tự | Nhãn góc trên (vd: `Thủ đoạn`, `Tác động`, `Lưu ý`) |
| `feature-list` | `title` | max 40 ký tự | Tiêu đề danh sách |
| `feature-list` | `bullets` | 1–4 chuỗi, **mỗi chuỗi max 50 ký tự** | **Mảng chuỗi thuần `string[]` (KHÔNG dùng mảng object `{title, desc}`)** |
| `comparison` | `left.label`, `right.label` | max 30 ký tự | Tên 2 bên so sánh |
| `comparison` | `left.value`, `right.value` | max 20 ký tự | Giá trị định lượng ngắn |
| `comparison` | `color` | enum | Chỉ nhận `"cyan"` hoặc `"purple"` |
| `outro` | `ctaTop` | max 30 ký tự | Kêu gọi hành động |
| `outro` | `channelName` | max 30 ký tự | Tên kênh |
| `outro` | `source` | max 40 ký tự | Tên miền nguồn tin (vd: `vnexpress.net`) |

---

## 4. Kế hoạch Cập nhật (Files to Update)

1. [`.agents/skills/create-news-video/SKILL.md`](file:///d:/Project/auto-video-gen/.agents/skills/create-news-video/SKILL.md): Cập nhật quy tắc ánh xạ tự động + ma trận template theo chủ đề bài báo + checklist kiểm soát schema.
2. [`.claude/skills/create-news-video/SKILL.md`](file:///d:/Project/auto-video-gen/.claude/skills/create-news-video/SKILL.md): Đồng bộ toàn bộ nội dung sang Claude Code skill.
