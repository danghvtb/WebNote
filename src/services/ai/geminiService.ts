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
      const cleanContent = p.content ? p.content.replace(/<[^>]*>/g, ' ').slice(0, 1500) : '(Trống)';
      return `--- GHI CHÚ: "${p.title}" (ID: ${p.id}) ---\n${cleanContent}\n`;
    })
    .join('\n');

  const systemInstruction = `Bạn là Trợ lý AI Vault thông minh tích hợp trong ứng dụng WebNote (Google Gemini 1.5).
Thời điểm hiện tại hệ thống: ${currentDate}.
Dưới đây là TOÀN BỘ KHO GHI CHÚ (VAULT) hiện có của người dùng gồm ${vaultPages.length} trang ghi chú:

================ KHO GHI CHÚ (VAULT) ================
${vaultContextStr}
=====================================================

NHIỆM VỤ CỦA BẠN:
1. Đọc và suy luận sâu sắc trên toàn bộ ghi chú ở trên để trả lời câu hỏi của người dùng một cách chuẩn xác, thông minh và hữu ích nhất.
2. Trả lời bằng Tiếng Việt thân thiện, rõ ràng, định dạng Markdown (dùng **in đậm**, <ul><li> danh sách, <code> mã code nếu có).
3. Nếu câu hỏi liên quan đến ngày tháng, thời gian hiện tại, hãy dùng ngày hệ thống (${currentDate}).
4. Khi trích xuất thông tin từ ghi chú nào, hãy ghi rõ tên ghi chú đó.`;

  // Build request messages array for Gemini REST API
  const contents: GeminiMessage[] = [];

  // Add past conversation turns
  chatHistory.slice(-6).forEach((msg) => {
    contents.push({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text.replace(/<[^>]*>/g, '') }],
    });
  });

  // Add final query with system prompt attached if no API key or to enforce system instruction
  const fullPrompt = `${systemInstruction}\n\nCÂU HỎI CỦA NGUỜI DÙNG: ${query}`;
  
  contents.push({
    role: 'user',
    parts: [{ text: fullPrompt }],
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
                contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
              }),
            });

            if (response.ok) {
              const data = await response.json();
              const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (candidateText) {
                const citedSources = vaultPages
                  .filter((p) => candidateText.toLowerCase().includes(p.title.toLowerCase()))
                  .slice(0, 4)
                  .map((p) => ({ title: p.title, id: p.id }));

                return {
                  text: candidateText.replace(/\n/g, '<br/>'),
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
