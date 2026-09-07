// ============================================================
// MyNotes — Add/Edit Schedule Block Modal
// Quick modal form to create or modify a schedule item/time block
// ============================================================

import React, { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import { useScheduleStore } from '../../stores/scheduleStore';
import { todayDate } from '../../utils';
import type { ScheduleBlock, RecurrenceFrequency } from '../../types';

export function AddScheduleModal() {
  const {
    addModalOpen,
    editingBlock,
    selectedTimeSlot,
    customTasks,
    categories,
    setAddModalOpen,
    addOrUpdateBlock,
  } = useScheduleStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayDate());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [color, setColor] = useState('#3b82f6');
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency | 'none'>('none');
  const [completed, setCompleted] = useState(false);

  // New fields for custom task & work category binding (Default: empty / no task)
  const [selectedCustomTaskId, setSelectedCustomTaskId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  useEffect(() => {
    if (editingBlock) {
      setTitle(editingBlock.title || '');
      setDescription(editingBlock.description || '');
      setDate(editingBlock.date || todayDate());
      setStartTime(editingBlock.startTime || '09:00');
      setEndTime(editingBlock.endTime || '10:00');
      setPriority(editingBlock.priority || 'medium');
      setColor(editingBlock.color || '#3b82f6');
      setRecurrence(editingBlock.recurrence?.frequency || 'none');
      setCompleted(editingBlock.completed || false);
      setSelectedCustomTaskId(editingBlock.customTaskId || '');
      setSelectedCategoryId(editingBlock.categoryId || '');
    } else {
      const targetDate = selectedTimeSlot?.date || todayDate();
      const existingSameDayBlocks = useScheduleStore.getState().blocks.filter((b) => b.date === targetDate);
      const usedColors = new Set(existingSameDayBlocks.map((b) => b.color).filter(Boolean));
      
      const PALETTE = ['#3b82f6', '#a855f7', '#f59e0b', '#10b981', '#f43f5e', '#06b6d4', '#ec4899', '#8b5cf6', '#6366f1'];
      const availableColors = PALETTE.filter((c) => !usedColors.has(c));
      const autoColor = availableColors.length > 0
        ? availableColors[Math.floor(Math.random() * availableColors.length)]
        : PALETTE[Math.floor(Math.random() * PALETTE.length)];

      setTitle('');
      setDescription('');
      setDate(targetDate);
      setStartTime(selectedTimeSlot?.startTime || '09:00');
      if (selectedTimeSlot?.startTime) {
        const [h, m] = selectedTimeSlot.startTime.split(':').map(Number);
        const endH = (h + 1) % 24;
        setEndTime(`${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      } else {
        setEndTime('10:00');
      }
      setPriority('medium');
      setColor(autoColor);
      setRecurrence('none');
      setCompleted(false);
      setSelectedCustomTaskId('');
      setSelectedCategoryId('');
    }
  }, [editingBlock, selectedTimeSlot, addModalOpen]);

  if (!addModalOpen) return null;

  // Auto fill title and category if a custom task is picked
  const handleCustomTaskSelect = (taskId: string) => {
    setSelectedCustomTaskId(taskId);
    if (taskId) {
      const task = customTasks.find((t) => t.id === taskId);
      if (task) {
        if (!title.trim()) setTitle(task.title);
        if (task.categoryId) {
          setSelectedCategoryId(task.categoryId);
          const cat = categories.find((c) => c.id === task.categoryId);
          if (cat) setColor(cat.color);
        }
      }
    }
  };

  const handleCategorySelect = (catId: string) => {
    setSelectedCategoryId(catId);
    if (catId) {
      const cat = categories.find((c) => c.id === catId);
      if (cat) setColor(cat.color);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let estMins = 60;
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const diff = eh * 60 + em - (sh * 60 + sm);
      if (diff > 0) estMins = diff;
    }

    const payload: Omit<ScheduleBlock, 'id' | 'createdAt' | 'updatedAt'> & { id?: string } = {
      ...(editingBlock?.id ? { id: editingBlock.id } : {}),
      title: title.trim(),
      description: description.trim(),
      date,
      startTime,
      endTime,
      estimatedMinutes: estMins,
      priority,
      color,
      completed,
      recurrence: recurrence !== 'none' ? { frequency: recurrence } : undefined,
      taskId: editingBlock?.taskId,
      customTaskId: selectedCustomTaskId || undefined,
      categoryId: selectedCategoryId || undefined,
      pageId: editingBlock?.pageId,
    };

    await addOrUpdateBlock(payload);
    setAddModalOpen(false);
  };

  const COLOR_PRESETS = [
    { label: 'Blue', value: '#3b82f6' },
    { label: 'Purple', value: '#a855f7' },
    { label: 'Amber', value: '#f59e0b' },
    { label: 'Emerald', value: '#10b981' },
    { label: 'Rose', value: '#f43f5e' },
    { label: 'Cyan', value: '#06b6d4' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">
              {editingBlock ? 'Chỉnh Sửa Lịch Biểu' : 'Thêm Lịch Làm Việc Mới'}
            </h3>
          </div>
          <button
            onClick={() => setAddModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {/* Optional Task / Category Binding */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
            <div>
              <label className="block text-[11px] font-bold text-purple-300 mb-1">Gắn Work Task (Tùy chọn)</label>
              <select
                value={selectedCustomTaskId}
                onChange={(e) => handleCustomTaskSelect(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-purple-500/60"
              >
                <option value="">-- Không gán Task --</option>
                {customTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-purple-300 mb-1">Nhóm Work / Project</label>
              <select
                value={selectedCategoryId}
                onChange={(e) => handleCategorySelect(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-purple-500/60"
              >
                <option value="">-- Không thuộc Nhóm --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Tên Công Việc / Sự Kiện *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Review PR #42, Họp Team..."
              className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/60"
            />
          </div>

          {/* Date & Time Row (24-Hour Format HH:mm) */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Ngày</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500/60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Bắt Đầu (24h)</label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500/60 font-mono"
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const h = i.toString().padStart(2, '0');
                  return (
                    <React.Fragment key={h}>
                      <option value={`${h}:00`}>{h}:00</option>
                      <option value={`${h}:30`}>{h}:30</option>
                    </React.Fragment>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Kết Thúc (24h)</label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500/60 font-mono"
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const h = i.toString().padStart(2, '0');
                  return (
                    <React.Fragment key={h}>
                      <option value={`${h}:00`}>{h}:00</option>
                      <option value={`${h}:30`}>{h}:30</option>
                    </React.Fragment>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Priority & Color */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Mức Độ Ưu Tiên</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500/60"
              >
                <option value="high">🔴 Cao (High)</option>
                <option value="medium">🟡 Vừa (Medium)</option>
                <option value="low">🔵 Thấp (Low)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Lặp Lại (Recurrence)</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500/60"
              >
                <option value="none">Không lặp lại</option>
                <option value="daily">Hàng ngày</option>
                <option value="weekdays">Thứ 2 đến Thứ 6</option>
                <option value="weekly">Hàng tuần</option>
                <option value="monthly">Hàng tháng</option>
              </select>
            </div>
          </div>

          {/* Color Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Màu Thẻ Display</label>
            <div className="flex items-center gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-7 h-7 rounded-full transition-all flex items-center justify-center ${
                    color === c.value ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Ghi Chú / Chi Tiết</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Thêm mô tả hoặc chuẩn bị cho công việc..."
              className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/60"
            />
          </div>

          {/* Completed Checkbox */}
          {editingBlock && (
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-purple-600 focus:ring-purple-500 bg-slate-950"
              />
              <span className="text-xs font-medium text-slate-300">Đánh dấu đã hoàn thành</span>
            </label>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg shadow-purple-600/25 transition-all"
            >
              {editingBlock ? 'Lưu Thay Đổi' : 'Tạo Lịch Làm Việc'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
