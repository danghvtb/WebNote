import { DaySidebar } from '../sidebar/DaySidebar';
import { NotebookSidebar } from '../sidebar/NotebookSidebar';
import { Editor } from '../editor/Editor';
import { HomePage } from '../home/HomePage';
import { Header } from './Header';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { X, Calendar } from 'lucide-react';

export function AppLayout() {
  const { selectedPageId } = useNotesStore();
  const {
    mobileSidebarOpen,
    setMobileSidebarOpen,
    mobileDaySidebarOpen,
    setMobileDaySidebarOpen,
  } = useAppStore();

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
      <Header />

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
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileSidebarOpen(false)}
            />

            {/* Content Drawer */}
            <div className="relative w-4/5 max-w-xs bg-[var(--color-bg-secondary)] h-full flex flex-col shadow-2xl z-50 animate-slide-in-left">
              <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
                <button
                  onClick={() => setMobileDaySidebarOpen(!mobileDaySidebarOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-cyan-400 border border-slate-700"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Timeline</span>
                </button>
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">Notebooks</span>
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1 rounded-lg text-[var(--color-text-tertiary)] hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto">
                {mobileDaySidebarOpen ? <DaySidebar /> : <NotebookSidebar />}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {selectedPageId ? (
            <Editor />
          ) : (
            <HomePage />
          )}
        </div>
      </div>
    </div>
  );
}
