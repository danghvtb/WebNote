// ============================================================
// MyNotes — MonthView Calendar Grid Component
// Monthly overview grid of schedule blocks
// ============================================================

import { useScheduleStore } from '../../stores/scheduleStore';
import { todayDate } from '../../utils';

export function MonthView() {
  const { selectedDate, getFilteredBlocks, setSelectedDate, setViewMode } = useScheduleStore();
  const blocks = getFilteredBlocks();

  const getMonthMatrix = () => {
    const current = new Date(selectedDate);
    const year = current.getFullYear();
    const month = current.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1; // Mon index 0

    const daysInMonth = lastDayOfMonth.getDate();
    const matrix: { dateStr: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean }[] = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, prevMonthLastDay - i);
      matrix.push({
        dateStr: prevDate.toISOString().split('T')[0],
        dayNum: prevDate.getDate(),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(year, month, d);
      const dateStr = curDate.toISOString().split('T')[0];
      matrix.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayDate(),
      });
    }

    // Next month padding to fill 35 or 42 grid cells
    const remaining = (7 - (matrix.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      matrix.push({
        dateStr: nextDate.toISOString().split('T')[0],
        dayNum: i,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return matrix;
  };

  const daysMatrix = getMonthMatrix();
  const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

  const handleCellClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setViewMode('day');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      {/* Month Days Header */}
      <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-900/60 sticky top-0 z-10">
        {DAY_LABELS.map((lbl) => (
          <div key={lbl} className="py-2.5 text-center text-xs font-bold text-slate-400">
            {lbl}
          </div>
        ))}
      </div>

      {/* Month Cells Grid */}
      <div className="flex-1 grid grid-cols-7 overflow-y-auto">
        {daysMatrix.map((cell, idx) => {
          const dayBlocks = blocks.filter((b) => b.date === cell.dateStr);

          return (
            <div
              key={idx}
              onClick={() => handleCellClick(cell.dateStr)}
              className={`min-h-[100px] border-r border-b border-slate-800/40 p-2 transition-colors hover:bg-purple-950/20 cursor-pointer ${
                !cell.isCurrentMonth ? 'opacity-30 bg-slate-950' : 'bg-slate-900/20'
              } ${cell.isToday ? 'bg-purple-950/30' : ''}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    cell.isToday
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-300'
                  }`}
                >
                  {cell.dayNum}
                </span>

                {dayBlocks.length > 0 && (
                  <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20">
                    {dayBlocks.length} lịch
                  </span>
                )}
              </div>

              {/* Preview Blocks */}
              <div className="space-y-1">
                {dayBlocks.slice(0, 3).map((b) => (
                  <div
                    key={b.id}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-200 truncate"
                    style={{ backgroundColor: `${b.color || '#3b82f6'}25`, borderLeft: `2px solid ${b.color || '#3b82f6'}` }}
                  >
                    {b.title}
                  </div>
                ))}
                {dayBlocks.length > 3 && (
                  <span className="text-[9px] text-slate-500 block font-semibold">
                    +{dayBlocks.length - 3} lịch khác...
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
