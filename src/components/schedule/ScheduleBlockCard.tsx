// ============================================================
// MyNotes — Schedule Block Card Component
// Individual event item rendered inside Week/Day time slot grid
// ============================================================

import React from 'react';
import { CheckCircle2, Circle, Clock, Trash2, Sparkles } from 'lucide-react';
import { useScheduleStore } from '../../stores/scheduleStore';
import type { ScheduleBlock } from '../../types';

interface ScheduleBlockCardProps {
  block: ScheduleBlock;
}

export function ScheduleBlockCard({ block }: ScheduleBlockCardProps) {
  const { toggleBlock, removeBlock, setAddModalOpen, categories } = useScheduleStore();
  const category = categories.find((c) => c.id === block.categoryId);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBlock(block.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeBlock(block.id);
  };

  const handleCardClick = () => {
    setAddModalOpen(true, block);
  };

  const priorityBadge =
    block.priority === 'high'
      ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
      : block.priority === 'low'
      ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
      : 'border-amber-500/40 bg-amber-500/10 text-amber-300';

  return (
    <div
      onClick={handleCardClick}
      className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer select-none shadow-sm hover:shadow-md ${
        block.completed
          ? 'bg-slate-900/60 border-slate-800/80 opacity-60 line-through'
          : 'bg-slate-900 border-slate-800 hover:border-purple-500/50 hover:bg-slate-850'
      }`}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: block.color || category?.color || '#3b82f6',
      }}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={handleToggle}
              className="text-slate-400 hover:text-purple-400 transition-colors shrink-0"
            >
              {block.completed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Circle className="w-4 h-4" />
              )}
            </button>

            <span className="text-xs font-semibold text-slate-100 truncate">
              {block.title}
            </span>
          </div>

          {category && (
            <span
              className="inline-block text-[9px] font-bold px-1.5 py-0.2 rounded mt-1 max-w-[120px] truncate"
              style={{ backgroundColor: `${category.color}25`, color: category.color }}
            >
              {category.name}
            </span>
          )}
        </div>

        {/* Action icons on hover */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
          <button
            onClick={handleDelete}
            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Details Footer */}
      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800/60 text-[10px] text-slate-400">
        <div className="flex items-center gap-1 font-mono">
          <Clock className="w-3 h-3 text-slate-500" />
          <span>{block.startTime || 'All day'} - {block.endTime || ''}</span>
        </div>

        <div className="flex items-center gap-1">
          {block.aiSuggested && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
              <Sparkles className="w-2.5 h-2.5" /> AI
            </span>
          )}

          {block.priority && (
            <span className={`px-1.5 py-0.2 rounded border text-[9px] uppercase font-bold ${priorityBadge}`}>
              {block.priority}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
