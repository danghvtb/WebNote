// ============================================================
// MyNotes — Custom Tiptap TaskItem Component with Inline Deadline Picker Button
// Renders an explicit 📅 Deadline Button at the end of every task line in the editor.
// ============================================================

import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';
import { useState, useRef, useEffect } from 'react';
import { Calendar, Zap, Trash2, Clock, AlertTriangle } from 'lucide-react';
import { formatRelativeDeadline, getQuickPresetDate, formatForDateTimeInput } from '../../utils/taskUtils';

export function CustomTaskItemComponent({ node, updateAttributes }: NodeViewProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isChecked = node.attrs.checked;
  const dueDate = node.attrs.due as string | undefined;

  const relativeTime = dueDate ? formatRelativeDeadline(dueDate) : null;

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [popoverOpen]);

  const handleToggleChecked = () => {
    updateAttributes({ checked: !isChecked });
  };

  const handleSetDue = (dateStr: string | null) => {
    updateAttributes({ due: dateStr || null });
  };

  const handlePreset = (action: 'today' | 'tomorrow' | 'add_1h' | 'add_1d' | 'add_1w') => {
    const newDate = getQuickPresetDate(action, dueDate);
    handleSetDue(newDate);
  };

  return (
    <NodeViewWrapper as="li" data-type="taskItem" data-checked={isChecked} data-due={dueDate || ''} className="custom-task-item flex items-start sm:items-center gap-2 group my-1.5 w-full">
      {/* Checkbox */}
      <label className="flex items-center cursor-pointer select-none flex-shrink-0 mt-1 sm:mt-0">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={handleToggleChecked}
          className="accent-purple-500 w-4 h-4 rounded cursor-pointer"
        />
      </label>

      {/* Task Text Content */}
      <NodeViewContent className={`flex-1 min-w-0 break-words ${isChecked ? 'line-through text-slate-500' : 'text-slate-200'}`} />

      {/* Deadline Badge & Action Button at the end of task */}
      <div className="relative flex-shrink-0 flex items-center gap-1.5 select-none" contentEditable={false}>
        {/* Deadline Badge */}
        {relativeTime && (
          <span
            onClick={() => setPopoverOpen((prev) => !prev)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all border ${
              relativeTime.isOverdue
                ? 'bg-rose-950/90 text-rose-200 border-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.3)] animate-pulse'
                : relativeTime.isDueToday
                ? 'bg-amber-950/80 text-amber-200 border-amber-500/70'
                : 'bg-purple-950/60 text-purple-300 border-purple-500/30'
            }`}
            title="Nhấp để chỉnh sửa deadline"
          >
            {relativeTime.isOverdue && <AlertTriangle className="w-3 h-3 text-rose-400" />}
            {relativeTime.isDueToday && <Zap className="w-3 h-3 text-amber-400" />}
            {!relativeTime.isOverdue && !relativeTime.isDueToday && <Clock className="w-3 h-3 text-purple-400" />}
            {relativeTime.label}
          </span>
        )}

        {/* 📅 Deadline Picker Trigger Button at the end of Task */}
        <button
          type="button"
          onClick={() => setPopoverOpen((prev) => !prev)}
          className={`p-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold border ${
            dueDate
              ? 'bg-purple-950/80 border-purple-500/50 text-purple-300 hover:bg-purple-900/80 shadow-sm'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 opacity-60 group-hover:opacity-100 hover:text-purple-300 hover:border-purple-500/40'
          }`}
          title="Cài đặt deadline cho task này"
        >
          <Calendar className="w-3.5 h-3.5 text-purple-400" />
          {!dueDate && <span className="text-[10px] hidden group-hover:inline">Set Due</span>}
        </button>

        {/* Popover Menu */}
        {popoverOpen && (
          <div
            ref={popoverRef}
            className="absolute right-0 top-7 z-50 p-3 rounded-xl bg-slate-900/98 border border-purple-500/40 shadow-2xl backdrop-blur-xl w-64 text-slate-200 space-y-2.5 animate-fade-in"
            style={{ boxShadow: '0 15px 35px rgba(0, 0, 0, 0.8), 0 0 20px rgba(168, 85, 247, 0.25)' }}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-purple-300 border-b border-purple-500/20 pb-1.5">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                Chọn thời hạn (Deadline)
              </span>
              <button
                type="button"
                onClick={() => setPopoverOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer px-1"
              >
                ✕
              </button>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => { handlePreset('today'); setPopoverOpen(false); }}
                className="px-2 py-1 rounded-lg bg-purple-950/80 border border-purple-500/40 text-purple-200 hover:bg-purple-900 text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-all"
              >
                <Zap className="w-3 h-3 text-amber-400" /> Hôm nay (18:00)
              </button>
              <button
                type="button"
                onClick={() => { handlePreset('tomorrow'); setPopoverOpen(false); }}
                className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 text-[10px] font-semibold cursor-pointer transition-all"
              >
                ☀️ Ngày mai (09:00)
              </button>
              <button
                type="button"
                onClick={() => { handlePreset('add_1d'); setPopoverOpen(false); }}
                className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-[10px] cursor-pointer transition-all"
              >
                +1 Ngày
              </button>
              <button
                type="button"
                onClick={() => { handlePreset('add_1w'); setPopoverOpen(false); }}
                className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-[10px] cursor-pointer transition-all"
              >
                +1 Tuần
              </button>
            </div>

            {/* Datetime-local picker */}
            <div className="flex items-center gap-1 bg-slate-950 px-2 py-1.5 rounded-lg border border-slate-800 focus-within:border-purple-500/50">
              <input
                type="datetime-local"
                value={formatForDateTimeInput(dueDate)}
                onChange={(e) => handleSetDue(e.target.value)}
                className="w-full text-xs bg-transparent outline-none cursor-pointer text-purple-300 font-semibold"
              />
            </div>

            {dueDate && (
              <button
                type="button"
                onClick={() => { handleSetDue(null); setPopoverOpen(false); }}
                className="w-full py-1 rounded-lg bg-rose-950/80 border border-rose-500/50 text-rose-300 hover:bg-rose-900 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
              >
                <Trash2 className="w-3 h-3" /> Xóa thời hạn deadline
              </button>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
