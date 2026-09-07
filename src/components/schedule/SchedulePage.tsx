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
import { CustomTaskManagerModal } from './CustomTaskManagerModal';
import { CheckSquare, X } from 'lucide-react';

export function SchedulePage() {
  const { viewMode, loadAllBlocks, loadTasksAndCategories } = useScheduleStore();
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [mobileTasksOpen, setMobileTasksOpen] = useState(false);

  useEffect(() => {
    loadAllBlocks();
    loadTasksAndCategories();
  }, [loadAllBlocks, loadTasksAndCategories]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Top Calendar Navigation Toolbar */}
      <CalendarHeader onOpenAIPanel={() => setAiPanelOpen(true)} />

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop TaskSidebar (hidden < lg) */}
        <div className="hidden lg:block">
          <TaskSidebar />
        </div>

        {/* Mobile TaskSidebar Slide-Over Drawer */}
        {mobileTasksOpen && (
          <div className="fixed inset-0 z-[80] lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileTasksOpen(false)}
            />
            <div className="relative w-4/5 max-w-xs bg-slate-900 h-full flex flex-col shadow-2xl z-50 animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-950">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-purple-400" /> Unscheduled Tasks
                </span>
                <button
                  onClick={() => setMobileTasksOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <TaskSidebar />
              </div>
            </div>
          </div>
        )}

        {/* Mobile Task Drawer Trigger Floating Button */}
        <button
          onClick={() => setMobileTasksOpen(true)}
          className="lg:hidden absolute bottom-4 left-4 z-40 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-full shadow-lg flex items-center gap-1.5 border border-purple-400/40"
        >
          <CheckSquare className="w-4 h-4" /> Tasks chưa xếp
        </button>

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
      <CustomTaskManagerModal />
      <AISchedulePanel isOpen={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />
    </div>
  );
}
