// ============================================================
// MyNotes — Smart Schedule Main Page Component
// Container for Smart Schedule Route (/schedule or View Toggle)
// ============================================================

import { useEffect, useState } from 'react';
import { useScheduleStore } from '../../stores/scheduleStore';
import { CalendarHeader } from './CalendarHeader';
import { TaskSidebar } from './TaskSidebar';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { MonthView } from './MonthView';
import { AddScheduleModal } from './AddScheduleModal';
import { DailyBriefingModal } from './DailyBriefingModal';
import { AISchedulePanel } from './AISchedulePanel';

export function SchedulePage() {
  const { viewMode, loadAllBlocks } = useScheduleStore();
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  useEffect(() => {
    loadAllBlocks();
  }, [loadAllBlocks]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Top Calendar Navigation Toolbar */}
      <CalendarHeader onOpenAIPanel={() => setAiPanelOpen(true)} />

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Unscheduled Tasks Sidebar */}
        <TaskSidebar />

        {/* Calendar View Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {viewMode === 'week' && <WeekView />}
          {viewMode === 'day' && <DayView />}
          {viewMode === 'month' && <MonthView />}
        </div>
      </div>

      {/* Modals & AI Drawer Panels */}
      <AddScheduleModal />
      <DailyBriefingModal />
      <AISchedulePanel isOpen={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />
    </div>
  );
}
