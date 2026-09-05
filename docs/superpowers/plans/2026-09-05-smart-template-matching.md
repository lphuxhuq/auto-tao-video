# Kế hoạch Thực hiện: Tự động Ánh xạ Template Phù hợp với Bài báo (Smart Template Matching)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp bộ quy tắc thông minh trong Skill `create-news-video` để AI Agent tự động nhận diện thể loại bài báo (Pháp luật, Kinh tế, Công nghệ, Xã hội, Thể thao...) và phối hợp các template đồ họa phù hợp nhất, kèm các chốt chặn giới hạn ký tự chuẩn xác tránh lỗi Zod Schema.

**Architecture:** Cập nhật hướng dẫn prompt và cấu trúc dữ liệu mẫu trong `SKILL.md` của cả Google Antigravity IDE và Claude Code.

**Tech Stack:** Markdown, Zod Schema, TypeScript, Google Antigravity Skills.

## Global Constraints

- Tuân thủ 100% schema định nghĩa trong `src/render/script-schema.ts`.
- `callout.statement` tuyệt đối không vượt quá 80 ký tự.
- `stat-hero.context` đúng tên trường (không dùng `subtext`), tối đa 50 ký tự.
- `feature-list.bullets` là mảng các chuỗi `string[]` (không dùng object).
- Giữ nguyên các test suite hiện tại và đảm bảo 69/69 tests đều pass.

---

### Task 1: Nâng cấp Skill `.agents/skills/create-news-video/SKILL.md`

**Files:**
- Modify: `.agents/skills/create-news-video/SKILL.md`

- [ ] **Step 1: Bổ sung Ma trận Phân loại Thể loại Tin tức**
  Thêm hướng dẫn nhận diện 5 thể loại bài báo chính (Pháp luật, Kinh tế, Công nghệ, Đời sống, Thể thao) và cấu trúc phân cảnh (Scene Flow) tối ưu cho từng thể loại.

- [ ] **Step 2: Cập nhật Bảng Ràng buộc Ký tự Schema Guards**
  Cung cấp bảng giới hạn ký tự và quy tắc định dạng bắt buộc cho từng trường trong `templateData` (đặc biệt là `callout.statement <= 80 chars`, `feature-list.bullets: string[]`, `stat-hero.context <= 50 chars`).

- [ ] **Step 3: Cập nhật Step 5 (Self-validate before writing)**
  Bổ sung bước đếm ký tự của AI trước khi gọi `write_to_file` ghi file `script.json`.

---

### Task 2: Đồng bộ sang `.claude/skills/create-news-video/SKILL.md`

**Files:**
- Modify: `.claude/skills/create-news-video/SKILL.md`

- [ ] **Step 1: Đồng bộ các thay đổi từ `.agents` sang `.claude`**
  Đảm bảo cả 2 nền tảng AI IDE (Google Antigravity & Claude Code) đều sở hữu cùng một bộ quy tắc thông minh.

---

### Task 3: Kiểm thử và Xác nhận Hệ thống

**Files:**
- Test: `src/config.test.ts`, `src/render/html-composer.test.ts`, `src/render/script-schema.test.ts`

- [ ] **Step 1: Chạy toàn bộ test suite**
  Chạy `npm test` để xác nhận 69/69 tests pass.

- [ ] **Step 2: Chạy kiểm tra kiểu TypeScript**
  Chạy `npm run typecheck` để đảm bảo không có lỗi type.

- [ ] **Step 3: Commit và push lên GitHub**
  Commit các thay đổi và push lên repo `lphuxhuq/auto-tao-video`.
