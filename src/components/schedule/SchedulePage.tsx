// ============================================================
// MyNotes — Smart Schedule Main Page Component
// Container for Smart Schedule Route (/schedule or View Toggle)
// ============================================================

import { useEffect, useState } from 'react';
import { useScheduleStore } from '../../stores/scheduleStore';
import { CalendarHeader } from './CalendarHeader';
import { ScheduleFilterBar } from './ScheduleFilterBar';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { MonthView } from './MonthView';
import { AddScheduleModal } from './AddScheduleModal';
import { DailyBriefingModal } from './DailyBriefingModal';
import { AISchedulePanel } from './AISchedulePanel';
import { CustomTaskManagerModal } from './CustomTaskManagerModal';
import { FilterResultListView } from './FilterResultListView';

export function SchedulePage() {
  const { viewMode, searchFilter, loadAllBlocks, loadTasksAndCategories } = useScheduleStore();
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  useEffect(() => {
    loadAllBlocks();
    loadTasksAndCategories();
  }, [loadAllBlocks, loadTasksAndCategories]);

  const isFilterActive =
    !!searchFilter.keyword ||
    searchFilter.categoryId !== 'all' ||
    searchFilter.taskSource !== 'all' ||
    searchFilter.datePreset !== 'all' ||
    searchFilter.status !== 'all' ||
    searchFilter.priority !== 'all';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Top Calendar Navigation Toolbar */}
      <CalendarHeader onOpenAIPanel={() => setAiPanelOpen(true)} />

      {/* Filter Bar Toolbar */}
      <ScheduleFilterBar />

      {/* Calendar View Area OR Filter Results List */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {isFilterActive ? (
          <FilterResultListView />
        ) : (
          <>
            {viewMode === 'week' && <WeekView />}
            {viewMode === 'day' && <DayView />}
            {viewMode === 'month' && <MonthView />}
          </>
        )}
      </div>

      {/* Modals & AI Drawer Panels */}
      <AddScheduleModal />
      <DailyBriefingModal />
      <CustomTaskManagerModal />
      <AISchedulePanel isOpen={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />
    </div>
  );
}
