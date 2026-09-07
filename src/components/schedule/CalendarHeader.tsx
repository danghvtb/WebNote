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
    setSelectedDate,
    setViewMode,
    setDailyBriefingOpen,
    setAddModalOpen,
  } = useScheduleStore();

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
    <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
      {/* Date Navigation Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleToday}
          className="px-3 py-1.5 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
        >
          Hôm Nay
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <h2 className="text-sm font-bold text-slate-100 capitalize flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-purple-400" />
          {formatDateDisplay()}
        </h2>
      </div>

      {/* Center View Mode Switcher */}
      <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl">
        {(['day', 'week', 'month'] as ScheduleViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-3 py-1 text-xs font-bold capitalize rounded-lg transition-all ${
              viewMode === mode
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {mode === 'day' ? 'Ngày' : mode === 'week' ? 'Tuần' : 'Tháng'}
          </button>
        ))}
      </div>

      {/* Right Action Buttons */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setDailyBriefingOpen(true)}
          className="px-3.5 py-1.5 text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all flex items-center gap-1.5"
        >
          <Sun className="w-4 h-4 text-amber-400" /> Daily Briefing
        </button>

        <button
          onClick={onOpenAIPanel}
          className="px-3.5 py-1.5 text-xs font-bold text-purple-200 bg-gradient-to-r from-purple-900/60 to-indigo-900/60 hover:from-purple-800/80 hover:to-indigo-800/80 border border-purple-500/40 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
        >
          <Sparkles className="w-4 h-4 text-purple-400" /> AI Optimizer
        </button>

        <button
          onClick={() => setAddModalOpen(true)}
          className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Thêm Lịch
        </button>
      </div>
    </div>
  );
}
