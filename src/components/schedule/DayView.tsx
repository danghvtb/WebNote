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

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-6">
      <div className="max-w-3xl mx-auto w-full space-y-3">
        {hours.map((hour) => {
          const hourStr = `${hour.toString().padStart(2, '0')}:00`;
          const slotBlocks = dayBlocks.filter((b) => b.startTime?.startsWith(hour.toString().padStart(2, '0')));

          return (
            <div key={hour} className="flex gap-4 group">
              {/* Hour Label */}
              <div className="w-16 pt-1 text-right text-xs font-mono font-bold text-slate-500 shrink-0">
                {hourStr}
              </div>

              {/* Slot Box */}
              <div
                onClick={() => handleSlotClick(hour)}
                className="flex-1 min-h-[64px] p-2 bg-slate-900/40 border border-slate-800/60 hover:border-purple-500/40 rounded-xl transition-all space-y-2 cursor-pointer"
              >
                {slotBlocks.map((block) => (
                  <ScheduleBlockCard key={block.id} block={block} />
                ))}

                {slotBlocks.length === 0 && (
                  <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[11px] font-semibold text-purple-400">
                      + Nhấp để thêm lịch lúc {hourStr}
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
