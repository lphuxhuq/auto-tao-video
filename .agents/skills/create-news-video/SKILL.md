---
name: create-news-video
description: Tạo video tin tức ngắn 9:16 (~60s) nhiều ảnh (multi-image) và giàu chi tiết từ URL bài báo hoặc file .txt tiếng Việt. Trigger khi user yêu cầu tạo video tin tức, làm short news, làm bản tin video, render tin thành video, làm TikTok tin tức. Output: video.mp4 + thumbnail.jpg + voice.mp3 + script.txt cho CapCut + caption.txt (Tiêu đề, mô tả & hashtag #shorts).
---

# Create News Video Skill

Generate a Vietnamese 9:16 motion-graphic news video from a URL or .txt file with rich visuals (multi-image) and in-depth details.

## Input

Single argument: a news article URL (starts with `http://` or `https://`) OR a path to a `.txt` file.

## Workflow (MUST follow these steps in order)

### Step 1: Detect input type

- Starts with `http://` or `https://` → URL mode
- Otherwise → file mode

### Step 2: Fetch content & images

**URL mode:**
- Use `read_url_content` (or `browser_subagent` if the page is dynamic / JS-rendered).
- Extract:
  - `title` (string): tiêu đề bài báo
  - `content` (string): nội dung chính, ~500-1500 từ
  - `ogImage` (string|null): URL ảnh og:image (meta og:image hoặc ảnh đầu bài)
  - `images` (string[]): danh sách tất cả URL ảnh thực tế có trong bài báo (để làm tư liệu đa ảnh cho từng phân cảnh)
  - `domain` (string): domain của URL (vd "thanhnien.vn", "vnexpress.net")
- If fetching fails (paywall, blocking, 4xx) → tell user to save content to a .txt file and pass that instead. Stop.

**File mode:**
- Use `view_file` to read the .txt file.
- Title = first non-empty line (strip whitespace, max 80 chars)
- Content = remaining lines joined
- ogImage = `null`
- images = `[]`
- domain = `"local"`

### Step 3: Create slug + output directory

- slug = lowercase ASCII (strip Vietnamese diacritics, đ→d), replace non-alphanumeric with `-`, trim dashes, max 40 chars
- timestamp = current local time as `YYYYMMDD-HHmm`
- outputDir = `output/<slug>-<timestamp>/`

### Step 4: Generate script.json

Following the schema in `docs/superpowers/specs/2026-04-29-auto-news-video-design.md` Section 4. Key rules:

**Script content (Vietnamese):**
- Total voiceText: ~150–200 words → ~55–65s spoken at speed 1.0
- Number of scenes: **5–8** (1 hook + 3–6 body + 1 outro)
- Each scene voiceText is 1-3 short sentences, văn nói (spoken style, not formal)
- No emoji, no markdown in voiceText

### ⚠️ CRITICAL: Vietnamese TTS Phonetic Rules

The `voiceText` field is read aloud by Edge TTS / LucyLab / ElevenLabs / Vbee. **Numbers and symbols are read literally** — if you write "5.5", TTS may say "năm rưỡi" (five and a half — WRONG for version numbers). **Always spell out numbers in Vietnamese phonetic form** in `voiceText`. The `templateData` fields (visual text on screen) can keep the original "5.5" / "82.7%" formatting.

**Mandatory rules for `voiceText`:**

| Number form | WRONG (TTS misreads) | RIGHT (spell out in Vietnamese) |
|---|---|---|
| Decimal version | `GPT 5.5` → "năm rưỡi" ❌ | `GPT năm chấm năm` ✅ |
| Decimal stat | `82.7%` | `tám mươi hai phẩy bảy phần trăm` |
| Version | `iPhone 17` | `iPhone mười bảy` (or `iPhone 17` works for whole numbers) |
| Version with point | `iOS 18.2` | `iOS mười tám chấm hai` |
| Tech spec | `200MP` | `hai trăm megapixel` |
| Battery | `5000mAh` | `năm nghìn miliampe giờ` |
| Tokens | `1M tokens` / `1000000 tokens` | `một triệu token` |
| Price VND | `21 triệu đồng` | `hai mươi mốt triệu đồng` |
| Price USD | `$5` | `năm đô la` (or `năm đô`) |
| Multiplier | `2x` | `gấp đôi` (more natural than "hai lần") |
| Year | `2026` | `hai nghìn không trăm hai mươi sáu` (or just `năm 2026` reads OK) |
| Percentage with decimal | `30%` | `ba mươi phần trăm` |
| Time | `60 giây` | `sáu mươi giây` |
| Frequency | `5G` | `năm gờ` (be careful — TTS often says "năm-gờ") |
| Channel name | `Tin tức 24h` | `Tin tức hai mươi bốn giờ` |

**Notation choices:**
- For decimal point use `chấm` (more spoken/natural) or `phẩy` (formal). Both work; pick consistent.
- For comma separator, use `phẩy` (e.g. "1,000" → "một nghìn")
- For ratio "3:1" → say `ba trên một` or `ba so với một`

**English brand names — keep as-is**, TTS handles them OK:
- `Apple`, `Google`, `OpenAI`, `Microsoft`, `TikTok`, `YouTube` ✅

**English acronyms — write phonetically if TTS misreads:**
- `AI` → write `ây ai`
- `API` → write `ây pi ai`
- `GPT` → usually OK; if not, write `gí pi tí`
- `iOS` → write `ai ô ét` if matter

**Symbols to AVOID in voiceText:**
- `→` `&` `%` `$` `#` `+` `=` (TTS may say literal name or skip)
- `!` `?` at end of sentence is OK — they create natural intonation
- Emoji: NEVER (TTS pronounces or skips inconsistently)
- URLs: NEVER (TTS reads dot/slash literally)

**End each `voiceText` sentence with `.` or `?`** for natural pause/intonation.

**Examples — full scene:**

WRONG (will sound bad):
```json
{ "voiceText": "GPT 5.5 đạt 82.7% trên Terminal-Bench, vượt GPT 5.4 (75.1%)." }
```
→ TTS reads: "GPT năm rưỡi đạt tám mươi hai chấm bảy phần trăm trên Terminal-Bench..."

RIGHT (natural):
```json
{ "voiceText": "GPT năm chấm năm đạt tám mươi hai phẩy bảy phần trăm trên Terminal Bench, vượt phiên bản năm chấm bốn ở mức bảy mươi lăm phẩy một." }
```

**Note**: `templateData` (text on screen) CAN use original formatting — the visual is separate from spoken:
```json
{
  "voiceText": "GPT năm chấm năm đạt tám mươi hai phẩy bảy phần trăm.",
  "templateData": {
    "template": "stat-hero",
    "value": "82.7%",
    "label": "Terminal-Bench"
  }
}
```

**Hook (most important — gets first 3 seconds of viewer attention):**
- Must contain a bold claim, shocking statistic, or curious question.
- NEVER generic ("Hôm nay chúng ta sẽ nói về..." is wrong).
- ALWAYS include compelling headline and subhead.

### 🖼️ Multi-Image & Rich Visual Rules (BẮT BUỘC)

Video cần sống động với **hình ảnh thay đổi liên tục theo từng phân cảnh**, không để cả video dùng 1 ảnh đơn điệu hay gradient tĩnh:

1. **Gán ảnh cho từng phân cảnh (`bgSrc`):**
   - **Cảnh Hook**: dùng `$source.image` (hoặc ảnh tiêu đề chính của bài báo).
   - **Các cảnh Body (`comparison`, `stat-hero`, `feature-list`, `callout`)**:
     - Sử dụng các ảnh thực tế khác có trong bài báo (URL từ `images[]` ở Step 2).
     - Nếu bài báo ít ảnh hoặc ảnh ngang khó crop, **hãy dùng công cụ `generate_image`** để tạo ảnh chân dung 9:16 (`AspectRatio: "9:16"`) độ nét cao, chuẩn bối cảnh Việt Nam (ví dụ: sổ đỏ, bản đồ số 3D Việt Nam, văn phòng công chứng, tòa nhà hiện đại, hợp đồng, đồ thị kinh tế...).
     - Lưu ảnh vào thư mục `<outputDir>/images/<tên-ảnh>.jpg` và đặt `bgSrc: "images/<tên-ảnh>.jpg"`.
   - **Cảnh Outro**: có thể dùng ảnh sổ đỏ, văn phòng hoặc biểu tượng liên quan đến kênh/nội dung.

2. **Hiệu ứng chuyển động ảnh (Ken Burns):**
   - BẮT BUỘC thay đổi `kenBurns` giữa các scene: `zoom-in`, `zoom-out`, `pan-left`, `pan-right`.
   - Tuyệt đối không dùng 1 hiệu ứng lặp lại cho tất cả các cảnh.

3. **Độ chi tiết và chiều sâu nội dung (Rich Details):**
   - **Độ dài giọng đọc**: Target ~180–200 từ tiếng Việt → đạt thời lượng ~55–60 giây spoken (tận dụng tối đa khung thời lượng vàng cho Shorts/TikTok).
   - **Số lượng phân cảnh**: 5–7 scenes (1 hook + 3–5 body + 1 outro).
   - **Nội dung sâu sắc**:
     - Đưa số liệu cụ thể (phần trăm, tiền tệ, mốc thời gian, số lượng).
     - So sánh trước và sau (Before vs After / Hiện hành vs Đề xuất mới).
     - Bổ sung 2–3 gạch đầu dòng rõ ràng trong `feature-list`.
     - Phân tích rõ lợi ích, tác động thực tế tới người dân/người xem trong cảnh `callout`.

### 🧠 Ma trận Phân loại Thể loại Tin tức & Công thức Chọn Template Tự động

Khi phân tích bài báo, BẮT BUỘC xác định thể loại chính để áp dụng công thức phối cảnh (Scene Flow) phù hợp nhất:

| Thể loại tin tức | Đặc trưng nhận diện | Công thức phân cảnh (Scene Flow) đề xuất |
|---|---|---|
| **1. Pháp luật / Vụ án / An ninh** | Khởi tố, truy tố, bắt giữ, đường dây cá cược, lừa đảo, số tiền chiếm đoạt, số bị can | `hook` ➔ `stat-hero` (số bị can hoặc số tiền thu lợi) ➔ `callout` (thủ đoạn tinh vi hoặc lời khai) ➔ `feature-list` (hành vi vi phạm hoặc các bên liên quan) ➔ `callout` (kết luận/hệ lụy) ➔ `outro` |
| **2. Kinh tế / Tài chính / BĐS** | Giá vàng, chứng khoán, lãi suất, bất động sản, luật đất đai, tăng trưởng GDP, xuất nhập khẩu | `hook` ➔ `stat-hero` (mức giá kỷ lục hoặc tỷ lệ %) ➔ `comparison` (so sánh trước vs sau, hoặc trong nước vs thế giới) ➔ `feature-list` (các điều kiện/chính sách mới) ➔ `callout` (tác động tới túi tiền người dân) ➔ `outro` |
| **3. Công nghệ / Thiết bị / AI** | Ra mắt điện thoại, chip mới, mô hình AI, benchmark, tính năng phần mềm, xe điện | `hook` ➔ `stat-hero` (điểm benchmark, giá bán hoặc thông số khủng) ➔ `comparison` (đối đầu 2 model hoặc 2 hãng) ➔ `feature-list` (danh sách tính năng mới) ➔ `callout` (đánh giá chuyên gia/ngày mở bán) ➔ `outro` |
| **4. Đời sống / Xã hội / Giao thông** | Nghị định mới, tăng mức xử phạt, thời tiết cực đoan, y tế, giáo dục, quy hoạch đô thị | `hook` ➔ `stat-hero` (mức phạt cao nhất hoặc mốc thời gian áp dụng) ➔ `feature-list` (các trường hợp vi phạm hoặc điểm mới cần nhớ) ➔ `callout` (lời khuyên an toàn/cảnh báo người dân) ➔ `outro` |
| **5. Thể thao / Giải trí** | Tỉ số trận đấu, kỷ lục giải đấu, chuyển nhượng cầu thủ, scandal, sự kiện văn hóa lớn | `hook` ➔ `stat-hero` (tỉ số, kỷ lục hoặc mức phí chuyển nhượng) ➔ `comparison` (so sánh thành tích 2 đội/vận động viên) ➔ `feature-list` (diễn biến chính hoặc danh sách bàn thắng) ➔ `callout` (phát biểu/nhận định) ➔ `outro` |

---

### 🛡️ Ràng buộc Schema Bắt buộc (Strict Schema Guards)

Tránh hoàn toàn lỗi Zod Schema — BẮT BUỘC tuân thủ đúng tên trường và giới hạn ký tự:

| Template | Trường dữ liệu | Giới hạn ký tự | Quy tắc định dạng bắt buộc |
|---|---|---|---|
| **`hook`** | `headline` | **≤ 40 ký tự** | Câu giật tít ngắn, có thể viết in hoa từ khóa chính. |
| | `subhead` | **≤ 40 ký tự** | Dòng phụ đề tóm tắt ngữ cảnh (tùy chọn). |
| **`stat-hero`** | `value` | **≤ 20 ký tự** | Con số nổi bật + đơn vị ngắn (vd: `74 BỊ CAN`, `2,4 TỶ ĐỒNG`, `82.5%`). |
| | `label` | **≤ 40 ký tự** | Nhãn mô tả con số (vd: `Đề nghị truy tố`, `Tiền công lập trình`). |
| | `context` | **≤ 50 ký tự** | **Đúng tên trường `context` (TUYỆT ĐỐI KHÔNG DÙNG `subtext`)**. |
| **`callout`** | `statement` | **≤ 80 ký tự** | **TUYỆT ĐỐI KHÔNG vượt quá 80 ký tự! Chỉ 1 câu đơn cô đọng.** |
| | `tag` | **≤ 20 ký tự** | Nhãn góc trên (vd: `Thủ đoạn tinh vi`, `Tác động`, `Lưu ý`). |
| **`feature-list`** | `title` | **≤ 40 ký tự** | Tiêu đề khối danh sách. |
| | `bullets` | 1–4 chuỗi | **Mảng chuỗi thuần `string[]`, mỗi chuỗi ≤ 50 ký tự (KHÔNG DÙNG mảng object `{title, desc}`)**. |
| | `icon` | string (tùy chọn) | Biểu tượng: `"spark"`, `"shield"`, `"zap"`, `"alert"`. |
| **`comparison`** | `left.label`, `right.label` | **≤ 30 ký tự** | Tên 2 bên so sánh (vd: `Hiện hành`, `Đề xuất mới`). |
| | `left.value`, `right.value` | **≤ 20 ký tự** | Giá trị định lượng (vd: `Trong tỉnh`, `Toàn quốc`). |
| | `color` | enum | Chỉ nhận `"purple"` hoặc `"cyan"`. |
| | `winner` | boolean | `true` ở `right` nếu bên phải là bên vượt trội/thắng. |
| **`outro`** | `ctaTop` | **≤ 30 ký tự** | Kêu gọi hành động (vd: `Cập nhật tin mới mỗi ngày`). |
| | `channelName` | **≤ 30 ký tự** | Tên kênh hiển thị. |
| | `source` | **≤ 40 ký tự** | Domain nguồn tin (vd: `vnexpress.net`, `thanhnien.vn`). |

**Outro chuẩn format:**
```json
{
  "id": "outro",
  "type": "outro",
  "voiceText": "Theo dõi kênh để xem bản tin mới mỗi ngày.",
  "templateData": {
    "template": "outro",
    "ctaTop": "Cập nhật tin mới mỗi ngày",
    "channelName": "Tin tức 24h",
    "source": "<DOMAIN>",
    "bgSrc": "images/...",
    "kenBurns": "zoom-out"
  }
}
```
Replace `<DOMAIN>` with the actual domain string.

### Step 5: Self-validate before writing

Trước khi gọi `write_to_file`, bạn BẮT BUỘC tự rà soát danh sách sau:
1. **Kiểm tra số cảnh**: 5–7 cảnh (cảnh 0 luôn là `hook`, cảnh cuối luôn là `outro`).
2. **Kiểm tra độ dài giọng đọc**: Tổng số từ `voiceText` ~150–200 từ tiếng Việt.
3. **Kiểm tra giới hạn ký tự Schema**:
   - Mọi `statement` trong `callout`: **Đếm từng ký tự xem có ≤ 80 ký tự không**. Nếu dài hơn, cắt gọn lại ngay!
   - Mọi `bullets` trong `feature-list`: Phải là mảng chuỗi `["dòng 1", "dòng 2"]`, mỗi chuỗi **≤ 50 ký tự**.
   - Mọi `context` trong `stat-hero`: Phải dùng đúng tên thuộc tính `context` (không được gõ `subtext`), **≤ 50 ký tự**.
   - Mọi `headline`: **≤ 40 ký tự**.
4. **Kiểm tra phiên âm số**: Không để số thập phân hay ký hiệu lạ trong `voiceText` (tuân thủ mục CRITICAL Vietnamese TTS).

Nếu phát hiện vi phạm, tự sửa ngay trước khi ghi file!

### Step 6: Write script.json

Use the `write_to_file` tool to write the validated JSON to `<outputDir>/script.json`.

### Step 7: Run the pipeline

Use `run_command` to run:

```bash
npm run pipeline -- <outputDir>/script.json
```

If exit code != 0:
- Report the error message clearly
- Tell user the output dir path so they can inspect intermediate files

### Step 8: Generate Title, Description, and Hashtags (caption.txt)

Only run this step if Step 7 (the pipeline) succeeded — don't caption a video that wasn't actually produced.

Tạo nội dung xuất bản hoàn chỉnh gồm **Tiêu đề**, **Mô tả chi tiết**, **Hashtags**, và **Khối đăng nhanh** cho video dựa trên `script.metadata.title`, nội dung các scenes và nguồn tin.

**Quy tắc chi tiết:**

1. **Tiêu đề video (Title):**
   - 1 câu ngắn gọn, giật tít, cuốn hút, nêu bật thông tin sốt dẻo hoặc câu hỏi tò mò (~10–20 từ).
   - Tối ưu SEO cho TikTok, YouTube Shorts, Facebook Reels.

2. **Mô tả video (Description):**
   - Tóm tắt 2–4 ý chính (hoặc gạch đầu dòng) về nội dung quan trọng nhất của bản tin.
   - Thêm ngữ cảnh, thời gian áp dụng, tác động đối với người dân.
   - Thêm lời kêu gọi hành động (CTA tương tác, follow kênh).
   - Ghi rõ nguồn tin (`Nguồn: <domain>`).

3. **Hashtags:**
   - Đầy đủ 5–7 hashtags liên quan:
     1. **Bắt buộc có:** `#shorts`
     2. Tag chuyên mục/chủ đề rộng (vd: `#tintuc`, `#batdongsan`, `#congnghe`, `#phapluat`)
     3. Tag chi tiết nội dung/từ khóa chính (vd: `#congchung`, `#nhadat`, `#luatdatdai`)
     4. Tag kênh: `#tintuc` (hoặc tag thương hiệu riêng)
     5. Tag xu hướng: `#xuhuong`, `#fyp`
   - Tất cả viết thường, không dấu cách, không ký tự đặc biệt.

4. **Khối đăng nhanh (Quick-post):**
   - Khối văn bản kết hợp hoàn chỉnh tiêu đề + tóm tắt 1-2 câu + hashtags để người dùng copy 1 chạm dán thẳng vào ứng dụng.

Ghi kết quả vào `<outputDir>/caption.txt` bằng `write_to_file`:
```
=== TIÊU ĐỀ VIDEO ===
<Tiêu đề hấp dẫn, giật tít>

=== MÔ TẢ VIDEO ===
<Mô tả tóm tắt chi tiết 2–4 điểm chính của bản tin>
- <Ý 1>
- <Ý 2>
- <Ý 3>

<Lời kêu gọi hành động CTA>
Nguồn: <domain>

=== HASHTAGS ===
#shorts #tag1 #tag2 #tag3 #tintuc #xuhuong #fyp

=== NỘI DUNG ĐĂNG NHANH (TIKTOK / SHORTS / REELS) ===
<Tiêu đề hoặc hook ngắn + emoji phù hợp>

<Tóm tắt 1-2 câu điểm nhấn quan trọng nhất>

#shorts #tag1 #tag2 #tag3 #tintuc #xuhuong
```

### Step 9: Report success

Báo cáo cho người dùng với markdown links:

```markdown
✓ Video:     [video.mp4](output/<slug>-<timestamp>/video.mp4)
✓ Thumbnail: [thumbnail.jpg](output/<slug>-<timestamp>/thumbnail.jpg) — ảnh bìa 9:16 sắc nét
✓ Audio:     [voice.mp3](output/<slug>-<timestamp>/voice.mp3) — cho CapCut
✓ Script:    [script.txt](output/<slug>-<timestamp>/script.txt) — cho CapCut auto-caption
✓ Caption:   [caption.txt](output/<slug>-<timestamp>/caption.txt) — Tiêu đề, mô tả & hashtags đăng TikTok/Shorts
Tổng thời lượng: XX.Xs

=== TIÊU ĐỀ ===
<Tiêu đề>

=== MÔ TẢ ===
<Mô tả ngắn gọn>

=== HASHTAGS ===
#shorts #tag1 #tag2 #tag3 #tintuc #xuhuong
```

## Example: Full script.json Structure

```json
{
  "version": "1.0",
  "metadata": {
    "title": "Đề xuất công chứng nhà đất trên toàn quốc từ 1.7.2028",
    "source": {
      "url": "https://thanhnien.vn/de-xuat-cong-chung-nha-dat-tren-toan-quoc-tu-172028-185260904143500945.htm",
      "domain": "thanhnien.vn",
      "image": "https://images2.thanhnien.vn/.../main.jpeg"
    },
    "channel": "Tin tức 24h"
  },
  "voice": {
    "provider": "edge-tts",
    "voiceId": "${VOICE_ID}",
    "speed": 1.0
  },
  "scenes": [
    {
      "id": "hook",
      "type": "hook",
      "voiceText": "Từ ngày một tháng bảy năm 2028, người dân cả nước có thể công chứng mua bán nhà đất ở bất kỳ đâu, mà không còn bị giới hạn bởi địa giới hành chính.",
      "templateData": {
        "template": "hook",
        "headline": "Công chứng nhà đất toàn quốc",
        "subhead": "Đề xuất từ tháng 7 năm 2028",
        "bgSrc": "images/bg.jpg",
        "kenBurns": "zoom-in"
      }
    },
    {
      "id": "body-1",
      "type": "body",
      "voiceText": "Theo luật hiện hành, bạn chỉ được công chứng nhà đất trong phạm vi tỉnh hoặc thành phố nơi đặt trụ sở. Đề xuất mới của Bộ Tư pháp sẽ mở rộng quyền này ra toàn quốc.",
      "templateData": {
        "template": "comparison",
        "bgSrc": "images/ban-do-so.jpg",
        "kenBurns": "pan-left",
        "left": {
          "label": "Hiện hành",
          "value": "Cùng tỉnh thành",
          "color": "purple"
        },
        "right": {
          "label": "Đề xuất mới",
          "value": "Cả 63 tỉnh thành",
          "color": "cyan",
          "winner": true
        }
      }
    },
    {
      "id": "body-2",
      "type": "body",
      "voiceText": "Mốc thời gian áp dụng dự kiến là ngày một tháng bảy năm 2028. Bởi đến hết năm 2027, hệ thống cơ sở dữ liệu quốc gia về đất đai và công chứng mới cơ bản hoàn thành để liên thông.",
      "templateData": {
        "template": "stat-hero",
        "bgSrc": "images/ban-do-so.jpg",
        "kenBurns": "zoom-out",
        "value": "01/07/2028",
        "label": "Thời điểm áp dụng",
        "context": "Hoàn tất CSDL đất đai cuối năm 2027"
      }
    },
    {
      "id": "body-3",
      "type": "body",
      "voiceText": "Dự thảo bổ sung quy định cho phép công chứng ngoài trụ sở với các giao dịch tài sản từ một tỉ đồng trở lên khi bàn giao giấy tờ. Đồng thời chuyển giao thẩm quyền chứng thực từ ủy ban nhân dân xã sang các phòng công chứng.",
      "templateData": {
        "template": "feature-list",
        "bgSrc": "images/ky-giay-to.jpg",
        "kenBurns": "pan-right",
        "title": "3 Thay đổi mang tính đột phá",
        "bullets": [
          "Công chứng ngoài trụ sở từ 1 tỉ đồng",
          "Ký kết đồng thời bàn giao tài sản",
          "Chuyển thẩm quyền từ xã sang công chứng"
        ],
        "icon": "spark"
      }
    },
    {
      "id": "body-4",
      "type": "body",
      "voiceText": "Thay đổi này sẽ tạo thuận lợi tối đa cho người dân mua bán nhà đất liên tỉnh, tiết kiệm hàng triệu đồng chi phí đi lại, đồng thời giảm tải áp lực công việc cho cán bộ cấp xã.",
      "templateData": {
        "template": "callout",
        "bgSrc": "images/so-do.jpg",
        "kenBurns": "zoom-in",
        "statement": "Tiết kiệm tối đa chi phí đi lại, giảm thủ tục rườm rà và tăng tính minh bạch.",
        "tag": "Lợi ích người dân"
      }
    },
    {
      "id": "outro",
      "type": "outro",
      "voiceText": "Theo dõi kênh để xem bản tin mới mỗi ngày.",
      "templateData": {
        "template": "outro",
        "bgSrc": "images/so-do.jpg",
        "kenBurns": "zoom-out",
        "ctaTop": "Cập nhật tin mới mỗi ngày",
        "channelName": "Tin tức 24h",
        "source": "thanhnien.vn"
      }
    }
  ]
}
```

## Sound Effects (SFX)

**You almost never need to set the `sfx` field.** The pipeline has a smart 3-tier selector that picks the right SFX for each scene automatically:

1. **If `scene.sfx` is set** → use exactly that (override).
2. **Else, scan `voiceText` for semantic keywords**:
   - `cảnh báo / rủi ro / nguy hiểm / warning` → `alert/`
   - `kỷ lục / vượt / xuất sắc / breakthrough / success` → `success/`
   - `thất bại / sai / lỗi / fail / wrong` → `fail/`
   - `ra mắt / công bố / lần đầu / launch / unveil` → `reveal/`
   - `đếm ngược / tích tắc / countdown` → `countdown/`
   - `hùng vĩ / hoành tráng / cinematic / epic` → `cinematic/`
   - `hồi hộp / chờ đợi / drumroll / suspense` → `drumroll/`
3. **Else, fall back to template default category**:
   - `hook` → `transition/` or `cinematic/`
   - `comparison` → `transition/` or `emphasis/`
   - `stat-hero` → `emphasis/` or `success/`
   - `feature-list` → `transition/` or `emphasis/`
   - `callout` → `alert/` or `drumroll/`
   - `outro` → `outro/` or `success/`

Within a category, the actual file is picked **deterministically** by hashing the scene id — same script gives same SFX (idempotent), but different scenes in the same video get different files (variety).

### When to add explicit `sfx` override

Only when you want to FORCE a specific sound:
- Scene needs a particular signature sound: `{ "name": "transition/whoosh-sfx", "volume": 0.4 }`
- Disable SFX for a scene: `{ "name": "none" }`

Available SFX categories (`assets/sfx/<category>/<name>.mp3`):
- `transition/`, `emphasis/`, `alert/`, `success/`, `fail/`, `outro/`, `reveal/`, `drumroll/`, `countdown/`, `cinematic/`

## Edge cases

| Situation | Action |
|---|---|
| URL paywall / JS-rendered → read_url_content returns no content | Tell user: "Không đọc được URL (có thể do paywall hoặc JS). Hãy lưu nội dung vào file .txt rồi gọi lại." Stop. |
| URL content < 200 words | Warn "Tin gốc ngắn, video có thể không đủ chất liệu", continue anyway |
| URL content > 2000 words | Summarize to key points, fit ~150-200 words script |
| File mode + file empty/missing | Error message, don't create output dir |
| Pipeline fails | Report error message + output dir path; user can re-try `npm run pipeline -- <path>` after fixing |
