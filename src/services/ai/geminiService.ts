// ============================================================
// MyNotes — Google Gemini LLM Service
// Connects WebNote to Google Gemini 1.5 Flash/Pro API for Full-Vault AI Intelligence
// ============================================================

import type { Page } from '../../types';

const GEMINI_KEY_STORAGE_KEY = 'mynotes_gemini_api_key';

/**
 * Get stored Gemini API key or fallback to env var
 */
export function getGeminiApiKey(): string {
  const customKey = localStorage.getItem(GEMINI_KEY_STORAGE_KEY);
  if (customKey && customKey.trim()) {
    return customKey.trim();
  }
  return import.meta.env.VITE_GEMINI_API_KEY || '';
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

interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

/**
 * Call Google Gemini 1.5 Flash API with full Vault context
 */
export async function queryGeminiVault(
  query: string,
  vaultPages: Page[],
  chatHistory: { sender: 'user' | 'ai'; text: string }[] = []
): Promise<{ text: string; sourcePages: { title: string; id: string }[] }> {
  const apiKey = getGeminiApiKey();

  // Construct full vault context payload
  const currentDate = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const vaultContextStr = vaultPages
    .map((p) => {
      // Parse HTML to convert checkboxes/tasks into explicit readable format for AI: [HOÀN THÀNH] or [CHƯA HOÀN THÀNH]
      let textContent = p.content || '';
      if (typeof document !== 'undefined' && textContent) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = textContent;

        // Convert task items
        const taskItems = Array.from(tempDiv.querySelectorAll('li[data-type="taskItem"], li'));
        taskItems.forEach((item) => {
          const isChecked = 
            item.getAttribute('data-checked') === 'true' || 
            item.querySelector('input[type="checkbox"]')?.hasAttribute('checked') ||
            (item.querySelector('input[type="checkbox"]') as HTMLInputElement)?.checked;

          const label = item.textContent?.trim() || '';
          if (label) {
            const statusTag = isChecked ? '[TRẠNG THÁI: ĐÃ HOÀN THÀNH ✅]' : '[TRẠNG THÁI: CHƯA HOÀN THÀNH ⏳]';
            item.textContent = `${statusTag} ${label}`;
          }
        });

        textContent = tempDiv.innerText || tempDiv.textContent || textContent.replace(/<[^>]*>/g, ' ');
      } else {
        textContent = textContent.replace(/<[^>]*>/g, ' ');
      }

      return `=== TRANG GHI CHÚ: "${p.title}" (ID: ${p.id}) ===\n${textContent.slice(0, 2000)}\n`;
    })
    .join('\n');

  const systemInstructionText = `Bạn là Trợ lý AI Vault chuyên nghiệp và thông minh của ứng dụng WebNote.
Thời gian hệ thống hiện tại: ${currentDate}.
Dưới đây là TOÀN BỘ KHO GHI CHÚ (VAULT) hiện có của người dùng gồm ${vaultPages.length} trang ghi chú:

${vaultContextStr}

HƯỚNG DẪN TRẢ LỜI CHO BẠN:
1. Khi người dùng hỏi về thời gian/ngày tháng: Trả lời rõ ràng ngày giờ hiện tại (Ví dụ: "Hôm nay là Thứ Bảy, ngày 5 tháng 9 năm 2026").
2. Khi người dùng hỏi về Task (hoàn thành/chưa hoàn thành/chậm deadline): Hãy đọc kỹ các mục "[TRẠNG THÁI: ĐÃ HOÀN THÀNH ✅]" và "[TRẠNG THÁI: CHƯA HOÀN THÀNH ⏳]" từ các trang ghi chú ở trên, sau đó liệt kê chi tiết các công việc kèm tên trang ghi chú trích xuất.
3. Luôn trả lời bằng Tiếng Việt tự nhiên, lịch sự, đầy đủ ý, định dạng Markdown rõ ràng. KHÔNG trả lời cộc lốc 1-2 từ. KHÔNG in ra các từ tiếng Anh rác như "Rule 1", "System prompt".`;

  // Build conversation history
  const contentsPayload: GeminiMessage[] = [];
  chatHistory.slice(-4).forEach((msg) => {
    contentsPayload.push({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text.replace(/<[^>]*>/g, '') }],
    });
  });
  contentsPayload.push({
    role: 'user',
    parts: [{ text: query }],
  });

  // Fallback to internal smart LLM simulator if API key is not configured yet
  if (!apiKey) {
    console.warn('[Gemini Service] No API key found. Falling back to internal Gemini logic simulator.');
    return simulateGeminiResponse(query, vaultPages, currentDate);
  }

  // Direct execution with verified active Google AI Studio models (gemini-3.6-flash, gemini-flash-latest)
  const modelsToTry = [
    'gemini-3.6-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-2.5-pro',
  ];
  let lastError = '';

  for (const model of modelsToTry) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemInstructionText}\n\nCÂU HỎI CỦA NGUỜI DÙNG: ${query}` }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        let candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (candidateText) {
          // Format raw task tags like "[TRẠNG THÁI: ĐÃ HOÀN THÀNH ✅]" into clean Vietnamese bullet points "✅ "
          let finalAnswer = candidateText
            .replace(/\[TRẠNG THÁI:\s*ĐÃ HOÀN THÀNH\s*✅\]/gi, '✅ ')
            .replace(/\[TRẠNG THÁI:\s*CHƯA HOÀN THÀNH\s*⏳\]/gi, '⏳ ')
            .replace(/^"|"$/g, '')
            .trim();

          // Strip any leaked reasoning lines if present
          finalAnswer = finalAnswer
            .split('\n')
            .filter((l: string) => !/^\*\s*(User|Context|Current|Goal|Rule|System|Task|Role|Objective|Input):/i.test(l.trim()))
            .join('\n')
            .trim();

          const citedSources = vaultPages
            .filter((p) => finalAnswer.toLowerCase().includes(p.title.toLowerCase()))
            .slice(0, 4)
            .map((p) => ({ title: p.title, id: p.id }));

          return {
            text: finalAnswer.replace(/\n/g, '<br/>'),
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

  // If all models failed
  return {
    text: `⚠️ <strong>Lỗi kết nối Gemini API:</strong> ${lastError}.<br/><br/>` +
      `💡 <strong>Gợi ý:</strong> Vui lòng kiểm tra lại API Key từ Google AI Studio hoặc đảm bảo API Key đã được cấp quyền "Generative Language API".`,
    sourcePages: [],
  };
}

/**
 * Intelligent Fallback Simulator when API key is missing
 */
function simulateGeminiResponse(query: string, vaultPages: Page[], currentDate: string) {
  const lowerQ = query.toLowerCase();
  
  if (lowerQ.includes('ngày') || lowerQ.includes('thời gian') || lowerQ.includes('mấy giờ') || lowerQ.includes('hôm nay')) {
    return {
      text: `📅 <strong>Hôm nay là:</strong> <strong>${currentDate}</strong>.<br/><br/>Tôi có thể đọc qua ${vaultPages.length} ghi chú để tổng hợp tiến độ hoặc công việc dở dang của bạn!`,
      sourcePages: [],
    };
  }

  const matched = vaultPages.filter(
    (p) => p.title.toLowerCase().includes(lowerQ) || p.content.toLowerCase().includes(lowerQ)
  );

  if (matched.length > 0) {
    const top = matched[0];
    const snippet = top.content.replace(/<[^>]*>/g, ' ').slice(0, 200);
    return {
      text: `🤖 <strong>Trợ lý Gemini Vault (Chế độ xem trước):</strong><br/><br/>` +
        `Tìm thấy <strong>${matched.length} ghi chú</strong> liên quan trong kho dữ liệu của bạn.<br/>` +
        `• <strong>${top.title}</strong>: <em>"${snippet}..."</em><br/><br/>` +
        `🔑 <em>Lưu ý: Nhập Gemini API Key trong Cài Đặt để kích hoạt Gemini 1.5 Pro suy luận toàn bộ câu hỏi linh hoạt!</em>`,
      sourcePages: matched.slice(0, 3).map((p) => ({ title: p.title, id: p.id })),
    };
  }

  return {
    text: `🤖 <strong>Trợ lý Gemini Vault:</strong><br/><br/>` +
      `Tôi đã quét qua <strong>${vaultPages.length} trang ghi chú</strong> trong Vault. Để AI suy luận tự do cho các câu hỏi mở bất kỳ, bạn hãy dán <strong>Gemini API Key</strong> vào Cài Đặt (Settings) nhé!`,
    sourcePages: [],
  };
}
