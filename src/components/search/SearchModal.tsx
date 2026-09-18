// ============================================================
// MyNotes — Search Modal (Ctrl+K)
// Global search across notebooks and pages.
// ============================================================

/* oxlint-disable react(set-state-in-effect) -- modal open resets transient query state. */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, FileText, Notebook, ClipboardList, X, Tag as TagIcon } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useNotesStore } from '../../stores/notesStore';
import { getAllVaultPages, searchAll } from '../../services/database/repository';
import type { SearchEntry } from '../../types';
import { createExcerpt } from '../../utils';
import { useWorkReportStore } from '../../stores/workReportStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { DialogShell } from '../common/DialogShell';
import { vi } from '../../i18n/vi';

function highlightText(value: string, query: string): React.ReactNode {
  if (!query.trim()) return value;
  const terms = query.trim().split(/\s+/).filter(Boolean).map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (terms.length === 0) return value;
  const matcher = new RegExp(`(${terms.join('|')})`, 'ig');
  return value.split(matcher).map((part, index) => new RegExp(`^(?:${terms.join('|')})$`, 'i').test(part)
    ? <mark key={`${part}-${index}`} className="rounded px-0.5 bg-amber-300/40 text-inherit">{part}</mark>
    : <span key={`${part}-${index}`}>{part}</span>);
}

export function SearchModal() {
  const { searchOpen, setSearchOpen, searchQuery, setSearchQuery, addNotification, setProjectManagerOpen, setTaskManagerOpen } = useAppStore();
  const { selectDay, selectNotebook, selectPage, tags, loadTags } = useNotesStore();
  const { openOrCreateReport, projects, loadProjects } = useWorkReportStore();
  const setActiveScheduleTab = useScheduleStore((state) => state.setActiveTab);
  const setSelectedScheduleDate = useScheduleStore((state) => state.setSelectedDate);
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<Array<'page' | 'notebook' | 'work_report' | 'project' | 'task' | 'schedule'>>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [taskStatus, setTaskStatus] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [recentPages, setRecentPages] = useState<SearchEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      // Reset transient modal state when the dialog opens.
      // oxlint-disable-next-line react(set-state-in-effect)
      setResults([]);
      // oxlint-disable-next-line react(set-state-in-effect)
      setSelectedIndex(0);
      setSelectedTagIds([]);
      setSelectedProjectIds([]);
      setSelectedTypes([]);
      setStartDate('');
      setEndDate('');
      setTaskStatus('all');
      setSearching(false);
      try { setRecentQueries(JSON.parse(localStorage.getItem('mynotes_recent_searches') || '[]')); } catch { setRecentQueries([]); }
      getAllVaultPages().then((pages) => setRecentPages(pages.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5).map((page) => ({ id: `recent_${page.id}`, type: 'page', entityId: page.id, title: page.title || 'Chưa có tiêu đề', content: '', date: page.updatedAt.slice(0, 10), notebookId: page.notebookId })))).catch(() => setRecentPages([]));
      loadTags();
      void loadProjects();
    }
  }, [searchOpen, loadTags, loadProjects]);

  // Debounced search
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchTimer.current) clearTimeout(searchTimer.current);

      if (!query.trim() && selectedTagIds.length === 0 && selectedProjectIds.length === 0 && selectedTypes.length === 0 && !startDate && !endDate && taskStatus === 'all') { setResults([]); setSearching(false); return; }
      setSearching(true);
      searchTimer.current = setTimeout(async () => {
        try {
          setResults(await searchAll({ query, tagIds: selectedTagIds, projectIds: selectedProjectIds, types: selectedTypes, startDate, endDate, taskStatus }));
          setSelectedIndex(0);
        } catch {
          setResults([]);
          addNotification('error', 'Không thể tìm kiếm lúc này. Vui lòng thử lại.');
        } finally {
          setSearching(false);
        }
      }, 200);
    },
    [setSearchQuery, selectedTagIds, selectedProjectIds, selectedTypes, startDate, endDate, taskStatus, addNotification]
  );

  const toggleTag = (id: string) => {
    const next = selectedTagIds.includes(id) ? selectedTagIds.filter((x) => x !== id) : [...selectedTagIds, id];
    setSelectedTagIds(next);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQuery.trim() && next.length === 0 && selectedProjectIds.length === 0 && selectedTypes.length === 0 && !startDate && !endDate && taskStatus === 'all') { setResults([]); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        setResults(await searchAll({ query: searchQuery, tagIds: next, projectIds: selectedProjectIds, types: selectedTypes, startDate, endDate, taskStatus }));
        setSelectedIndex(0);
      } catch {
        setResults([]);
        addNotification('error', 'Không thể tìm kiếm lúc này. Vui lòng thử lại.');
      } finally {
        setSearching(false);
      }
    }, 200);
  };

  const toggleProject = (id: string) => {
    const next = selectedProjectIds.includes(id) ? selectedProjectIds.filter((item) => item !== id) : [...selectedProjectIds, id];
    setSelectedProjectIds(next);
    setSearching(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try { setResults(await searchAll({ query: searchQuery, tagIds: selectedTagIds, projectIds: next, types: selectedTypes, startDate, endDate, taskStatus })); setSelectedIndex(0); }
      catch { setResults([]); addNotification('error', 'Không thể tìm kiếm lúc này. Vui lòng thử lại.'); }
      finally { setSearching(false); }
    }, 150);
  };

  const toggleType = (type: 'page' | 'notebook' | 'work_report' | 'project' | 'task' | 'schedule') => {
    const next = selectedTypes.includes(type) ? selectedTypes.filter((item) => item !== type) : [...selectedTypes, type];
    setSelectedTypes(next);
    setSearching(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try { setResults(await searchAll({ query: searchQuery, tagIds: selectedTagIds, projectIds: selectedProjectIds, types: next, startDate, endDate, taskStatus })); setSelectedIndex(0); }
      catch { setResults([]); addNotification('error', 'Không thể tìm kiếm lúc này. Vui lòng thử lại.'); }
      finally { setSearching(false); }
    }, 150);
  };

  const runAdvancedSearch = (next: Partial<{ startDate: string; endDate: string; taskStatus: 'all' | 'pending' | 'completed' | 'overdue' }>) => {
    const values = { startDate: next.startDate ?? startDate, endDate: next.endDate ?? endDate, taskStatus: next.taskStatus ?? taskStatus };
    if (!searchQuery.trim() && selectedTagIds.length === 0 && selectedProjectIds.length === 0 && selectedTypes.length === 0 && !values.startDate && !values.endDate && values.taskStatus === 'all') { setResults([]); return; }
    setSearching(true);
    void searchAll({ query: searchQuery, tagIds: selectedTagIds, projectIds: selectedProjectIds, types: selectedTypes, ...values })
      .then(setResults)
      .catch(() => { setResults([]); addNotification('error', 'Không thể tìm kiếm lúc này. Vui lòng thử lại.'); })
      .finally(() => setSearching(false));
  };

  // Navigate to search result
  const handleSelect = useCallback(
    async (entry: SearchEntry) => {
      if (searchQuery.trim()) {
        const nextRecent = [searchQuery.trim(), ...recentQueries.filter((item) => item !== searchQuery.trim())].slice(0, 8);
        setRecentQueries(nextRecent);
        localStorage.setItem('mynotes_recent_searches', JSON.stringify(nextRecent));
      }
      if (entry.type === 'notebook') {
        selectNotebook(entry.entityId);
      } else if (entry.type === 'page') {
        if (entry.notebookId) {
          selectNotebook(entry.notebookId);
        }
        selectPage(entry.entityId);
      } else if (entry.type === 'work_report' && entry.dayId) {
        await selectDay(entry.dayId);
        useNotesStore.getState().clearPageSelection();
        await openOrCreateReport(entry.dayId);
      } else if (entry.type === 'project') {
        setProjectManagerOpen(true);
      } else if (entry.type === 'task') {
        if (entry.pageId) {
          if (entry.notebookId) selectNotebook(entry.notebookId);
          selectPage(entry.pageId);
        } else {
          setTaskManagerOpen(true);
        }
      } else if (entry.type === 'schedule') {
        if (entry.pageId) {
          if (entry.notebookId) selectNotebook(entry.notebookId);
          selectPage(entry.pageId);
        } else {
          setActiveScheduleTab('schedule');
          if (entry.date) setSelectedScheduleDate(entry.date);
        }
      } else {
        addNotification('info', 'Kết quả này chỉ dùng để tra cứu trong chỉ mục.');
      }
      setSearchOpen(false);
    },
    [selectDay, selectNotebook, selectPage, setSearchOpen, openOrCreateReport, addNotification, setProjectManagerOpen, setTaskManagerOpen, setActiveScheduleTab, setSelectedScheduleDate, searchQuery, recentQueries]
  );

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) handleSelect(results[selectedIndex]);
        break;
      case 'Escape':
        setSearchOpen(false);
        break;
    }
  };

  if (!searchOpen) return null;

  return (
    <DialogShell open={searchOpen} onClose={() => setSearchOpen(false)} ariaLabel="Tìm kiếm trong WebNote" className="w-full max-w-xl rounded-xl overflow-hidden animate-scale-in" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}>
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <Search className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} /><span className="sr-only">{vi.search}</span>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tìm trong ghi chú, sổ và báo cáo..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--color-text-primary)' }}
            aria-label="Tìm kiếm ghi chú"
          />
          <button
            onClick={() => setSearchOpen(false)}
            className="p-1 rounded cursor-pointer"
            style={{ color: 'var(--color-text-tertiary)' }}
            aria-label="Đóng tìm kiếm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-[var(--color-border)] flex flex-wrap items-center gap-1.5">
          <TagIcon className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
          {tags.map((tag) => <button key={tag.id} onClick={() => toggleTag(tag.id)} className={`px-2 py-0.5 rounded-full text-xs cursor-pointer border ${selectedTagIds.includes(tag.id) ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50' : 'text-[var(--color-text-tertiary)] border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'}`}>#{tag.name}</button>)}
          {tags.length === 0 && <span className="text-xs text-[var(--color-text-tertiary)]">Chưa có thẻ</span>}
        </div>

        <div className="px-4 py-2 border-b border-[var(--color-border)] flex flex-wrap gap-1.5">
          <span className="text-[11px] text-[var(--color-text-tertiary)] self-center mr-1">Loại:</span>
          {([['page', 'Trang'], ['notebook', 'Sổ'], ['work_report', 'Báo cáo'], ['project', 'Dự án'], ['task', 'Việc'], ['schedule', 'Lịch']] as const).map(([type, label]) => <button key={type} onClick={() => toggleType(type)} className={`px-2 py-0.5 rounded-full text-[11px] cursor-pointer border ${selectedTypes.includes(type) ? 'bg-purple-500/20 text-purple-300 border-purple-400/50' : 'text-[var(--color-text-tertiary)] border-[var(--color-border)]'}`}>{label}</button>)}
        </div>
        {projects.length > 0 && <div className="px-4 py-2 border-b border-[var(--color-border)] flex flex-wrap items-center gap-1.5"><span className="text-[11px] text-[var(--color-text-tertiary)] mr-1">Dự án:</span>{projects.filter((project) => !project.deletedAt).map((project) => <button key={project.id} type="button" onClick={() => toggleProject(project.id)} className={`px-2 py-0.5 rounded-full text-[11px] cursor-pointer border ${selectedProjectIds.includes(project.id) ? 'bg-pink-500/20 text-pink-300 border-pink-400/50' : 'text-[var(--color-text-tertiary)] border-[var(--color-border)]'}`}>{project.name}</button>)}</div>}
        <div className="px-4 py-2 border-b border-[var(--color-border)] flex flex-wrap items-center gap-2">
          <label className="text-[11px] text-[var(--color-text-tertiary)]">Từ <input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); runAdvancedSearch({ startDate: event.target.value }); }} className="ml-1 rounded border border-[var(--color-border)] bg-transparent px-1.5 py-1 text-[11px]" /></label>
          <label className="text-[11px] text-[var(--color-text-tertiary)]">Đến <input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); runAdvancedSearch({ endDate: event.target.value }); }} className="ml-1 rounded border border-[var(--color-border)] bg-transparent px-1.5 py-1 text-[11px]" /></label>
          <select value={taskStatus} onChange={(event) => { const next = event.target.value as typeof taskStatus; setTaskStatus(next); runAdvancedSearch({ taskStatus: next }); }} className="rounded border border-[var(--color-border)] bg-transparent px-1.5 py-1 text-[11px] text-[var(--color-text-secondary)]" aria-label="Lọc trạng thái công việc">
            <option value="all">Mọi trạng thái</option><option value="pending">Đang làm</option><option value="completed">Đã hoàn thành</option><option value="overdue">Quá hạn</option>
          </select>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {searching ? (
            <div className="px-4 py-8 text-center" role="status">
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Đang tìm kiếm…</p>
            </div>
          ) : results.length === 0 && (searchQuery.trim() || selectedTagIds.length > 0 || selectedProjectIds.length > 0 || selectedTypes.length > 0 || startDate || endDate || taskStatus !== 'all') ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Không tìm thấy kết quả</p>
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center">
              {recentQueries.length > 0 || recentPages.length > 0 ? <div className="space-y-3"><div><p className="text-xs mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Tìm kiếm gần đây</p><div className="flex flex-wrap justify-center gap-1.5">{recentQueries.map((query) => <button key={query} type="button" onClick={() => handleSearch(query)} className="px-2.5 py-1 rounded-full text-xs border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]">{query}</button>)}</div></div>{recentPages.length > 0 && <div><p className="text-xs mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Nội dung mở gần đây</p><div className="space-y-1">{recentPages.map((entry) => <button key={entry.id} type="button" onClick={() => void handleSelect(entry)} className="w-full text-left px-3 py-2 rounded-lg text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] truncate">{entry.title}</button>)}</div></div>}</div> : <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Nhập từ khóa để tìm trong toàn bộ nội dung</p>}
            </div>
          ) : (
            <div className="py-2">
              <div className="px-4 py-1">
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                  {results.length} kết quả
                </span>
              </div>
              {results.map((entry, index) => (
                <button
                  key={entry.id}
                  onClick={() => handleSelect(entry)}
                  className="w-full text-left flex items-start gap-3 px-4 py-2.5 transition-colors cursor-pointer"
                  style={{
                    background: index === selectedIndex ? 'var(--color-bg-hover)' : 'transparent',
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {entry.type === 'notebook' ? (
                    <Notebook className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
                  ) : entry.type === 'work_report' ? (
                    <ClipboardList className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
                  ) : (
                    <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {highlightText(entry.title, searchQuery)}
                    </p>
                    {entry.content && (entry.type === 'page' || entry.type === 'work_report') && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                        {highlightText(createExcerpt(entry.content, 80), searchQuery)}
                      </p>
                    )}
                    {entry.notebookTitle && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                        trong {entry.notebookTitle}
                      </p>
                    )}
                    {entry.type === 'work_report' && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Báo cáo theo ngày</p>}
                    {entry.type === 'project' && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Dự án</p>}
                    {entry.type === 'task' && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Công việc</p>}
                    {entry.type === 'schedule' && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Lịch biểu</p>}
                    {entry.type === 'page' && (entry.tagNames || []).length > 0 && <div className="flex gap-1 mt-1">{(entry.tagNames || []).map((name) => <span key={name} className="text-[10px] text-cyan-300">#{name}</span>)}</div>}
                    {(entry.matchedFields || []).length > 0 && <div className="flex flex-wrap gap-1 mt-1">{entry.matchedFields?.map((field) => <span key={field} className="text-[10px] text-slate-500">{({ title: 'tiêu đề', tag: 'thẻ', content: 'nội dung', project: 'dự án', status: 'trạng thái', date: 'ngày' } as Record<string, string>)[field] || field}</span>)}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2" style={{ borderTop: '1px solid var(--color-border)' }}>
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            ↑↓ Di chuyển
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            ↵ Mở
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Esc Đóng
          </span>
        </div>
    </DialogShell>
  );
}
