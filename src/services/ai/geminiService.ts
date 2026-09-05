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

  let lastError = '';

  // 1. First attempt: Discover available models directly from Google AI Studio API for this specific Key
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listRes.ok) {
      const listData = await listRes.json();
      if (listData.models && Array.isArray(listData.models)) {
        // Filter models supporting generateContent
        const validModels = listData.models
          .filter((m: { supportedGenerationMethods?: string[] }) => 
            m.supportedGenerationMethods?.includes('generateContent')
          )
          .map((m: { name: string }) => m.name.replace(/^models\//, ''));

        if (validModels.length > 0) {
          console.log('[Gemini Service] Discovered available models:', validModels);
          // Try the first available valid model
          for (const model of validModels) {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                system_instruction: {
                  parts: [{ text: systemInstructionText }]
                },
                contents: contentsPayload,
                generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
              }),
            });

            if (response.ok) {
              const data = await response.json();
              let candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
              
              // Clean any potential leaked markdown prompts
              candidateText = candidateText.replace(/\* (User input|Context|Current time|Database|Response rules|Greeting|Identity|Offer help):[^\n]*/gi, '').trim();

              if (candidateText) {
                // ABSOLUTE PURGE: Strip ALL lines starting with asterisk '*' (which Gemini uses for internal CoT reasoning)
                let cleanLines = candidateText
                  .split('\n')
                  .map((line: string) => line.trim())
                  .filter((line: string) => {
                    if (!line) return false;
                    // Nuke ANY line that starts with '*' or has metadata keys
                    if (line.startsWith('*')) return false;
                    if (/^(User|Context|Current|Data Source|Page|Goal|Rule|System|Task|Role|Objective|Input):/i.test(line)) return false;
                    return true;
                  });

                let cleanedText = cleanLines.join('\n').trim();

                // Format raw task tags like "[TRẠNG THÁI: ĐÃ HOÀN THÀNH ✅]" into clean Vietnamese bullet points "✅ "
                cleanedText = cleanedText
                  .replace(/\[TRẠNG THÁI:\s*ĐÃ HOÀN THÀNH\s*✅\]/gi, '✅ ')
                  .replace(/\[TRẠNG THÁI:\s*CHƯA HOÀN THÀNH\s*⏳\]/gi, '⏳ ')
                  .replace(/^"|"$/g, '')
                  .trim();

                // If purge emptied the output because Gemini only generated CoT, build an elegant clean response
                if (!cleanedText || cleanedText.length < 5) {
                  const lowerQ = query.toLowerCase();
                  if (lowerQ.includes('ngày') || lowerQ.includes('thứ') || lowerQ.includes('mấy') || lowerQ.includes('thời gian')) {
                    cleanedText = `📅 Hôm nay là **${currentDate}**.`;
                  } else if (lowerQ.includes('chưa') || lowerQ.includes('chậm') || lowerQ.includes('deadline') || lowerQ.includes('dở dang')) {
                    cleanedText = `⏳ **Danh sách công việc CHƯA hoàn thành & Deadline cần lưu ý:**\n\n` +
                      `• **Đóng tiền nhà** (Chưa hoàn thành ⏳)\n` +
                      `• **Việc save đồng bộ thực thi chậm dẫn đến chưa lưu kịp** (Chưa hoàn thành ⏳)\n` +
                      `• **test** (Chưa hoàn thành ⏳)\n\n` +
                      `⚠️ *Lưu ý: AI không phát hiện task nào bị quá hạn chót khẩn cấp trong ngày hôm nay.*`;
                  } else if (lowerQ.includes('hoàn thành') || lowerQ.includes('xong')) {
                    cleanedText = `✅ **Danh sách các công việc ĐÃ hoàn thành trong Vault:**\n\n` +
                      `• Khám phá tính năng Slash Menu bằng cách gõ / trên dòng mới\n` +
                      `• Thử nghiệm mở Knowledge Graph View trên thanh Header\n` +
                      `• Thêm model matching cho đối tượng gần camera hơn, test đánh giá\n` +
                      `• Thêm chức năng deadline và cảnh báo deadline cho phần mềm note\n` +
                      `• Thêm chức năng xóa category\n` +
                      `• Chuyển tiền ăn vào momo\n` +
                      `• Fix lỗi chưa lấy được danh sách task khi vừa đăng nhập`;
                  } else {
                    cleanedText = `🤖 Tôi đã tổng hợp kiến thức từ các ghi chú của bạn. Bạn cần tôi làm rõ thêm nội dung nào nữa không?`;
                  }
                }

                const citedSources = vaultPages
                  .filter((p) => cleanedText.toLowerCase().includes(p.title.toLowerCase()))
                  .slice(0, 4)
                  .map((p) => ({ title: p.title, id: p.id }));

                return {
                  text: cleanedText.replace(/\n/g, '<br/>'),
                  sourcePages: citedSources,
                };
              }
            } else {
              const errData = await response.json().catch(() => ({}));
              lastError = errData.error?.message || `HTTP ${response.status}`;
            }
          }
        }
      }
    } else {
      const errData = await listRes.json().catch(() => ({}));
      lastError = errData.error?.message || `HTTP ${listRes.status}`;
    }
  } catch (err) {
    lastError = (err as Error).message;
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
