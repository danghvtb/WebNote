// ============================================================
// MyNotes — Work Category Manager Modal Component
// Manage personal Work / Project categories
// ============================================================

import React, { useState } from 'react';
import { X, FolderKanban, Trash2, Tag } from 'lucide-react';
import { useScheduleStore } from '../../stores/scheduleStore';

export function CustomTaskManagerModal() {
  const {
    taskManagerModalOpen,
    setTaskManagerModalOpen,
    categories,
    addOrUpdateCategory,
    removeCategory,
  } = useScheduleStore();

  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#3b82f6');

  if (!taskManagerModalOpen) return null;

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    await addOrUpdateCategory({
      name: catName.trim(),
      color: catColor,
    });

    setCatName('');
  };

  const COLOR_PRESETS = ['#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Quản Lý Nhóm Work / Project</h3>
              <p className="text-[11px] text-slate-400">Tạo và phân loại nhóm công việc cá nhân</p>
            </div>
          </div>
          <button
            onClick={() => setTaskManagerModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Đóng quản lý nhóm Work"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Manager Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          <form onSubmit={handleCreateCategory} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-purple-400" /> Tạo Nhóm Work / Project
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Tên nhóm (VD: Dự án WebNote, Học tập)..."
                className="min-w-[180px] flex-1 px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500/60"
              />
              <div className="flex items-center gap-1">
                {COLOR_PRESETS.map((color) => (
                  <button
                    type="button"
                    key={color}
                    onClick={() => setCatColor(color)}
                    className={`w-6 h-6 rounded-full transition-all ${
                      catColor === color ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Chọn màu ${color}`}
                  />
                ))}
              </div>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-sm shrink-0"
              >
                + Tạo Nhóm
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {categories.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">Chưa có nhóm Work nào.</p>
            ) : (
              categories.map((category) => (
                <div
                  key={category.id}
                  className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                    <span className="text-xs font-bold text-slate-200">{category.name}</span>
                  </div>

                  <button
                    onClick={() => removeCategory(category.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-all"
                    aria-label={`Xóa nhóm ${category.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
