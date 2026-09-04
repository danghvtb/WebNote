// ============================================================
// MyNotes — Export & Import Modal
// Modal UI for Vault Backup, Markdown Export, and JSON Import.
// ============================================================

import { useState } from 'react';
import { X, Download, Upload, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { exportVaultAsJSON, exportPageAsMarkdown, importVaultFromJSON } from '../../services/export/exportManager';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const { pages, selectedPageId, loadDays } = useNotesStore();
  const { addNotification } = useAppStore();
  const [importing, setImporting] = useState(false);

  const selectedPage = pages.find((p) => p.id === selectedPageId);

  const handleExportJSON = async () => {
    try {
      await exportVaultAsJSON();
      addNotification('success', 'Vault backup (.json) downloaded successfully!');
    } catch (err) {
      console.error(err);
      addNotification('error', 'Failed to export backup JSON.');
    }
  };

  const handleExportCurrentMarkdown = () => {
    if (!selectedPage) {
      addNotification('warning', 'Please select a page first.');
      return;
    }
    exportPageAsMarkdown(selectedPage);
    addNotification('success', `Exported "${selectedPage.title || 'Untitled'}" as Markdown.`);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const result = await importVaultFromJSON(file);
      await loadDays(); // Refresh UI notes store
      addNotification('success', result.message);
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Import failed';
      addNotification('error', msg);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-xl bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(16, 185, 129, 0.15)' }}
      >
        {/* Header */}
        <div className="p-5 border-b border-emerald-500/20 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Vault Backup & Export Data</h3>
              <p className="text-xs text-slate-400">100% data sovereignty & offline portability</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Options */}
        <div className="p-6 space-y-4">
          {/* Option 1: Export Complete Vault JSON */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between hover:border-emerald-500/40 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-950/50 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Full Vault Backup (.json)</h4>
                <p className="text-[11px] text-slate-400">Includes all {pages.length} pages, notebooks & hierarchy metadata</p>
              </div>
            </div>
            <button
              onClick={handleExportJSON}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Backup
            </button>
          </div>

          {/* Option 2: Export Current Note Markdown */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between hover:border-emerald-500/40 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-950/50 text-purple-400 border border-purple-500/20">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Export Note as Markdown (.md)</h4>
                <p className="text-[11px] text-slate-400">
                  {selectedPage ? `Export "${selectedPage.title || 'Untitled'}"` : 'Select a note to export'}
                </p>
              </div>
            </div>
            <button
              onClick={handleExportCurrentMarkdown}
              disabled={!selectedPage}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Export .md
            </button>
          </div>

          {/* Option 3: Import Backup JSON */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between hover:border-emerald-500/40 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-950/50 text-indigo-400 border border-indigo-500/20">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Restore / Import Vault (.json)</h4>
                <p className="text-[11px] text-slate-400">Restore notes from a previously exported backup file</p>
              </div>
            </div>
            <label className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              {importing ? 'Importing...' : 'Restore'}
              <input type="file" accept=".json" onChange={handleFileChange} className="hidden" />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Your data stays on your device and private Google Drive account.</span>
        </div>
      </div>
    </div>
  );
}
