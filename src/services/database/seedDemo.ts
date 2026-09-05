// ============================================================
// MyNotes — Demo Vault Seed Data Generator
// Creates a comprehensive demo notebook with tutorial pages & live examples for all features.
// ============================================================

import { ensureToday, createNotebook, createPage, updatePageContent, getNotebooksByDay, getPagesByNotebook } from './repository';
import type { Notebook, Page } from '../../types';

export async function seedDemoVault(): Promise<{ notebook: Notebook; pages: Page[] }> {
  // Ensure today exists
  const today = await ensureToday();

  // Check if Demo Notebook already exists for today to prevent duplicates
  const existingNotebooks = await getNotebooksByDay(today.id);
  const existingDemo = existingNotebooks.find(
    (nb) => nb.title === '📚 Hướng Dẫn Sử Dụng MyNotes 4.0'
  );

  if (existingDemo) {
    const existingPages = await getPagesByNotebook(existingDemo.id);
    if (existingPages.length > 0) {
      return { notebook: existingDemo, pages: existingPages };
    }
  }

  // Create Demo Notebook if not found
  const notebook = existingDemo || (await createNotebook('📚 Hướng Dẫn Sử Dụng MyNotes 4.0', today.id, 'book'));

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

<h2>💡 Ví dụ thực tế mẫu (Live Example Demonstration):</h2>
<p>Dưới đây là ví dụ minh họa cấu trúc của một ghi chú tiêu chuẩn trong MyNotes kết hợp văn bản, đánh dấu highlight và bảng tổng quan:</p>

<blockquote><p>📌 <em>"Tri thức là tài sản duy nhất tăng giá trị khi được chia sẻ và tổ chức hệ thống."</em></p></blockquote>

<table>
  <thead>
    <tr>
      <th>Thành phần</th>
      <th>Vị trí lưu trữ</th>
      <th>Cơ chế bảo mật</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Bộ nhớ cục bộ</strong></td>
      <td>IndexedDB (Trình duyệt)</td>
      <td>Lưu mã hóa cục bộ, truy cập không cần mạng</td>
    </tr>
    <tr>
      <td><strong>Sao lưu đám mây</strong></td>
      <td>Google Drive (/MyNotes)</td>
      <td>Chỉ tài khoản Google cá nhân mới có quyền xem</td>
    </tr>
  </tbody>
</table>`,
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

<h2>💡 Ví dụ thực tế mẫu (Live Example Demonstration):</h2>

<h3>1. Khối trích dẫn (Quote Block):</h3>
<blockquote><p>💡 <strong>Slash Command Tip:</strong> Nhấn phím <code>Esc</code> bất kỳ lúc nào để đóng trình đơn lệnh nhanh mà không cần dùng chuột.</p></blockquote>

<h3>2. Khối mã nguồn (Code Block with Syntax Highlighting):</h3>
<pre><code>// Ví dụ đoạn mã TypeScript tính toán thời gian đọc
function getReadingTime(wordsCount: number): number {
  const WORDS_PER_MINUTE = 200;
  return Math.ceil(wordsCount / WORDS_PER_MINUTE);
}
console.log("Reading time:", getReadingTime(450), "minutes");</code></pre>

<h3>3. Khối Bảng dữ liệu mẫu (Interactive Table):</h3>
<table>
  <thead>
    <tr>
      <th>Lệnh Slash</th>
      <th>Phím tắt tương ứng</th>
      <th>Chức năng</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>/h1</code></td>
      <td>Ctrl + Alt + 1</td>
      <td>Tiêu đề H1 lớn</td>
    </tr>
    <tr>
      <td><code>/todo</code></td>
      <td>Ctrl + Shift + C</td>
      <td>Tạo ô tích công việc</td>
    </tr>
    <tr>
      <td><code>/code</code></td>
      <td>Ctrl + Alt + C</td>
      <td>Tạo khối mã nguồn</td>
    </tr>
  </tbody>
</table>`,
    },
    {
      title: '🔗 3. Liên Kết 2 Chiều (Wiki Links [[ ]])',
      content: `<h1>🔗 Bi-directional Wiki Links & Linked References</h1>
<p>Giống như <em>Obsidian</em> và <em>Roam Research</em>, MyNotes hỗ trợ liên kết các trang ghi chú lại với nhau tạo thành mạng lưới tri thức liên hoàn.</p>

<h2>📝 Cách tạo liên kết trang:</h2>
<p>Để liên kết tới một trang khác, bạn chỉ chỉ cần gõ tên trang đó trong cặp dấu ngoặc vuông đôi <code>[[Tên trang]]</code>.</p>

<h2>💡 Ví dụ thực tế mẫu (Live Example Demonstration):</h2>
<p>Hãy thử nhấp vào các liên kết Wiki Links trực tiếp dưới đây để chuyển trang tức thì:</p>

<ul>
  <li><p>👉 Mở trang hướng dẫn gõ Slash Menu: [[⚡ 2. Slash Commands Menu (Gõ /)]]</p></li>
  <li><p>👉 Mở trang hướng dẫn Sơ đồ tri thức: [[🌐 4. Sơ Đồ Tri Thức (Knowledge Graph View)]]</p></li>
  <li><p>👉 Mở trang Quản lý công việc: [[✅ 6. Trung Tâm Quản Lý Công Việc (Todo Dashboard)]]</p></li>
</ul>

<hr />

<h2>🔍 Thử nghiệm Linked References:</h2>
<p>Cuộn xuống <strong>cuối trang này</strong> để nhìn thấy bảng <strong>Linked References</strong> — danh sách các bài viết mẫu khác tự động tham chiếu ngược lại bài viết này!</p>`,
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
</ol>

<h2>💡 Ví dụ thực tế mẫu (Live Example Demonstration):</h2>
<p>Dưới đây là một sơ đồ liên kết ý tưởng văn bản (Map of Content - MOC) thể hiện cách các nút ghi chú kết nối với nhau trong Knowledge Graph:</p>

<pre><code>[ MyNotes Vault ]
   ├── [ 📚 Sổ Tay Hướng Dẫn ]
   │     ├── 📄 [[📄 1. Tổng Quan về MyNotes 4.0]]
   │     ├── ⚡ [[⚡ 2. Slash Commands Menu (Gõ /)]]
   │     ├── 🔗 [[🔗 3. Liên Kết 2 Chiều (Wiki Links [[ ]])]]
   │     └── 🌐 [[🌐 4. Sơ Đồ Tri Thức (Knowledge Graph View)]]
   └── [ 💡 Sổ Tay Dự Án Kế Hoạch ]
         ├── 🤖 [[🤖 5. Trợ Lý AI Copilot (Summarize, Polish & Translate)]]
         └── ✅ [[✅ 6. Trung Tâm Quản Lý Công Việc (Todo Dashboard)]]</code></pre>`,
    },
    {
      title: '🤖 5. Trợ Lý AI Copilot (Summarize, Polish & Translate)',
      content: `<h1>🤖 AI Writing Copilot Assistant</h1>
<p>Trợ lý AI tích hợp sẵn giúp bạn xử lý văn bản, tóm tắt ý chính, trích xuất to-do list và dịch thuật chuyên nghiệp chỉ với 1 cú nhấp chuột.</p>

<h2>🚀 Hướng dẫn kích hoạt:</h2>
<p>Bấm vào nút <strong>AI Copilot</strong> (biểu tượng ✨ tím) trên thanh công cụ soạn thảo hoặc ở chân trang để mở giao diện Trợ lý AI.</p>

<h2>💡 Ví dụ thực tế mẫu (Live Example Demonstration):</h2>

<h3>Đoạn văn bản thô (Original Input Text):</h3>
<blockquote><p>"Hôm nay đội dự án đã họp bàn về việc nâng cấp giao diện MyNotes lên phiên bản 4.0. Cần phải hoàn thành các nhiệm vụ sau: bổ sung menu gõ slash command, xây dựng todo dashboard tập trung, thêm tính năng backup dữ liệu json và kiểm thử toàn bộ trên trình duyệt trước 22:00."</p></blockquote>

<h3>Kết quả sau khi dùng AI Copilot (AI Processed Output):</h3>
<ul>
  <li><p><strong>Tóm tắt (Summarize):</strong> Họp nâng cấp MyNotes 4.0 tập trung vào 3 tính năng: Slash Menu, Todo Dashboard, Backup JSON và kiểm thử trước 22:00.</p></li>
  <li><p><strong>Rút công việc (Extract Tasks):</strong></p>
    <ul data-type="taskList">
      <li data-type="taskItem" data-checked="true"><p>Bổ sung menu gõ Slash command</p></li>
      <li data-type="taskItem" data-checked="true"><p>Xây dựng Todo Dashboard tập trung</p></li>
      <li data-type="taskItem" data-checked="false"><p>Thêm tính năng backup dữ liệu JSON</p></li>
      <li data-type="taskItem" data-checked="false"><p>Kiểm thử toàn bộ trên trình duyệt trước 22:00</p></li>
    </ul>
  </li>
  <li><p><strong>Dịch sang Tiếng Anh (English Translation):</strong> <em>"Today the project team met to discuss upgrading the MyNotes UI to version 4.0, focusing on Slash Commands, Todo Dashboard, and JSON Backup."</em></p></li>
</ul>`,
    },
    {
      title: '✅ 6. Trung Tâm Quản Lý Công Việc & Deadline Thông Minh',
      content: `<h1>✅ Smart Task & Exact Time Deadline Management</h1>
<p>Toàn bộ danh sách công việc có đính kèm <strong>Ngày & Giờ (Date & Time)</strong> hoặc gõ từ khóa tự nhiên (NLP như <code>@today</code>, <code>@ngaymai</code>, <code>@sau 2 gio</code>) sẽ được tự động đếm ngược, cảnh báo đỏ và sắp xếp ưu tiên!</p>

<h2>🚨 Cảnh báo deadline đếm ngược theo Giờ & Phút:</h2>
<p>Hệ thống tự động hiển thị thời gian đếm ngược chính xác: <code>🔴 Quá hạn 2 giờ</code>, <code>🔥 Hôm nay 18:00 (Còn 35m)</code>, <code>⚡ Ngày mai 09:00</code>.</p>

<h2>💡 Ví dụ thực tế mẫu (Live Example Demonstration):</h2>
<p>Thử sử dụng menu lệnh <strong>/deadline</strong> hoặc gõ trực tiếp <code>@homnay</code>, <code>@ngaymai</code>, <code>@sau 3 gio</code> trong văn bản:</p>

<h3>📌 Danh sách công việc đính kèm Ngày & Giờ:</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false" data-due="2026-09-01T09:00"><p>⚠️ Nộp báo cáo tổng kết dự án MyNotes 4.0 (@due(2026-09-01 09:00))</p></li>
  <li data-type="taskItem" data-checked="false" data-due="2026-09-04T15:30"><p>⚠️ Kiểm thử chức năng đếm ngược giờ/phút trên Task Center (@due(2026-09-04 15:30))</p></li>
  <li data-type="taskItem" data-checked="true" data-due="2026-09-05T18:00"><p>Khám phá tính năng Slash Menu bằng cách gõ / trên dòng mới @today</p></li>
  <li data-type="taskItem" data-checked="false" data-due="2026-09-06T09:00"><p>Trải nghiệm Trợ lý AI Copilot để tóm tắt văn bản @tomorrow</p></li>
  <li data-type="taskItem" data-checked="false"><p>Xuất bản sao lưu dữ liệu (.json) dự phòng về máy tính</p></li>
</ul>

<p>👉 Nhấp nút <strong>Tasks</strong> trên Header để dùng các phím chọn nhanh 1-Click (⚡ Hôm nay, ☀️ Ngày mai, +1h, +1d, +1w) và bộ chọn Ngày & Giờ chính xác!</p>`,
    },
    {
      title: '📦 7. Sao Lưu & Xuất/Nhập Dữ Liệu (Backup & Export)',
      content: `<h1>📦 Vault Backup & Data Portability</h1>
<p>Dữ liệu ghi chú là tài sản quan trọng nhất của bạn. MyNotes đảm bảo bạn luôn làm chủ 100% dữ liệu với khả năng sao lưu và xuất file linh hoạt.</p>

<h2>🚀 Hướng dẫn kích hoạt:</h2>
<p>Bấm vào nút <strong>Export</strong> (biểu tượng Download màu xanh lá) trên thanh Header để mở bảng điều khiển Sao lưu.</p>

<h2>💡 Ví dụ thực tế mẫu (Live Example Demonstration):</h2>

<h3>1. Mẫu file Markdown (.md) sau khi xuất từ MyNotes:</h3>
<pre><code># 📄 1. Tổng Quan về MyNotes 4.0

Date Created: 2026-09-04T20:30:00.000Z
Notebook: 📚 Hướng Dẫn Sử Dụng MyNotes 4.0
---

Welcome to MyNotes 4.0 🚀
MyNotes là ứng dụng quản lý tri thức cá nhân (Personal Knowledge Base) hiện đại...</code></pre>

<h3>2. Mẫu định dạng sao lưu dữ liệu Full Vault (.json):</h3>
<pre><code>{
  "version": "4.0",
  "exportDate": "2026-09-04T21:50:00.000Z",
  "days": [{ "id": "day_20260904", "date": "2026-09-04" }],
  "notebooks": [{ "id": "nb_demo", "title": "📚 Hướng Dẫn Sử Dụng MyNotes 4.0" }],
  "pages": [{ "id": "page_demo_1", "title": "📄 1. Tổng Quan về MyNotes 4.0" }]
}</code></pre>`,
    },
    {
      title: '☁️ 8. Đồng Bộ Google Drive & Hoạt Động Offline',
      content: `<h1>☁️ Google Drive Sync & Offline-First Storage</h1>
<p>MyNotes kết hợp hoàn hảo giữa tốc độ vượt trội của bộ nhớ cục bộ trình duyệt và độ an toàn của đám mây Google Drive.</p>

<h2>💡 Ví dụ thực tế mẫu (Live Example Demonstration):</h2>
<p>Dưới đây là mô phỏng chu kỳ xử lý lưu trữ tự động của MyNotes khi có kết nối mạng và khi ngoại tuyến:</p>

<table>
  <thead>
    <tr>
      <th>Trạng thái mạng</th>
      <th>Hành động người dùng</th>
      <th>Phản hồi hệ thống MyNotes</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Online (Có mạng)</strong></td>
      <td>Gõ bài viết mới</td>
      <td>Lưu tức thì vào IndexedDB ➔ Đợi 1.5s ➔ Đẩy đồng bộ lên Google Drive (Hiển thị <code>Saved</code>)</td>
    </tr>
    <tr>
      <td><strong>Offline (Mất mạng)</strong></td>
      <td>Tạo thêm 5 bài viết</td>
      <td>Lưu an toàn vào IndexedDB ➔ Đưa vào Hàng chờ đồng bộ (Hiển thị <code>Offline</code>)</td>
    </tr>
    <tr>
      <td><strong>Có mạng trở lại</strong></td>
      <td>Mở lại trình duyệt</td>
      <td>Tự động quét Hàng chờ ➔ Đồng bộ toàn bộ bài viết mới lên Google Drive</td>
    </tr>
  </tbody>
</table>

<p>👉 Bạn có thể bấm vào biểu tượng đám mây trên Header bất kỳ lúc nào để thực hiện ép đồng bộ (<strong>Sync Now</strong>)!</p>`,
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
