// ============================================================
// MyNotes — Export & Import Modal
// Modal UI for Vault Backup, Markdown Export, and JSON Import.
// ============================================================

import { useState } from 'react';
import { X, Download, Upload, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { exportScheduleAsICS, exportTasksAsCSV, exportVaultAsJSON, exportPageAsMarkdown, exportWorkReportsAsMarkdown, importVaultFromJSON, inspectBackup, type ImportPlan } from '../../services/export/exportManager';
import { DialogShell } from '../common/DialogShell';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const { pages, tags, selectedPageId, loadDays, loadTags } = useNotesStore();
  const { addNotification } = useAppStore();
  const [importing, setImporting] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importPlan, setImportPlan] = useState<ImportPlan | null>(null);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');

  const selectedPage = pages.find((p) => p.id === selectedPageId);

  const handleExportJSON = async () => {
    try {
      await exportVaultAsJSON();
      addNotification('success', 'Đã tải xuống bản sao lưu Vault (.json).');
    } catch (err) {
      console.error(err);
      addNotification('error', 'Không thể xuất bản sao lưu JSON.');
    }
  };

  const handleExportCurrentMarkdown = () => {
    if (!selectedPage) {
      addNotification('warning', 'Hãy chọn một trang trước.');
      return;
    }
    exportPageAsMarkdown(selectedPage, tags);
    addNotification('success', `Đã xuất "${selectedPage.title || 'Không có tiêu đề'}" dạng Markdown.`);
  };

  const handleExportReports = async () => {
    try {
      const count = await exportWorkReportsAsMarkdown(reportStartDate || undefined, reportEndDate || undefined);
      addNotification(count ? 'success' : 'info', count ? `Đã xuất ${count} báo cáo dạng Markdown.` : 'Chưa có báo cáo để xuất.');
    } catch {
      addNotification('error', 'Không thể xuất báo cáo công việc.');
    }
  };

  const handleExportCalendar = async () => { const count = await exportScheduleAsICS(); addNotification(count ? 'success' : 'info', count ? `Đã xuất ${count} lịch biểu (.ics).` : 'Chưa có lịch biểu để xuất.'); };
  const handleExportTasks = async () => { const count = await exportTasksAsCSV(); addNotification(count ? 'success' : 'info', count ? `Đã xuất ${count} công việc (.csv).` : 'Chưa có công việc để xuất.'); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const plan = await inspectBackup(file);
      setPendingFile(file);
      setImportPlan(plan);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Nhập dữ liệu thất bại.';
      addNotification('error', msg);
    }
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!pendingFile || !importPlan) return;
    setImporting(true);
    try {
      const result = await importVaultFromJSON(pendingFile);
      await loadDays();
      await loadTags();
      addNotification('success', result.message);
      setPendingFile(null);
      setImportPlan(null);
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Khôi phục dữ liệu thất bại.';
      addNotification('error', msg);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <DialogShell open={isOpen} onClose={onClose} ariaLabel="Sao lưu và xuất dữ liệu" className="w-full max-w-xl bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(16, 185, 129, 0.15)' }}>
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
              <h3 className="text-lg font-bold text-slate-100">Sao lưu và xuất dữ liệu</h3>
              <p className="text-xs text-slate-400">Toàn quyền dữ liệu và sử dụng ngoại tuyến</p>
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
                <h4 className="text-xs font-bold text-slate-200">Sao lưu toàn bộ Vault (.json)</h4>
                <p className="text-[11px] text-slate-400">Bao gồm dữ liệu page, sổ ghi chú, báo cáo, lịch biểu và cài đặt</p>
              </div>
            </div>
            <button
              onClick={handleExportJSON}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Sao lưu
            </button>
          </div>

          {/* Option 2: Export Current Note Markdown */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between hover:border-emerald-500/40 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-950/50 text-purple-400 border border-purple-500/20">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Xuất ghi chú dạng Markdown (.md)</h4>
                <p className="text-[11px] text-slate-400">
                  {selectedPage ? `Xuất "${selectedPage.title || 'Không có tiêu đề'}"` : 'Hãy chọn ghi chú để xuất'}
                </p>
              </div>
            </div>
            <button
              onClick={handleExportCurrentMarkdown}
              disabled={!selectedPage}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Xuất .md
            </button>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between hover:border-emerald-500/40 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-950/50 text-cyan-400 border border-cyan-500/20"><FileText className="w-5 h-5" /></div>
              <div><h4 className="text-xs font-bold text-slate-200">Xuất báo cáo công việc (.md)</h4><p className="text-[11px] text-slate-400">Gộp toàn bộ báo cáo theo thứ tự ngày</p></div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5"><label className="text-[10px] text-slate-500">Từ <input type="date" value={reportStartDate} onChange={(event) => setReportStartDate(event.target.value)} className="rounded border border-slate-700 bg-slate-900 px-1 py-1 text-[10px] text-slate-300" /></label><label className="text-[10px] text-slate-500">Đến <input type="date" value={reportEndDate} onChange={(event) => setReportEndDate(event.target.value)} className="rounded border border-slate-700 bg-slate-900 px-1 py-1 text-[10px] text-slate-300" /></label><button onClick={handleExportReports} className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Xuất báo cáo</button></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleExportCalendar} className="px-3 py-2 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer">Xuất lịch .ics</button>
            <button onClick={handleExportTasks} className="px-3 py-2 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer">Xuất việc .csv</button>
          </div>

          {/* Option 3: Import Backup JSON */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between hover:border-emerald-500/40 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-950/50 text-indigo-400 border border-indigo-500/20">
                <Upload className="w-5 h-5" />
              </div>
              <div>
              <h4 className="text-xs font-bold text-slate-200">Khôi phục / nhập Vault (.json)</h4>
              <p className="text-[11px] text-slate-400">Khôi phục từ file backup đã xuất trước đó</p>
              </div>
            </div>
            <label className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              {importing ? 'Đang khôi phục...' : 'Chọn file'}
              <input type="file" accept=".json" onChange={handleFileChange} className="hidden" />
            </label>
          </div>

          {importPlan && pendingFile && (
            <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/40 space-y-3" role="status">
              <div>
                <h4 className="text-sm font-semibold text-indigo-200">Xác nhận khôi phục</h4>
                <p className="text-[11px] text-slate-400 mt-1 break-all">{pendingFile.name}</p>
                <p className="text-[11px] text-amber-300 mt-2">Dữ liệu hiện tại sẽ được thay thế. Ứng dụng sẽ tự tải một bản recovery trước khi khôi phục.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] text-slate-300">
                {Object.entries(importPlan.counts).map(([label, count]) => (
                  <div key={label} className="rounded-lg bg-slate-950/60 px-2 py-1.5">
                    <div className="text-slate-500">{label}</div>
                    <div className="font-semibold text-slate-200">{count}</div>
                  </div>
                ))}
              </div>
              {importPlan.warnings.length > 0 && (
                <p className="text-[11px] text-amber-200">{importPlan.warnings.join(' ')}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setPendingFile(null); setImportPlan(null); }}
                  disabled={importing}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs cursor-pointer disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={importing}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {importing ? 'Đang khôi phục...' : 'Khôi phục dữ liệu'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Dữ liệu vẫn ở trên thiết bị và tài khoản Google Drive riêng của bạn.</span>
        </div>
      </div>
    </DialogShell>
  );
}
