import { useEffect, useMemo, useRef, useState } from 'react';
import { BriefcaseBusiness, Check, Clipboard, Copy, FilePlus2, FolderCog, History, Plus, Printer, Trash2, X } from 'lucide-react';
import { useWorkReportStore } from '../../stores/workReportStore';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { formatWorkReport } from '../../services/database/repository';
import { dateFromDayId } from '../../utils/timelineGrouping';
import type { WorkReport, WorkReportProjectEntry } from '../../types';

const editableFields = ['issue', 'solution', 'nextWork'] as const;
type ReportTemplate = { id: string; name: string; issue: string; solution: string; nextWork: string };
const defaultTemplates: ReportTemplate[] = [
  { id: 'daily', name: 'Báo cáo hằng ngày', issue: '', solution: '', nextWork: 'Tiếp tục các công việc đang thực hiện và xử lý các đầu việc còn lại.' },
  { id: 'delivery', name: 'Bàn giao / nghiệm thu', issue: 'Các điểm cần xác nhận trước khi bàn giao:', solution: 'Đã kiểm tra, phối hợp và xử lý các điểm phát sinh.', nextWork: 'Theo dõi phản hồi sau bàn giao và hoàn tất tài liệu liên quan.' },
  { id: 'incident', name: 'Sự cố / xử lý nhanh', issue: 'Mô tả sự cố, phạm vi ảnh hưởng và nguyên nhân:', solution: 'Các bước đã thực hiện để khắc phục và phòng ngừa tái diễn:', nextWork: 'Theo dõi ổn định và bổ sung hành động phòng ngừa.' },
];

export function WorkReportEditor() {
  const { report, reports, projects, saving, updateReport, copyPreviousReport, createNextReportFromCurrent, loadProjects, loadReports, openReportById, createProject, clearSelectedReport } = useWorkReportStore();
  const { days } = useNotesStore();
  const { setProjectManagerOpen, addNotification } = useAppStore();
  const [draft, setDraft] = useState<WorkReport | null>(report);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [quickProjectName, setQuickProjectName] = useState('');
  const [previewOpen, setPreviewOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProjectId, setHistoryProjectId] = useState('all');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [templates, setTemplates] = useState<ReportTemplate[]>(defaultTemplates);
  const lastSaved = useRef('');
  const previewRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadProjects();
    loadReports();
  }, [loadProjects, loadReports]);

  // Keep the local draft aligned when navigating between days/reports without
  // unmounting the editor shell (for example, the "chuyển việc ngày mai" action).
  useEffect(() => {
    setDraft(report);
    lastSaved.current = '';
  }, [report?.id]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('mynotes_report_templates') || '[]');
      if (Array.isArray(saved)) setTemplates([...defaultTemplates, ...saved.filter((item): item is ReportTemplate => item && typeof item.id === 'string' && typeof item.name === 'string')]);
    } catch {
      // Ignore malformed optional template preferences.
    }
  }, []);

  useEffect(() => {
    if (!draft) return;
    const snapshot = JSON.stringify({
      projectEntries: draft.projectEntries,
      issue: draft.issue,
      solution: draft.solution,
      nextWork: draft.nextWork,
    });
    if (snapshot === lastSaved.current) return;
    const timer = setTimeout(() => {
      lastSaved.current = snapshot;
      updateReport({
        projectEntries: draft.projectEntries,
        issue: draft.issue,
        solution: draft.solution,
        nextWork: draft.nextWork,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [draft, updateReport]);

  const day = draft ? days.find((item) => item.id === draft.dayId) : undefined;
  const reportDate = day?.date || (draft ? dateFromDayId(draft.dayId) : null) || '';
  const reportText = draft ? formatWorkReport(draft, reportDate) : '';
  const selectedProjectIds = useMemo(() => new Set((draft?.projectEntries || []).map((entry) => entry.projectId)), [draft?.projectEntries]);
  const availableProjects = projects.filter((project) =>
    !selectedProjectIds.has(project.id) && project.name.toLocaleLowerCase().includes(projectSearch.toLocaleLowerCase()),
  );
  const historyItems = useMemo(() => reports
    .filter((item) => item.id !== report?.id)
    .map((item) => ({ item, date: dateFromDayId(item.dayId) || item.dayId.replace(/^day_/, '') }))
    .filter(({ date }) => !historyFrom || date >= historyFrom)
    .filter(({ date }) => !historyTo || date <= historyTo)
    .filter(({ item }) => historyProjectId === 'all' || item.projectEntries.some((entry) => entry.projectId === historyProjectId))
    .sort((a, b) => b.date.localeCompare(a.date)), [reports, report?.id, historyFrom, historyTo, historyProjectId]);

  if (!draft) {
    return (
      <div className="h-full flex items-center justify-center" style={{ color: 'var(--color-text-tertiary)' }}>
        <p className="text-sm">Đang tải báo cáo công việc...</p>
      </div>
    );
  }

  const updateDraftField = (field: typeof editableFields[number], value: string) => {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  };

  const updateEntry = (projectId: string, field: 'content' | 'result', value: string) => {
    setDraft((current) => current ? {
      ...current,
      projectEntries: current.projectEntries.map((entry) => entry.projectId === projectId ? { ...entry, [field]: value } : entry),
    } : current);
  };

  const addProject = (projectId: string, name: string) => {
    setDraft((current) => current ? {
      ...current,
      projectEntries: [...current.projectEntries, { projectId, projectNameSnapshot: name, content: '', result: '' }],
    } : current);
    setPickerOpen(false);
    setProjectSearch('');
  };

  const addQuickProject = async () => {
    if (!quickProjectName.trim()) return;
    try {
      const project = await createProject(quickProjectName);
      addProject(project.id, project.name);
      setQuickProjectName('');
      addNotification('success', 'Đã tạo dự án và thêm vào báo cáo');
    } catch (error) {
      addNotification('error', error instanceof Error ? error.message : 'Không thể tạo dự án');
    }
  };

  const removeProject = (projectId: string) => {
    setDraft((current) => current ? { ...current, projectEntries: current.projectEntries.filter((entry) => entry.projectId !== projectId) } : current);
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      addNotification('success', 'Đã copy báo cáo vào clipboard');
    } catch {
      previewRef.current?.focus();
      previewRef.current?.select();
      addNotification('info', 'Clipboard bị chặn. Hãy chọn và copy nội dung xem trước.');
    }
  };

  const saveReport = async () => {
    await updateReport({ projectEntries: draft.projectEntries, issue: draft.issue, solution: draft.solution, nextWork: draft.nextWork });
    addNotification('success', 'Đã tạo báo cáo công việc');
  };

  const copyPrevious = async () => {
    const copied = await copyPreviousReport();
    addNotification(copied ? 'success' : 'info', copied ? 'Đã sao chép báo cáo ngày trước.' : 'Chưa có báo cáo ngày trước để sao chép.');
  };

  const transferNextWork = async () => {
    const created = await createNextReportFromCurrent();
    addNotification(created ? 'success' : 'info', created ? 'Đã tạo/mở báo cáo ngày tiếp theo và chuyển công việc.' : 'Chưa có báo cáo hiện tại để chuyển tiếp.');
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setDraft((current) => current ? { ...current, issue: template.issue, solution: template.solution, nextWork: template.nextWork } : current);
  };

  const saveTemplate = () => {
    const name = window.prompt('Tên mẫu báo cáo');
    if (!name?.trim()) return;
    const template: ReportTemplate = {
      id: `custom_${crypto.randomUUID()}`,
      name: name.trim(),
      issue: draft.issue,
      solution: draft.solution,
      nextWork: draft.nextWork,
    };
    const custom = [...templates.filter((item) => item.id.startsWith('custom_')), template];
    setTemplates([...defaultTemplates, ...custom]);
    localStorage.setItem('mynotes_report_templates', JSON.stringify(custom));
    addNotification('success', `Đã lưu mẫu “${template.name}”`);
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900');
    if (!printWindow) {
      addNotification('warning', 'Trình duyệt đã chặn cửa sổ in.');
      return;
    }
    printWindow.document.write(`<html lang="vi"><head><title>Báo cáo công việc</title><style>body{font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.5;padding:32px;color:#111} @media print{body{padding:0}}</style></head><body>${reportText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--color-bg-primary)' }}>
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-accent-dim)' }}>
              <BriefcaseBusiness className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>Báo cáo công việc {reportDate ? reportDate.split('-').reverse().join('/') : ''}</h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{reportDate || draft.dayId.replace('day_', '')} · {saving ? 'Đang lưu...' : 'Đã lưu local'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select aria-label="Chọn mẫu báo cáo" onChange={(event) => applyTemplate(event.target.value)} defaultValue="" className="max-w-44 px-2 py-2 rounded-lg text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)]" style={{ color: 'var(--color-text-secondary)' }}>
              <option value="" disabled>Mẫu báo cáo</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
            <button type="button" onClick={saveTemplate} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ color: 'var(--color-text-secondary)', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
              <FilePlus2 className="w-3.5 h-3.5" /> Lưu mẫu
            </button>
            <button type="button" onClick={copyPrevious} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ color: 'var(--color-text-secondary)', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
              <Copy className="w-3.5 h-3.5" /> Sao chép ngày trước
            </button>
            <button type="button" onClick={() => void transferNextWork()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ color: 'var(--color-text-secondary)', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
              <FilePlus2 className="w-3.5 h-3.5" /> Chuyển việc ngày mai
            </button>
            <button type="button" onClick={() => setProjectManagerOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ color: 'var(--color-text-secondary)', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
              <FolderCog className="w-3.5 h-3.5" /> Quản lý dự án
            </button>
            <button type="button" onClick={clearSelectedReport} className="p-2 rounded-lg cursor-pointer" style={{ color: 'var(--color-text-tertiary)' }} aria-label="Đóng báo cáo" title="Đóng báo cáo">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <details open={historyOpen} onToggle={(event) => setHistoryOpen(event.currentTarget.open)} className="mb-5 rounded-xl" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            <History className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> Lịch sử báo cáo
          </summary>
          <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex flex-wrap gap-2">
              <select aria-label="Lọc lịch sử theo dự án" value={historyProjectId} onChange={(event) => setHistoryProjectId(event.target.value)} className="rounded-lg px-2 py-1.5 text-xs" style={{ color: 'var(--color-text-secondary)', background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)' }}>
                <option value="all">Tất cả dự án</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <input aria-label="Từ ngày lịch sử báo cáo" type="date" value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} className="rounded-lg px-2 py-1.5 text-xs" style={{ color: 'var(--color-text-secondary)', background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)' }} />
              <input aria-label="Đến ngày lịch sử báo cáo" type="date" value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} className="rounded-lg px-2 py-1.5 text-xs" style={{ color: 'var(--color-text-secondary)', background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)' }} />
            </div>
            {historyItems.length === 0 ? <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Không có báo cáo phù hợp.</p> : <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">{historyItems.slice(0, 12).map(({ item, date }) => <button type="button" key={item.id} onClick={() => void openReportById(item.id)} className="touch-target rounded-lg px-3 py-2 text-left text-xs hover:bg-[var(--color-bg-hover)]" style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}><span className="block font-semibold">{date.split('-').reverse().join('/')}</span><span className="block truncate text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{item.projectEntries.map((entry) => entry.projectNameSnapshot).join(', ') || 'Chưa có dự án'}</span></button>)}</div>}
          </div>
        </details>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          <section className="space-y-4">
            <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Dự án trong ngày</h2>
                <button type="button" onClick={() => setPickerOpen((open) => !open)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ color: 'var(--color-accent)', background: 'var(--color-accent-dim)' }}>
                  <Plus className="w-3.5 h-3.5" /> Thêm dự án
                </button>
              </div>

              {pickerOpen && (
                <div className="mb-3 p-3 rounded-lg space-y-2" style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)' }}>
                  <input value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder="Tìm dự án..." autoFocus className="w-full px-2.5 py-2 rounded-lg text-xs bg-transparent outline-none" style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {availableProjects.map((project) => (
                      <button type="button" key={project.id} onClick={() => addProject(project.id, project.name)} className="w-full text-left px-2.5 py-2 rounded-md text-xs cursor-pointer hover:bg-[var(--color-bg-hover)]" style={{ color: 'var(--color-text-secondary)' }}>{project.name}</button>
                    ))}
                    {availableProjects.length === 0 && <p className="text-xs py-1" style={{ color: 'var(--color-text-tertiary)' }}>Không còn dự án phù hợp.</p>}
                  </div>
                  <div className="flex gap-2">
                    <input value={quickProjectName} onChange={(event) => setQuickProjectName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addQuickProject(); }} placeholder="Tạo dự án mới nhanh..." className="flex-1 px-2.5 py-2 rounded-lg text-xs bg-transparent outline-none" style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
                    <button type="button" onClick={addQuickProject} className="p-2 rounded-lg cursor-pointer" style={{ color: 'var(--color-accent)', background: 'var(--color-accent-dim)' }} aria-label="Tạo dự án"><FilePlus2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              )}

              {draft.projectEntries.length === 0 ? (
                <div className="py-8 text-center rounded-lg" style={{ border: '1px dashed var(--color-border)', color: 'var(--color-text-tertiary)' }}>
                  <p className="text-xs">Chưa có dự án trong báo cáo.</p>
                  <p className="text-[11px] mt-1">Bạn có thể để trống hoặc thêm dự án ở trên.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {draft.projectEntries.map((entry: WorkReportProjectEntry, index) => (
                    <div key={entry.projectId} className="rounded-lg p-3" style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)' }}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h3 className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{index + 1}. {entry.projectNameSnapshot}</h3>
                        <button type="button" onClick={() => removeProject(entry.projectId)} className="p-1 rounded cursor-pointer" style={{ color: 'var(--color-text-tertiary)' }} aria-label={`Bỏ ${entry.projectNameSnapshot}`}><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <label className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>Nội dung công việc
                          <textarea value={entry.content} onChange={(event) => updateEntry(entry.projectId, 'content', event.target.value)} className="mt-1 w-full min-h-24 p-2 rounded-lg text-xs bg-transparent outline-none resize-y" style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
                        </label>
                        <label className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>Kết quả công việc
                          <textarea value={entry.result} onChange={(event) => updateEntry(entry.projectId, 'result', event.target.value)} className="mt-1 w-full min-h-24 p-2 rounded-lg text-xs bg-transparent outline-none resize-y" style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {editableFields.map((field) => {
              const labels = { issue: 'Vấn đề tồn tại', solution: 'Hướng giải quyết', nextWork: 'Công việc ngày tiếp theo' };
              return (
                <label key={field} className="block rounded-xl p-4" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <span className="text-sm font-semibold">{labels[field]}</span>
                  <textarea value={draft[field]} onChange={(event) => updateDraftField(field, event.target.value)} className="mt-2 w-full min-h-24 p-3 rounded-lg text-sm bg-transparent outline-none resize-y" style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
                </label>
              );
            })}
          </section>

          <section className="rounded-xl overflow-hidden xl:sticky xl:top-4" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2"><Clipboard className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /><h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Xem trước báo cáo</h2></div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={saveReport} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer" style={{ color: 'var(--color-accent)', background: 'var(--color-accent-dim)' }}><Check className="w-3.5 h-3.5" /> Tạo báo cáo</button>
                <button type="button" onClick={copyReport} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer" style={{ color: 'var(--color-accent)', background: 'var(--color-accent-dim)' }}><Copy className="w-3.5 h-3.5" /> Sao chép</button>
                <button type="button" onClick={printReport} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer" style={{ color: 'var(--color-accent)', background: 'var(--color-accent-dim)' }}><Printer className="w-3.5 h-3.5" /> In / PDF</button>
                <button type="button" onClick={() => setPreviewOpen((open) => !open)} className="px-2 py-1.5 rounded-lg text-xs cursor-pointer md:hidden" style={{ color: 'var(--color-text-tertiary)' }}>{previewOpen ? 'Thu gọn' : 'Mở'}</button>
              </div>
            </div>
            {previewOpen && <textarea ref={previewRef} readOnly value={reportText} className="w-full min-h-[480px] p-4 text-xs leading-5 bg-transparent outline-none resize-y font-mono" style={{ color: 'var(--color-text-secondary)' }} aria-label="Nội dung xem trước báo cáo" />}
            {!previewOpen && <div className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Khung xem trước đang thu gọn.</div>}
            <div className="flex items-center gap-2 px-4 py-2 text-[11px]" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-tertiary)' }}><Check className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} /> Tự động lưu thay đổi</div>
          </section>
        </div>
      </div>
    </div>
  );
}
