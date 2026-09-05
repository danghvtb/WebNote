// ============================================================
// MyNotes — Global Task Manager Modal
// Scans all notes for tasks/todos, provides unified view, priority sorting & deadline management.
// ============================================================

import { useState, useMemo } from 'react';
import { X, CheckSquare, Search, ExternalLink, CheckCircle2, Circle, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { queueSync } from '../../services/sync/syncManager';
import { parseAllTasks, updateTaskDueDateInHtml, type ParsedTask } from '../../utils/taskUtils';

interface TaskManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TaskManagerModal({ isOpen, onClose }: TaskManagerModalProps) {
  const { pages, notebooks, selectPage, updatePageContent } = useNotesStore();
  const [filter, setFilter] = useState<'all' | 'overdue' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract all tasks across all pages
  const allTasks = useMemo(() => {
    return parseAllTasks(pages, notebooks);
  }, [pages, notebooks]);

  // Toggle task completed status directly in note HTML
  const toggleTask = async (task: ParsedTask) => {
    const page = pages.find((p) => p.id === task.pageId);
    if (!page || !page.content) return;

    const parser = new DOMParser();
    const doc = parser.parseFromString(page.content, 'text/html');
    const taskNodes = doc.querySelectorAll('li[data-type="taskItem"]');

    taskNodes.forEach((node) => {
      const text = node.textContent?.trim() || '';
      if (text.includes(task.text) || task.text.includes(text)) {
        const currentStatus = node.getAttribute('data-checked') === 'true';
        node.setAttribute('data-checked', (!currentStatus).toString());
      }
    });

    const updatedHtml = doc.body.innerHTML;
    await updatePageContent(task.pageId, updatedHtml);
    queueSync('update', 'page', task.pageId, { content: updatedHtml });
  };

  // Change or assign task deadline date
  const handleDateChange = async (task: ParsedTask, dateStr: string) => {
    const page = pages.find((p) => p.id === task.pageId);
    if (!page || !page.content) return;

    const updatedHtml = updateTaskDueDateInHtml(page.content, task.text, dateStr || null);
    await updatePageContent(task.pageId, updatedHtml);
    queueSync('update', 'page', task.pageId, { content: updatedHtml });
  };

  // Filter tasks based on selected tab and search term
  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'overdue' && t.isOverdue) ||
        (filter === 'pending' && !t.completed) ||
        (filter === 'completed' && t.completed);

      const matchesSearch =
        t.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.pageTitle.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [allTasks, filter, searchQuery]);

  // Prioritize Overdue Tasks at the top of the list!
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      // Completed tasks go to the bottom
      if (a.completed !== b.completed) return a.completed ? 1 : -1;

      // Overdue tasks prioritized FIRST at top
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;

      // Due today tasks second
      if (a.isDueToday !== b.isDueToday) return a.isDueToday ? -1 : 1;

      // Sort by earliest due date
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;

      return 0;
    });
  }, [filteredTasks]);

  const completedCount = allTasks.filter((t) => t.completed).length;
  const overdueCount = allTasks.filter((t) => t.isOverdue).length;
  const progressPercent = allTasks.length > 0 ? Math.round((completedCount / allTasks.length) * 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-4xl max-h-[88vh] bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(168, 85, 247, 0.25)' }}
      >
        {/* Header */}
        <div className="p-5 border-b border-purple-500/20 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Task Center & Todo Dashboard
                {overdueCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-950 border border-rose-500 text-rose-300 text-xs font-extrabold flex items-center gap-1 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    {overdueCount} Overdue
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {allTasks.length} total tasks ({completedCount} completed - {progressPercent}%, {overdueCount} overdue)
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
            className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Filters & Search */}
        <div className="p-4 bg-slate-900/90 border-b border-purple-500/10 flex flex-col sm:flex-row gap-3 justify-between items-center">
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
            {(['all', 'overdue', 'pending', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer flex items-center gap-1.5 ${
                  filter === tab
                    ? tab === 'overdue'
                      ? 'bg-rose-950 text-rose-200 border border-rose-500/60 shadow-sm'
                      : 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'overdue' && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                {tab}{' '}
                {tab === 'all'
                  ? `(${allTasks.length})`
                  : tab === 'overdue'
                  ? `(${overdueCount})`
                  : tab === 'pending'
                  ? `(${allTasks.length - completedCount})`
                  : `(${completedCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {sortedTasks.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-medium">No tasks found</p>
              <p className="text-xs text-slate-600 mt-1">Create checklist items in any note using `/` or toolbar</p>
            </div>
          ) : (
            sortedTasks.map((task) => {
              const isOverdue = task.isOverdue;
              const isDueToday = task.isDueToday;

              return (
                <div
                  key={task.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                    isOverdue
                      ? 'bg-rose-950/70 border-rose-500/80 shadow-[0_0_15px_rgba(244,63,94,0.25)] hover:border-rose-400'
                      : isDueToday
                      ? 'bg-amber-950/50 border-amber-500/70 hover:border-amber-400'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-purple-500/30'
                  }`}
                >
                  {/* Task Checkbox & Text */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => toggleTask(task)}
                      className="flex-shrink-0 cursor-pointer text-slate-400 hover:text-purple-400 transition-colors"
                      title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : isOverdue ? (
                        <Circle className="w-5 h-5 text-rose-400 hover:text-rose-300" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-500 hover:text-purple-400" />
                      )}
                    </button>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-medium truncate ${
                            task.completed
                              ? 'line-through text-slate-500'
                              : isOverdue
                              ? 'text-rose-100 font-bold'
                              : isDueToday
                              ? 'text-amber-200 font-semibold'
                              : 'text-slate-200'
                          }`}
                        >
                          {task.text}
                        </span>

                        {/* Overdue Warning Red Badge */}
                        {isOverdue && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-900 border border-rose-500 text-rose-200 text-[10px] font-extrabold flex items-center gap-1 shadow-sm uppercase tracking-wide">
                            <AlertTriangle className="w-3 h-3 text-rose-300" />
                            QUÁ HẠN (OVERDUE)
                          </span>
                        )}

                        {/* Due Today Badge */}
                        {isDueToday && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-900/80 border border-amber-500 text-amber-200 text-[10px] font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-300" />
                            Hôm nay (Due Today)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Deadline Date Picker & Page Nav */}
                  <div className="flex items-center gap-2.5 flex-shrink-0 self-end sm:self-auto">
                    {/* Inline Deadline DatePicker */}
                    <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 focus-within:border-purple-500/50">
                      <Calendar className={`w-3.5 h-3.5 ${isOverdue ? 'text-rose-400' : 'text-slate-400'}`} />
                      <input
                        type="date"
                        value={task.dueDate || ''}
                        onChange={(e) => handleDateChange(task, e.target.value)}
                        className={`text-[11px] bg-transparent outline-none cursor-pointer ${
                          isOverdue
                            ? 'text-rose-300 font-bold'
                            : task.dueDate
                            ? 'text-purple-300'
                            : 'text-slate-500'
                        }`}
                        title="Assign or change deadline"
                      />
                    </div>

                    <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-900 text-slate-400 border border-slate-800 hidden md:inline-block">
                      {task.notebookTitle}
                    </span>

                    <button
                      onClick={() => {
                        selectPage(task.pageId);
                        onClose();
                      }}
                      className="flex items-center gap-1 text-[11px] text-purple-300 hover:text-white transition-colors cursor-pointer bg-purple-950/60 border border-purple-500/30 px-2.5 py-1 rounded-lg hover:bg-purple-900/60"
                      title="Open page in editor"
                    >
                      <span className="max-w-[100px] truncate">{task.pageTitle}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
