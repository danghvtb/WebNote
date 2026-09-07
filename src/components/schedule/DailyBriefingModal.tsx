// ============================================================
// MyNotes — Daily Briefing Modal Component
// Displays morning inspiration & AI-synthesized schedule plan
// ============================================================

import { useEffect, useState } from 'react';
import { Sun, Sparkles, X, ShieldCheck } from 'lucide-react';
import { useScheduleStore } from '../../stores/scheduleStore';
import { generateDailyBriefing } from '../../services/ai/geminiService';
import { getAllVaultPages, getAllVaultNotebooks } from '../../services/database/repository';
import { parseAllTasks } from '../../utils/taskUtils';
import { todayDate } from '../../utils';

export function DailyBriefingModal() {
  const { dailyBriefingOpen, setDailyBriefingOpen, blocks, selectedDate } = useScheduleStore();
  const [briefingHtml, setBriefingHtml] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dailyBriefingOpen) {
      setLoading(true);
      Promise.all([getAllVaultPages(), getAllVaultNotebooks()]).then(([pages, notebooks]) => {
        const tasks = parseAllTasks(pages, notebooks, true);
        const todayBlocks = blocks.filter((b) => b.date === (selectedDate || todayDate()));

        generateDailyBriefing(selectedDate || todayDate(), todayBlocks, tasks.length).then((html) => {
          setBriefingHtml(html);
          setLoading(false);
        });
      });
    }
  }, [dailyBriefingOpen, blocks, selectedDate]);

  if (!dailyBriefingOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Decorative Top Glow */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-400" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sun className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
                Daily Briefing <Sparkles className="w-4 h-4 text-purple-400" />
              </h3>
              <p className="text-[11px] text-slate-400">Tổng quan kế hoạch & năng lượng chào ngày mới</p>
            </div>
          </div>
          <button
            onClick={() => setDailyBriefingOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400 animate-pulse">Gemini AI đang tổng hợp kế hoạch ngày cho bạn...</p>
            </div>
          ) : (
            <div
              className="prose prose-invert prose-xs max-w-none space-y-3"
              dangerouslySetInnerHTML={{ __html: briefingHtml }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800/80 bg-slate-900/60">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> WebNote AI Powered
          </span>
          <button
            onClick={() => setDailyBriefingOpen(false)}
            className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-purple-600/20 transition-all"
          >
            Bắt Đầu Ngày Làm Việc 🚀
          </button>
        </div>
      </div>
    </div>
  );
}
