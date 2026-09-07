// ============================================================
// MyNotes — DayView Single-Day Timeline Component
// Detailed hourly time slots for a single selected date
// ============================================================

import { useScheduleStore } from '../../stores/scheduleStore';
import { ScheduleBlockCard } from './ScheduleBlockCard';

export function DayView() {
  const { selectedDate, getFilteredBlocks, setAddModalOpen } = useScheduleStore();
  const dayBlocks = getFilteredBlocks().filter((b) => b.date === selectedDate);
  const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 to 22:00

  const handleSlotClick = (hour: number) => {
    const startTime = `${hour.toString().padStart(2, '0')}:00`;
    setAddModalOpen(true, null, { date: selectedDate, startTime });
  };

  // Helper to parse HH:mm into floating hour number (e.g. "08:30" => 8.5)
  const parseHourNum = (timeStr?: string, defaultHour = 9) => {
    if (!timeStr) return defaultHour;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) + (m || 0) / 60;
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto w-full space-y-3">
        {/* Quick Add Button Header for DayView */}
        <div className="flex items-center justify-between p-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl mb-4">
          <span className="text-xs font-bold text-slate-300">
            📅 Lịch trình ngày: <span className="text-purple-400 font-mono">{selectedDate}</span> ({dayBlocks.length} lịch)
          </span>
          <button
            onClick={() => handleSlotClick(9)}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1"
          >
            + Thêm Lịch Ngày Này
          </button>
        </div>

        {hours.map((hour) => {
          const hourStr = `${hour.toString().padStart(2, '0')}:00`;
          
          // Blocks starting in this hour
          const startingBlocks = dayBlocks.filter((b) => {
            const start = parseHourNum(b.startTime, 9);
            return Math.floor(start) === hour;
          });

          // Blocks spanning over this hour (started earlier, ending after this hour)
          const spanningBlocks = dayBlocks.filter((b) => {
            const start = parseHourNum(b.startTime, 9);
            const end = b.endTime ? parseHourNum(b.endTime, start + 1) : start + 1;
            return Math.floor(start) < hour && end > hour;
          });

          return (
            <div key={hour} className="flex gap-3 sm:gap-4 group">
              {/* Hour Label */}
              <div className="w-14 sm:w-16 pt-1 text-right text-xs font-mono font-bold text-slate-500 shrink-0">
                {hourStr}
              </div>

              {/* Slot Container */}
              <div
                onClick={(e) => {
                  // Only click slot if not clicking a card
                  if ((e.target as HTMLElement).closest('.schedule-card')) return;
                  handleSlotClick(hour);
                }}
                className="flex-1 min-h-[68px] p-2 bg-slate-900/40 border border-slate-800/60 hover:border-purple-500/40 rounded-2xl transition-all space-y-2 cursor-pointer relative"
              >
                {/* Starting Blocks */}
                {startingBlocks.map((block) => {
                  const start = parseHourNum(block.startTime, hour);
                  const end = block.endTime ? parseHourNum(block.endTime, start + 1) : start + 1;
                  const durationHours = Math.max(1, Math.round(end - start));

                  return (
                    <div key={block.id} className="schedule-card">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-purple-300 font-mono bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                          ⏱️ Thời lượng: {block.startTime || '09:00'} - {block.endTime || '10:00'} ({durationHours}h)
                        </span>
                      </div>
                      <ScheduleBlockCard block={block} />
                    </div>
                  );
                })}

                {/* Spanning Indicator */}
                {spanningBlocks.map((block) => (
                  <div
                    key={`span_${block.id}`}
                    className="p-2 rounded-xl border border-dashed border-purple-500/30 bg-purple-950/15 flex items-center justify-between text-xs text-purple-300/80 schedule-card"
                  >
                    <span className="font-semibold text-[11px] truncate flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shrink-0" />
                      Đang trong thời gian: <strong>{block.title}</strong> ({block.startTime} - {block.endTime})
                    </span>
                  </div>
                ))}

                {/* Empty Slot Hover Hint */}
                {startingBlocks.length === 0 && spanningBlocks.length === 0 && (
                  <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[11px] font-semibold text-purple-400">
                      + Thêm lịch lúc {hourStr}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
