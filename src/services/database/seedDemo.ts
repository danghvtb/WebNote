// ============================================================
// MyNotes — Demo Vault Seed Data Generator
// Creates a comprehensive demo notebook with tutorial pages for all features.
// ============================================================

import { ensureToday, createNotebook, createPage, updatePageContent } from './repository';
import type { Notebook, Page } from '../../types';

export async function seedDemoVault(): Promise<{ notebook: Notebook; pages: Page[] }> {
  // Ensure today exists
  const today = await ensureToday();

  // Create Demo Notebook
  const notebook = await createNotebook('📚 Hướng Dẫn Sử Dụng MyNotes 4.0', today.id, 'book');

  const demoPagesData = [
    {
      title: '📄 1. Tổng Quan về MyNotes 4.0',
      content: `<h1>Welcome to MyNotes 4.0 🚀</h1>
<p><strong>MyNotes</strong> là ứng dụng quản lý tri thức cá nhân (Personal Knowledge Base) hiện đại, hoạt động <strong>Offline-First</strong> và tự động đồng bộ an toàn với tài khoản Google Drive cá nhân của bạn.</p>

<h2>✨ Các điểm nổi bật của MyNotes:</h2>
<ul>
  <li><p><strong>Cấu trúc 3 cấp khoa học:</strong> Ngày (Day) ➔ Sổ tay (Notebook) ➔ Trang (Page).</p></li>
  <li><p><strong>Quyền riêng tư tuyệt đối:</strong> 100% dữ liệu lưu trong trình duyệt của bạn (IndexedDB) và Google Drive cá nhân. Không qua bất kỳ máy chủ bên thứ 3 nào.</p></li>
  <li><p><strong>Obsidian Midnight UI:</strong> Giao diện tối màu tương phản cao, phông chữ lớn hiện đại, trải nghiệm viết cực kỳ êm mắt.</p></li>
</ul>

<p>👉 Hãy mở các trang ghi chú trong danh sách bên trái để khám phá và thử nghiệm chi tiết từng tính năng thông minh!</p>`,
    },
    {
      title: '⚡ 2. Slash Commands Menu (Gõ /)',
      content: `<h1>⚡ Trình Đơn Lệnh Nhanh — Slash Commands Menu</h1>
<p>Chỉ cần gõ ký tự <code>/</code> ở bất kỳ dòng mới nào trong trình soạn thảo, một menu chọn nhanh các khối định dạng phong phú sẽ xuất hiện ngay lập tức!</p>

<h2>🛠️ Hướng dẫn sử dụng:</h2>
<ol>
  <li><p>Đưa con trỏ xuống một dòng mới trong bài viết này.</p></li>
  <li><p>Gõ ký tự <code>/</code> trên bàn phím (hoặc bấm nút <strong>/</strong> trên thanh công cụ soạn thảo).</p></li>
  <li><p>Sử dụng phím mũi tên lên/xuống để chọn loại định dạng mong muốn và ấn <code>Enter</code>.</p></li>
</ol>

<h2>📋 Các khối hỗ trợ trong Menu:</h2>
<ul>
  <li><p><strong>Headings (H1, H2, H3):</strong> Tiêu đề bài viết lớn, vừa, nhỏ.</p></li>
  <li><p><strong>Task List:</strong> Tạo danh sách việc cần làm có ô tích checkbox.</p></li>
  <li><p><strong>Code Block:</strong> Khối mã nguồn hỗ trợ tô màu cú pháp syntax highlighting.</p></li>
  <li><p><strong>Quote:</strong> Khối trích dẫn nổi bật.</p></li>
  <li><p><strong>Table:</strong> Chèn bảng biểu 3x3 linh hoạt.</p></li>
  <li><p><strong>Divider:</strong> Đường phân cách nét liền đẹp mắt.</p></li>
  <li><p><strong>AI Copilot:</strong> Kích hoạt Trợ lý AI ngay tại vị trí soạn thảo.</p></li>
</ul>`,
    },
    {
      title: '🔗 3. Liên Kết 2 Chiều (Wiki Links [[ ]])',
      content: `<h1>🔗 Bi-directional Wiki Links & Linked References</h1>
<p>Giống như <em>Obsidian</em> và <em>Roam Research</em>, MyNotes hỗ trợ liên kết các trang ghi chú lại với nhau tạo thành mạng lưới tri thức liên hoàn.</p>

<h2>📝 Cách tạo liên kết trang:</h2>
<p>Để liên kết tới một trang khác, bạn chỉ cần gõ tên trang đó trong cặp dấu ngoặc vuông đôi <code>[[Tên trang]]</code>.</p>

<p>Ví dụ hãy nhấp thử vào các đường dẫn bên dưới:</p>
<ul>
  <li><p>Trang hướng dẫn Slash Menu: [[⚡ 2. Slash Commands Menu (Gõ /)]]</p></li>
  <li><p>Trang hướng dẫn Knowledge Graph: [[🌐 4. Sơ Đồ Tri Thức (Knowledge Graph View)]]</p></li>
</ul>

<h2>🔍 Linked References (Tham chiếu ngược):</h2>
<p>Ở phía dưới chân của mỗi bài viết, MyNotes tự động phân tích và hiển thị phần <strong>Linked References</strong> — liệt kê tất cả các bài viết khác có liên kết hoặc nhắc tới bài viết hiện tại!</p>`,
    },
    {
      title: '🌐 4. Sơ Đồ Tri Thức (Knowledge Graph View)',
      content: `<h1>🌐 Knowledge Graph View — Trực Quan Hóa Mạng Lưới Tri Thức</h1>
<p>Tính năng Knowledge Graph giúp bạn theo dõi toàn bộ cấu trúc và mối liên hệ giữa các Sổ tay (Notebooks) và Trang ghi chú (Pages) dưới dạng mạng nhện 2D tương tác sống động.</p>

<h2>🎯 Hướng dẫn trải nghiệm:</h2>
<ol>
  <li><p>Nhấp vào nút <strong>Graph</strong> (biểu tượng mạng lưới cyan) ở góc phải thanh Header trên cùng.</p></li>
  <li><p>Một cửa sổ Modal Canvas 2D sẽ hiện lên với các nút (nodes) tượng trưng cho Vault, Notebook và Page.</p></li>
  <li><p>Bạn có thể dùng chuột kéo thả các nút, thu phóng sơ đồ.</p></li>
  <li><p>Nhấp trực tiếp vào bất kỳ nút trang màu hồng nào để chuyển nhanh sang bài viết đó!</p></li>
</ol>`,
    },
    {
      title: '🤖 5. Trợ Lý AI Copilot (Summarize, Polish & Translate)',
      content: `<h1>🤖 AI Writing Copilot Assistant</h1>
<p>Trợ lý AI tích hợp sẵn giúp bạn xử lý văn bản, tóm tắt ý chính, trích xuất to-do list và dịch thuật chuyên nghiệp chỉ với 1 cú nhấp chuột.</p>

<h2>✨ Các tính năng của AI Copilot:</h2>
<ul>
  <li><p><strong>Summarize (Tóm tắt):</strong> Tóm gọn bài viết dài thành các ý chính cô đọng.</p></li>
  <li><p><strong>Polish / Rephrase (Chuẩn hóa):</strong> Trau chuốt văn phong bài viết thêm chuyên nghiệp và mượt mà.</p></li>
  <li><p><strong>Extract Tasks (Rút việc cần làm):</strong> Tự động phát hiện các yêu cầu trong bài và chuyển thành danh sách Checklist <code>- [ ]</code>.</p></li>
  <li><p><strong>Translate (Dịch thuật):</strong> Dịch tức thì bài viết sang Tiếng Việt hoặc Tiếng Anh.</p></li>
</ul>

<h2>🚀 Hướng dẫn kích hoạt:</h2>
<p>Bấm vào nút <strong>AI Copilot</strong> (biểu tượng ✨ tím) trên thanh công cụ soạn thảo hoặc ở chân trang để mở giao diện Trợ lý AI.</p>`,
    },
    {
      title: '✅ 6. Trung Tâm Quản Lý Công Việc (Todo Dashboard)',
      content: `<h1>✅ Task Center & Todo Dashboard</h1>
<p>Toàn bộ các danh sách công việc (Checklists) nằm rải rác ở nhiều bài viết khác nhau sẽ được gom về một giao diện quản lý tập trung duy nhất!</p>

<h2>📌 Danh sách công việc mẫu để thử nghiệm:</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><p>Thử nghiệm tính năng Task Center bằng cách bấm nút Tasks trên Header</p></li>
  <li data-type="taskItem" data-checked="false"><p>Đánh dấu hoàn thành bài tập về nhà trong ghi chú</p></li>
  <li data-type="taskItem" data-checked="true"><p>Khám phá tính năng MyNotes 4.0 thành công</p></li>
</ul>

<h2>💡 Hướng dẫn sử dụng:</h2>
<ol>
  <li><p>Nhấp vào nút <strong>Tasks</strong> (biểu tượng CheckSquare) trên thanh Header.</p></li>
  <li><p>Bạn sẽ thấy tổng số việc, tỷ lệ hoàn thành (%) và bộ lọc (Tất cả / Đang làm / Đã hoàn thành).</p></li>
  <li><p>Có thể tích chọn hoàn thành trực tiếp trên Dashboard hoặc bấm vào tên bài viết để chuyển đến vị trí trang gốc!</p></li>
</ol>`,
    },
    {
      title: '📦 7. Sao Lưu & Xuất/Nhập Dữ Liệu (Backup & Export)',
      content: `<h1>📦 Vault Backup & Data Portability</h1>
<p>Dữ liệu ghi chú là tài sản quan trọng nhất của bạn. MyNotes đảm bảo bạn luôn làm chủ 100% dữ liệu với khả năng sao lưu và xuất file linh hoạt.</p>

<h2>📥 Các tùy chọn xuất dữ liệu:</h2>
<ul>
  <li><p><strong>Full Vault Backup (.json):</strong> Xuất toàn bộ cơ sở dữ liệu (Tất cả ngày, sổ tay, bài viết và thuộc tính) thành 1 file JSON duy nhất để lưu trữ dự phòng.</p></li>
  <li><p><strong>Export Markdown (.md):</strong> Xuất bài viết hiện tại thành file văn bản chuẩn Markdown (.md) để sử dụng trên Obsidian, VS Code hay bất kỳ trình đọc nào khác.</p></li>
  <li><p><strong>Restore / Import (.json):</strong> Nạp lại dữ liệu đã sao lưu vào trình duyệt chỉ trong 1 giây.</p></li>
</ul>

<h2>🚀 Thử nghiệm ngay:</h2>
<p>Bấm vào nút <strong>Export</strong> (biểu tượng Download màu xanh lá) trên thanh Header để mở bảng điều khiển Sao lưu.</p>`,
    },
    {
      title: '☁️ 8. Đồng Bộ Google Drive & Hoạt Động Offline',
      content: `<h1>☁️ Google Drive Sync & Offline-First Storage</h1>
<p>MyNotes kết hợp hoàn hảo giữa tốc độ vượt trội của bộ nhớ cục bộ trình duyệt và độ an toàn của đám mây Google Drive.</p>

<h2>🔒 Cơ chế bảo mật và đồng bộ:</h2>
<ul>
  <li><p><strong>Offline-First:</strong> Mọi thao tác gõ chữ, tạo bài viết đều lưu tức thì vào IndexedDB cục bộ. Bạn có thể sử dụng mượt mà ngay cả khi không có mạng Internet.</p></li>
  <li><p><strong>Tự động đồng bộ:</strong> Khi có mạng, ứng dụng sẽ tự động sao lưu dữ liệu lên thư mục <code>MyNotes/</code> trên Google Drive của bạn.</p></li>
  <li><p><strong>Trạng thái lưu trên Header:</strong></p>
    <ul>
      <li><p><code>Saved</code>: Dữ liệu đã an toàn trên đám mây.</p></li>
      <li><p><code>Saving...</code>: Đang tự động lưu bài viết.</p></li>
      <li><p><code>Offline</code>: Đang chạy ở chế độ ngoại tuyến.</p></li>
    </ul>
  </li>
</ul>

<p>👉 Nhấp vào biểu tượng đám mây trên Header bất kỳ lúc nào để thực hiện ép đồng bộ (<strong>Sync Now</strong>)!</p>`,
    },
  ];

  const createdPages: Page[] = [];

  for (const pageData of demoPagesData) {
    const page = await createPage(notebook.id, pageData.title);
    await updatePageContent(page.id, pageData.content);
    createdPages.push(page);
  }

  return { notebook, pages: createdPages };
}
