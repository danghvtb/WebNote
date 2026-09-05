// ============================================================
// MyNotes 3.0 — AI Assistant Modal
// Smart AI Copilot for Summarizing, Polishing & Generating Tasks.
// ============================================================

import { useState } from 'react';
import { X, Sparkles, FileText, CheckSquare, RefreshCw, Wand2 } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { queueSync } from '../../services/sync/syncManager';

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIModal({ isOpen, onClose }: AIModalProps) {
  const { selectedPageId, pages, updatePageContent } = useNotesStore();
  const { addNotification } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'summarize' | 'polish' | 'tasks' | 'digest'>('summarize');
  const [aiResult, setAiResult] = useState<string | null>(null);

  const selectedPage = pages.find((p) => p.id === selectedPageId);

  if (!isOpen || !selectedPage) return null;

  const handleGenerate = async (action: string) => {
    setLoading(true);
    setAiResult(null);

    // Simulate AI Copilot generation (or integrate with LLM backend)
    setTimeout(() => {
      let result = '';
      const textContent = selectedPage.content.replace(/<[^>]*>/g, '').trim();

      if (!textContent && action !== 'digest') {
        setAiResult('⚠️ Page has no text content to analyze.');
        setLoading(false);
        return;
      }

      if (action === 'summarize') {
        result = `📌 <strong>AI Key Takeaways:</strong><ul><li>Main focus: ${selectedPage.title}</li><li>Key point: High-density knowledge note.</li><li>Action item: Review and synchronize with cloud.</li></ul>`;
      } else if (action === 'polish') {
        result = `<p><strong>Enhanced Content:</strong></p><p>${textContent} (Refined with professional clarity and concise tone).</p>`;
      } else if (action === 'tasks') {
        result = `<ul data-type="taskList"><li data-type="taskItem" data-checked="false" data-due="${new Date().toISOString().split('T')[0]}T18:00"><label><input type="checkbox"><span>Review ${selectedPage.title} outline</span></label></li><li data-type="taskItem" data-checked="false" data-due="${new Date().toISOString().split('T')[0]}T20:00"><label><input type="checkbox"><span>Organize key concepts into sub-pages</span></label></li></ul>`;
      } else if (action === 'digest') {
        result = `☀️ <strong>AI Daily Productivity Standup:</strong><br/><ul><li>🔥 <strong>Priority 1:</strong> Finish upcoming deadlines due within 30 minutes.</li><li>⚡ <strong>Priority 2:</strong> Review notebook "${selectedPage.title}" notes.</li><li>✅ <strong>Goal:</strong> Maintain 100% completion rate for today's tasks.</li></ul>`;
      }

      setAiResult(result);
      setLoading(false);
    }, 1000);
  };

  const handleApply = async () => {
    if (!aiResult || !selectedPageId) return;
    const newContent = selectedPage.content + '<br/><hr/>' + aiResult;
    await updatePageContent(selectedPageId, newContent);
    await queueSync('update', 'page', selectedPageId, { content: newContent });
    addNotification('success', 'AI content appended to note!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg rounded-2xl glass-card border border-purple-500/30 p-6 shadow-2xl glow-accent animate-scale-in"
        style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/30 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base">MyNotes AI Assistant</h3>
              <p className="text-xs text-slate-400">Smart analysis for "{selectedPage.title}"</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Tabs */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <button
            onClick={() => { setActiveTab('summarize'); handleGenerate('summarize'); }}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'summarize'
                ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Summarize
          </button>
          <button
            onClick={() => { setActiveTab('polish'); handleGenerate('polish'); }}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'polish'
                ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            Polish
          </button>
          <button
            onClick={() => { setActiveTab('tasks'); handleGenerate('tasks'); }}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            Extract Tasks
          </button>
          <button
            onClick={() => { setActiveTab('digest'); handleGenerate('digest'); }}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'digest'
                ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            Daily Digest
          </button>
        </div>

        {/* AI Result Area */}
        <div className="min-h-[140px] max-h-[220px] overflow-y-auto p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-sm mb-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-purple-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span className="text-xs font-medium">AI is thinking & analyzing...</span>
            </div>
          ) : aiResult ? (
            <div className="prose prose-invert prose-sm" dangerouslySetInnerHTML={{ __html: aiResult }} />
          ) : (
            <p className="text-xs text-slate-500 text-center py-8">Select an AI action above to analyze note.</p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!aiResult || loading}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Append to Note
          </button>
        </div>
      </div>
    </div>
  );
}
