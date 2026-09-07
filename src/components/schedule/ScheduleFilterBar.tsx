// ============================================================
// MyNotes — Schedule Filter Bar Component
// Advanced search & filter toolbar (Keyword, Category, Date Presets, AI Query)
// ============================================================

import React, { useState } from 'react';
import { Search, Sparkles, X, RotateCcw } from 'lucide-react';
import { useScheduleStore } from '../../stores/scheduleStore';
import { parseNaturalScheduleQuery } from '../../services/ai/geminiService';
import type { DatePresetOption } from '../../types';

export function ScheduleFilterBar() {
  const {
    searchFilter,
    categories,
    filterBarOpen,
    aiExplanation,
    setSearchFilter,
    resetSearchFilter,
    setFilterBarOpen,
  } = useScheduleStore();

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  if (!filterBarOpen) return null;

  const handleAISearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    setAiLoading(true);
    try {
      const res = await parseNaturalScheduleQuery(
        aiPrompt.trim(),
        categories.map((c) => ({ id: c.id, name: c.name }))
      );

      if (res.filter) {
        setSearchFilter(res.filter, res.explanation);
      }
    } catch (err) {
      console.error('[FilterBar] AI Search error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const isFilterActive =
    !!searchFilter.keyword ||
    searchFilter.categoryId !== 'all' ||
    searchFilter.taskSource !== 'all' ||
    searchFilter.datePreset !== 'all' ||
    searchFilter.status !== 'all' ||
    searchFilter.priority !== 'all';

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 p-3 sm:px-6 space-y-3 backdrop-blur-sm animate-in slide-in-from-top-2 duration-150">
      {/* Top Filter Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
        {/* Keyword Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchFilter.keyword || ''}
            onChange={(e) => setSearchFilter({ keyword: e.target.value })}
            placeholder="Tìm tên lịch, nội dung..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/60"
          />
        </div>

        {/* Work Category Filter */}
        <div>
          <select
            value={searchFilter.categoryId || 'all'}
            onChange={(e) => setSearchFilter({ categoryId: e.target.value })}
            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500/60"
          >
            <option value="all">🏷️ Tất cả Nhóm Work</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range Presets */}
        <div>
          <select
            value={searchFilter.datePreset || 'all'}
            onChange={(e) => setSearchFilter({ datePreset: e.target.value as DatePresetOption })}
            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500/60"
          >
            <option value="all">📅 Tất cả thời gian</option>
            <option value="today">Hôm nay</option>
            <option value="this_week">Tuần này</option>
            <option value="this_month">Tháng này</option>
            <option value="next_7_days">7 ngày tới</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={searchFilter.status || 'all'}
            onChange={(e) => setSearchFilter({ status: e.target.value as any })}
            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500/60"
          >
            <option value="all">⚡ Tất cả trạng thái</option>
            <option value="pending">⏳ Chưa làm (Pending)</option>
            <option value="completed">✅ Đã xong (Completed)</option>
            <option value="overdue">🔴 Quá hạn (Overdue)</option>
          </select>
        </div>

        {/* Priority & Clear */}
        <div className="flex items-center gap-2">
          <select
            value={searchFilter.priority || 'all'}
            onChange={(e) => setSearchFilter({ priority: e.target.value as any })}
            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500/60"
          >
            <option value="all">🚩 Ưu tiên: Tất cả</option>
            <option value="high">🔴 Cao (High)</option>
            <option value="medium">🟡 Vừa (Medium)</option>
            <option value="low">🔵 Thấp (Low)</option>
          </select>

          {isFilterActive && (
            <button
              onClick={resetSearchFilter}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors shrink-0"
              title="Xóa bộ lọc"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setFilterBarOpen(false)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AI Natural Search Query Box */}
      <form onSubmit={handleAISearch} className="flex items-center gap-2 pt-1">
        <div className="relative flex-1">
          <Sparkles className="w-3.5 h-3.5 absolute left-3 top-2.5 text-purple-400 animate-pulse" />
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="AI Search: VD 'Lịch họp dự án WebNote tuần này'..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-purple-950/30 border border-purple-500/30 rounded-xl text-purple-200 placeholder-purple-400/60 focus:outline-none focus:border-purple-500"
          />
        </div>
        <button
          type="submit"
          disabled={aiLoading}
          className="px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all shadow-sm flex items-center gap-1 shrink-0"
        >
          {aiLoading ? 'Đang lọc...' : '🤖 AI Lọc'}
        </button>
      </form>

      {/* AI Explanation Result Tag */}
      {aiExplanation && (
        <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-950/40 p-2 rounded-xl border border-purple-500/30">
          <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span>{aiExplanation}</span>
          <button onClick={resetSearchFilter} className="ml-auto text-[10px] text-purple-400 underline">
            Hủy lọc AI
          </button>
        </div>
      )}
    </div>
  );
}
