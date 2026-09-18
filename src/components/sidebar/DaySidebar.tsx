// ============================================================
// MyNotes — Day Sidebar
// Left column: Timeline view of days grouped by week or month.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, Plus, ClipboardList, Notebook } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { useWorkReportStore } from '../../stores/workReportStore';
import { useAppStore } from '../../stores/appStore';
import { formatDateDisplay, isToday, todayDate, todayId } from '../../utils';
import { getAllVaultNotebooks, getAllWorkReports } from '../../services/database/repository';
import {
  buildTimelineDays,
  dateFromDayId,
  getTimelineGroupKey,
  groupTimelineDays,
} from '../../utils/timelineGrouping';

interface DayWithCount {
  id: string;
  date: string;
  notebookCount: number;
  workReportCount?: number;
}

interface DaySidebarProps {
  mobile?: boolean;
}

export function DaySidebar({ mobile = false }: DaySidebarProps) {
  const { days, selectedDayId, selectDay, selectToday, loadDays } = useNotesStore();
  const reportsVersion = useWorkReportStore((state) => state.reportsVersion);
  const {
    setMobileDaySidebarOpen,
    setMobileSidebarOpen,
    timelineGroupingMode,
    setTimelineGroupingMode,
    expandedTimelineGroupKeys,
    toggleTimelineGroup,
    ensureTimelineGroupsExpanded,
    setCreateNotebookOpen,
  } = useAppStore();
  const [daysWithCounts, setDaysWithCounts] = useState<DayWithCount[]>([]);
  const [addMenuDayId, setAddMenuDayId] = useState<string | null>(null);

  useEffect(() => {
    loadDays();
  }, [loadDays]);

  useEffect(() => {
    let cancelled = false;

    const loadCounts = async () => {
      try {
        // Build the timeline from the notebooks as well as the Day records.
        // Older/synced data can contain notebooks whose Day record is missing
        // on this device, and those dates must still be visible in the timeline.
        const [notebooks, reports] = await Promise.all([getAllVaultNotebooks(), getAllWorkReports()]);
        const withCounts = buildTimelineDays(days, notebooks, {
          id: todayId(),
          date: todayDate(),
        }).map((day) => ({ ...day, workReportCount: 0 }));
        const byDay = new Map(withCounts.map((day) => [day.id, day]));
        reports.forEach((report) => {
          const existing = byDay.get(report.dayId);
          if (existing) existing.workReportCount += 1;
          else {
            const date = dateFromDayId(report.dayId);
            if (date) {
              const day = { id: report.dayId, date, notebookCount: 0, workReportCount: 1 };
              withCounts.push(day);
              byDay.set(day.id, day);
            }
          }
        });
        withCounts.sort((a, b) => b.date.localeCompare(a.date));

        if (!cancelled) setDaysWithCounts(withCounts);
      } catch (error) {
        console.warn('[DaySidebar] Failed to load timeline counts:', error);
        if (!cancelled) setDaysWithCounts([]);
      }
    };

    loadCounts();

    return () => {
      cancelled = true;
    };
  }, [days, reportsVersion]);

  // Show every calendar day, including days without notebooks or work reports.
  const visibleDaysWithCounts = useMemo(
    () => daysWithCounts,
    [daysWithCounts],
  );

  const grouped = useMemo(
    () => groupTimelineDays(visibleDaysWithCounts, timelineGroupingMode),
    [visibleDaysWithCounts, timelineGroupingMode],
  );

  const selectedDate =
    daysWithCounts.find((day) => day.id === selectedDayId)?.date ??
    dateFromDayId(selectedDayId);

  useEffect(() => {
    const keys = [todayDate(), selectedDate]
      .filter((date): date is string => !!date)
      .map((date) => getTimelineGroupKey(date, timelineGroupingMode));

    ensureTimelineGroupsExpanded(timelineGroupingMode, keys);
  }, [ensureTimelineGroupsExpanded, selectedDate, timelineGroupingMode]);

  const handleToday = async () => {
    useWorkReportStore.getState().clearSelectedReport();
    await selectToday();
    if (mobile) {
      useNotesStore.getState().clearPageEditorSelection();
      setMobileSidebarOpen(true);
      setMobileDaySidebarOpen(false);
    }
  };

  const handleDaySelect = async (day: DayWithCount) => {
    useWorkReportStore.getState().clearSelectedReport();
    if (isToday(day.date)) {
      await selectToday();
    } else {
      await selectDay(day.id);
    }
    if (mobile) {
      useNotesStore.getState().clearPageEditorSelection();
      setMobileSidebarOpen(true);
      setMobileDaySidebarOpen(false);
    }
  };

  const handleAddNotebook = (dayId: string) => {
    setAddMenuDayId(null);
    useWorkReportStore.getState().clearSelectedReport();
    selectDay(dayId);
    setCreateNotebookOpen(true);
  };

  const handleAddReport = async (dayId: string) => {
    setAddMenuDayId(null);
    useWorkReportStore.getState().clearSelectedReport();
    await selectDay(dayId);
    useNotesStore.getState().clearPageSelection();
    await useWorkReportStore.getState().openOrCreateReport(dayId);
    if (mobile) { setMobileDaySidebarOpen(false); setMobileSidebarOpen(false); }
  };

  return (
    <aside
      className={`${mobile ? 'w-full h-full' : 'w-56 h-full'} flex flex-col flex-shrink-0 glass-sidebar`}
      aria-label="Dòng thời gian các ngày"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
          Dòng thời gian
        </span>
        <div className="flex items-center gap-1">
          <div className="flex items-center p-0.5 rounded-lg" style={{ background: 'var(--color-bg-primary)' }} role="group" aria-label="Nhóm dòng thời gian">
            {(['week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTimelineGroupingMode(mode)}
                className="touch-target px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                style={{
                  background: timelineGroupingMode === mode ? 'var(--color-bg-active)' : 'transparent',
                  color: timelineGroupingMode === mode ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                }}
                aria-pressed={timelineGroupingMode === mode}
              >
                {mode === 'week' ? 'Tuần' : 'Tháng'}
              </button>
            ))}
          </div>
          <button
            onClick={handleToday}
            className="touch-target flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer"
            style={{ color: 'var(--color-accent)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-dim)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Về hôm nay"
            aria-label="Về hôm nay"
          >
            <Calendar className="w-3 h-3" />
            Hôm nay
          </button>
        </div>
      </div>

      {/* Day List */}
      <div className={`${mobile ? 'flex-1 min-h-0 overflow-y-auto' : 'flex-1 overflow-y-auto'} px-2 py-2`}>
        {visibleDaysWithCounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Calendar className="w-8 h-8 mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
            <p className="text-sm text-center" style={{ color: 'var(--color-text-tertiary)' }}>
              Chưa có nội dung.
            </p>
            <button
              onClick={handleToday}
              className="touch-target mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
              style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}
            >
              <Plus className="w-3 h-3" />
              Bắt đầu hôm nay
            </button>
          </div>
        ) : (
          grouped.map((group) => {
            const expanded = expandedTimelineGroupKeys[timelineGroupingMode].includes(group.key);

            return (
              <div key={group.key} className="mb-2">
                <button
                  type="button"
                  onClick={() => toggleTimelineGroup(timelineGroupingMode, group.key)}
                  className="touch-target w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg transition-colors cursor-pointer"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  aria-expanded={expanded}
                >
                  <span className="min-w-0 text-left">
                    <span className="block text-xs font-semibold truncate">{group.label}</span>
                    <span className="block text-[10px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                      {group.notebookCount} {group.notebookCount === 1 ? 'sổ' : 'sổ'} · {group.notebookDayCount} {group.notebookDayCount === 1 ? 'ngày' : 'ngày'}{group.workReportCount ? ` · ${group.workReportCount} báo cáo` : ''}
                    </span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && group.days.map((day) => {
                  const selected = day.id === selectedDayId;
                  const today = isToday(day.date);
                  return (
                    <div key={day.id} className="relative group">
                    <button
                      onClick={() => handleDaySelect(day)}
                      className="touch-target w-full text-left flex items-center gap-3 px-3 py-2 pr-8 rounded-lg mb-0.5 transition-colors cursor-pointer"
                      style={{ background: selected ? 'var(--color-bg-active)' : 'transparent' }}
                      onMouseEnter={(e) => !selected && (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                      onMouseLeave={(e) => !selected && (e.currentTarget.style.background = 'transparent')}
                      aria-label={`${formatDateDisplay(day.date)} - ${day.notebookCount} sổ ghi chú${day.workReportCount ? ', có báo cáo công việc' : ''}`}
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          background: today
                            ? 'var(--color-accent)'
                            : selected
                            ? 'var(--color-text-secondary)'
                            : 'var(--color-text-tertiary)',
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-medium"
                            style={{ color: selected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                          >
                            {formatDateDisplay(day.date)}
                          </span>
                          {today && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}>
                              Today
                            </span>
                          )}
                        </div>
                        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          {day.notebookCount} sổ ghi chú{day.workReportCount ? ` · ${day.workReportCount} báo cáo` : ''}
                        </span>
                      </div>
                    </button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); setAddMenuDayId((current) => current === day.id ? null : day.id); }} className="touch-target absolute right-1 top-1 p-2 rounded-md opacity-100 md:opacity-0 md:group-hover:opacity-100 cursor-pointer" style={{ color: 'var(--color-accent)' }} aria-label={`Thêm nội dung cho ${formatDateDisplay(day.date)}`}><Plus className="w-3.5 h-3.5" /></button>
                    {addMenuDayId === day.id && <div className="absolute right-0 top-9 z-30 w-48 rounded-lg p-1 shadow-xl" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                      <button type="button" onClick={() => handleAddNotebook(day.id)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs text-left cursor-pointer hover:bg-[var(--color-bg-hover)]" style={{ color: 'var(--color-text-secondary)' }}><Notebook className="w-3.5 h-3.5" /> Sổ ghi chú</button>
                      <button type="button" onClick={() => handleAddReport(day.id)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs text-left cursor-pointer hover:bg-[var(--color-bg-hover)]" style={{ color: 'var(--color-text-secondary)' }}><ClipboardList className="w-3.5 h-3.5" /> Báo cáo công việc</button>
                    </div>}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
