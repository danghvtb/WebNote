// ============================================================
// MyNotes — Global Task Manager Modal
// Scans all notes for tasks/todos, provides unified view & toggle.
// ============================================================

import { useState, useMemo } from 'react';
import { X, CheckSquare, Search, ExternalLink, CheckCircle2, Circle } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { queueSync } from '../../services/sync/syncManager';

interface TaskManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedTask {
  id: string;
  pageId: string;
  pageTitle: string;
  notebookTitle: string;
  text: string;
  completed: boolean;
  rawHtml: string;
}

export function TaskManagerModal({ isOpen, onClose }: TaskManagerModalProps) {
  const { pages, notebooks, selectPage, updatePageContent } = useNotesStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract all tasks from page HTML content
  const allTasks = useMemo(() => {
    const tasks: ParsedTask[] = [];

    pages.forEach((page) => {
      if (!page.content) return;

      const notebook = notebooks.find((nb) => nb.id === page.notebookId);
      const notebookTitle = notebook ? notebook.title : 'Uncategorized';

      // Parse HTML task items using DOMParser
      const parser = new DOMParser();
      const doc = parser.parseFromString(page.content, 'text/html');
      const taskNodes = doc.querySelectorAll('li[data-type="taskItem"]');

      taskNodes.forEach((node, index) => {
        const isChecked = node.getAttribute('data-checked') === 'true';
        const textContent = node.textContent?.trim() || '';

        if (textContent) {
          tasks.push({
            id: `${page.id}-task-${index}`,
            pageId: page.id,
            pageTitle: page.title || 'Untitled',
            notebookTitle,
            text: textContent,
            completed: isChecked,
            rawHtml: node.outerHTML,
          });
        }
      });
    });

    return tasks;
  }, [pages, notebooks]);

  // Toggle task completed status directly in note HTML
  const toggleTask = async (task: ParsedTask) => {
    const page = pages.find((p) => p.id === task.pageId);
    if (!page || !page.content) return;

    const parser = new DOMParser();
    const doc = parser.parseFromString(page.content, 'text/html');
    const taskNodes = doc.querySelectorAll('li[data-type="taskItem"]');

    taskNodes.forEach((node) => {
      if (node.textContent?.trim() === task.text) {
        const currentStatus = node.getAttribute('data-checked') === 'true';
        node.setAttribute('data-checked', (!currentStatus).toString());
      }
    });

    const updatedHtml = doc.body.innerHTML;
    await updatePageContent(task.pageId, updatedHtml);
    queueSync('update', 'page', task.pageId, { content: updatedHtml });
  };

  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'pending' && !t.completed) ||
        (filter === 'completed' && t.completed);

      const matchesSearch =
        t.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.pageTitle.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [allTasks, filter, searchQuery]);

  const completedCount = allTasks.filter((t) => t.completed).length;
  const progressPercent = allTasks.length > 0 ? Math.round((completedCount / allTasks.length) * 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-3xl max-h-[85vh] bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(168, 85, 247, 0.2)' }}
      >
        {/* Header */}
        <div className="p-5 border-b border-purple-500/20 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Task Center & Todo Dashboard
              </h3>
              <p className="text-xs text-slate-400">
                {allTasks.length} total tasks across all notes ({completedCount} completed - {progressPercent}%)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-950 h-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Filters & Search */}
        <div className="p-4 bg-slate-900/80 border-b border-purple-500/10 flex flex-col sm:flex-row gap-3 justify-between items-center">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-purple-500/50"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto justify-center">
            {(['all', 'pending', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 text-xs font-medium rounded-lg capitalize transition-all cursor-pointer ${
                  filter === tab
                    ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab} {tab === 'all' ? `(${allTasks.length})` : tab === 'pending' ? `(${allTasks.length - completedCount})` : `(${completedCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredTasks.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-medium">No tasks found</p>
              <p className="text-xs text-slate-600 mt-1">Create checklist items in any note using `/` or toolbar</p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-purple-500/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => toggleTask(task)}
                    className="flex-shrink-0 cursor-pointer text-slate-400 hover:text-purple-400 transition-colors"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-purple-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500 hover:text-purple-400" />
                    )}
                  </button>
                  <span
                    className={`text-xs text-slate-200 truncate ${
                      task.completed ? 'line-through text-slate-500' : ''
                    }`}
                  >
                    {task.text}
                  </span>
                </div>

                <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    {task.notebookTitle}
                  </span>
                  <button
                    onClick={() => {
                      selectPage(task.pageId);
                      onClose();
                    }}
                    className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 transition-colors cursor-pointer bg-purple-950/40 border border-purple-500/20 px-2 py-1 rounded-lg"
                  >
                    <span>{task.pageTitle}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
