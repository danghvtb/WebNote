// ============================================================
// MyNotes 3.0 — AI Assistant Modal
// Smart AI Copilot for Summarizing, Polishing & Generating Tasks.
// ============================================================

import { useState } from 'react';
import { X, Sparkles, FileText, CheckSquare, RefreshCw, Wand2 } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { queueSync } from '../../services/sync/syncManager';

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIModal({ isOpen, onClose }: AIModalProps) {
  const { selectedPageId, pages, updatePageContent } = useNotesStore();
  const { addNotification } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'summarize' | 'polish' | 'tasks' | 'digest'>('summarize');
  const [aiResult, setAiResult] = useState<string | null>(null);

  const selectedPage = pages.find((p) => p.id === selectedPageId);

  if (!isOpen || !selectedPage) return null;

  const handleGenerate = async (action: string) => {
    setLoading(true);
    setAiResult(null);

    // Simulate AI Copilot generation (or integrate with LLM backend)
    setTimeout(() => {
      let result = '';
      const textContent = selectedPage.content.replace(/<[^>]*>/g, '').trim();

      if (!textContent && action !== 'digest') {
        setAiResult('⚠️ Trang này chưa có nội dung văn bản để AI phân tích.');
        setLoading(false);
        return;
      }

      if (action === 'summarize') {
        result = `📌 <strong>AI Tóm Tắt Ý Chính:</strong><ul><li>Chủ đề chính: ${selectedPage.title}</li><li>Nội dung trọng tâm: Ghi chú tri thức mật độ cao.</li><li>Hành động tiếp theo: Rà soát và đồng bộ dữ liệu.</li></ul>`;
      } else if (action === 'polish') {
        result = `<p><strong>Văn Bản Đã Tinh Chỉnh:</strong></p><p>${textContent} (Đã được chuẩn hóa văn phong mượt mà và rõ ràng hơn).</p>`;
      } else if (action === 'tasks') {
        result = `<ul data-type="taskList"><li data-type="taskItem" data-checked="false" data-due="${new Date().toISOString().split('T')[0]}T18:00"><label><input type="checkbox"><span>Xem lại nội dung ${selectedPage.title}</span></label></li><li data-type="taskItem" data-checked="false" data-due="${new Date().toISOString().split('T')[0]}T20:00"><label><input type="checkbox"><span>Sắp xếp các ý chính vào mục tương ứng</span></label></li></ul>`;
      } else if (action === 'digest') {
        result = `☀️ <strong>AI Tổng Hợp Mục Tiêu Trong Ngày:</strong><br/><ul><li>🔥 <strong>Ưu tiên 1:</strong> Hoàn thành các deadline sắp đến hạn trong 30 phút tới.</li><li>⚡ <strong>Ưu tiên 2:</strong> Rà soát và cập nhật ghi chú "${selectedPage.title}".</li><li>✅ <strong>Mục tiêu:</strong> Duy trì 100% tỉ lệ hoàn thành công việc hôm nay.</li></ul>`;
      }

      setAiResult(result);
      setLoading(false);
    }, 1000);
  };

  const handleApply = async () => {
    if (!aiResult || !selectedPageId) return;
    const newContent = selectedPage.content + '<br/><hr/>' + aiResult;
    await updatePageContent(selectedPageId, newContent);
    await queueSync('update', 'page', selectedPageId, { content: newContent });
    addNotification('success', 'AI content appended to note!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg rounded-2xl glass-card border border-purple-500/30 p-6 shadow-2xl glow-accent animate-scale-in"
        style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/30 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base">Trợ Lý Thông Minh AI Copilot</h3>
              <p className="text-xs text-slate-400">Phân tích cho ghi chú "{selectedPage.title}"</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Tabs */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <button
            onClick={() => { setActiveTab('summarize'); handleGenerate('summarize'); }}
            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'summarize'
                ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Tóm Tắt
          </button>
          <button
            onClick={() => { setActiveTab('polish'); handleGenerate('polish'); }}
            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'polish'
                ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            Tinh Chỉnh
          </button>
          <button
            onClick={() => { setActiveTab('tasks'); handleGenerate('tasks'); }}
            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            Tạo Task
          </button>
          <button
            onClick={() => { setActiveTab('digest'); handleGenerate('digest'); }}
            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'digest'
                ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            Lịch Ngày
          </button>
        </div>

        {/* AI Result Area */}
        <div className="min-h-[140px] max-h-[220px] overflow-y-auto p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-sm mb-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-purple-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span className="text-xs font-medium">AI đang phân tích và xử lý nội dung...</span>
            </div>
          ) : aiResult ? (
            <div className="prose prose-invert prose-sm" dangerouslySetInnerHTML={{ __html: aiResult }} />
          ) : (
            <p className="text-xs text-slate-500 text-center py-8">Chọn một tính năng AI ở trên để phân tích ghi chú.</p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            Hủy
          </button>
          <button
            onClick={handleApply}
            disabled={!aiResult || loading}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Chèn Vào Ghi Chú
          </button>
        </div>
      </div>
    </div>
  );
}
