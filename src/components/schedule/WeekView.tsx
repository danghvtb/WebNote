// ============================================================
// MyNotes — WeekView Calendar Grid Component
// 7-day interactive time-slot grid with Drag & Slot Click creation
// ============================================================

import { useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useScheduleStore } from '../../stores/scheduleStore';
import { ScheduleBlockCard } from './ScheduleBlockCard';
import { formatDateISO, todayDate } from '../../utils';
import { formatLunarDateShort } from '../../utils/lunarCalendar';
import { usePeriodDragNavigation } from './usePeriodDragNavigation';

export function WeekView() {
  const { selectedDate, getFilteredBlocks, setAddModalOpen, setSelectedDate } = useScheduleStore();
  const blocks = getFilteredBlocks();
  const scrollRef = useRef<HTMLDivElement>(null);

  const handlePrevWeek = useCallback(() => {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() - 7);
    setSelectedDate(formatDateISO(d));
  }, [selectedDate, setSelectedDate]);

  const handleNextWeek = useCallback(() => {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + 7);
    setSelectedDate(formatDateISO(d));
  }, [selectedDate, setSelectedDate]);

  const periodDrag = usePeriodDragNavigation({
    mode: 'scroll',
    onPrevious: handlePrevWeek,
    onNext: handleNextWeek,
    scrollRef,
    resetScrollKey: selectedDate,
    snapColumns: 7,
  });

  // Compute 7 days of the current week based on selectedDate (Mon - Sun)
  const getWeekDays = () => {
    const current = new Date(`${selectedDate}T00:00:00`);
    const dayOfWeek = current.getDay();
    // Normalize Monday to index 0
    const distanceToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mon = new Date(current);
    mon.setDate(current.getDate() + distanceToMon);

    const week: { dateStr: string; dayName: string; dayNum: number; isToday: boolean }[] = [];
    const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const dateStr = formatDateISO(d);
      week.push({
        dateStr,
        dayName: DAY_NAMES[i],
        dayNum: d.getDate(),
        isToday: dateStr === todayDate(),
      });
    }
    return week;
  };

  const weekDays = getWeekDays();

  const handleSlotClick = (dateStr: string, hour: number) => {
    const startTime = `${hour.toString().padStart(2, '0')}:00`;
    setAddModalOpen(true, null, { date: dateStr, startTime });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 select-none relative">
      {periodDrag.feedback.direction && (
        <div
          className={`absolute inset-y-0 z-40 pointer-events-none flex items-center ${
            periodDrag.feedback.direction === 'previous' ? 'left-3' : 'right-3'
          }`}
          style={{ opacity: 0.35 + periodDrag.feedback.progress * 0.65 }}
        >
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-full border shadow-xl backdrop-blur-md text-xs font-bold ${
              periodDrag.thresholdReached
                ? 'bg-purple-600/90 border-purple-300/70 text-white'
                : 'bg-slate-900/90 border-slate-700 text-slate-200'
            }`}
          >
            {periodDrag.feedback.direction === 'previous' && <ChevronLeft className="w-4 h-4" />}
            <span>
              {periodDrag.thresholdReached
                ? `Thả để sang tuần ${periodDrag.feedback.direction === 'previous' ? 'trước' : 'sau'}`
                : 'Kéo thêm để chuyển tuần'}
            </span>
            {periodDrag.feedback.direction === 'next' && <ChevronRight className="w-4 h-4" />}
          </div>
        </div>
      )}

      {/* Floating Prev/Next Week Quick Navigation Buttons for Desktop Mouse Drag / Quick Click */}
      <div className="absolute top-16 left-2 z-30 hidden sm:flex">
        <button
          onClick={handlePrevWeek}
          className="p-2 rounded-full bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:bg-purple-600 transition-all shadow-lg cursor-pointer"
          title="Kéo/Bấm lùi sang Tuần Trước"
        >
          ‹
        </button>
      </div>

      <div className="absolute top-16 right-2 z-30 hidden sm:flex">
        <button
          onClick={handleNextWeek}
          className="p-2 rounded-full bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:bg-purple-600 transition-all shadow-lg cursor-pointer"
          title="Kéo/Bấm chuyển sang Tuần Kế Tiếp"
        >
          ›
        </button>
      </div>

      {/* Scrollable Container for Mobile Horizontal Swipe */}
      <div
        ref={scrollRef}
        {...periodDrag.bind}
        style={periodDrag.surfaceStyle}
        className="flex-1 overflow-x-auto overflow-y-auto flex flex-col min-w-full overscroll-x-contain"
      >
        <div
          className="min-w-[650px] sm:min-w-full flex-1 flex flex-col"
          style={periodDrag.contentStyle}
        >
          {/* 7 Column Header */}
          <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-900/50 sticky top-0 z-10">
            {weekDays.map((day) => (
              <div
                key={day.dateStr}
                className={`py-2 px-1 sm:py-2.5 sm:px-2 text-center border-r border-slate-800/60 flex items-center justify-between group ${
                  day.isToday ? 'bg-purple-950/20' : ''
                }`}
              >
                <div className="flex-1 text-center">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block uppercase truncate">
                    {day.dayName}
                  </span>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full text-[11px] sm:text-xs font-bold ${
                        day.isToday
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                          : 'text-slate-200'
                      }`}
                    >
                      {day.dayNum}
                    </span>
                    {(() => {
                      const lunarInfo = formatLunarDateShort(day.dateStr);
                      return (
                        <span
                          className={`text-[10px] font-medium ${
                            lunarInfo.isSpecial ? 'text-amber-400 font-bold' : 'text-slate-400/75'
                          }`}
                          title={lunarInfo.holiday ? lunarInfo.holiday : `Âm: ${lunarInfo.shortText}`}
                        >
                          {lunarInfo.shortText}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <button
                  onClick={() => handleSlotClick(day.dateStr, 9)}
                  className="p-1 rounded-lg text-slate-500 hover:text-purple-300 hover:bg-purple-500/20 transition-all cursor-pointer opacity-60 hover:opacity-100"
                  title={`Thêm lịch cho ${day.dayName} (${day.dateStr})`}
                >
                  +
                </button>
              </div>
            ))}
          </div>

          {/* Grid Content: Simple Vertical List for Each Day */}
          <div className="flex-1">
            <div className="grid grid-cols-7 min-h-full">
              {weekDays.map((day) => {
                const dayBlocks = blocks.filter((b) => b.date === day.dateStr);

                return (
                  <div
                    key={day.dateStr}
                    className={`border-r border-slate-800/40 p-2 space-y-2 min-h-[450px] flex flex-col justify-between transition-colors hover:bg-slate-900/20 ${
                      day.isToday ? 'bg-purple-950/10' : ''
                    }`}
                  >
                    {/* List of Events */}
                    <div className="space-y-2 flex-1">
                      {dayBlocks.length > 0 ? (
                        dayBlocks.map((block) => (
                          <ScheduleBlockCard key={block.id} block={block} variant="week" />
                        ))
                      ) : (
                        <div className="py-8 text-center text-[10px] text-slate-600 font-semibold italic">
                          Chưa có lịch
                        </div>
                      )}
                    </div>

                    {/* Quick Add Button at bottom of column */}
                    <button
                      onClick={() => handleSlotClick(day.dateStr, 9)}
                      className="w-full py-1.5 rounded-xl border border-dashed border-slate-800 hover:border-purple-500/40 hover:bg-purple-500/10 text-slate-500 hover:text-purple-300 transition-all flex items-center justify-center text-[11px] font-semibold cursor-pointer group mt-2"
                    >
                      <span>+ Thêm lịch</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
