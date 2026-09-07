// ============================================================
// MyNotes — AI Schedule Panel Component
// AI Smart Schedule Optimizer Sidebar/Panel
// ============================================================

import { useState } from 'react';
import { Sparkles, Wand2, Check, Clock, X } from 'lucide-react';
import { useScheduleStore } from '../../stores/scheduleStore';
import { generateSmartSchedule, type AIScheduleRecommendation } from '../../services/ai/geminiService';
import { getAllVaultPages, getAllVaultNotebooks } from '../../services/database/repository';
import { parseAllTasks } from '../../utils/taskUtils';

interface AISchedulePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AISchedulePanel({ isOpen, onClose }: AISchedulePanelProps) {
  const { selectedDate, blocks, addOrUpdateBlock } = useScheduleStore();
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<AIScheduleRecommendation[]>([]);
  const [summaryHtml, setSummaryHtml] = useState<string>('');
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const handleRunOptimizer = async () => {
    setLoading(true);
    setAppliedIds(new Set());

    try {
      const [pages, notebooks] = await Promise.all([getAllVaultPages(), getAllVaultNotebooks()]);
      const tasks = parseAllTasks(pages, notebooks, true).filter((t) => !t.completed);

      // Find tasks that aren't scheduled yet on selectedDate
      const existingTaskIds = new Set(blocks.map((b) => b.taskId).filter(Boolean));
      const unscheduledTasks = tasks.filter((t) => !existingTaskIds.has(t.id));

      const existingBlocksInfo = blocks
        .filter((b) => b.date === selectedDate)
        .map((b) => ({ startTime: b.startTime, endTime: b.endTime, title: b.title }));

      const res = await generateSmartSchedule(
        selectedDate,
        unscheduledTasks.map((t) => ({
          id: t.id,
          text: t.text,
          pageTitle: t.pageTitle,
          dueDate: t.dueDate,
          pageId: t.pageId,
        })),
        existingBlocksInfo
      );

      setRecommendations(res.recommendations);
      setSummaryHtml(res.summaryHtml);
    } catch (err) {
      console.error('[AIPanel] Optimizer error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplySingle = async (rec: AIScheduleRecommendation) => {
    await addOrUpdateBlock({
      title: rec.title,
      date: rec.date || selectedDate,
      startTime: rec.startTime,
      endTime: rec.endTime,
      estimatedMinutes: rec.estimatedMinutes,
      priority: rec.priority,
      aiSuggested: true,
      completed: false,
      taskId: rec.taskId,
      pageId: rec.pageId,
      color: rec.priority === 'high' ? '#f43f5e' : rec.priority === 'medium' ? '#f59e0b' : '#3b82f6',
    });

    if (rec.taskId) {
      setAppliedIds((prev) => new Set([...prev, rec.taskId!]));
    }
  };

  const handleApplyAll = async () => {
    for (const rec of recommendations) {
      await handleApplySingle(rec);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-[90] w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              AI Schedule Optimizer
            </h3>
            <p className="text-[11px] text-slate-400">Tự động đề xuất xếp lịch tối ưu ngày {selectedDate}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4">
        {/* Trigger Button */}
        {recommendations.length === 0 && !loading && (
          <div className="p-6 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/50 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
              <Wand2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">Phân Tích & Tối Ưu Lịch Trình</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Gemini AI sẽ quét các task chưa xếp lịch trong kho ghi chú và đề xuất khung giờ hợp lý nhất cho ngày {selectedDate}.
              </p>
            </div>
            <button
              onClick={handleRunOptimizer}
              className="w-full py-2.5 px-4 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Chạy AI Schedule Optimizer
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 mx-auto border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Gemini AI đang tính toán khung giờ tối ưu...</p>
          </div>
        )}

        {/* AI Recommendations List */}
        {recommendations.length > 0 && !loading && (
          <div className="space-y-4">
            {/* Summary */}
            <div
              className="p-3.5 bg-purple-950/30 border border-purple-500/20 rounded-xl text-xs text-slate-200"
              dangerouslySetInnerHTML={{ __html: summaryHtml }}
            />

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Đề xuất ({recommendations.length}):</span>
              <button
                onClick={handleApplyAll}
                className="text-[11px] font-bold text-purple-400 hover:text-purple-300 transition-colors"
              >
                + Áp dụng tất cả
              </button>
            </div>

            <div className="space-y-2.5">
              {recommendations.map((rec, idx) => {
                const isApplied = rec.taskId ? appliedIds.has(rec.taskId) : false;

                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isApplied
                        ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                        : 'bg-slate-950 border-slate-800 hover:border-purple-500/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h5 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          {rec.title}
                        </h5>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-purple-300 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{rec.startTime} - {rec.endTime}</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-purple-500/20 rounded border border-purple-500/30">
                            {rec.estimatedMinutes} phút
                          </span>
                        </div>
                        {rec.reasoning && (
                          <p className="text-[11px] text-slate-400 mt-1.5 italic">
                            "{rec.reasoning}"
                          </p>
                        )}
                      </div>

                      <button
                        disabled={isApplied}
                        onClick={() => handleApplySingle(rec)}
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 shrink-0 ${
                          isApplied
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default'
                            : 'bg-purple-600 hover:bg-purple-500 text-white shadow-sm'
                        }`}
                      >
                        {isApplied ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Đã Thêm
                          </>
                        ) : (
                          <>
                            + Áp Dụng
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
