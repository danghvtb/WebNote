// ============================================================
// MyNotes — WeekView Calendar Grid Component
// 7-day interactive time-slot grid with Drag & Slot Click creation
// ============================================================

import { useScheduleStore } from '../../stores/scheduleStore';
import { ScheduleBlockCard } from './ScheduleBlockCard';
import { todayDate } from '../../utils';

export function WeekView() {
  const { selectedDate, blocks, setAddModalOpen } = useScheduleStore();

  // Compute 7 days of the current week based on selectedDate (Mon - Sun)
  const getWeekDays = () => {
    const current = new Date(selectedDate);
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
      const dateStr = d.toISOString().split('T')[0];
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
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      {/* 7 Column Header */}
      <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-900/50 sticky top-0 z-10">
        {weekDays.map((day) => (
          <div
            key={day.dateStr}
            className={`py-3 px-2 text-center border-r border-slate-800/60 ${
              day.isToday ? 'bg-purple-950/20' : ''
            }`}
          >
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">
              {day.dayName}
            </span>
            <span
              className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold mt-0.5 ${
                day.isToday
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-200'
              }`}
            >
              {day.dayNum}
            </span>
          </div>
        ))}
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 min-h-full">
          {weekDays.map((day) => {
            const dayBlocks = blocks.filter((b) => b.date === day.dateStr);

            return (
              <div
                key={day.dateStr}
                className={`border-r border-slate-800/40 p-2 space-y-2 min-h-[600px] transition-colors hover:bg-slate-900/20 ${
                  day.isToday ? 'bg-purple-950/10' : ''
                }`}
              >
                {/* Unsourced or All-Day Blocks */}
                {dayBlocks.map((block) => (
                  <ScheduleBlockCard key={block.id} block={block} />
                ))}

                {/* Empty Click Slot Placeholder */}
                {dayBlocks.length === 0 && (
                  <div
                    onClick={() => handleSlotClick(day.dateStr, 9)}
                    className="h-full min-h-[120px] rounded-xl border border-dashed border-slate-800/60 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all flex flex-col items-center justify-center text-slate-600 hover:text-purple-400 cursor-pointer group"
                  >
                    <span className="text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      + Thêm Lịch
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
