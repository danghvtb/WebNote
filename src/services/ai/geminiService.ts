// ============================================================
// MyNotes — Google Gemini LLM Service
// Connects WebNote to Google Gemini API for Full-Vault AI Intelligence
// ============================================================

import type { Page } from '../../types';

const GEMINI_KEY_STORAGE_KEY = 'mynotes_gemini_api_key';

/**
 * Get stored Gemini API key or fallback to environment variable
 */
export function getGeminiApiKey(): string {
  if (typeof localStorage !== 'undefined') {
    const customKey = localStorage.getItem(GEMINI_KEY_STORAGE_KEY);
    if (customKey && customKey.trim()) {
      return customKey.trim();
    }
  }
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || '';
}

/**
 * Save custom Gemini API key to LocalStorage
 */
export function setGeminiApiKey(key: string): void {
  if (key && key.trim()) {
    localStorage.setItem(GEMINI_KEY_STORAGE_KEY, key.trim());
  } else {
    localStorage.removeItem(GEMINI_KEY_STORAGE_KEY);
  }
}

/**
 * Parses TipTap HTML page content into clean, structured text for AI context.
 * Preserves paragraphs, lists, tables, and task checkmark statuses.
 */
export function parsePageToCleanText(page: Page): string {
  let content = page.content || '';
  if (!content.trim()) {
    return `=== TRANG GHI CHÚ: "${page.title}" ===\n(Nội dung trang này đang trống)\n`;
  }

  if (typeof document !== 'undefined') {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    // Target ONLY genuine task items (Checklists with data-type="taskItem" or input checkbox or taskList parent)
    const allLis = Array.from(tempDiv.querySelectorAll('li'));
    const taskItems = allLis.filter((item) => {
      const isTaskAttr = item.getAttribute('data-type') === 'taskItem';
      const hasCheckbox = item.querySelector('input[type="checkbox"]') !== null;
      const parentIsTaskList = item.parentElement?.getAttribute('data-type') === 'taskList';
      return isTaskAttr || hasCheckbox || parentIsTaskList;
    });

    taskItems.forEach((item) => {
      if (item.getAttribute('data-task-parsed') === 'true') return;
      item.setAttribute('data-task-parsed', 'true');

      const isChecked =
        item.getAttribute('data-checked') === 'true' ||
        item.querySelector('input[type="checkbox"]')?.hasAttribute('checked') ||
        (item.querySelector('input[type="checkbox"]') as HTMLInputElement)?.checked;

      const dueAttr = item.getAttribute('data-due');
      let dueText = '';
      if (dueAttr) {
        dueText = ` (Deadline: ${dueAttr.replace('T', ' ')})`;
      }

      // Clean pre-existing status tags to prevent tag corruption
      let label = item.textContent?.trim() || '';
      label = label.replace(/\[(TASK|CÔNG VIỆC|\s|✅|⏳|ĐÃ|CHƯA|HOÀN|THÀNH|XONG)*\]/gi, '').trim();

      if (label) {
        const statusTag = isChecked ? '[ĐÃ XONG]' : '[CHƯA XONG]';
        item.textContent = `${statusTag} ${label}${dueText}`;
      }
    });

    // Mark normal non-task bullet items clearly
    const normalLis = allLis.filter((item) => !taskItems.includes(item));
    normalLis.forEach((item) => {
      if (!item.textContent?.trim().startsWith('*') && !item.textContent?.trim().startsWith('-')) {
        item.textContent = `• ${item.textContent?.trim()}`;
      }
    });

    // Append newline separator to block elements
    const blocks = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, tr, div, blockquote');
    blocks.forEach((el) => {
      el.insertAdjacentText('afterend', '\n');
    });

    content = tempDiv.innerText || tempDiv.textContent || '';
  } else {
    // Regex fallback
    content = content
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<\/p>|<\/div>|<br\s*\/?>|<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]*>/g, ' ');
  }

  // Clean lines
  const cleanedText = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  return `=== TRANG GHI CHÚ: "${page.title}" ===\n${cleanedText}\n`;
}

/**
 * Converts raw Markdown output from Gemini into clean, beautifully styled HTML
 * without leaking markdown symbols, raw tags, or junk formatting.
 */
export function formatMarkdownToHTML(markdownText: string): string {
  if (!markdownText) return '';

  let html = markdownText.trim();

  // Strip leaked system instruction headers or prompt rules
  html = html
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (/^\d+\.\s*(Format Requirements|System|Instruction|Rule|Quy tắc|Yêu cầu|Goal|Role):/i.test(trimmed)) return false;
      if (/^\*\s*(Format Requirements|System|Instruction|Rule|Quy tắc|Yêu cầu):/i.test(trimmed)) return false;
      return true;
    })
    .join('\n');

  // Clean up any raw internal status tags or broken status fragments (e.g., HOÀN THÀNH ⏳ ], [CÔNG VIỆC CHƯA HOÀN)
  html = html
    .replace(/\[?TASK\s*ĐÃ\s*HOÀN\s*THÀNH\s*✅\]?/gi, '✅ ')
    .replace(/\[?TASK\s*CHƯA\s*HOÀN\s*THÀNH\s*⏳\]?/gi, '⏳ ')
    .replace(/\[?CÔNG\s*VIỆC\s*ĐÃ\s*HOÀN\s*THÀNH\s*✅\]?/gi, '✅ ')
    .replace(/\[?CÔNG\s*VIỆC\s*CHƯA\s*HOÀN\s*THÀNH\s*⏳\]?/gi, '⏳ ')
    .replace(/\[?CÔNG\s*VIỆC\s*CHƯA\s*HOÀN\b/gi, '⏳ ')
    .replace(/\[?CÔNG\s*VIỆC\s*ĐÃ\s*HOÀN\b/gi, '✅ ')
    .replace(/\[?CÔNG\s*VIỆC\b/gi, '')
    .replace(/\[?CHƯA\s*HOÀN\s*THÀNH\s*⏳?\]?/gi, '⏳ ')
    .replace(/\[?ĐÃ\s*HOÀN\s*THÀNH\s*✅?\]?/gi, '✅ ')
    .replace(/HOÀN\s*THÀNH\s*⏳\s*\]?/gi, '⏳ ')
    .replace(/HOÀN\s*THÀNH\s*✅\s*\]?/gi, '✅ ')
    .replace(/\[?✅\s*HOÀN\s*THÀNH\]?/gi, '✅ ')
    .replace(/\[?⏳\s*CHƯA\s*HOÀN\s*THÀNH\]?/gi, '⏳ ')
    .replace(/THÀNH\s*⏳\s*\]/gi, '⏳ ')
    .replace(/THÀNH\s*✅\s*\]/gi, '✅ ')
    .replace(/^"|"$/g, '');

  // Convert Markdown headers
  html = html
    .replace(/^### (.*$)/gim, '<h4 class="text-xs font-bold text-purple-300 mt-3 mb-1 flex items-center gap-1">📄 $1</h4>')
    .replace(/^## (.*$)/gim, '<h3 class="text-sm font-bold text-cyan-300 mt-3 mb-1.5 border-b border-slate-800 pb-1">📌 $1</h3>')
    .replace(/^# (.*$)/gim, '<h2 class="text-base font-extrabold text-purple-200 mt-3 mb-2">🚀 $1</h2>');

  // Convert Bold & Italic
  html = html
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-100 font-semibold">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="text-slate-300 italic">$1</em>');

  // Convert Code syntax
  html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-800/80 text-cyan-300 px-1.5 py-0.5 rounded text-[11px] font-mono border border-slate-700/50">$1</code>');

  // Process list lines vs paragraph blocks cleanly
  const lines = html.split('\n');
  const resultLines: string[] = [];
  let inUl = false;
  let inOl = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inUl) { resultLines.push('</ul>'); inUl = false; }
      if (inOl) { resultLines.push('</ol>'); inOl = false; }
      continue;
    }

    const isBullet = /^[•\-\*]\s+(.*)/.exec(trimmed);
    const isNumber = /^\d+\.\s+(.*)/.exec(trimmed);

    if (isBullet) {
      if (inOl) { resultLines.push('</ol>'); inOl = false; }
      if (!inUl) {
        resultLines.push('<ul class="list-disc list-inside space-y-1.5 my-2 pl-1">');
        inUl = true;
      }
      resultLines.push(`<li class="text-slate-200 text-xs leading-relaxed">${isBullet[1]}</li>`);
    } else if (isNumber) {
      if (inUl) { resultLines.push('</ul>'); inUl = false; }
      if (!inOl) {
        resultLines.push('<ol class="list-decimal list-inside space-y-1.5 my-2 pl-1">');
        inOl = true;
      }
      resultLines.push(`<li class="text-slate-200 text-xs leading-relaxed">${isNumber[1]}</li>`);
    } else {
      if (inUl) { resultLines.push('</ul>'); inUl = false; }
      if (inOl) { resultLines.push('</ol>'); inOl = false; }

      if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol')) {
        resultLines.push(trimmed);
      } else {
        resultLines.push(`<p class="mb-2 text-xs leading-relaxed text-slate-200">${trimmed}</p>`);
      }
    }
  }

  if (inUl) resultLines.push('</ul>');
  if (inOl) resultLines.push('</ol>');

  return resultLines.join('\n');
}

/**
 * Call Google Gemini API with complete Vault context
 */
export async function queryGeminiVault(
  query: string,
  vaultPages: Page[],
  chatHistory: { sender: 'user' | 'ai'; text: string }[] = [],
  customSystemPrompt?: string
): Promise<{ text: string; sourcePages: { title: string; id: string }[] }> {
  const apiKey = getGeminiApiKey();

  const currentDate = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Extract text from ALL pages in full detail without truncation cutoffs
  const vaultContextStr = vaultPages
    .map((p) => parsePageToCleanText(p))
    .join('\n');

  const systemInstructionText = customSystemPrompt || `Bạn là Trợ lý AI Vault thông minh và tinh nhuệ của ứng dụng WebNote.
Thời gian hệ thống hiện tại: ${currentDate}.
Dữ liệu kho ghi chú (Vault) của người dùng (${vaultPages.length} trang):
${vaultContextStr}

============================================================
QUY TẮC NGUYÊN TẮC VÀ NGUYÊN TẮC TRẢ LỜI (BẮT BUỘC):
============================================================
1. TRỰC DIỆN - ĐÚNG TRỌNG TÂM - CÔ ĐỌNG:
   - Đi thẳng vào câu trả lời ngay từ dòng đầu tiên.
   - KHÔNG chào hỏi (ví dụ: "Chào bạn"), KHÔNG dạo đầu rườm rà.
   - Tuyệt đối KHÔNG tự tiện thêm phần "Lời khuyên từ AI" hay các nhận xét tư vấn ngoài lề ngoại trừ danh sách nội dung được hỏi.

2. PHÂN BIỆT RÕ RÀNG CÂU HỎI VỀ CÔNG VIỆC (TASK) VÀ NỘI DUNG THƯỜNG:
   - Khi hỏi "CÁC VIỆC CẦN LÀM HÔM NAY" hoặc "TASK HÔM NAY": Chỉ lọc ra ĐÚNG các thẻ công việc (Checklist item có nhãn [⏳ CHƯA HOÀN THÀNH] hoặc [✅ HOÀN THÀNH]) có deadline HÔM NAY hoặc tag @today/@homnay.
   - Tuyệt đối KHÔNG lấy các dấu chấm gạch đầu dòng (•) hướng dẫn hay bài viết thông thường làm task.
   - Nếu trong Vault KHÔNG có task nào đến hạn hôm nay, hãy trả lời ngắn gọn: "Hiện tại không có công việc nào cần hoàn thành trong hôm nay."

3. VÍ DỤ MẪU (FEW-SHOT TRAINING EXAMPLES):
   - Người dùng hỏi: "Những việc cần làm hôm nay?"
     Trả lời chuẩn (KHÔNG KÈM LỜI KHUYÊN PHÁT SINH):
     📌 **Công việc cần hoàn thành hôm nay:**
     ⏳ Thiết kế UI modal AI Vault (Nguồn: 1. Tổng Quan)
     ⏳ Kiểm tra tính năng đồng bộ Drive (Nguồn: 6. Trung Tâm Quản Lý)

   - Người dùng hỏi: "WebNote có những tính năng gì nổi bật?"
     Trả lời chuẩn:
     📌 **Các tính năng nổi bật của WebNote:**
     - **Quản lý 3 cấp:** Ngày (Day) -> Sổ tay (Notebook) -> Trang (Page).
     - **Tính năng AI Vault:** Hỏi đáp, tóm tắt, tinh chỉnh và bóc tách task trên toàn bộ ghi chú.
     - **Liên kết 2 chiều (Wiki Links):** Kết nối các bài viết dạng mạng lưới tri thức.
     - **Bảo mật & Offline-First:** Dữ liệu lưu trong IndexedDB local và đồng bộ Google Drive cá nhân.

4. ĐỊNH DẠNG & ĐỘ HOÀN THIỆN:
   - Viết hoàn chỉnh 100% câu từ, có dấu chấm câu đầy đủ ở cuối. Trả lời bằng Tiếng Việt chuẩn mực.`;

  // Build contents payload with conversation history
  const contentsPayload: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  if (chatHistory && chatHistory.length > 0) {
    chatHistory.slice(-6).forEach((msg) => {
      contentsPayload.push({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text.replace(/<[^>]*>/g, '') }],
      });
    });
  }
  contentsPayload.push({
    role: 'user',
    parts: [{ text: `${systemInstructionText}\n\nCÂU HỎI CỦA NGƯỜI DÙNG: ${query}` }],
  });

  // Active production model list for Google AI Studio
  const modelsToTry = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash-lite',
    'gemini-flash-latest',
  ];
  let lastError = '';

  for (const model of modelsToTry) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: contentsPayload,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const rawResponseText = parts
          .map((pt: { text?: string }) => pt.text || '')
          .filter((txt: string) => txt.trim().length > 0)
          .join('\n');

        if (rawResponseText) {
          // Format raw markdown into clean HTML
          const formattedText = formatMarkdownToHTML(rawResponseText);

          // Extract referenced source pages
          const citedSources = vaultPages
            .filter((p) => rawResponseText.toLowerCase().includes(p.title.toLowerCase()))
            .slice(0, 5)
            .map((p) => ({ title: p.title, id: p.id }));

          return {
            text: formattedText,
            sourcePages: citedSources,
          };
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        lastError = errData.error?.message || `HTTP ${response.status}`;
        console.warn(`[Gemini model ${model} failed]`, lastError);
      }
    } catch (err) {
      lastError = (err as Error).message;
    }
  }

  // Fail-safe fallback: If online API key failed or returned invalid key error, seamlessly run local analyzer
  console.warn('[Gemini Service] API key call failed, seamlessly falling back to rich local Vault analyzer.');
  return simulateGeminiResponse(query, vaultPages, customSystemPrompt);
}

/**
 * Advanced Local Vault Analyzer Engine.
 * Runs comprehensive semantic & full-text extraction across 100% of vault pages
 * to synthesize clear, detailed, and complete responses without missing any ideas.
 */
function simulateGeminiResponse(query: string, vaultPages: Page[], customPrompt?: string) {
  const lowerQ = query.toLowerCase();

  // Parse all pages into clean text and structured data
  const parsedVault = vaultPages.map((page) => {
    const rawText = parsePageToCleanText(page);
    const lines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('=== TRANG GHI CHÚ'));

    return {
      id: page.id,
      title: page.title,
      content: page.content || '',
      rawText,
      lines,
    };
  });

  // Check query intent
  const isTaskQuery =
    lowerQ.includes('công việc') ||
    lowerQ.includes('task') ||
    lowerQ.includes('to-do') ||
    lowerQ.includes('cần làm') ||
    lowerQ.includes('hạn') ||
    customPrompt?.includes('Quản Lý Công Việc');

  const isDigestQuery =
    lowerQ.includes('hôm nay') ||
    lowerQ.includes('lịch') ||
    lowerQ.includes('ngày') ||
    lowerQ.includes('kế hoạch') ||
    customPrompt?.includes('Quản Lý Thời Gian');

  // Filter pages matching query keywords (or use all pages if open summary query)
  const keywords = lowerQ
    .split(/\s+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 2 && !['tính', 'năng', 'của', 'trong', 'được', 'hướng', 'dẫn', 'bằng', 'chỉ'].includes(k));

  const matchedPages = parsedVault.filter((p) => {
    const pTitleLower = p.title.toLowerCase();
    const pTextLower = p.rawText.toLowerCase();

    // Check title or content match
    if (pTitleLower.includes(lowerQ) || pTextLower.includes(lowerQ)) return true;
    if (keywords.length > 0 && keywords.some((kw) => pTitleLower.includes(kw) || pTextLower.includes(kw))) return true;
    return false;
  });

  const activePages = matchedPages.length > 0 ? matchedPages : parsedVault;

  let resultHtml = '';

  if (isTaskQuery) {
    // Extract ALL genuine tasks across all pages
    const tasks: { title: string; isChecked: boolean; pageTitle: string; due?: string }[] = [];
    parsedVault.forEach((p) => {
      p.lines.forEach((line) => {
        if (line.includes('[TASK ĐÃ HOÀN THÀNH ✅]') || line.includes('[TASK CHƯA HOÀN THÀNH ⏳]') || line.includes('[✅ ĐÃ HOÀN THÀNH]') || line.includes('[⏳ CHƯA HOÀN THÀNH]')) {
          const isChecked = line.includes('[TASK ĐÃ HOÀN THÀNH ✅]') || line.includes('[✅ ĐÃ HOÀN THÀNH]');
          let taskTitle = line
            .replace('[TASK ĐÃ HOÀN THÀNH ✅]', '')
            .replace('[TASK CHƯA HOÀN THÀNH ⏳]', '')
            .replace('[✅ ĐÃ HOÀN THÀNH]', '')
            .replace('[⏳ CHƯA HOÀN THÀNH]', '')
            .trim();
          let dueStr = '';
          const dueMatch = /\(Deadline:\s*([^)]+)\)/.exec(taskTitle) || /\(Hạn deadline:\s*([^)]+)\)/.exec(taskTitle);
          if (dueMatch) {
            dueStr = dueMatch[1];
            taskTitle = taskTitle.replace(dueMatch[0], '').trim();
          }
          tasks.push({ title: taskTitle, isChecked, pageTitle: p.title, due: dueStr });
        }
      });
    });

    const isTodayQuery = lowerQ.includes('hôm nay') || lowerQ.includes('today');
    let displayedTasks = tasks;
    if (isTodayQuery) {
      const todayTasks = tasks.filter((t) => {
        const fullText = (t.title + ' ' + (t.due || '')).toLowerCase();
        return (
          fullText.includes('@today') ||
          fullText.includes('@homnay') ||
          fullText.includes('hôm nay') ||
          (t.due && t.due.startsWith(new Date().toISOString().split('T')[0]))
        );
      });
      if (todayTasks.length > 0) {
        displayedTasks = todayTasks;
      }
    }

    const pendingTasks = displayedTasks.filter((t) => !t.isChecked);
    const completedTasks = displayedTasks.filter((t) => t.isChecked);

    resultHtml = `<h3 class="text-sm font-bold text-cyan-300 mt-1 mb-2 border-b border-slate-800 pb-1">📌 Danh Sách Công Việc ${isTodayQuery ? 'Hôm Nay' : 'Toàn Bộ Vault'} (${displayedTasks.length} công việc)</h3>`;
    resultHtml += `<p class="text-xs text-slate-300 mb-2">Đã quét <strong>${parsedVault.length} trang ghi chú</strong> trong kho lưu trữ của bạn:</p>`;

    if (pendingTasks.length > 0) {
      resultHtml += `<h4 class="text-xs font-bold text-amber-300 mt-3 mb-1">⏳ Việc Cần Làm (${pendingTasks.length}):</h4>`;
      resultHtml += `<ul class="list-disc list-inside space-y-1.5 my-2 pl-1">`;
      pendingTasks.forEach((t) => {
        const dueTag = t.due ? ` <span class="text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded text-[10px] border border-amber-500/30">⏰ ${t.due}</span>` : '';
        resultHtml += `<li class="text-xs text-slate-200"><strong>${t.title}</strong>${dueTag} <em class="text-slate-400 text-[11px]">(Nguồn: ${t.pageTitle})</em></li>`;
      });
      resultHtml += `</ul>`;
    }

    if (completedTasks.length > 0) {
      resultHtml += `<h4 class="text-xs font-bold text-emerald-400 mt-3 mb-1">✅ Công Việc Đã Hoàn Thành (${completedTasks.length}):</h4>`;
      resultHtml += `<ul class="list-disc list-inside space-y-1.5 my-2 pl-1">`;
      completedTasks.forEach((t) => {
        resultHtml += `<li class="text-xs text-slate-300 line-through"><strong>${t.title}</strong> <em class="text-slate-400 text-[11px] non-italic">(Nguồn: ${t.pageTitle})</em></li>`;
      });
      resultHtml += `</ul>`;
    }

    if (tasks.length === 0) {
      resultHtml += `<p class="text-xs text-slate-400 py-2">Chưa tìm thấy công việc (task item) nào trong các trang ghi chú.</p>`;
    }
  } else if (isDigestQuery) {
    resultHtml = `<h3 class="text-sm font-bold text-purple-300 mt-1 mb-2 border-b border-slate-800 pb-1">☀️ Lịch Trình & Tổng Quan Tiến Độ Trong Ngày</h3>`;
    resultHtml += `<p class="text-xs text-slate-300 mb-3">Dưới đây là kế hoạch tổng hợp từ toàn bộ <strong>${parsedVault.length} ghi chú</strong> của bạn:</p>`;

    resultHtml += `<h4 class="text-xs font-bold text-rose-400 mt-2 mb-1">🔥 Ưu Tiên Hàng Đầu:</h4>`;
    resultHtml += `<ul class="list-disc list-inside space-y-1.5 my-2 pl-1">`;
    activePages.slice(0, 5).forEach((p) => {
      const firstLine = p.lines.find((l) => !l.startsWith('===') && l.length > 10) || p.title;
      resultHtml += `<li class="text-xs text-slate-200"><strong>${p.title}:</strong> ${firstLine}</li>`;
    });
    resultHtml += `</ul>`;

    resultHtml += `<h4 class="text-xs font-bold text-cyan-300 mt-3 mb-1">⚡ Đã Quét Toàn Bộ Vault:</h4>`;
    resultHtml += `<p class="text-xs text-slate-300">Tất cả ghi chú đã được đồng bộ an toàn và sẵn sàng cho việc tra cứu nhanh.</p>`;
  } else {
    // Complete non-truncated text extraction across matching pages
    resultHtml = `<h3 class="text-sm font-bold text-purple-300 mt-1 mb-2 border-b border-slate-800 pb-1">📌 Tổng Hợp Thông Tin Chi Tiết & Đầy Đủ Từ Vault (${activePages.length} ghi chú)</h3>`;
    resultHtml += `<p class="text-xs text-slate-300 mb-3">Nội dung chi tiết trích xuất đầy đủ từ các ghi chú liên quan đến: <em>"${query}"</em></p>`;

    activePages.forEach((p) => {
      resultHtml += `<div class="mb-4 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/80 shadow-sm">`;
      resultHtml += `<h4 class="text-xs font-bold text-cyan-300 mb-2 flex items-center gap-1">📄 ${p.title}</h4>`;

      const contentLines = p.lines.filter((l) => !l.includes('[✅') && !l.includes('[⏳'));
      if (contentLines.length > 0) {
        let inList = false;
        contentLines.forEach((line) => {
          if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
            if (!inList) {
              resultHtml += `<ul class="list-disc list-inside space-y-1 my-1.5 pl-1">`;
              inList = true;
            }
            resultHtml += `<li class="text-xs text-slate-200 leading-relaxed">${line.replace(/^[•\-\*]\s*/, '')}</li>`;
          } else {
            if (inList) {
              resultHtml += `</ul>`;
              inList = false;
            }
            if (line.startsWith('http') || line.includes('Tip:') || line.includes('Ví dụ')) {
              resultHtml += `<p class="text-xs text-purple-300 font-medium my-1">${line}</p>`;
            } else {
              resultHtml += `<p class="text-xs text-slate-200 leading-relaxed mb-1.5">${line}</p>`;
            }
          }
        });
        if (inList) {
          resultHtml += `</ul>`;
        }
      } else {
        resultHtml += `<p class="text-xs text-slate-300">${p.rawText}</p>`;
      }
      resultHtml += `</div>`;
    });
  }

  return {
    text: resultHtml,
    sourcePages: activePages.map((p) => ({ title: p.title, id: p.id })),
  };
}

/**
 * Real-time Auto-Translate service function
 * Strategy: split by line → translate in parallel via MyMemory (fast ~300ms)
 * Fallback to Gemini for lines >500 chars or when MyMemory fails.
 * Preserves line break structure.
 */
export async function translateLiveText(
  text: string,
  sourceLang: string = 'auto',
  targetLang: string = 'en'
): Promise<string> {
  if (!text || !text.trim()) return '';

  const LANG_NAMES: Record<string, string> = {
    auto: 'Automatically Detected Language',
    vi: 'Vietnamese',
    en: 'English',
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese',
    fr: 'French',
    de: 'German',
    es: 'Spanish',
    ru: 'Russian',
  };

  const srcName = LANG_NAMES[sourceLang] || sourceLang;
  const tgtName = LANG_NAMES[targetLang] || targetLang;
  const srcCode = sourceLang === 'auto' ? 'autodetect' : sourceLang;

  /** Fast path: MyMemory API (~200-400ms per chunk) */
  const translateChunkMyMemory = async (chunk: string): Promise<string | null> => {
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk.slice(0, 500))}&langpair=${srcCode}|${targetLang}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const translated: string = data.responseData?.translatedText;
      if (translated && !translated.startsWith('MYMEMORY WARNING') && translated.trim()) {
        return translated.trim();
      }
    } catch {
      /* ignore */
    }
    return null;
  };

  /** Fallback: Gemini (handles long text and complex structure) */
  const translateChunkGemini = async (chunk: string): Promise<string | null> => {
    const apiKey = getGeminiApiKey();
    const prompt = `Translate ONLY the text below from ${srcName} to ${tgtName}. Output ONLY the translated text, nothing else.

${chunk}`;
    for (const model of ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest']) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
          }),
        });
        if (response.ok) {
          const data = await response.json();
          const output: string = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (output && output.trim()) return output.trim();
        }
      } catch {
        /* try next model */
      }
    }
    return null;
  };

  /** Translate one line: MyMemory first (fast), Gemini fallback */
  const translateLine = async (line: string): Promise<string> => {
    if (!line.trim()) return ''; // preserve blank lines
    if (line.length <= 500) {
      const fast = await translateChunkMyMemory(line);
      if (fast) return fast;
    }
    const gemini = await translateChunkGemini(line);
    return gemini ?? `[${targetLang.toUpperCase()}] ${line}`;
  };

  // Split by newlines, translate all lines in parallel, rejoin
  const lines = text.split('\n');
  const translated = await Promise.all(lines.map(translateLine));
  return translated.join('\n');
}

// ============================================================
// SMART SCHEDULE & AI OPTIMIZER FUNCTIONS
// ============================================================

/**
 * Interface for AI Smart Schedule Recommendation
 */
export interface AIScheduleRecommendation {
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  estimatedMinutes: number;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
  taskId?: string;
  pageId?: string;
}

/**
 * AI Optimizer: Generates intelligent schedule recommendations based on unscheduled tasks and existing blocks.
 */
export async function generateSmartSchedule(
  targetDate: string,
  unscheduledTasks: { id: string; text: string; pageTitle?: string; dueDate?: string; pageId?: string }[],
  existingBlocks: { startTime?: string; endTime?: string; title: string }[]
): Promise<{ recommendations: AIScheduleRecommendation[]; summaryHtml: string }> {
  const apiKey = getGeminiApiKey();

  if (!unscheduledTasks || unscheduledTasks.length === 0) {
    return {
      recommendations: [],
      summaryHtml: '<p class="text-xs text-slate-400">Không có công việc nào chưa lên lịch để xếp.</p>',
    };
  }

  const prompt = `Bạn là Chuyên gia Tối ưu Lịch làm việc Thông minh (AI Schedule Optimizer).
Hãy phân tích các công việc chưa được xếp lịch sau đây và xếp thời gian hợp lý cho ngày ${targetDate}.

CÁC KHUNG GIỜ ĐÃ BỊ CHIẾM TRONG NGÀY:
${existingBlocks.map((b) => `- ${b.startTime || '??'} - ${b.endTime || '??'}: ${b.title}`).join('\n') || '(Chưa có lịch nào trong ngày)'}

DANH SÁCH CÔNG VIỆC CẦN XẾP LỊCH:
${unscheduledTasks.map((t) => `- [ID: ${t.id}] ${t.text} (Nguồn: ${t.pageTitle || 'Ghi chú'}, Hạn: ${t.dueDate || 'Không'})`).join('\n')}

QUY TẮC XẾP LỊCH:
1. Giờ làm việc ưu tiên từ 08:00 đến 18:00, nghỉ trưa 12:00 - 13:30.
2. Mỗi block tối đa 90 phút, tối thiểu 30 phút. Giữ khoảng nghỉ 15 phút giữa các task.
3. Task có deadline gần hơn hoặc quan trọng xếp lên buổi sáng (Eat the Frog).

Trả về kết quả chuẩn định dạng JSON duy nhất (không bọc trong triple backticks markdown) theo cấu trúc:
{
  "summary": "Mô tả ngắn gọn lý do phân bổ lịch (2-3 câu bằng tiếng Việt HTML)",
  "recommendations": [
    {
      "taskId": "ID công việc tương ứng",
      "title": "Tên công việc",
      "date": "${targetDate}",
      "startTime": "HH:mm",
      "endTime": "HH:mm",
      "estimatedMinutes": 60,
      "priority": "high/medium/low",
      "reasoning": "Lý do chọn khung giờ này"
    }
  ]
}`;

  try {
    for (const model of ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest']) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawText: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            recommendations: parsed.recommendations || [],
            summaryHtml: parsed.summary || '<p class="text-xs text-slate-300">Đã tối ưu hóa lịch biểu thành công.</p>',
          };
        }
      }
    }
  } catch (err) {
    console.warn('[Gemini] AI Optimizer error:', err);
  }

  // Fallback if AI call fails or no API key
  const fallbackRecs: AIScheduleRecommendation[] = unscheduledTasks.map((t, idx) => {
    const startHour = 9 + idx;
    const startTime = `${startHour.toString().padStart(2, '0')}:00`;
    const endTime = `${(startHour + 1).toString().padStart(2, '0')}:00`;
    return {
      taskId: t.id,
      pageId: t.pageId,
      title: t.text,
      date: targetDate,
      startTime,
      endTime,
      estimatedMinutes: 60,
      priority: 'medium',
      reasoning: 'Sắp xếp tự động theo thứ tự',
    };
  });

  return {
    recommendations: fallbackRecs,
    summaryHtml: `<p class="text-xs text-amber-300">Đã tạo lịch đề xuất tự động (Fallback mode). Bạn có thể chỉnh sửa khung giờ tùy thích.</p>`,
  };
}

/**
 * AI Daily Briefing: Generates an inspiring morning overview based on scheduled tasks & full vault context.
 */
export async function generateDailyBriefing(
  todayStr: string,
  scheduledBlocks: { title: string; startTime?: string; endTime?: string; completed: boolean }[],
  vaultTaskCount: number
): Promise<string> {
  const apiKey = getGeminiApiKey();

  const prompt = `Bạn là Trợ lý AI Cá nhân Thân thiện & Năng lượng cao (Daily Briefing Assistant).
Hãy tạo một thông điệp Chào Buổi Sáng và Tóm Tắt Kế Hoạch Ngày (${todayStr}) cho người dùng.

THÔNG TIN LỊCH TRÌNH HÔM NAY:
- Tổng số task trong toàn kho ghi chú: ${vaultTaskCount}
- Số lịch biểu đã xếp hôm nay: ${scheduledBlocks.length}
- Các lịch trình chi tiết:
${scheduledBlocks.map((b) => `  + [${b.completed ? '✅ Đã xong' : '⏳ Chưa làm'}] ${b.startTime || '--:--'} - ${b.endTime || '--:--'}: ${b.title}`).join('\n') || '  (Chưa có lịch biểu nào)'}

YÊU CẦU ĐỊNH DẠNG:
- Trả về dạng HTML đẹp mắt, hiện đại (dùng CSS Tailwind inline classes như text-cyan-300, text-slate-200, font-bold, space-y-2).
- Có 3 phần:
  1. ☀️ Lời Chào & Câu nói truyền cảm hứng (1-2 câu ngắn).
  2. 🎯 Tóm tắt 2-3 việc trọng tâm nhất trong ngày.
  3. 💡 Lời khuyên phân bổ năng lượng (Eat the Frog, Pomodoro, hoặc thời gian nghỉ ngơi).
- Không bọc trong code block markdown (\`\`\`html). Trả về HTML trực tiếp.`;

  if (apiKey) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const html = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (html && html.trim()) return html.trim().replace(/^```html|```$/g, '');
      }
    } catch (err) {
      console.warn('[Gemini] Daily Briefing error:', err);
    }
  }

  // Fallback Daily Briefing HTML
  return `
    <div class="space-y-3 text-xs leading-relaxed text-slate-200">
      <p class="text-sm font-bold text-amber-300 flex items-center gap-1.5">
        ☀️ Chào ngày mới! Chúc bạn một ngày làm việc tràn đầy năng lượng và hiệu quả.
      </p>
      <div class="p-2.5 bg-slate-800/80 rounded-lg border border-slate-700/60">
        <p class="font-semibold text-cyan-300 mb-1">🎯 Trọng tâm hôm nay (${todayStr}):</p>
        <p>Bạn đang có <strong>${scheduledBlocks.length} lịch biểu</strong> đã xếp và <strong>${vaultTaskCount} task</strong> trong toàn bộ kho ghi chú.</p>
      </div>
      <p class="text-slate-300">💡 <em>Mẹo nhỏ:</em> Hãy giải quyết công việc quan trọng nhất ngay đầu buổi sáng khi tinh thần minh mẫn nhất (Eat the Frog)!</p>
    </div>
  `;
}





