// ============================================================
// MyNotes — App Layout
// 3-column responsive grid: Days | Notebooks | Editor
// ============================================================

import { DaySidebar } from '../sidebar/DaySidebar';
import { NotebookSidebar } from '../sidebar/NotebookSidebar';
import { Editor } from '../editor/Editor';
import { HomePage } from '../home/HomePage';
import { Header } from './Header';
import { useNotesStore } from '../../stores/notesStore';

export function AppLayout() {
  const { selectedPageId } = useNotesStore();

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--color-bg-primary)' }}>
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* Day Sidebar — hidden on mobile */}
        <div className="hidden lg:block" style={{ width: '220px', minWidth: '220px' }}>
          <DaySidebar />
        </div>

        {/* Notebook Sidebar — hidden on mobile */}
        <div className="hidden md:block" style={{ width: '260px', minWidth: '260px' }}>
          <NotebookSidebar />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
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
