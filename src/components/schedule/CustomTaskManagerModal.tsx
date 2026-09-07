// ============================================================
// MyNotes — Task & Work Category Manager Modal Component
// Allows users to create, manage & categorize custom Tasks / Works
// ============================================================

import React, { useState } from 'react';
import { X, Plus, FolderKanban, Trash2, Tag, Check } from 'lucide-react';
import { useScheduleStore } from '../../stores/scheduleStore';

export function CustomTaskManagerModal() {
  const {
    taskManagerModalOpen,
    setTaskManagerModalOpen,
    customTasks,
    categories,
    addOrUpdateTask,
    removeTask,
    toggleTaskStatus,
    addOrUpdateCategory,
    removeCategory,
  } = useScheduleStore();

  const [activeTab, setActiveTab] = useState<'tasks' | 'categories'>('tasks');

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [taskDueDate, setTaskDueDate] = useState<string>('');

  // Category form state
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#3b82f6');

  if (!taskManagerModalOpen) return null;

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const cat = categories.find((c) => c.id === selectedCatId);
    await addOrUpdateTask({
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      categoryId: selectedCatId || undefined,
      categoryName: cat?.name,
      dueDate: taskDueDate || undefined,
      status: 'todo',
    });

    setTaskTitle('');
    setTaskDesc('');
    setTaskDueDate('');
  };

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
              <h3 className="text-base font-bold text-slate-100">Quản Lý Work & Custom Tasks</h3>
              <p className="text-[11px] text-slate-400">Tạo công việc & phân loại nhóm công việc cá nhân</p>
            </div>
          </div>
          <button
            onClick={() => setTaskManagerModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center px-5 pt-3 border-b border-slate-800 bg-slate-950 gap-4">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`pb-2.5 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'tasks'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Danh Sách Work Tasks ({customTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`pb-2.5 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'categories'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Nhóm Công Việc / Project ({categories.length})
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {activeTab === 'tasks' ? (
            <>
              {/* Form Create Task */}
              <form onSubmit={handleCreateTask} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-purple-400" /> Tạo Công Việc Mới
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="Tên công việc/task..."
                    className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500/60"
                  />
                  <select
                    value={selectedCatId}
                    onChange={(e) => setSelectedCatId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-purple-500/60"
                  >
                    <option value="">Không gán nhóm (Mặc định)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-sm"
                  >
                    + Thêm Task
                  </button>
                </div>
              </form>

              {/* Tasks List */}
              <div className="space-y-2">
                {customTasks.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">Chưa có công việc tùy chỉnh nào.</p>
                ) : (
                  customTasks.map((t) => {
                    const cat = categories.find((c) => c.id === t.categoryId);

                    return (
                      <div
                        key={t.id}
                        className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            onClick={() => toggleTaskStatus(t.id)}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              t.status === 'completed'
                                ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                                : 'border-slate-700 hover:border-purple-400'
                            }`}
                          >
                            {t.status === 'completed' && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>

                          <div className="min-w-0">
                            <p
                              className={`text-xs font-semibold truncate ${
                                t.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-100'
                              }`}
                            >
                              {t.title}
                            </p>
                            {cat && (
                              <span
                                className="inline-block text-[10px] font-bold px-1.5 py-0.2 rounded mt-1"
                                style={{ backgroundColor: `${cat.color}25`, color: cat.color }}
                              >
                                {cat.name}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => removeTask(t.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              {/* Form Create Category */}
              <form onSubmit={handleCreateCategory} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-purple-400" /> Tạo Nhóm Work / Project
                </h4>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="Tên nhóm (VD: Dự án WebNote, Học tập)..."
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500/60"
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

              {/* Categories List */}
              <div className="space-y-2">
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="text-xs font-bold text-slate-200">{c.name}</span>
                    </div>

                    <button
                      onClick={() => removeCategory(c.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
