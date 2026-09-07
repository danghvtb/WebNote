// ============================================================
// MyNotes — DayView Premium Continuous Timeline Component
// Google Calendar / Outlook style absolute positioning canvas
// ============================================================

import { useScheduleStore } from '../../stores/scheduleStore';
import { ScheduleBlockCard } from './ScheduleBlockCard';
import { todayDate } from '../../utils';
import { formatLunarDateFull } from '../../utils/lunarCalendar';
import type { ScheduleBlock } from '../../types';

const HOUR_HEIGHT = 64; // 64px per hour (approx 1px per minute)
const START_HOUR = 6;  // Timeline starts at 06:00
const END_HOUR = 23;   // Timeline ends at 23:00
const TOTAL_HOURS = END_HOUR - START_HOUR + 1;

export function DayView() {
  const { selectedDate, getFilteredBlocks, setAddModalOpen } = useScheduleStore();
  const dayBlocks = getFilteredBlocks().filter((b) => b.date === selectedDate);
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => i + START_HOUR);

  // Helper to convert "HH:mm" to minutes from START_HOUR
  const getMinutesFromStart = (timeStr?: string, defaultHour = 9): number => {
    if (!timeStr) return (defaultHour - START_HOUR) * 60;
    const [h, m] = timeStr.split(':').map(Number);
    const hourVal = isNaN(h) ? defaultHour : h;
    const minVal = isNaN(m) ? 0 : m;
    return Math.max(0, (hourVal - START_HOUR) * 60 + minVal);
  };

  // Helper to calculate overlap groups and column positions
  const computePositionedBlocks = (blocks: ScheduleBlock[]) => {
    const parsed = blocks.map((block) => {
      const startMin = getMinutesFromStart(block.startTime, 9);
      let endMin = getMinutesFromStart(block.endTime, 10);
      if (endMin <= startMin) endMin = startMin + 60; // minimum 60 mins if invalid
      return {
        block,
        startMin,
        endMin,
        durationMins: endMin - startMin,
        colIndex: 0,
        totalCols: 1,
      };
    });

    // Sort by startMin asc, duration desc
    parsed.sort((a, b) => a.startMin - b.startMin || b.durationMins - a.durationMins);

    // Group overlapping blocks
    const clusters: typeof parsed[] = [];
    let currentCluster: typeof parsed = [];
    let clusterEnd = -1;

    for (const item of parsed) {
      if (currentCluster.length === 0) {
        currentCluster.push(item);
        clusterEnd = item.endMin;
      } else if (item.startMin < clusterEnd) {
        currentCluster.push(item);
        clusterEnd = Math.max(clusterEnd, item.endMin);
      } else {
        clusters.push(currentCluster);
        currentCluster = [item];
        clusterEnd = item.endMin;
      }
    }
    if (currentCluster.length > 0) {
      clusters.push(currentCluster);
    }

    // Assign column indices per cluster
    for (const cluster of clusters) {
      const columns: typeof parsed = [];

      for (const item of cluster) {
        let col = 0;
        while (columns[col] && columns[col].endMin > item.startMin) {
          col++;
        }
        item.colIndex = col;
        columns[col] = item;
      }

      const totalCols = Math.max(...cluster.map((i) => i.colIndex)) + 1;
      for (const item of cluster) {
        item.totalCols = totalCols;
      }
    }

    return parsed;
  };

  const positionedBlocks = computePositionedBlocks(dayBlocks);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent trigger if clicking on an event card
    if ((e.target as HTMLElement).closest('.event-card-container')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const clickedHour = Math.floor(offsetY / HOUR_HEIGHT) + START_HOUR;
    const clampedHour = Math.min(Math.max(clickedHour, START_HOUR), END_HOUR);
    const startTime = `${clampedHour.toString().padStart(2, '0')}:00`;
    setAddModalOpen(true, null, { date: selectedDate, startTime });
  };

  // Current time line calculation
  const now = new Date();
  const isTodaySelected = selectedDate === todayDate();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const nowTop = (currentHour - START_HOUR) * HOUR_HEIGHT + (currentMin / 60) * HOUR_HEIGHT;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-4 sm:p-6 select-none">
      <div className="max-w-4xl mx-auto w-full space-y-4">
        {/* Header Summary Toolbar */}
        <div className="flex items-center justify-between p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping" />
              <span className="text-xs font-bold text-slate-200">
                📅 Dòng thời gian ngày: <span className="text-purple-400 font-mono">{selectedDate}</span> ({dayBlocks.length} lịch)
              </span>
            </div>
            <div className="text-[11px] font-medium text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20 flex items-center gap-1.5">
              <span>🌙 Âm lịch:</span>
              <span>{formatLunarDateFull(selectedDate)}</span>
            </div>
          </div>
          <button
            onClick={() => setAddModalOpen(true, null, { date: selectedDate, startTime: '09:00' })}
            className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all shadow-md shadow-purple-600/25 cursor-pointer flex items-center gap-1.5"
          >
            + Thêm Lịch Mới
          </button>
        </div>

        {/* Timeline Canvas Container */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-6 relative shadow-inner overflow-hidden">
          {/* Background Hourly Grid Lines & Labels */}
          <div
            className="relative cursor-pointer"
            style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
            onClick={handleCanvasClick}
          >
            {hours.map((hour) => {
              const topPos = (hour - START_HOUR) * HOUR_HEIGHT;
              const hourStr = `${hour.toString().padStart(2, '0')}:00`;

              return (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-slate-800/50 flex items-start group"
                  style={{ top: topPos, height: HOUR_HEIGHT }}
                >
                  {/* Hour Label */}
                  <span className="text-[11px] font-mono font-bold text-slate-500 -mt-2.5 w-12 sm:w-14 shrink-0 bg-slate-950/40 px-1 rounded">
                    {hourStr}
                  </span>

                  {/* Half-hour dashed line */}
                  <div
                    className="absolute left-14 right-0 border-t border-dashed border-slate-800/30"
                    style={{ top: HOUR_HEIGHT / 2 }}
                  />

                  {/* Click Hover Helper Text */}
                  <div className="ml-14 flex-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center text-[10px] font-semibold text-purple-400/80 pt-1">
                    + Click để tạo lịch lúc {hourStr}
                  </div>
                </div>
              );
            })}

            {/* Red Indicator Line for Current Time */}
            {isTodaySelected && currentHour >= START_HOUR && currentHour <= END_HOUR && (
              <div
                className="absolute left-12 right-0 border-t-2 border-rose-500 z-30 flex items-center pointer-events-none"
                style={{ top: nowTop }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.25 shadow-md shadow-rose-500/50 animate-pulse" />
                <span className="text-[9px] font-mono font-bold text-rose-300 bg-rose-950 px-1.5 py-0.5 rounded border border-rose-500/40 ml-2">
                  Hiện tại {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}

            {/* Absolute Positioned Events Layer */}
            <div className="absolute left-14 sm:left-16 right-0 top-0 bottom-0 pointer-events-none">
              {positionedBlocks.map(({ block, startMin, durationMins, colIndex, totalCols }) => {
                // Top position: 64px per hour -> (startMin / 60) * 64
                const topPx = (startMin / 60) * HOUR_HEIGHT;

                // Height: (durationMins / 60) * 64px (e.g. 9 hours = 9 * 64 = 576px)
                const heightPx = Math.max(48, (durationMins / 60) * HOUR_HEIGHT - 4); // gap of 4px

                // Calculate horizontal position & width percentage for overlapping blocks
                const widthPercent = 100 / totalCols;
                const leftPercent = colIndex * widthPercent;

                return (
                  <div
                    key={block.id}
                    className="absolute pointer-events-auto transition-all duration-200 event-card-container px-1 overflow-hidden"
                    style={{
                      top: topPx,
                      height: heightPx,
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                    }}
                  >
                    <div className="h-full w-full overflow-hidden flex flex-col">
                      <ScheduleBlockCard block={block} />
                    </div>
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
