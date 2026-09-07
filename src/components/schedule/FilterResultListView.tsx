// ============================================================
// MyNotes — FilterResultListView Component
// Dedicated view when search/filter is active to list all matching items neatly
// ============================================================

import { Calendar, Tag, CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react';
import { useScheduleStore } from '../../stores/scheduleStore';

export function FilterResultListView() {
  const { getFilteredBlocks, categories, customTasks, resetSearchFilter } = useScheduleStore();
  const filteredBlocks = getFilteredBlocks();

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto w-full space-y-4">
        {/* Header Summary */}
        <div className="flex items-center justify-between p-4 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              Danh Sách Lịch Biểu Lọc Được
            </h3>
            <p className="text-xs text-slate-400">
              Hiển thị <span className="font-bold text-purple-300 font-mono">{filteredBlocks.length}</span> lịch làm việc khớp với bộ lọc
            </p>
          </div>

          <button
            onClick={resetSearchFilter}
            className="px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Xóa bộ lọc
          </button>
        </div>

        {/* Empty State */}
        {filteredBlocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-500">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-300">Không tìm thấy lịch biểu nào</h4>
              <p className="text-xs text-slate-500 max-w-sm">
                Thử thay đổi từ khóa tìm kiếm, điều chỉnh khoảng thời gian hoặc nhóm công việc trong bộ lọc trên thanh công cụ.
              </p>
            </div>
            <button
              onClick={resetSearchFilter}
              className="mt-2 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-md transition-all cursor-pointer"
            >
              Reset tất cả bộ lọc
            </button>
          </div>
        ) : (
          /* Result List */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredBlocks.map((block) => {
              const cat = categories.find((c) => c.id === block.categoryId);
              const customTask = customTasks.find((t) => t.id === block.customTaskId);

              return (
                <div
                  key={block.id}
                  className="p-4 bg-slate-900 border border-slate-800/80 rounded-2xl space-y-3 hover:border-purple-500/40 transition-all shadow-md group relative overflow-hidden"
                  style={{ borderLeft: `4px solid ${block.color || '#3b82f6'}` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-purple-400 font-mono flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-purple-400" />
                        {block.date} {block.startTime ? `• ${block.startTime}${block.endTime ? ` - ${block.endTime}` : ''}` : ''}
                      </span>
                      <h4 className="text-sm font-bold text-slate-100 group-hover:text-purple-200 transition-colors">
                        {block.title}
                      </h4>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        block.completed
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {block.completed ? '✅ Đã xong' : '⏳ Chưa xong'}
                    </span>
                  </div>

                  {block.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                      {block.description}
                    </p>
                  )}

                  {/* Metadata Tags */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
                    {cat && (
                      <span
                        className="px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 text-[10px]"
                        style={{ backgroundColor: `${cat.color}20`, color: cat.color, border: `1px solid ${cat.color}40` }}
                      >
                        <Tag className="w-3 h-3" /> {cat.name}
                      </span>
                    )}

                    {customTask && (
                      <span className="px-2 py-0.5 rounded-md bg-purple-950/40 text-purple-300 border border-purple-500/30 flex items-center gap-1 text-[10px]">
                        <CheckCircle2 className="w-3 h-3 text-purple-400" /> Task: {customTask.title}
                      </span>
                    )}

                    {block.priority && (
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          block.priority === 'high'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : block.priority === 'medium'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        Priority: {block.priority.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
