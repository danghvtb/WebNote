import { lazy, Suspense, useEffect, useRef } from 'react';
import { DaySidebar } from '../sidebar/DaySidebar';
import { NotebookSidebar } from '../sidebar/NotebookSidebar';
import { Header } from './Header';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { X, Calendar, Home, MoreHorizontal } from 'lucide-react';
import { useWorkReportStore } from '../../stores/workReportStore';
import { vi } from '../../i18n/vi';

const Editor = lazy(() => import('../editor/Editor').then((module) => ({ default: module.Editor })));
const HomePage = lazy(() => import('../home/HomePage').then((module) => ({ default: module.HomePage })));
const SchedulePage = lazy(() => import('../schedule/SchedulePage').then((module) => ({ default: module.SchedulePage })));
const WorkReportEditor = lazy(() => import('../workReport/WorkReportEditor').then((module) => ({ default: module.WorkReportEditor })));

export function AppLayout() {
  const { selectedPageId, selectedNotebookId, selectedDayId, selectDay, selectPage, selectNotebook, selectToday } = useNotesStore();
  const selectedReportId = useWorkReportStore((s) => s.selectedReportId);
  const openReportById = useWorkReportStore((s) => s.openReportById);
  const clearSelectedReport = useWorkReportStore((s) => s.clearSelectedReport);
  const { activeTab } = useScheduleStore();
  const setActiveTab = useScheduleStore((state) => state.setActiveTab);
  const {
    mobileSidebarOpen,
    setMobileSidebarOpen,
    mobileDaySidebarOpen,
    setMobileDaySidebarOpen,
  } = useAppStore();
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);

  const lastRouteRef = useRef('');
  const restoringRouteRef = useRef(false);

  // Keep the current view addressable and restorable on refresh/GitHub Pages.
  useEffect(() => {
    const route = activeTab === 'schedule'
      ? '#/schedule'
      : selectedReportId
        ? `#/report/${selectedReportId}`
      : selectedPageId
        ? `#/page/${selectedPageId}`
        : selectedNotebookId
          ? `#/notebook/${selectedNotebookId}`
          : selectedDayId
            ? `#/day/${selectedDayId.replace(/^day_/, '')}`
            : '#/today';
    if (!restoringRouteRef.current && route !== lastRouteRef.current && window.location.hash !== route) {
      window.history.pushState({}, '', route);
    }
    lastRouteRef.current = route;
  }, [activeTab, selectedDayId, selectedNotebookId, selectedPageId, selectedReportId]);

  useEffect(() => {
    const restoreRoute = () => {
      const hash = window.location.hash;
      restoringRouteRef.current = true;
      const finishRestore = () => { restoringRouteRef.current = false; lastRouteRef.current = window.location.hash; };
      if (hash === '#/schedule') {
        setActiveTab('schedule');
        finishRestore();
        return;
      }
      if (hash === '#/today' || hash === '' || hash === '#') {
        void selectToday().finally(finishRestore);
        return;
      }
      if (hash.startsWith('#/report/')) {
        void openReportById(hash.slice('#/report/'.length)).finally(finishRestore);
        return;
      }
      if (hash.startsWith('#/page/')) {
        void Promise.resolve(selectPage(hash.slice('#/page/'.length))).finally(finishRestore);
      } else if (hash.startsWith('#/notebook/')) {
        void Promise.resolve(selectNotebook(hash.slice('#/notebook/'.length))).finally(finishRestore);
      } else if (hash.startsWith('#/day/')) {
        void selectDay(`day_${hash.slice('#/day/'.length).replace(/-/g, '')}`).finally(finishRestore);
      } else {
        finishRestore();
      }
    };
    restoreRoute();
    window.addEventListener('popstate', restoreRoute);
    window.addEventListener('hashchange', restoreRoute);
    return () => {
      window.removeEventListener('popstate', restoreRoute);
      window.removeEventListener('hashchange', restoreRoute);
    };
  }, [selectDay, selectNotebook, selectPage, selectToday, setActiveTab, openReportById]);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedReportId && (selectedPageId || selectedNotebookId)) clearSelectedReport();
  }, [selectedPageId, selectedNotebookId, selectedReportId, clearSelectedReport]);

  // Allow keyboard users to close the mobile drawer without reaching for the close button.
  useEffect(() => {
    if (!mobileSidebarOpen) return;
    requestAnimationFrame(() => {
      mobileDrawerRef.current?.querySelector<HTMLElement>('button:not([aria-hidden="true"])')?.focus();
    });
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileSidebarOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileSidebarOpen, setMobileSidebarOpen]);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
      <Header />

      {activeTab === 'schedule' ? (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-sm text-slate-400">Đang mở lịch biểu…</div>}><SchedulePage /></Suspense>
      ) : (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Desktop Day Sidebar (hidden < lg) */}
          <div className="hidden lg:block border-r border-[var(--color-border)]" style={{ width: '220px', minWidth: '220px' }}>
            <DaySidebar />
          </div>

          {/* Desktop Notebook Sidebar (hidden < md) */}
          <div className="hidden md:block border-r border-[var(--color-border)]" style={{ width: '260px', minWidth: '260px' }}>
            <NotebookSidebar />
          </div>

          {/* Mobile Slide-Over Drawer: Notebooks & Pages */}
          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-40 md:hidden flex">
              {/* Backdrop */}
              <button
                type="button"
                className="fixed inset-0 border-0 p-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-default"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Đóng bảng điều hướng"
              />

              {/* Content Drawer */}
              <div
                ref={mobileDrawerRef}
                className="relative w-[min(88vw,360px)] bg-[var(--color-bg-secondary)] h-full flex flex-col shadow-2xl z-50 animate-slide-in-left"
                role="dialog"
                aria-modal="true"
                aria-label={mobileDaySidebarOpen ? 'Dòng thời gian' : 'Nội dung ngày'}
              >
                <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
                  <button
                    onClick={() => setMobileDaySidebarOpen(!mobileDaySidebarOpen)}
                    className="touch-target flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-cyan-400 border border-slate-700"
                    aria-label={mobileDaySidebarOpen ? 'Mở nội dung ngày' : 'Mở dòng thời gian'}
                    aria-pressed={!mobileDaySidebarOpen}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{mobileDaySidebarOpen ? 'Nội dung ngày' : 'Dòng thời gian'}</span>
                  </button>
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{mobileDaySidebarOpen ? 'Dòng thời gian' : 'Nội dung ngày'}</span>
                  <button
                    onClick={() => setMobileSidebarOpen(false)}
                    className="touch-target p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-white"
                    aria-label="Đóng bảng điều hướng"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Drawer Content */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  {mobileDaySidebarOpen ? <DaySidebar mobile /> : <NotebookSidebar />}
                </div>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col pb-14 md:pb-0">
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-sm text-slate-400">Đang mở nội dung…</div>}>
              {selectedReportId ? <WorkReportEditor key={selectedReportId} /> : selectedPageId ? <Editor /> : <HomePage />}
            </Suspense>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-center justify-around border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]" aria-label="Điều hướng chính">
        <button type="button" className="touch-target flex flex-col items-center justify-center gap-0.5 px-3 text-[10px] text-[var(--color-text-secondary)]" onClick={() => { void selectToday(); setMobileSidebarOpen(false); }}><Home className="w-4 h-4" />{vi.today}</button>
        <button type="button" className="touch-target flex flex-col items-center justify-center gap-0.5 px-3 text-[10px] text-[var(--color-text-secondary)]" onClick={() => { setMobileDaySidebarOpen(true); setMobileSidebarOpen(true); }}><MenuIcon />{vi.notes}</button>
        <button type="button" className="touch-target flex flex-col items-center justify-center gap-0.5 px-3 text-[10px] text-[var(--color-text-secondary)]" onClick={() => { setActiveTab('schedule'); setMobileSidebarOpen(false); }}><Calendar className="w-4 h-4" />{vi.schedule}</button>
        <button type="button" className="touch-target flex flex-col items-center justify-center gap-0.5 px-3 text-[10px] text-[var(--color-text-secondary)]" onClick={() => setSettingsOpen(true)}><MoreHorizontal className="w-4 h-4" />{vi.more}</button>
      </nav>
    </div>
  );
}

function MenuIcon() {
  return <span className="text-sm leading-none" aria-hidden="true">☰</span>;
}
