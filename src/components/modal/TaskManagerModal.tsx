// ============================================================
// MyNotes — Global Task Manager Modal
// Scans all notes for tasks/todos, provides unified view, priority sorting & smart deadline management (Date+Time).
// ============================================================

import { useState, useMemo, useEffect } from 'react';
import { X, CheckSquare, Search, ExternalLink, CheckCircle2, Circle, AlertTriangle, Calendar, Clock, Zap, Trash2 } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { queueSync } from '../../services/sync/syncManager';
import { getAllVaultPages, getAllVaultNotebooks } from '../../services/database/repository';
import type { Page, Notebook } from '../../types';
import { todayDate } from '../../utils';
import {
  parseAllTasks,
  updateTaskDueDateInHtml,
  formatRelativeDeadline,
  getQuickPresetDate,
  formatForDateTimeInput,
  isValidDueDate,
  type ParsedTask,
} from '../../utils/taskUtils';

interface TaskManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TaskManagerModal({ isOpen, onClose }: TaskManagerModalProps) {
  const { pages, notebooks, selectPage, updatePageContent } = useNotesStore();
  const [filter, setFilter] = useState<'all' | 'overdue' | 'pending' | 'completed'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'kanban'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [vaultPages, setVaultPages] = useState<Page[]>([]);
  const [vaultNotebooks, setVaultNotebooks] = useState<Notebook[]>([]);

  // Fetch 100% of all pages and notebooks across the entire vault when Task Center opens
  useEffect(() => {
    if (isOpen) {
      Promise.all([getAllVaultPages(), getAllVaultNotebooks()]).then(([allP, allN]) => {
        setVaultPages(allP);
        setVaultNotebooks(allN);
      });
    }
  }, [isOpen, pages, notebooks]);

  const targetPages = vaultPages.length > 0 ? vaultPages : pages;
  const targetNotebooks = vaultNotebooks.length > 0 ? vaultNotebooks : notebooks;
  const todayStr = todayDate();

  // Extract tasks across ALL vault pages:
  // 1. Must have VALID deadline assigned (isValidDueDate(t.dueDate))
  // 2. Pending tasks (completed === false): show all (Overdue, Due Today, Future Due)
  // 3. Completed tasks (completed === true): ONLY show if deadline is TODAY
  const allTasks = useMemo(() => {
    const tasks = parseAllTasks(targetPages, targetNotebooks, true);
    return tasks.filter((t) => {
      if (!isValidDueDate(t.dueDate)) return false;
      const datePart = t.dueDate.split('T')[0].split(' ')[0];
      if (t.completed) {
        return datePart === todayStr;
      }
      return true;
    });
  }, [targetPages, targetNotebooks, todayStr]);

  // Toggle task completed status directly in note HTML
  const toggleTask = async (task: ParsedTask) => {
    const page = targetPages.find((p) => p.id === task.pageId);
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

    // Update local vault pages cache for instant UI refresh
    setVaultPages((prev) =>
      prev.map((p) => (p.id === task.pageId ? { ...p, content: updatedHtml } : p))
    );
  };

  // Change or assign task deadline date & time
  const handleDateChange = async (task: ParsedTask, dateStr: string) => {
    const page = targetPages.find((p) => p.id === task.pageId);
    if (!page || !page.content) return;

    const updatedHtml = updateTaskDueDateInHtml(page.content, task.text, dateStr || null);
    await updatePageContent(task.pageId, updatedHtml);
    queueSync('update', 'page', task.pageId, { content: updatedHtml });

    // Update local vault pages cache for instant UI refresh
    setVaultPages((prev) =>
      prev.map((p) => (p.id === task.pageId ? { ...p, content: updatedHtml } : p))
    );
  };

  // Quick preset action (Today, Tomorrow, +1h, +1d, +1w)
  const handleApplyPreset = async (task: ParsedTask, action: 'today' | 'tomorrow' | 'add_1h' | 'add_1d' | 'add_1w') => {
    const newDateStr = getQuickPresetDate(action, task.dueDate);
    await handleDateChange(task, newDateStr);
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

  // Sort tasks: Earliest deadline at the very top!
  // Order:
  // 1. Pending (uncompleted) tasks come before Completed tasks.
  // 2. Overdue tasks appear first at top (sorted from oldest overdue to newest).
  // 3. Upcoming tasks sorted chronologically by earliest date & time (e.g. 08:00 before 17:00).
  // 4. Completed tasks go to the bottom.
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      // Completed tasks go to the bottom
      if (a.completed !== b.completed) return a.completed ? 1 : -1;

      // Compare exact due date timestamps
      const timeA = a.dueDate ? new Date(a.dueDate.includes('T') ? a.dueDate : `${a.dueDate}T18:00`).getTime() : Infinity;
      const timeB = b.dueDate ? new Date(b.dueDate.includes('T') ? b.dueDate : `${b.dueDate}T18:00`).getTime() : Infinity;

      return timeA - timeB;
    });
  }, [filteredTasks]);

  const completedCount = allTasks.filter((t) => t.completed).length;
  const overdueCount = allTasks.filter((t) => t.isOverdue).length;
  const progressPercent = allTasks.length > 0 ? Math.round((completedCount / allTasks.length) * 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(168, 85, 247, 0.25)' }}
      >
        {/* Header */}
        <div className="p-5 border-b border-purple-500/20 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Task Center & Smart Deadline Manager
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

        {/* Filters, View Modes & Search */}
        <div className="p-4 bg-slate-900/90 border-b border-purple-500/10 flex flex-col md:flex-row gap-3 justify-between items-center">
          {/* Left: Search + View Modes */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            {/* View Mode Selector */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'list' ? 'bg-purple-600/40 text-purple-200 border border-purple-500/50' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📋 List
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'kanban' ? 'bg-purple-600/40 text-purple-200 border border-purple-500/50' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📊 Kanban
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full md:w-auto justify-center overflow-x-auto">
            {(['all', 'overdue', 'pending', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  filter === tab
                    ? tab === 'overdue'
                      ? 'bg-rose-950 text-rose-200 border border-rose-500/60 shadow-sm'
                      : 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'overdue' && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                {tab === 'completed' ? 'completed (today)' : tab}{' '}
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

        {/* View Mode Content Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {viewMode === 'kanban' ? (
            /* KANBAN BOARD VIEW */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full min-h-[350px]">
              {/* Column 1: Overdue */}
              <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-3 flex flex-col">
                <h4 className="text-xs font-bold text-rose-300 mb-3 flex items-center gap-2 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Overdue ({sortedTasks.filter((t) => t.isOverdue && !t.completed).length})
                </h4>
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[420px] pr-1">
                  {sortedTasks.filter((t) => t.isOverdue && !t.completed).map((task) => (
                    <div key={task.id} className="p-3 bg-slate-900 border border-rose-500/40 rounded-xl shadow-sm">
                      <p className="text-xs font-medium text-slate-200 mb-2">{task.text}</p>
                      <div className="flex items-center justify-between text-[10px] text-rose-300">
                        <span>⏰ {task.dueDate}</span>
                        <button onClick={() => toggleTask(task)} className="text-emerald-400 hover:underline">✓ Mark Done</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2: To-Do / Pending */}
              <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-3 flex flex-col">
                <h4 className="text-xs font-bold text-purple-300 mb-3 flex items-center gap-2 uppercase tracking-wider">
                  <Clock className="w-4 h-4 text-purple-400" />
                  Pending ({sortedTasks.filter((t) => !t.isOverdue && !t.completed).length})
                </h4>
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[420px] pr-1">
                  {sortedTasks.filter((t) => !t.isOverdue && !t.completed).map((task) => (
                    <div key={task.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-sm">
                      <p className="text-xs font-medium text-slate-200 mb-2">{task.text}</p>
                      <div className="flex items-center justify-between text-[10px] text-purple-300">
                        <span>📅 {task.dueDate?.split('T')[0]}</span>
                        <button onClick={() => toggleTask(task)} className="text-emerald-400 hover:underline">✓ Mark Done</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 3: Completed */}
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 flex flex-col">
                <h4 className="text-xs font-bold text-emerald-300 mb-3 flex items-center gap-2 uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Completed ({sortedTasks.filter((t) => t.completed).length})
                </h4>
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[420px] pr-1">
                  {sortedTasks.filter((t) => t.completed).map((task) => (
                    <div key={task.id} className="p-3 bg-slate-900 border border-emerald-500/30 rounded-xl opacity-75">
                      <p className="text-xs font-medium line-through text-slate-400 mb-2">{task.text}</p>
                      <div className="flex items-center justify-between text-[10px] text-emerald-400">
                        <span>Completed Today</span>
                        <button onClick={() => toggleTask(task)} className="text-slate-400 hover:underline">Undo</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : sortedTasks.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-medium">No tasks found</p>
              <p className="text-xs text-slate-600 mt-1">Create tasks using checklist or `/deadline` in any note</p>
            </div>
          ) : (
            sortedTasks.map((task) => {
              const isOverdue = task.isOverdue;
              const isDueToday = task.isDueToday;
              const relativeTime = task.dueDate ? formatRelativeDeadline(task.dueDate) : null;

              return (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3 group ${
                    isOverdue
                      ? 'bg-rose-950/70 border-rose-500/80 shadow-[0_0_18px_rgba(244,63,94,0.3)] hover:border-rose-400'
                      : isDueToday
                      ? 'bg-amber-950/40 border-amber-500/60 hover:border-amber-400'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-purple-500/30'
                  }`}
                >
                  {/* Task Checkbox & Text */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => toggleTask(task)}
                      className="mt-0.5 flex-shrink-0 cursor-pointer text-slate-400 hover:text-purple-400 transition-colors"
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

                    <div className="flex flex-col min-w-0 space-y-1">
                      <span
                        className={`text-xs font-medium ${
                          task.completed
                            ? 'line-through text-slate-500'
                            : isOverdue
                            ? 'text-rose-100 font-bold text-sm'
                            : isDueToday
                            ? 'text-amber-200 font-semibold'
                            : 'text-slate-200'
                        }`}
                      >
                        {task.text}
                      </span>

                      {/* Smart Relative Time Countdown Badge */}
                      {relativeTime && !task.completed && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 border ${
                              relativeTime.isOverdue
                                ? 'bg-rose-900/90 text-rose-200 border-rose-500/80 shadow-sm animate-pulse'
                                : relativeTime.isDueToday
                                ? 'bg-amber-900/80 text-amber-200 border-amber-500/70'
                                : 'bg-purple-950/60 text-purple-300 border-purple-500/30'
                            }`}
                          >
                            {relativeTime.isOverdue && <AlertTriangle className="w-3 h-3 text-rose-300" />}
                            {relativeTime.isDueToday && <Zap className="w-3 h-3 text-amber-300" />}
                            {!relativeTime.isOverdue && !relativeTime.isDueToday && <Clock className="w-3 h-3 text-purple-400" />}
                            {relativeTime.label}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Quick Action Presets, Datetime Picker & Page Navigation */}
                  <div className="flex flex-wrap items-center gap-2 flex-shrink-0 self-end lg:self-auto">
                    {/* 1-Click Quick Action Presets */}
                    <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
                      <button
                        onClick={() => handleApplyPreset(task, 'today')}
                        className="px-2 py-0.5 text-[10px] rounded bg-purple-950/60 border border-purple-500/30 text-purple-300 hover:bg-purple-900/60 transition-all cursor-pointer font-medium"
                        title="Gán deadline Hôm nay 18:00"
                      >
                        ⚡ Hôm nay
                      </button>
                      <button
                        onClick={() => handleApplyPreset(task, 'tomorrow')}
                        className="px-2 py-0.5 text-[10px] rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all cursor-pointer font-medium"
                        title="Gán deadline Ngày mai 09:00"
                      >
                        ☀️ Ngày mai
                      </button>
                      <button
                        onClick={() => handleApplyPreset(task, 'add_1h')}
                        className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all cursor-pointer"
                        title="Gia hạn +1 Giờ"
                      >
                        +1h
                      </button>
                      <button
                        onClick={() => handleApplyPreset(task, 'add_1d')}
                        className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all cursor-pointer"
                        title="Gia hạn +1 Ngày"
                      >
                        +1d
                      </button>
                      <button
                        onClick={() => handleApplyPreset(task, 'add_1w')}
                        className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all cursor-pointer"
                        title="Gia hạn +1 Tuần"
                      >
                        +1w
                      </button>
                      {task.dueDate && (
                        <button
                          onClick={() => handleDateChange(task, '')}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-all cursor-pointer"
                          title="Xóa deadline"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Exact Date & Time Picker */}
                    <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 focus-within:border-purple-500/50">
                      <Calendar className={`w-3.5 h-3.5 ${isOverdue ? 'text-rose-400' : 'text-slate-400'}`} />
                      <input
                        type="datetime-local"
                        value={formatForDateTimeInput(task.dueDate)}
                        onChange={(e) => handleDateChange(task, e.target.value)}
                        className={`text-[11px] bg-transparent outline-none cursor-pointer ${
                          isOverdue
                            ? 'text-rose-300 font-bold'
                            : task.dueDate
                            ? 'text-purple-300 font-semibold'
                            : 'text-slate-500'
                        }`}
                        title="Chọn ngày & giờ deadline cụ thể"
                      />
                    </div>

                    {/* Notebook Badge & Page Link */}
                    <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-900 text-slate-400 border border-slate-800 hidden xl:inline-block">
                      {task.notebookTitle}
                    </span>

                    <button
                      onClick={() => {
                        selectPage(task.pageId);
                        onClose();
                      }}
                      className="flex items-center gap-1 text-[11px] text-purple-300 hover:text-white transition-colors cursor-pointer bg-purple-950/60 border border-purple-500/30 px-2.5 py-1 rounded-lg hover:bg-purple-900/60"
                      title="Mở ghi chú trong trình soạn thảo"
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
