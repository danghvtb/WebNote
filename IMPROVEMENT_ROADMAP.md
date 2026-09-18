# Roadmap cải tiến WebNote

> Tài liệu định hướng triển khai các cải tiến về độ tin cậy, trải nghiệm mobile và tiện ích hằng ngày cho WebNote.
>
> Phạm vi: ứng dụng cá nhân, local-first, đồng bộ Google Drive. Không triển khai cộng tác nhiều người trong roadmap này.

## 1. Mục tiêu tổng thể

WebNote cần mở nhanh, làm việc ổn định khi offline, không làm mất dữ liệu khi backup/restore hoặc đồng bộ lỗi, và thao tác thuận tiện trên điện thoại. Giao diện và thông báo được chuẩn hóa hoàn toàn bằng tiếng Việt.

### Mục tiêu đo lường

| Chỉ số | Mục tiêu nghiệm thu |
| --- | --- |
| Hiển thị dữ liệu local khi đã có cache | Tối đa 500 ms trên điện thoại tầm trung |
| Main bundle | Dưới 220 KB gzip sau khi lazy-load |
| Backup/restore | Round-trip bảo toàn tất cả collection và cài đặt |
| Mobile | Không còn thao tác chính/phụ thuộc hover |
| Vùng chạm | Tối thiểu 44×44 px |
| Lint | Không còn cảnh báo |
| Kiểm thử | Unit + smoke E2E desktop/mobile + accessibility contract; E2E trình duyệt thật với Chromium và axe-core chạy trong CI |
| Offline | Mở được app shell và chỉnh sửa dữ liệu đã cache |
| AI | Chỉ gửi đúng phạm vi người dùng đã chọn; không render HTML không an toàn |

## 2. Đánh giá hiện trạng

### Điểm mạnh đang có

- Ghi chú rich-text bằng Tiptap, task checklist, bảng, code block, hình ảnh và liên kết.
- Tổ chức dữ liệu theo ngày → notebook → page.
- Tag dùng chung, báo cáo công việc theo ngày và danh mục dự án.
- Lịch biểu, task tùy chỉnh, danh mục công việc và nhắc deadline.
- IndexedDB/Dexie hỗ trợ local-first; Google Drive là dịch vụ đồng bộ.
- Tìm kiếm Ctrl+K, AI Vault, export Markdown và knowledge graph.
- Đã có sync queue, soft delete page/project/report và cache local.

### Các vấn đề đã xác định

1. **Backup/import chưa an toàn tuyệt đối**
   - Backup hiện chưa chứa đầy đủ lịch biểu, task, category, settings và revision.
   - Import có hành vi trộn một số collection nhưng xóa/thay thế collection khác.
   - Chưa có preview, recovery backup và transaction bảo vệ trước khi restore.

2. **Lịch sử phiên bản chưa được sử dụng**
   - Bảng `revisions` đã có trong Dexie nhưng chưa có API/UI tạo, xem hoặc khôi phục revision.

3. **Mobile còn nhiều điểm ma sát**
   - Một số nút thêm/xóa/menu chỉ hiện khi hover.
   - Header và editor toolbar có quá nhiều biểu tượng trên màn hình hẹp.
   - Context menu có thể tràn khỏi cạnh màn hình.
   - Chưa có điều hướng mobile ổn định cho Hôm nay, Ghi chú, Lịch biểu và chức năng phụ.

4. **Accessibility chưa đồng nhất**
   - Modal chưa dùng một primitive chung cho `role="dialog"`, `aria-modal`, focus trap, Escape và restore focus.
   - Toast chưa có quy ước `aria-live` thống nhất.
   - Chưa có kiểm thử axe/E2E.

5. **Ngôn ngữ và nhận diện chưa nhất quán**
   - Nhiều nhãn/thông báo còn tiếng Anh hoặc pha trộn Việt–Anh.
   - `html lang` còn là `en`, favicon vẫn là tài nguyên mặc định của Vite.

6. **AI có rủi ro riêng tư và XSS**
   - Một số luồng gửi toàn bộ vault cho Gemini mà chưa có lựa chọn phạm vi rõ ràng.
   - Kết quả AI được render bằng HTML chưa làm sạch.
   - API key lưu trong localStorage nhưng chưa có kiểm tra kết nối và giải thích đầy đủ.

7. **Theo dõi deadline chưa tối ưu**
   - App xin quyền Notification ngay khi khởi động.
   - Monitor quét toàn bộ page/task mỗi 30 giây, gây hao pin trên mobile.

8. **Tìm kiếm còn đơn giản**
   - Chưa bỏ dấu tiếng Việt, fuzzy matching, ranking, highlight và bộ lọc ngày/loại/dự án.
   - Chưa hiển thị rõ trạng thái search index hoặc recent search.

9. **Graph chưa phản ánh đầy đủ liên kết tri thức**
   - Graph hiện chủ yếu biểu diễn quan hệ notebook–page; wiki link/backlink chưa được dựng thành cạnh thật.

10. **Hiệu năng và nợ kỹ thuật**
    - Bundle chính khoảng 1,2 MB minified/356 KB gzip.
    - Một số dynamic import không tạo chunk riêng vì module vẫn bị import tĩnh.
    - Có code sync legacy cần loại bỏ và còn 13 cảnh báo lint.

11. **Khả năng offline hoàn toàn còn hạn chế**
    - Chưa có manifest/service worker; offline-first hiện phụ thuộc việc app shell đã được tải trước.

### Baseline kiểm tra

- `npm test`: 3 test files, 11 tests đạt.
- `npm run build`: đạt nhưng có cảnh báo chunk lớn và dynamic import không hiệu lực.
- `npm run lint`: đạt nhưng còn 13 cảnh báo hiện hữu.
- Chưa có E2E, accessibility automation hoặc performance benchmark tự động.

## 3. Nguyên tắc triển khai

- Ưu tiên bảo toàn dữ liệu hơn tốc độ thêm tính năng.
- Local cache luôn có thể mở và chỉnh sửa khi Drive/OAuth lỗi.
- Mọi thao tác destructive phải có xác nhận, recovery path và test rollback.
- Thay đổi schema phải có migration idempotent và tương thích backup cũ.
- UI mobile không được phụ thuộc hover.
- AI chỉ hoạt động sau hành động chủ động của người dùng và phải minh bạch phạm vi dữ liệu.
- Mỗi giai đoạn phải kết thúc bằng test, build và kiểm tra thủ công trước khi chuyển giai đoạn.
- Không deploy GitHub Pages trong các bước cải tiến nếu không có yêu cầu riêng.

## 4. Lộ trình triển khai

## P0 — Tin cậy, bảo mật, mobile và tiếng Việt

### P0.1 — Backup và restore an toàn

**Hiện trạng/vấn đề**

Backup chưa đầy đủ collection; import không có preview và có thể thay đổi dữ liệu trước khi người dùng kiểm tra.

**Mục tiêu**

Người dùng có thể tạo backup đầy đủ, xem chính xác dữ liệu sẽ khôi phục, phục hồi an toàn và quay lại trạng thái trước restore nếu có lỗi.

**Các bước triển khai**

1. Định nghĩa `VaultBackupV7` với metadata schema, export time, owner email và danh sách đầy đủ domain collection.
2. Bổ sung days, notebooks, pages, tags, projects, workReports, scheduleBlocks, customTasks, workCategories, settings và revisions.
3. Viết `inspectBackup(file)` để parse, kiểm tra schema, ID trùng, quan hệ tham chiếu và thống kê số lượng.
4. Hiển thị màn hình preview trước khi restore.
5. Tự tạo recovery backup trước khi restore.
6. Restore mặc định theo chế độ `replace`, thực hiện trong một Dexie transaction.
7. Giữ nguyên `syncQueue` cho tới khi snapshot khôi phục được upload thành công.
8. Nếu lỗi parse/validate/transaction, không thay đổi vault hiện tại.
9. Ghi migration để backup cũ thiếu field mới nhận giá trị mặc định.
10. Cập nhật thông báo thành công/thất bại bằng tiếng Việt.

**Dữ liệu/API ảnh hưởng**

- `VaultBackupV7`, `BackupInspection`, `ImportMode`.
- `inspectBackup`, `createRecoveryBackup`, `restoreBackup`.
- Bổ sung toàn bộ collection vào export/import manager.

**Lỗi cần xử lý**

- JSON hỏng, file quá lớn, schema mới hơn, thiếu collection, ID trùng, tham chiếu không tồn tại, hết quota IndexedDB.

**Kiểm thử**

- Export → clear database → import → so sánh từng collection.
- Import backup cũ không có tag/project/report/schedule.
- Restore lỗi giữa transaction không làm mất dữ liệu.
- Không xóa sync queue đang chờ.

**Tiêu chí nghiệm thu**

- Backup round-trip bảo toàn toàn bộ dữ liệu trong phạm vi V7.
- Preview hiển thị đúng số record.
- Recovery backup được tạo trước mọi restore.
- Không có thay đổi nửa chừng khi restore lỗi.

**Phụ thuộc/ưu tiên**: Không phụ thuộc tính năng mới; P0 bắt buộc làm đầu tiên.

### P0.2 — Lịch sử phiên bản và thùng rác

**Hiện trạng/vấn đề**

Có bảng `revisions` nhưng người dùng không thể xem hoặc khôi phục. Thùng rác hiện tập trung vào page.

**Mục tiêu**

Khôi phục được nội dung cũ và phục hồi an toàn page, notebook, report đã xóa.

**Các bước triển khai**

1. Nâng Dexie lên version 6; thêm `deletedAt?` và `isPinned?` cho page/notebook nếu chưa có.
2. Thêm `createRevision`, `getPageRevisions`, `restoreRevision`, `pruneRevisions`.
3. Tạo revision khi đổi page, trước khi restore và theo chu kỳ tối đa 15 phút.
4. Giới hạn 30 revision/page hoặc 90 ngày.
5. Mở rộng Trash thành tab page/notebook/report.
6. Khôi phục notebook phải giữ quan hệ page; khôi phục report không khôi phục project đã archive.
7. Xóa vĩnh viễn phải có cảnh báo không thể hoàn tác.

**Dữ liệu/API ảnh hưởng**

- `Revision`, `deletedAt`, `isPinned`.
- `getTrashSummary`, `restoreNotebook`, `restoreWorkReport`, `emptyTrash`.

**Lỗi cần xử lý**

- Revision không còn page, notebook chứa page đã xóa, restore trùng ID, quota khi tạo revision.

**Kiểm thử/tiêu chí nghiệm thu**

- Xem và restore revision tạo nội dung mới đúng.
- Xóa/khôi phục notebook không làm mất page.
- Thùng rác hiển thị đúng số record và cảnh báo.

**Phụ thuộc/ưu tiên**: Sau P0.1 vì revision và Trash phải được đưa vào backup.

### P0.3 — Bảo mật và quyền riêng tư AI

**Hiện trạng/vấn đề**

AI có thể gửi quá nhiều nội dung và render HTML không tin cậy.

**Mục tiêu**

Người dùng biết dữ liệu nào được gửi; kết quả AI không thể chèn script hoặc event handler.

**Các bước triển khai**

1. Tách phạm vi AI: page hiện tại, notebook chọn, kết quả tìm kiếm hoặc toàn vault.
2. Mặc định chọn page hiện tại.
3. Hiển thị số page và kích thước trước khi gửi nhiều dữ liệu.
4. Giới hạn payload, chunk dữ liệu và báo lỗi khi vượt giới hạn.
5. Parse kết quả Markdown bằng renderer an toàn hoặc sanitizer whitelist.
6. Bỏ `dangerouslySetInnerHTML` cho nội dung AI chưa được làm sạch.
7. Thêm kiểm tra Gemini API key, hiện/ẩn, xóa và trạng thái kết nối.
8. Hiển thị cảnh báo rằng API key chỉ được lưu trên trình duyệt.

**Dữ liệu/API ảnh hưởng**

- `AiScope`, `AiRequestPreview`, `sanitizeAiOutput`.
- Cấu hình key và privacy notice trong Settings.

**Lỗi cần xử lý**

- Không có key, quota, timeout, mạng lỗi, phản hồi không phải Markdown hợp lệ, payload quá lớn.

**Kiểm thử/tiêu chí nghiệm thu**

- Xác nhận đúng phạm vi trước khi request.
- Chuỗi `<script>`, `onerror`, iframe và URL nguy hiểm không được thực thi.
- Key sai hiển thị lỗi rõ ràng, không làm hỏng editor.

**Phụ thuộc/ưu tiên**: P0 bắt buộc trước khi mở rộng AI.

### P0.4 — Mobile và accessibility

**Mục tiêu**

Mọi luồng chính dùng tốt bằng cảm ứng, bàn phím và trình đọc màn hình.

**Các bước triển khai**

1. Dùng mobile bottom navigation: `Hôm nay`, `Ghi chú`, `Lịch biểu`, `Thêm`.
2. Đưa graph, export, Trash, quản lý tag/project và Settings vào menu `Thêm`.
3. Đảm bảo vùng chạm tối thiểu 44×44 px.
4. Hiển thị nút thêm/xóa/menu trên touch device, không dựa vào hover.
5. Gom editor toolbar mobile thành nhóm công cụ thường dùng và bottom sheet mở rộng.
6. Clamp context menu theo kích thước viewport.
7. Tạo `DialogShell` dùng chung với focus trap, `role="dialog"`, `aria-modal`, Escape, backdrop và restore focus.
8. Thêm `aria-live` cho toast, trạng thái autosave và sync.
9. Thêm focus-visible, reduced motion và safe-area padding.
10. Sửa shortcut để bỏ qua input, textarea, select và contenteditable.
11. Thêm modal trợ giúp phím tắt.

**Kiểm thử/tiêu chí nghiệm thu**

- Test viewport 320 px, 375 px, 768 px và desktop.
- Không có nút chính chỉ xuất hiện khi hover.
- Có thể mở/đóng mọi modal bằng bàn phím.
- Screen reader đọc đúng tiêu đề, trạng thái và lỗi.

**Phụ thuộc/ưu tiên**: Có thể làm song song P0.1; bắt buộc hoàn tất trước P1 mobile.

### P0.5 — Chuẩn hóa tiếng Việt

**Các bước triển khai**

1. Tạo catalog chuỗi tập trung thay vì rải literal trong JSX.
2. Dịch toàn bộ Header, sidebar, editor, modal, empty state, lỗi và tooltip.
3. Chuẩn hóa định dạng ngày/giờ theo `vi-VN`.
4. Đặt `html lang="vi"`.
5. Thay favicon Vite, title và meta description bằng nhận diện WebNote.
6. Bổ sung kiểm tra không còn chuỗi UI tiếng Anh ngoài nội dung người dùng.

**Tiêu chí nghiệm thu**: Luồng tạo/sửa/xóa/tìm kiếm/sync/backup không còn nhãn tiếng Anh không chủ ý.

### P0.6 — Hiệu năng và nợ kỹ thuật

**Các bước triển khai**

1. Lazy-load schedule, AI, graph, work report và modal không cần ở first paint.
2. Tách static import gây vô hiệu dynamic import.
3. Xóa `syncFromCloudLegacy` sau khi kiểm tra toàn bộ call site.
4. Tránh quét toàn bộ vault để tính badge; cập nhật count theo mutation hoặc index.
5. Deadline monitor chạy khi app focus, khi dữ liệu thay đổi và theo timer deadline gần nhất.
6. Xử lý toàn bộ cảnh báo lint.
7. Thêm performance marks: local hydrate, first content, parse, apply, store refresh, search index.

**Tiêu chí nghiệm thu**

- Main bundle dưới 220 KB gzip.
- Không có long task trên 200 ms với fixture chuẩn nếu không cần worker.
- Không thêm cảnh báo lint.

## P1 — Năng suất hằng ngày

### P1.1 — Dashboard Hôm nay

**Mục tiêu**: Khi mở app, người dùng nhìn thấy ngay việc cần làm hôm nay.

**Các bước triển khai**

1. Nâng HomePage thành dashboard ngày hiện tại.
2. Hiển thị report, notebook/page, task quá hạn, task sắp đến hạn và lịch biểu tiếp theo.
3. Hiển thị queue sync, trạng thái Drive và lỗi gần nhất.
4. Thêm nội dung mở gần đây và page/notebook ghim.
5. Thêm quick action tạo page, notebook, report, task và schedule.
6. Giữ Offline Demo thành hành động chủ động, không seed tự động.

**Tiêu chí nghiệm thu**: Dashboard hữu ích khi ngày chỉ có report, chỉ có note, không có dữ liệu hoặc đang offline.

### P1.2 — Tìm kiếm thống nhất

**Mục tiêu**: Tìm được mọi loại nội dung bằng từ khóa tự nhiên và bộ lọc rõ ràng.

**Các bước triển khai**

1. Mở rộng `SearchFilters`: type, date range, tag, project, task status.
2. Chuẩn hóa hoa thường và bỏ dấu tiếng Việt.
3. Xếp hạng theo title, tag, content, độ gần ngày và recently opened.
4. Highlight phần khớp và hiển thị `matchedFields`.
5. Thêm recent search/recent content khi query rỗng.
6. Hiển thị loading/indexing/error thay vì empty state sớm.
7. Giữ điều hướng ↑/↓/Enter/Escape.

**Tiêu chí nghiệm thu**: Tìm page, notebook, report, project, task và schedule; kết quả không chứa entity đã xóa.

### P1.3 — Báo cáo và công việc nâng cao

**Các bước triển khai**

1. Thêm `Sao chép báo cáo ngày trước`.
2. Cho chuyển `Công việc ngày tiếp theo` sang báo cáo mới.
3. Thêm template báo cáo cá nhân.
4. Lọc lịch sử report theo ngày và project.
5. Export report theo ngày/khoảng ngày thành Markdown và PDF.
6. Export schedule `.ics` và task CSV.
7. Cho ghim notebook/page quan trọng.

**Tiêu chí nghiệm thu**: Copy/preview/autosave không làm mất nội dung và giữ đúng định dạng báo cáo.

### P1.4 — PWA và deep link

**Các bước triển khai**

1. Thêm manifest, icon, service worker và cache app shell.
2. Không cache response riêng tư của Google Drive.
3. Hiển thị trạng thái offline và nút cập nhật phiên bản mới.
4. Dùng hash route tương thích GitHub Pages:
   - `#/today`
   - `#/day/:date`
   - `#/page/:pageId`
   - `#/report/:reportId`
   - `#/schedule`
5. Đồng bộ route với Zustand selection.
6. Nút Back/Forward phải khôi phục đúng nội dung đang mở.

**Tiêu chí nghiệm thu**: App shell mở được offline sau lần truy cập đầu; refresh deep link không trả 404.

## P2 — Kho tri thức nâng cao

### P2.1 — Graph và liên kết thật

1. Parse wiki link và backlink thành edge.
2. Hiển thị node page, notebook, tag và project theo bộ lọc.
3. Thêm zoom, pan, tìm node và focus node đang chọn.
4. Hiển thị empty state khi không có liên kết.
5. Giữ canvas responsive và accessible alternative dạng danh sách.

### P2.2 — Đọc và tổ chức nội dung

1. Mục lục tự động từ heading.
2. Focus/reading mode.
3. Page orphan report và gợi ý backlink.
4. Pin/favorite nâng cao và sort tùy chỉnh.

### P2.3 — Tệp đính kèm

1. Upload tệp tối đa 10 MB từ editor; lưu data URL để dùng offline và thử upload binary vào Drive khi có token.
2. Lưu metadata attachment trong Dexie, snapshot `database.json`, backup/import và sync queue.
3. Hiển thị trạng thái đang tải, retry upload nền khi kết nối lại và cho phép xóa mềm an toàn.
4. Link tải cục bộ vẫn hoạt động khi Drive không còn file; phần preview ảnh/chia sẻ và xóa binary trên Drive tiếp tục là hardening P2.

## 5. API và schema dự kiến

```ts
interface VaultBackupV7 {
  meta: {
    schemaVersion: 7;
    exportedAt: string;
    ownerEmail?: string;
    appVersion: string;
  };
  days: Day[];
  notebooks: Notebook[];
  pages: Page[];
  tags: Tag[];
  projects: Project[];
  workReports: WorkReport[];
  attachments: Attachment[];
  scheduleBlocks: ScheduleBlock[];
  customTasks: CustomUserTask[];
  workCategories: WorkCategory[];
  revisions: Revision[];
  settings: AppSettings;
}

type ImportMode = 'replace';

interface BackupInspection {
  valid: boolean;
  schemaVersion: number;
  counts: Record<string, number>;
  warnings: string[];
  errors: string[];
}

interface SearchFilters {
  query?: string;
  types?: Array<'page' | 'notebook' | 'work_report' | 'project' | 'task' | 'schedule'>;
  tagIds?: string[];
  projectIds?: string[];
  startDate?: string;
  endDate?: string;
  taskStatus?: 'all' | 'pending' | 'completed' | 'overdue';
}

interface AiScope {
  type: 'current_page' | 'notebook' | 'selected_pages' | 'vault';
  ids?: string[];
}
```

Các API repository cần có:

- `inspectBackup`, `createRecoveryBackup`, `restoreBackup`.
- `createRevision`, `getPageRevisions`, `restoreRevision`, `pruneRevisions`.
- `getTrashSummary`, `restoreNotebook`, `restoreWorkReport`, `emptyTrash`.
- `setPinned`.
- `searchAll(filters: SearchFilters)`.
- `sanitizeAiOutput` và `buildAiRequest(scope: AiScope)`.

## 6. Migration, rollback và đồng bộ

### Migration

- Dexie version 6 bổ sung các field mới và migration idempotent.
- Backup cũ mặc định `[]` cho collection thiếu, không tự suy đoán dữ liệu.
- `deleted: true` cũ được chuyển sang `deletedAt` với thời điểm migration.
- Nếu schema backup mới hơn app hiện tại, dừng restore và giữ nguyên vault.

### Rollback

- Mọi restore tạo recovery backup trước.
- Apply snapshot chỉ trong một transaction.
- Không xóa sync queue khi parse/apply/upload thất bại.
- Nếu migration lỗi, báo lỗi rõ ràng và không tiếp tục khởi động với dữ liệu nửa chừng.
- Khi PWA có lỗi, người dùng có thể tải lại bản static trước và dữ liệu IndexedDB không bị xóa.

### Đồng bộ Google Drive

- Snapshot chính vẫn là nguồn dữ liệu cloud.
- Revision chỉ nằm trong backup thủ công ở giai đoạn đầu để tránh làm snapshot Drive phình to.
- Sau restore, upload snapshot hợp nhất trước khi dọn queue.
- Không upload dữ liệu tài khoản cũ sang tài khoản Google khác.

## 7. Kế hoạch kiểm thử

### Unit/IndexedDB

- Backup V7 đầy đủ và backup cũ thiếu collection.
- Preview phát hiện JSON hỏng, schema mới, ID trùng và quan hệ sai.
- Restore lỗi không làm mất cache hiện tại.
- Revision tạo, prune, compare và restore.
- Trash cascade page/notebook/report.
- Search bỏ dấu, ranking, filter và loại entity đã xóa.
- AI sanitizer chặn script, event handler và URL nguy hiểm.
- Migration version 5 → 6 không mất tag, project, report, lịch biểu.

### E2E desktop/mobile

- Tạo/sửa/xóa/khôi phục page, notebook, report và project.
- Mở timeline, drawer, bottom navigation và editor trên viewport hẹp.
- Mọi modal đóng bằng Escape và trả focus đúng.
- Backup preview → recovery backup → restore.
- Search bằng bàn phím và bộ lọc.
- Offline edit → reconnect → queue được đồng bộ.
- Dashboard hôm nay với các tổ hợp dữ liệu rỗng/report-only/note-only.

### Accessibility

- Chạy axe-core trên layout, editor, sidebar, search và từng modal.
- Kiểm tra keyboard-only, focus-visible, screen reader label và contrast.
- Kiểm tra reduced motion và touch target bằng snapshot layout.

### Performance

- Fixture 500, 5.000 và 20.000 page.
- Đo first local content, parse, transaction, refresh, search index và memory.
- CPU throttling 4×, Fast 4G và offline.
- So sánh bundle trước/sau lazy-load.

## 8. Checklist triển khai

| Mã | Hạng mục | Trạng thái | Điều kiện hoàn thành |
| --- | --- | --- | --- |
| P0.1 | Backup/restore an toàn | Hoàn thành | V7, preview, recovery, atomic restore |
| P0.2 | Revision và Trash | Hoàn thành | Xem/restore history, cascade trash |
| P0.3 | AI privacy/security | Hoàn thành | Scope rõ, sanitizer, key diagnostics |
| P0.4 | Mobile/accessibility | Hoàn thành | Touch 44 px, dialog chuẩn, không hover-only |
| P0.5 | Chuẩn hóa tiếng Việt | Hoàn thành | UI và meta đồng nhất tiếng Việt |
| P0.6 | Hiệu năng/nợ kỹ thuật | Hoàn thành | Bundle, lint, monitor đạt mục tiêu |
| P1.1 | Dashboard Hôm nay | Hoàn thành | Quick action và trạng thái ngày |
| P1.2 | Tìm kiếm thống nhất | Hoàn thành | Filter, ranking, accent-insensitive |
| P1.3 | Report/task nâng cao | Hoàn thành | Copy, template, export |
| P1.4 | PWA/deep link | Hoàn thành | App shell offline, hash route |
| P2 | Kho tri thức nâng cao | Hoàn thành | Graph thật, TOC, attachments |

## 9. Trình tự và điều kiện chuyển giai đoạn

1. Hoàn tất P0.1 và chạy migration/backup test.
2. Hoàn tất P0.2–P0.3; kiểm tra restore và bảo mật AI.
3. Hoàn tất P0.4–P0.5; kiểm tra thiết bị thật và chuẩn hóa chuỗi.
4. Hoàn tất P0.6; xác nhận performance baseline mới.
5. Chỉ bắt đầu P1 khi toàn bộ P0 đạt test và không còn lỗi dữ liệu nghiêm trọng.
6. Chỉ bắt đầu P2 sau khi P1 có telemetry cục bộ hoặc benchmark chứng minh không làm chậm first paint.
7. Trước mỗi release phải chạy `npm test`, `npm run lint`, `npm run build`, E2E và smoke test offline.

## 10. Ngoài phạm vi

- Cộng tác nhiều người, phân quyền, bình luận realtime.
- Di chuyển dữ liệu Supabase.
- Màu/icon/phân cấp cho tag nếu chưa có yêu cầu riêng.
- Tự động deploy GitHub Pages.

Tài liệu này là checklist chính thức cho các đợt cải tiến tiếp theo. Mỗi pull request cần cập nhật trạng thái checklist, test đã chạy và chỉ số trước/sau tương ứng.

## 11. Trạng thái cập nhật triển khai

Đợt triển khai hiện tại đã hoàn thành toàn bộ hạng mục P0, P1 và P2 trong phạm vi mã nguồn. Các kiểm thử tự động, smoke, Chromium/axe-core và benchmark đã đạt; kiểm tra thiết bị vật lý là bước xác nhận vận hành bổ sung sau khi phát hành.

| Mã | Trạng thái cập nhật | Ghi chú kiểm chứng |
| --- | --- | --- |
| P0.1 | Hoàn thành | Backup V7, preview, recovery backup, validate và restore atomic; đã có test round-trip cơ bản. |
| P0.2 | Hoàn thành | Revision chu kỳ, restore, soft-delete/khôi phục notebook/report/page và xóa vĩnh viễn. |
| P0.3 | Hoàn thành | AI scope page/notebook/các trang đã chọn/toàn vault, xác nhận phạm vi và kích thước payload, sanitizer HTML, kiểm tra API key và quyền thông báo chủ động. |
| P0.4 | Hoàn thành | Drawer mobile, bottom navigation, tất cả modal (kể cả lịch biểu) dùng DialogShell với focus trap/Escape/ARIA/restore focus, touch target 44px, reduced motion và safe-area; thao tác lịch/task/category không còn bị ẩn trên touch; smoke kiểm tra đủ modal primitive. |
| P0.5 | Hoàn thành | `lang=vi`, nhận diện WebNote, catalog `src/i18n/vi.ts`, lời chào/định dạng tháng, trạng thái đồng bộ và các luồng chính đã chuẩn hóa; nhãn timeline, lịch biểu, màu và trạng thái mobile còn sót đã được chuyển sang tiếng Việt. |
| P0.6 | Hoàn thành | Lazy-load, service worker, performance marks, deadline monitor, benchmark 5.000 page, sync legacy đã dọn, Tiptap/lowlight đã tách vendor chunk, snapshot lớn parse bằng Web Worker; Chromium Fast 4G + CPU 4× đo warm local vault 200 ms (<500 ms); lint/build sạch cảnh báo. |
| P1.1 | Hoàn thành | Dashboard Hôm nay có quick action tạo page/notebook/report/task/schedule, chỉ số task, lịch gần nhất, nội dung gần đây, trang ghim, report-only/orphan state và số thay đổi đang chờ đồng bộ; browser E2E desktop/mobile đạt. |
| P1.2 | Hoàn thành | Search bỏ dấu, ranking, tag/type/date/project/task filter, loading state, matched fields, recent search, highlight và điều hướng bàn phím; browser E2E + axe-core đạt. |
| P1.3 | Hoàn thành | Preview/copy/autosave, quản lý project, copy báo cáo ngày trước, chuyển công việc sang báo cáo ngày tiếp theo, mẫu báo cáo, export Markdown/PDF/ICS/CSV, ghim notebook/page và bảng lịch sử report lọc theo dự án/ngày đã có; browser E2E + axe-core đạt. |
| P1.4 | Hoàn thành | Manifest, service worker shell cache, hash route cho ngày/notebook/page/report/schedule và khôi phục Back/Forward không ghi đè lịch sử. |
| P2 | Hoàn thành | Wiki-link accent-insensitive cùng node tag/project, backlink hai chiều, gợi ý chèn liên kết, mục lục, chế độ đọc, orphan report, zoom/pan, tìm node, lọc loại node, danh sách graph accessible và attachment preview/chia sẻ cục bộ; retry upload, mở tệp chỉ có trên Drive, xóa binary Drive, cascade attachment khi xóa notebook, canvas `role=img`/`touch-none`; browser E2E + axe-core đạt. |

Các lệnh kiểm tra gần nhất: `npm test -- --run` (29 test đạt, gồm backup settings, round-trip đủ collection, AI scope, benchmark apply 5.000 page, cascade attachment và chuẩn hóa wiki-link), `npm run test:perf` (5.000 page: parse 3,6 ms, normalize 15,5 ms, tổng 19,1 ms; worker parse 28,2 ms; gzip 50 KB trên máy phát triển), `npm run lint` (không cảnh báo), `npm run build` (thành công; các vendor chunk đều dưới 220 KB gzip, không còn cảnh báo build), `npm run test:e2e` (build + smoke desktop/mobile/deep-link/manifest và modal accessibility đạt), `node scripts/browser-e2e.mjs` (Chromium thật, desktop/mobile, axe critical đạt), `npm run test:perf:browser` (Fast 4G + CPU 4×, Offline Demo local vault, cold shell 2.419 ms, warm reload 200 ms). Chưa kiểm tra trên thiết bị tầm trung vật lý và chưa thực hiện deploy trong đợt cập nhật này.
