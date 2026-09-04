// ============================================================
// MyNotes — Day Sidebar
// Left column: Timeline view of days grouped by month.
// ============================================================

import { useEffect } from 'react';
import { Calendar, Plus } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { formatDateDisplay, getMonthLabel, isToday } from '../../utils';
import { getNotebookCountByDay } from '../../services/database/repository';
import { useState } from 'react';

interface DayWithCount {
  id: string;
  date: string;
  notebookCount: number;
}

export function DaySidebar() {
  const { days, selectedDayId, selectDay, selectToday, loadDays } = useNotesStore();
  const [daysWithCounts, setDaysWithCounts] = useState<DayWithCount[]>([]);

  useEffect(() => {
    loadDays();
  }, [loadDays]);

  useEffect(() => {
    const loadCounts = async () => {
      const withCounts = await Promise.all(
        days.map(async (day) => {
          const count = await getNotebookCountByDay(day.id);
          return { ...day, notebookCount: count };
        })
      );
      setDaysWithCounts(withCounts);
    };
    loadCounts();
  }, [days]);

  // Group by month
  const grouped = new Map<string, DayWithCount[]>();
  for (const day of daysWithCounts) {
    const label = getMonthLabel(day.date);
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label)!.push(day);
  }

  const handleToday = () => {
    selectToday();
  };

  return (
    <aside
      className="w-full h-full flex flex-col overflow-hidden"
      style={{ background: 'var(--color-bg-secondary)', borderRight: '1px solid var(--color-border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
          Days
        </span>
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

      {/* Day List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {daysWithCounts.length === 0 ? (
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
          Array.from(grouped.entries()).map(([monthLabel, monthDays]) => (
            <div key={monthLabel} className="mb-4">
              <div className="px-2 py-1.5 mb-1">
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>
                  {monthLabel}
                </span>
              </div>
              {monthDays.map((day) => {
                const selected = day.id === selectedDayId;
                const today = isToday(day.date);
                return (
                  <button
                    key={day.id}
                    onClick={() => selectDay(day.id)}
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
          ))
        )}
      </div>
    </aside>
  );
}
