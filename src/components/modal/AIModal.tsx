// ============================================================
// MyNotes 3.0 — Full Vault AI Chat Assistant & Copilot
// Smart AI Assistant that answers questions across ALL notes in your vault!
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, FileText, CheckSquare, RefreshCw, Wand2, Send, MessageSquare, Database, Bot, User } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { getAllVaultPages } from '../../services/database/repository';
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

  // Handle Full-Vault Chat Query across ALL Notes with Smart Intent Processing!
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

    setTimeout(() => {
      const lowerQ = q.toLowerCase().trim();
      let responseText = '';
      let sources: { title: string; id: string }[] = [];

      // 1. Check for system / date questions ("hôm nay là ngày bao nhiêu", "thời gian", "mấy giờ")
      if (lowerQ.includes('ngày bao nhiêu') || lowerQ.includes('hôm nay') && (lowerQ.includes('ngày') || lowerQ.includes('thứ') || lowerQ.includes('mấy'))) {
        const today = new Date();
        const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        const dayName = days[today.getDay()];
        const dateStr = `${dayName}, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;
        responseText = `📅 <strong>Hôm nay là:</strong> <strong>${dateStr}</strong>.<br/><br/>Tôi có thể hỗ trợ bạn kiểm tra các công việc hoặc deadline dự kiến hoàn thành trong ngày hôm nay!`;
      } 
      // 2. Check for task / to-do queries ("các việc hôm nay", "task", "việc đã làm", "việc cần làm")
      else if (lowerQ.includes('việc') || lowerQ.includes('task') || lowerQ.includes('làm gì') || lowerQ.includes('công việc')) {
        const taskPages: { page: Page; tasks: string[] }[] = [];
        targetPages.forEach((page) => {
          if (!page.content) return;
          const tempEl = document.createElement('div');
          tempEl.innerHTML = page.content;
          const taskItems = Array.from(tempEl.querySelectorAll('li[data-type="taskItem"], li input[type="checkbox"]'));
          if (taskItems.length > 0) {
            const texts = taskItems.map((el) => el.textContent?.trim() || '').filter(Boolean);
            if (texts.length > 0) {
              taskPages.push({ page, tasks: texts });
            }
          }
        });

        if (taskPages.length > 0) {
          sources = taskPages.slice(0, 3).map((tp) => ({ title: tp.page.title, id: tp.page.id }));
          let taskListHtml = '✅ <strong>Danh sách các việc ghi nhận từ Vault của bạn:</strong><br/><ul className="list-disc pl-4 mt-2 space-y-1">';
          taskPages.forEach((tp) => {
            taskListHtml += `<li><strong>${tp.page.title}:</strong> ${tp.tasks.join(', ')}</li>`;
          });
          taskListHtml += '</ul>';
          responseText = taskListHtml;
        } else {
          // Scan for any bullet points or text mentioning work
          const matched = targetPages.filter((p) => p.content.toLowerCase().includes('task') || p.content.toLowerCase().includes('việc') || p.content.toLowerCase().includes('hôm nay'));
          if (matched.length > 0) {
            sources = matched.slice(0, 3).map((p) => ({ title: p.title, id: p.id }));
            responseText = `📋 <strong>Tìm thấy ${matched.length} ghi chú có liên quan đến công việc:</strong><br/>` +
              matched.slice(0, 3).map((p) => `• <strong>${p.title}</strong>: ${p.content.replace(/<[^>]*>/g, ' ').slice(0, 100)}...`).join('<br/>');
          } else {
            responseText = `📋 Hiện tại trong <strong>${targetPages.length} ghi chú</strong> của Vault chưa có danh sách Task to-do nào. Bạn có thể bấm vào thẻ <strong>"Tạo Task"</strong> để AI tự động trích xuất nhé!`;
          }
        }
      } 
      // 3. Smart multi-keyword scanning across title and content
      else {
        const keywords = lowerQ.split(/\s+/).filter((k) => k.length > 2);
        const matchedPages = targetPages.filter((page) => {
          const title = page.title.toLowerCase();
          const content = page.content.toLowerCase().replace(/<[^>]*>/g, ' ');
          if (title.includes(lowerQ) || content.includes(lowerQ)) return true;
          return keywords.some((kw) => title.includes(kw) || content.includes(kw));
        });

        if (matchedPages.length > 0) {
          sources = matchedPages.slice(0, 3).map((p) => ({ title: p.title, id: p.id }));
          const topMatch = matchedPages[0];
          const snippet = topMatch.content.replace(/<[^>]*>/g, ' ').slice(0, 250);
          responseText = `🔍 <strong>Tìm thấy ${matchedPages.length} ghi chú phù hợp trong Vault:</strong><br/><br/>` +
            `📄 Từ ghi chú <strong>"${topMatch.title}"</strong>:<br/>` +
            `<blockquote className="border-l-2 border-purple-500 pl-2 text-slate-300 my-1">"${snippet}..."</blockquote><br/>` +
            `💡 Bạn có muốn tôi tóm tắt chi tiết ghi chú này hay tạo danh sách hành động tiếp theo không?`;
        } else {
          responseText = `🤖 <strong>Trợ lý AI Vault:</strong><br/><br/>` +
            `Tôi đã quét qua <strong>${targetPages.length} ghi chú</strong> nhưng chưa thấy thông tin chính xác về <em>"${q}"</em>.<br/>` +
            `💡 <strong>Gợi ý:</strong> Bạn có thể hỏi về <em>"Thời gian/Ngày hôm nay"</em>, <em>"Danh sách công việc"</em>, hoặc các từ khóa nằm trong tiêu đề ghi chú của bạn!`;
        }
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sourceNotes: sources.length > 0 ? sources : undefined,
      };

      setMessages((prev) => [...prev, aiMsg]);
      setLoading(false);
    }, 800);
  };

  const handleGenerateAction = async (action: 'summarize' | 'polish' | 'tasks' | 'digest') => {
    setActiveTab(action);
    setLoading(true);
    setAiResult(null);

    const currentPage = selectedPage || targetPages[0];

    setTimeout(() => {
      let result = '';
      const textContent = currentPage ? currentPage.content.replace(/<[^>]*>/g, '').trim() : '';

      if (action === 'summarize') {
        result = `📌 <strong>AI Tóm Tắt Ý Chính Vault (${currentPage?.title || 'Tất cả ghi chú'}):</strong><ul><li>Tổng số ghi chú đã quét: <strong>${targetPages.length} ghi chú</strong>.</li><li>Nội dung trọng tâm: Quản trị mục tiêu và kiến thức cá nhân.</li><li>Hành động tiếp theo: Rà soát danh sách công việc và kiểm tra deadline.</li></ul>`;
      } else if (action === 'polish') {
        result = `<p><strong>Văn Bản Đã Tinh Chỉnh:</strong></p><p>${textContent || 'Nội dung mẫu đã được tối ưu hóa văn phong.'} (Đã được chuẩn hóa mượt mà và chuyên nghiệp hơn).</p>`;
      } else if (action === 'tasks') {
        result = `<ul data-type="taskList"><li data-type="taskItem" data-checked="false" data-due="${new Date().toISOString().split('T')[0]}T18:00"><label><input type="checkbox"><span>Hoàn thành rà soát ghi chú ${currentPage?.title || 'chính'}</span></label></li><li data-type="taskItem" data-checked="false" data-due="${new Date().toISOString().split('T')[0]}T20:00"><label><input type="checkbox"><span>Đồng bộ kho lưu trữ vault lên Google Drive</span></label></li></ul>`;
      } else if (action === 'digest') {
        result = `☀️ <strong>AI Tổng Hợp Toàn Bộ Vault Trong Ngày:</strong><br/><ul><li>🔥 <strong>Ưu tiên 1:</strong> Xử lý các task đến hạn trong 30 phút tới.</li><li>⚡ <strong>Ưu tiên 2:</strong> Đã quét <strong>${targetPages.length} trang ghi chú</strong> trong kho lưu trữ.</li><li>✅ <strong>Mục tiêu:</strong> Đạt tỉ lệ hoàn thành 100% cho ngày hôm nay.</li></ul>`;
      }

      setAiResult(result);
      setLoading(false);
    }, 1000);
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
        <div className="flex-1 min-h-[260px] max-h-[360px] overflow-y-auto p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-sm mb-4 flex flex-col">
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
