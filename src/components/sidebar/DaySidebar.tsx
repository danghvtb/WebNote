// ============================================================
// MyNotes — Day Sidebar
// Left column: Timeline view of days grouped by week or month.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, Plus } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { formatDateDisplay, isToday, todayDate, todayId } from '../../utils';
import { getAllVaultNotebooks } from '../../services/database/repository';
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
}

interface DaySidebarProps {
  mobile?: boolean;
}

export function DaySidebar({ mobile = false }: DaySidebarProps) {
  const { days, selectedDayId, selectDay, selectToday, loadDays } = useNotesStore();
  const {
    setMobileDaySidebarOpen,
    timelineGroupingMode,
    setTimelineGroupingMode,
    expandedTimelineGroupKeys,
    toggleTimelineGroup,
    ensureTimelineGroupsExpanded,
  } = useAppStore();
  const [daysWithCounts, setDaysWithCounts] = useState<DayWithCount[]>([]);

  useEffect(() => {
    loadDays();
  }, [loadDays]);

  useEffect(() => {
    let cancelled = false;

    const loadCounts = async () => {
      try {
        // Build the timeline from the notebooks as well as the Day records.
        // Older/synced data can contain notebooks whose Day record is missing
        // on this device, and those dates must still be visible in Timeline.
        const notebooks = await getAllVaultNotebooks();
        const withCounts = buildTimelineDays(days, notebooks, {
          id: todayId(),
          date: todayDate(),
        });

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
  }, [days]);

  // Keep days with notes and always keep today visible, even when it is empty.
  const visibleDaysWithCounts = useMemo(
    () => daysWithCounts.filter((day) => day.notebookCount > 0 || isToday(day.date)),
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

  const handleToday = () => {
    selectToday();
    if (mobile) setMobileDaySidebarOpen(false);
  };

  const handleDaySelect = (day: DayWithCount) => {
    if (isToday(day.date)) {
      selectToday();
    } else {
      selectDay(day.id);
    }
    if (mobile) setMobileDaySidebarOpen(false);
  };

  return (
    <aside
      className={`${mobile ? 'w-full h-full' : 'w-56 h-full'} flex flex-col flex-shrink-0 glass-sidebar`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
          Timeline
        </span>
        <div className="flex items-center gap-1">
          <div className="flex items-center p-0.5 rounded-lg" style={{ background: 'var(--color-bg-primary)' }} role="group" aria-label="Timeline grouping">
            {(['week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTimelineGroupingMode(mode)}
                className="px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
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
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer"
            style={{ color: 'var(--color-accent)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-dim)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Go to today"
            aria-label="Go to today"
          >
            <Calendar className="w-3 h-3" />
            Today
          </button>
        </div>
      </div>

      {/* Day List */}
      <div className={`${mobile ? 'flex-1 min-h-0 overflow-y-auto' : 'flex-1 overflow-y-auto'} px-2 py-2`}>
        {visibleDaysWithCounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Calendar className="w-8 h-8 mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
            <p className="text-sm text-center" style={{ color: 'var(--color-text-tertiary)' }}>
              No notes yet.
            </p>
            <button
              onClick={handleToday}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
              style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}
            >
              <Plus className="w-3 h-3" />
              Start today
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
                  className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg transition-colors cursor-pointer"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  aria-expanded={expanded}
                >
                  <span className="min-w-0 text-left">
                    <span className="block text-xs font-semibold truncate">{group.label}</span>
                    <span className="block text-[10px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                      {group.notebookCount} {group.notebookCount === 1 ? 'notebook' : 'notebooks'} · {group.notebookDayCount} {group.notebookDayCount === 1 ? 'day' : 'days'}
                    </span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && group.days.map((day) => {
                  const selected = day.id === selectedDayId;
                  const today = isToday(day.date);
                  return (
                    <button
                      key={day.id}
                      onClick={() => handleDaySelect(day)}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 transition-colors cursor-pointer"
                      style={{
                        background: selected ? 'var(--color-bg-active)' : 'transparent',
                      }}
                      onMouseEnter={(e) => !selected && (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                      onMouseLeave={(e) => !selected && (e.currentTarget.style.background = 'transparent')}
                      aria-label={`${formatDateDisplay(day.date)} - ${day.notebookCount} notebooks`}
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
                          {day.notebookCount} {day.notebookCount === 1 ? 'notebook' : 'notebooks'}
                        </span>
                      </div>
                    </button>
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
