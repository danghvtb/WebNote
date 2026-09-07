// ============================================================
// MyNotes — Calendar Header Toolbar Component
// Controls Date navigation, View mode (Day/Week/Month) & AI Triggers
// ============================================================

// ============================================================
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Sparkles,
  Sun,
  Plus,
  Filter,
} from 'lucide-react';
import { useScheduleStore, type ScheduleViewMode } from '../../stores/scheduleStore';
import { todayDate } from '../../utils';

interface CalendarHeaderProps {
  onOpenAIPanel: () => void;
}

export function CalendarHeader({ onOpenAIPanel }: CalendarHeaderProps) {
  const {
    selectedDate,
    viewMode,
    filterBarOpen,
    searchFilter,
    setSelectedDate,
    setViewMode,
    setDailyBriefingOpen,
    setAddModalOpen,
    setFilterBarOpen,
  } = useScheduleStore();

  const isFilterActive =
    !!searchFilter.keyword ||
    searchFilter.categoryId !== 'all' ||
    searchFilter.taskSource !== 'all' ||
    searchFilter.datePreset !== 'all' ||
    searchFilter.status !== 'all' ||
    searchFilter.priority !== 'all';

  const handlePrev = () => {
    const d = new Date(selectedDate);
    if (viewMode === 'day') d.setDate(d.getDate() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNext = () => {
    const d = new Date(selectedDate);
    if (viewMode === 'day') d.setDate(d.getDate() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(todayDate());
  };

  // Format date display
  const formatDateDisplay = () => {
    const d = new Date(selectedDate);
    const dateStr = d.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return dateStr;
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3 sm:px-6 sm:py-3.5 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm gap-2.5">
      {/* Date Navigation Left */}
      <div className="flex items-center justify-between sm:justify-start gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleToday}
            className="px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
          >
            Hôm Nay
          </button>

          <div className="flex items-center gap-0.5">
            <button
              onClick={handlePrev}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={handleNext}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        <h2 className="text-xs sm:text-sm font-bold text-slate-100 capitalize flex items-center gap-1.5 truncate">
          <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 shrink-0" />
          <span className="truncate">{formatDateDisplay()}</span>
        </h2>
      </div>

      {/* Right Controls: View Mode Switcher + Action Buttons */}
      <div className="flex items-center justify-between sm:justify-end gap-2">
        {/* Center View Mode Switcher */}
        <div className="flex items-center p-0.5 sm:p-1 bg-slate-950 border border-slate-800 rounded-xl">
          {(['day', 'week', 'month'] as ScheduleViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-2 py-1 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-bold capitalize rounded-lg transition-all ${
                viewMode === mode
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode === 'day' ? 'Ngày' : mode === 'week' ? 'Tuần' : 'Tháng'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterBarOpen(!filterBarOpen)}
            className={`p-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-bold rounded-xl transition-all flex items-center gap-1 ${
              filterBarOpen || isFilterActive
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700'
            }`}
            title="Bật/Tắt Bộ Lọc Tìm Kiếm Thông Minh"
          >
            <Filter className="w-4 h-4" />
            <span className="hidden md:inline">Bộ Lọc</span>
          </button>

          <button
            onClick={() => setDailyBriefingOpen(true)}
            className="p-1.5 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all flex items-center gap-1"
            title="Daily Briefing"
          >
            <Sun className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Briefing</span>
          </button>

          <button
            onClick={onOpenAIPanel}
            className="p-1.5 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs font-bold text-purple-200 bg-gradient-to-r from-purple-900/60 to-indigo-900/60 hover:from-purple-800/80 border border-purple-500/40 rounded-xl transition-all flex items-center gap-1"
            title="AI Optimizer"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="hidden md:inline">AI Optimizer</span>
          </button>

          <button
            onClick={() => setAddModalOpen(true)}
            className="p-1.5 sm:px-4 sm:py-1.5 text-[11px] sm:text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Thêm Lịch</span>
          </button>
        </div>
      </div>
    </div>
  );
}
