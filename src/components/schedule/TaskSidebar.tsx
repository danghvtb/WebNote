// ============================================================
// MyNotes — Task Sidebar Drag Source Component
// Displays unscheduled tasks from Vault ready to be scheduled
// ============================================================

import { useEffect, useState } from 'react';
import { CheckSquare, CalendarPlus, Search, FileText, Plus } from 'lucide-react';
import { useScheduleStore } from '../../stores/scheduleStore';
import { getAllVaultPages, getAllVaultNotebooks } from '../../services/database/repository';
import { parseAllTasks, type ParsedTask } from '../../utils/taskUtils';

export function TaskSidebar() {
  const { blocks, selectedDate, setAddModalOpen, addOrUpdateBlock } = useScheduleStore();
  const [tasks, setTasks] = useState<ParsedTask[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchVaultTasks = async () => {
    setLoading(true);
    try {
      const [pages, notebooks] = await Promise.all([getAllVaultPages(), getAllVaultNotebooks()]);
      const allTasks = parseAllTasks(pages, notebooks, true);
      
      // Filter uncompleted tasks
      const pendingTasks = allTasks.filter((t) => !t.completed);
      setTasks(pendingTasks);
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
  const scheduledTaskIds = new Set(blocks.map((b) => b.taskId).filter(Boolean));

  const filteredTasks = tasks.filter((t) => {
    if (scheduledTaskIds.has(t.id)) return false;
    if (search.trim()) {
      return t.text.toLowerCase().includes(search.toLowerCase()) || t.pageTitle.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const handleQuickSchedule = async (t: ParsedTask) => {
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

  return (
    <div className="w-80 h-full border-r border-slate-800 bg-slate-900/60 flex flex-col shrink-0">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-purple-400" />
            Unscheduled Tasks ({filteredTasks.length})
          </h4>
          <button
            onClick={() => setAddModalOpen(true)}
            className="p-1.5 rounded-lg text-purple-400 hover:bg-purple-500/10 transition-colors"
            title="Thêm lịch làm việc tùy chỉnh"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm task ghi chú..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/60"
          />
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Đang quét kho ghi chú...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="py-8 text-center space-y-1">
            <p className="text-xs font-semibold text-slate-400">Không có task chưa lên lịch</p>
            <p className="text-[11px] text-slate-500">Tất cả công việc đã được xếp vào lịch biểu!</p>
          </div>
        ) : (
          filteredTasks.map((t) => (
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
                  onClick={() => handleQuickSchedule(t)}
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
