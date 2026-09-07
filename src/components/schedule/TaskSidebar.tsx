// ============================================================
// MyNotes — Task Sidebar Drag Source Component
// Displays unscheduled tasks from Vault ready to be scheduled
// ============================================================

import { useEffect, useState } from 'react';
import { CheckSquare, CalendarPlus, Search, FileText } from 'lucide-react';
import { useScheduleStore } from '../../stores/scheduleStore';
import { getAllVaultPages, getAllVaultNotebooks } from '../../services/database/repository';
import { parseAllTasks, type ParsedTask } from '../../utils/taskUtils';
import type { CustomUserTask } from '../../types';

export function TaskSidebar() {
  const {
    blocks,
    selectedDate,
    customTasks,
    categories,
    setTaskManagerModalOpen,
    addOrUpdateBlock,
  } = useScheduleStore();

  const [tab, setTab] = useState<'note_tasks' | 'work_tasks'>('work_tasks');
  const [noteTasks, setNoteTasks] = useState<ParsedTask[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchVaultTasks = async () => {
    setLoading(true);
    try {
      const [pages, notebooks] = await Promise.all([getAllVaultPages(), getAllVaultNotebooks()]);
      const allTasks = parseAllTasks(pages, notebooks, true);
      const pendingTasks = allTasks.filter((t) => !t.completed);
      setNoteTasks(pendingTasks);
    } catch (err) {
      console.error('[TaskSidebar] Error parsing vault tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVaultTasks();
  }, [blocks]);

  // Already scheduled tasks IDs
  const scheduledNoteTaskIds = new Set(blocks.map((b) => b.taskId).filter(Boolean));
  const scheduledCustomTaskIds = new Set(blocks.map((b) => b.customTaskId).filter(Boolean));

  const filteredNoteTasks = noteTasks.filter((t) => {
    if (scheduledNoteTaskIds.has(t.id)) return false;
    if (search.trim()) {
      return t.text.toLowerCase().includes(search.toLowerCase()) || t.pageTitle.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const filteredWorkTasks = customTasks.filter((t) => {
    if (t.status === 'completed') return false;
    if (scheduledCustomTaskIds.has(t.id)) return false;
    if (search.trim()) {
      return t.title.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const handleQuickScheduleNoteTask = async (t: ParsedTask) => {
    await addOrUpdateBlock({
      title: t.text,
      date: selectedDate,
      startTime: '09:00',
      endTime: '10:00',
      estimatedMinutes: 60,
      completed: false,
      taskId: t.id,
      pageId: t.pageId,
      priority: 'medium',
      color: '#3b82f6',
    });
  };

  const handleQuickScheduleCustomTask = async (t: CustomUserTask) => {
    const cat = categories.find((c) => c.id === t.categoryId);
    await addOrUpdateBlock({
      title: t.title,
      date: selectedDate,
      startTime: '09:00',
      endTime: '10:00',
      estimatedMinutes: 60,
      completed: false,
      customTaskId: t.id,
      categoryId: t.categoryId,
      priority: 'medium',
      color: cat?.color || '#3b82f6',
    });
  };

  return (
    <div className="w-80 h-full border-r border-slate-800 bg-slate-900/60 flex flex-col shrink-0">
      {/* Sidebar Header */}
      <div className="p-3.5 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-purple-400" />
            Danh Sách Tasks Chưa Xếp Lịch
          </h4>
          <button
            onClick={() => setTaskManagerModalOpen(true)}
            className="px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg text-[10px] font-bold transition-all"
            title="Quản lý Công Việc & Nhóm Work"
          >
            ⚙️ Quản Lý
          </button>
        </div>

        {/* Sub-tabs: Work Tasks vs Note Tasks */}
        <div className="grid grid-cols-2 p-0.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-bold">
          <button
            onClick={() => setTab('work_tasks')}
            className={`py-1 rounded transition-all ${
              tab === 'work_tasks' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Work Tasks ({filteredWorkTasks.length})
          </button>
          <button
            onClick={() => setTab('note_tasks')}
            className={`py-1 rounded transition-all ${
              tab === 'note_tasks' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Note Tasks ({filteredNoteTasks.length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm công việc..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/60"
          />
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2">
        {tab === 'work_tasks' ? (
          filteredWorkTasks.length === 0 ? (
            <div className="py-8 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-400">Không có Work Task chưa xếp lịch</p>
              <button
                onClick={() => setTaskManagerModalOpen(true)}
                className="text-[11px] font-bold text-purple-400 hover:text-purple-300 transition-colors"
              >
                + Tạo Work Task Mới
              </button>
            </div>
          ) : (
            filteredWorkTasks.map((t) => {
              const cat = categories.find((c) => c.id === t.categoryId);

              return (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-purple-500/40 transition-all group"
                >
                  <p className="text-xs font-semibold text-slate-200 line-clamp-2">{t.title}</p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-900 text-[10px] text-slate-400">
                    {cat ? (
                      <span
                        className="font-bold px-1.5 py-0.2 rounded"
                        style={{ backgroundColor: `${cat.color}25`, color: cat.color }}
                      >
                        {cat.name}
                      </span>
                    ) : (
                      <span className="text-slate-500">Chưa gắn nhóm</span>
                    )}

                    <button
                      onClick={() => handleQuickScheduleCustomTask(t)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg flex items-center gap-1 shadow-sm"
                    >
                      <CalendarPlus className="w-3 h-3" /> + Lịch
                    </button>
                  </div>
                </div>
              );
            })
          )
        ) : loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Đang quét kho ghi chú...</div>
        ) : filteredNoteTasks.length === 0 ? (
          <div className="py-8 text-center space-y-1">
            <p className="text-xs font-semibold text-slate-400">Không có note task chưa xếp lịch</p>
            <p className="text-[11px] text-slate-500">Tất cả task ghi chú đã được xếp vào lịch biểu!</p>
          </div>
        ) : (
          filteredNoteTasks.map((t) => (
            <div
              key={t.id}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-purple-500/40 transition-all group"
            >
              <p className="text-xs font-medium text-slate-200 line-clamp-2">{t.text}</p>

              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-900 text-[10px] text-slate-400">
                <span className="flex items-center gap-1 text-slate-500 truncate max-w-[150px]">
                  <FileText className="w-3 h-3" /> {t.pageTitle}
                </span>

                <button
                  onClick={() => handleQuickScheduleNoteTask(t)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg flex items-center gap-1 shadow-sm"
                >
                  <CalendarPlus className="w-3 h-3" /> + Lịch
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
