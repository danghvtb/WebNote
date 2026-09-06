// ============================================================
// MyNotes 3.0 — Full Vault AI Chat Assistant & Copilot
// Smart AI Assistant that answers questions across ALL notes in your vault!
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, FileText, CheckSquare, RefreshCw, Wand2, Send, MessageSquare, Database, Bot, User } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { getAllVaultPages } from '../../services/database/repository';
import { queryGeminiVault } from '../../services/ai/geminiService';
import { queueSync } from '../../services/sync/syncManager';
import type { Page } from '../../types';

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  sourceNotes?: { title: string; id: string }[];
}

export function AIModal({ isOpen, onClose }: AIModalProps) {
  const { selectedPageId, pages, updatePageContent } = useNotesStore();
  const { addNotification } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'summarize' | 'polish' | 'tasks' | 'digest'>('chat');
  const [aiResult, setAiResult] = useState<string | null>(null);
  
  // Chat state
  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allVaultPages, setAllVaultPages] = useState<Page[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const selectedPage = pages.find((p) => p.id === selectedPageId);

  // Fetch 100% of all vault pages for full-vault knowledge scanning
  useEffect(() => {
    if (isOpen) {
      getAllVaultPages().then((p) => setAllVaultPages(p));
    }
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!isOpen) return null;

  const targetPages = allVaultPages.length > 0 ? allVaultPages : pages;

  // Handle Full-Vault Chat Query using Gemini 1.5 Pro/Flash LLM across ALL Notes!
  const handleSendQuery = async (queryText?: string) => {
    const q = queryText || inputQuery;
    if (!q.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: q.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const historyTurns = messages.map((m) => ({ sender: m.sender, text: m.text }));
      const result = await queryGeminiVault(q.trim(), targetPages, historyTurns);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: result.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sourceNotes: result.sourcePages.length > 0 ? result.sourcePages : undefined,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('[AI Modal Gemini error]', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          text: `⚠️ Không thể xử lý yêu cầu. Vui lòng kiểm tra lại kết nối mạng hoặc Gemini API Key trong phần Cài đặt.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAction = async (action: 'summarize' | 'polish' | 'tasks' | 'digest') => {
    setActiveTab(action);
    setLoading(true);
    setAiResult(null);

    const currentPage = selectedPage || targetPages[0];

    try {
      let promptQuery = '';
      let customSystemInstruction = '';

      if (action === 'summarize') {
        promptQuery = `Hãy tóm tắt ngắn gọn, đầy đủ và súc tích các ý chính quan trọng nhất trong trang ghi chú "${currentPage?.title || 'tất cả ghi chú'}" và toàn bộ Vault.`;
        customSystemInstruction = `Bạn là Trợ lý AI Tóm Tắt Chuyên Nghiệp của WebNote. Hãy phân tích kỹ ghi chú và tổng hợp lại các điểm cốt lõi, thành tựu hoặc nội dung chính theo định dạng danh sách gạch đầu dòng rõ ràng.`;
      } else if (action === 'polish') {
        promptQuery = `Hãy tinh chỉnh văn phong, sửa lỗi từ ngữ và cấu trúc bài viết của trang ghi chú "${currentPage?.title || 'hiện tại'}" để trở nên chuyên nghiệp, mượt mà hơn.`;
        customSystemInstruction = `Bạn là Trợ lý Biên Tập Viên AI. Hãy trau chuốt lại nội dung trang ghi chú hiện tại sao cho văn phong mượt mà, chuyên nghiệp, giữ nguyên 100% ý chính và thông tin quan trọng.`;
      } else if (action === 'tasks') {
        promptQuery = `Hãy trích xuất ĐẦY ĐỦ TẤT CẢ các việc cần làm (tasks/to-do list) có trong các ghi chú Vault, phân loại công việc đã xong và chưa xong.`;
        customSystemInstruction = `Bạn là Trợ lý Quản Lý Công Việc AI. Bạn phải quét toàn bộ Vault và liệt kê 100% các công việc (Task) được tìm thấy cùng trạng thái (đã xong/chưa xong) và tên ghi chú nguồn. KHÔNG bỏ sót bất kỳ task nào.`;
      } else if (action === 'digest') {
        promptQuery = `Tổng hợp toàn bộ lịch trình, việc cần làm gấp và định hướng trong ngày dựa trên tất cả các trang ghi chú trong Vault.`;
        customSystemInstruction = `Bạn là Trợ lý Quản Lý Thời Gian AI. Hãy tổng hợp kế hoạch ngày hôm nay cho người dùng: chia thành 🔥 Việc ưu tiên cao, ⚡ Việc cần lưu ý, và ✅ Tiến độ chung.`;
      }

      const res = await queryGeminiVault(promptQuery, targetPages, [], customSystemInstruction);
      setAiResult(res.text);
    } catch (err) {
      console.error('[AI Action error]', err);
      setAiResult('⚠️ <strong>Lỗi xử lý AI:</strong> Không thể hoàn tất yêu cầu. Vui lòng kiểm tra lại Gemini API Key.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!aiResult || !selectedPageId) return;
    const newContent = (selectedPage?.content || '') + '<br/><hr/>' + aiResult;
    await updatePageContent(selectedPageId, newContent);
    await queueSync('update', 'page', selectedPageId, { content: newContent });
    addNotification('success', 'Đã chèn nội dung AI vào ghi chú!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-2xl max-h-[85vh] rounded-2xl glass-card border border-purple-500/40 p-6 shadow-2xl glow-accent flex flex-col overflow-hidden"
        style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-3 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/30 text-purple-400 flex items-center justify-center border border-purple-500/30 shadow-sm">
              <Sparkles className="w-5 h-5 animate-pulse text-purple-300" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                Trợ Lý Thông Minh AI Vault Copilot
                <span className="px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/40 text-[10px] text-purple-300 font-medium flex items-center gap-1">
                  <Database className="w-3 h-3 text-cyan-400" />
                  {targetPages.length} Notes Scanned
                </span>
              </h3>
              <p className="text-xs text-slate-400">Hỏi đáp & Phân tích thông minh trên TOÀN BỘ kho ghi chú Vault của bạn</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Tabs */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-sm'
                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            Hỏi AI Vault
          </button>
          <button
            onClick={() => handleGenerateAction('digest')}
            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'digest'
                ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-sm'
                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            Lịch Ngày
          </button>
          <button
            onClick={() => handleGenerateAction('summarize')}
            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'summarize'
                ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-sm'
                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Tóm Tắt
          </button>
          <button
            onClick={() => handleGenerateAction('polish')}
            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'polish'
                ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-sm'
                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            Tinh Chỉnh
          </button>
          <button
            onClick={() => handleGenerateAction('tasks')}
            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-sm'
                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            Tạo Task
          </button>
        </div>

        {/* Content Area: Chat or Action Result */}
        <div className="flex-1 min-h-[320px] max-h-[55vh] overflow-y-auto p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-sm mb-4 flex flex-col">
          {activeTab === 'chat' ? (
            /* FULL VAULT CHAT INTERFACE */
            <div className="flex-1 flex flex-col space-y-3">
              {messages.length === 0 ? (
                <div className="py-12 text-center text-slate-500 my-auto">
                  <Bot className="w-10 h-10 mx-auto mb-2 text-purple-400 animate-bounce" />
                  <p className="text-sm font-semibold text-slate-300">Hỏi bất kỳ điều gì về tất cả các Ghi chú trong Vault!</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    AI sẽ tự động tìm kiếm, phân tích và trích xuất câu trả lời từ <strong>{targetPages.length} trang ghi chú</strong> trong kho lưu trữ của bạn.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    <button
                      onClick={() => handleSendQuery('Tổng hợp các việc cần làm hôm nay?')}
                      className="px-3 py-1 rounded-full bg-slate-900 border border-purple-500/30 text-purple-300 text-xs hover:bg-slate-800 cursor-pointer"
                    >
                      💡 Các việc cần làm hôm nay?
                    </button>
                    <button
                      onClick={() => handleSendQuery('Tìm thông tin dự án CV')}
                      className="px-3 py-1 rounded-full bg-slate-900 border border-cyan-500/30 text-cyan-300 text-xs hover:bg-slate-800 cursor-pointer"
                    >
                      💡 Tìm thông tin dự án CV
                    </button>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.sender === 'ai' && (
                      <div className="w-7 h-7 rounded-lg bg-purple-600/30 text-purple-300 flex items-center justify-center flex-shrink-0 mt-0.5 border border-purple-500/40">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-purple-600 text-white rounded-tr-none'
                          : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                      }`}
                    >
                      <div dangerouslySetInnerHTML={{ __html: msg.text }} />
                      {msg.sourceNotes && msg.sourceNotes.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex flex-wrap items-center gap-1">
                          <span className="font-semibold text-cyan-400">Nguồn trích xuất:</span>
                          {msg.sourceNotes.map((sn) => (
                            <span key={sn.id} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {sn.title}
                            </span>
                          ))}
                        </div>
                      )}
                      <span className="block text-[9px] text-slate-400 mt-1 text-right">{msg.timestamp}</span>
                    </div>
                    {msg.sender === 'user' && (
                      <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center flex-shrink-0 mt-0.5 border border-slate-700">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))
              )}
              {loading && (
                <div className="flex items-center gap-2 text-purple-400 text-xs py-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                  <span>AI đang quét toàn bộ Vault & tổng hợp câu trả lời...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          ) : (
            /* ACTION RESULT VIEW */
            <div>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-purple-400 gap-2">
                  <RefreshCw className="w-7 h-7 animate-spin" />
                  <span className="text-xs font-medium">AI đang phân tích và xử lý nội dung toàn bộ Vault...</span>
                </div>
              ) : aiResult ? (
                <div className="prose prose-invert prose-sm" dangerouslySetInnerHTML={{ __html: aiResult }} />
              ) : (
                <p className="text-xs text-slate-500 text-center py-12">Chọn một chức năng AI ở trên để phân tích toàn bộ ghi chú.</p>
              )}
            </div>
          )}
        </div>

        {/* Input Bar (Only visible for Chat tab) */}
        {activeTab === 'chat' ? (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendQuery()}
              placeholder="Đặt câu hỏi cho AI về tất cả các Ghi chú trong Vault..."
              className="flex-1 px-4 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 outline-none focus:border-purple-500/50"
            />
            <button
              onClick={() => handleSendQuery()}
              disabled={!inputQuery.trim() || loading}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Gửi
            </button>
          </div>
        ) : (
          /* Footer Actions for Action Tabs */
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              onClick={() => setActiveTab('chat')}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              Quay lại Chat
            </button>
            <button
              onClick={handleApply}
              disabled={!aiResult || loading || !selectedPageId}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Chèn Vào Ghi Chú Hiện Tại
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
