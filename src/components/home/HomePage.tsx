// ============================================================
// MyNotes — Home Page
// Shown when no notebook/page is selected.
// ============================================================

import { useEffect, useState } from 'react';
import { Search, Plus, Notebook, Clock, Sparkles, ClipboardList, CalendarDays, Pin, CheckSquare, FilePlus2 } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { getGreeting, timeAgo } from '../../utils';
import { seedDemoVault } from '../../services/database/seedDemo';
import { getPendingCount, queueSync } from '../../services/sync/syncManager';
import { ensureToday, getAllVaultNotebooks, getAllVaultPages, getWorkReportByDay } from '../../services/database/repository';
import { todayId, formatDateDisplay, extractWikiLinks } from '../../utils';
import { useWorkReportStore } from '../../stores/workReportStore';
import { parseAllTasks } from '../../utils/taskUtils';
import { useScheduleStore } from '../../stores/scheduleStore';

export function HomePage() {
  const { notebooks, recentNotebooks, selectNotebook, createPage, loadRecentNotebooks, loadDays } = useNotesStore();
  const { toggleSearch, setCreateNotebookOpen, setTaskManagerOpen, user, addNotification, cloudBootstrapStatus, syncStatus, syncMessage } = useAppStore();
  const openOrCreateReport = useWorkReportStore((state) => state.openOrCreateReport);
  const [hasTodayReport, setHasTodayReport] = useState(false);
  const [dashboard, setDashboard] = useState({ overdue: 0, upcoming: 0, pinnedPages: [] as Array<{ id: string; title: string; notebookId: string }>, orphanPages: [] as Array<{ id: string; title: string }> });
  const [pendingOps, setPendingOps] = useState(0);
  const blocks = useScheduleStore((state) => state.blocks);
  const setActiveScheduleTab = useScheduleStore((state) => state.setActiveTab);

  useEffect(() => {
    loadRecentNotebooks();
    getWorkReportByDay(todayId()).then((report) => setHasTodayReport(Boolean(report))).catch(() => setHasTodayReport(false));
    Promise.all([getAllVaultPages(), getAllVaultNotebooks()]).then(([allPages, allNotebooks]) => {
      const tasks = parseAllTasks(allPages, allNotebooks, true).filter((task) => !task.completed);
      const now = Date.now();
      const upcoming = tasks.filter((task) => task.dueDate && new Date(task.dueDate).getTime() >= now && new Date(task.dueDate).getTime() <= now + 7 * 86400000).length;
      const overdue = tasks.filter((task) => task.isOverdue).length;
      const linkedTitles = new Set(allPages.flatMap((page) => extractWikiLinks(page.content || '')).map((title) => title.trim().toLocaleLowerCase()));
      const orphanPages = allPages.filter((page) => !allNotebooks.some((notebook) => notebook.id === page.notebookId) || (!linkedTitles.has(page.title.trim().toLocaleLowerCase()) && !allPages.some((other) => other.id !== page.id && extractWikiLinks(other.content || '').some((title) => title.trim().toLocaleLowerCase() === page.title.trim().toLocaleLowerCase())))).slice(0, 8).map((page) => ({ id: page.id, title: page.title }));
      setDashboard({ overdue, upcoming, pinnedPages: allPages.filter((page) => page.isPinned).slice(0, 5).map((page) => ({ id: page.id, title: page.title, notebookId: page.notebookId })), orphanPages });
    }).catch(() => undefined);
    getPendingCount().then(setPendingOps).catch(() => setPendingOps(0));
  }, [loadRecentNotebooks]);

  useEffect(() => {
    const refreshQueue = () => { void getPendingCount().then(setPendingOps).catch(() => undefined); };
    const timer = window.setInterval(refreshQueue, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const nextSchedule = blocks.filter((block) => block.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => `${a.date}T${a.startTime || ''}`.localeCompare(`${b.date}T${b.startTime || ''}`))[0];

  const handleOpenTodayReport = async () => {
    const day = await ensureToday();
    await openOrCreateReport(day.id);
  };

  const handleCreatePage = async () => {
    const notebookId = useNotesStore.getState().selectedNotebookId || recentNotebooks[0]?.id || notebooks[0]?.id;
    if (!notebookId) {
      addNotification('info', 'Hãy tạo sổ ghi chú trước khi tạo trang.');
      setCreateNotebookOpen(true);
      return;
    }
    const page = await createPage(notebookId, 'Chưa có tiêu đề');
    await selectNotebook(notebookId);
    await useNotesStore.getState().selectPage(page.id);
  };

  const handleGenerateDemoNotes = async () => {
    try {
      const { notebook, pages } = await seedDemoVault();
      await loadDays();
      await loadRecentNotebooks();
      await selectNotebook(notebook.id);
      if (pages && pages.length > 0) {
        useNotesStore.getState().selectPage(pages[0].id);
      }
      queueSync('create', 'notebook', notebook.id);
      addNotification('success', 'Đã nạp và mở bộ ghi chú hướng dẫn mẫu!');
    } catch (err) {
      console.error(err);
      addNotification('error', 'Có lỗi khi tạo bộ ghi chú mẫu.');
    }
  };

  return (
    <div className="h-full overflow-y-auto px-6 md:px-12 lg:px-16 py-10 max-w-2xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          {getGreeting()} 👋
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {user?.name ? `Chào mừng trở lại, ${user.name.split(' ')[0]}` : 'Hôm nay bạn muốn làm gì?'}
        </p>
        <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
          <CalendarDays className="w-3.5 h-3.5" /> {formatDateDisplay(new Date().toISOString().slice(0, 10))}
        </p>
      </div>

      {/* Search Bar */}
      <button
        onClick={toggleSearch}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-8 transition-colors cursor-pointer"
        style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
        aria-label="Tìm kiếm ghi chú"
      >
        <Search className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
        <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Tìm ghi chú, báo cáo, công việc...</span>
        <kbd className="ml-auto text-xs px-2 py-0.5 rounded" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
          Ctrl+K
        </kbd>
      </button>

      {/* Today's Notebooks */}
      {notebooks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
            Hôm nay
          </h2>
          <div className="space-y-1">
            {notebooks.map((nb) => (
              <button
                key={nb.id}
                onClick={() => selectNotebook(nb.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer text-left"
                style={{ background: 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Notebook className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{nb.title}</span>
                <span className="text-xs ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>
                  {nb.pageIds.length} {nb.pageIds.length === 1 ? 'page' : 'pages'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-8">
        <div className="rounded-xl p-3 border border-rose-500/20 bg-rose-950/20"><p className="text-[11px] text-rose-300">Quá hạn</p><p className="text-xl font-bold text-rose-200">{dashboard.overdue}</p></div>
        <div className="rounded-xl p-3 border border-amber-500/20 bg-amber-950/20"><p className="text-[11px] text-amber-300">7 ngày tới</p><p className="text-xl font-bold text-amber-200">{dashboard.upcoming}</p></div>
        <div className="rounded-xl p-3 border border-cyan-500/20 bg-cyan-950/20"><p className="text-[11px] text-cyan-300">Báo cáo hôm nay</p><p className="text-xl font-bold text-cyan-200">{hasTodayReport ? 'Có' : 'Chưa'}</p></div>
        <div className="rounded-xl p-3 border border-purple-500/20 bg-purple-950/20"><p className="text-[11px] text-purple-300">Lịch gần nhất</p><p className="text-xs font-semibold text-purple-100 truncate">{nextSchedule?.title || 'Không có'}</p></div>
        <div className={`rounded-xl p-3 border ${pendingOps > 0 ? 'border-amber-500/30 bg-amber-950/20' : 'border-emerald-500/20 bg-emerald-950/20'}`}><p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>Đồng bộ</p><p className="text-xs font-semibold truncate" style={{ color: pendingOps > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>{pendingOps > 0 ? `${pendingOps} thay đổi chưa gửi` : cloudBootstrapStatus === 'auth_required' ? 'Cần kết nối' : syncStatus === 'offline' ? 'Ngoại tuyến' : 'Đã đồng bộ'}</p></div>
        <div className="rounded-xl p-3 border border-slate-500/20 bg-slate-900/40"><p className="text-[11px] text-slate-400">Trang mồ côi</p><p className="text-xl font-bold text-slate-200">{dashboard.orphanPages.length}</p></div>
      </div>

      {(syncStatus === 'error' || cloudBootstrapStatus === 'error') && syncMessage && <div role="status" className="mb-6 rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-xs text-rose-200">{syncMessage}</div>}

      {dashboard.pinnedPages.length > 0 && <div className="mb-8"><h2 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-tertiary)' }}><Pin className="w-3 h-3" /> Trang đã ghim</h2><div className="space-y-1">{dashboard.pinnedPages.map((page) => <button key={page.id} onClick={() => useNotesStore.getState().selectPage(page.id)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-[var(--color-bg-secondary)] cursor-pointer"><CheckSquare className="w-3.5 h-3.5 text-amber-300" /><span className="text-sm truncate" style={{ color: 'var(--color-text-secondary)' }}>{page.title || 'Chưa có tiêu đề'}</span></button>)}</div></div>}
      {dashboard.orphanPages.length > 0 && <div className="mb-8"><h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)' }}>Gợi ý liên kết</h2><p className="text-xs mb-2 text-slate-500">Các trang chưa có liên kết wiki hoặc notebook hợp lệ:</p><div className="flex flex-wrap gap-1.5">{dashboard.orphanPages.map((page) => <button key={page.id} type="button" onClick={() => useNotesStore.getState().selectPage(page.id)} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 truncate max-w-full">{page.title || 'Chưa có tiêu đề'}</button>)}</div></div>}

      {/* Quick actions */}
      <div className="space-y-2.5 mb-8">
        <button type="button" onClick={() => void handleCreatePage()} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer" style={{ border: '1px dashed var(--color-border)' }}>
          <FilePlus2 className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Trang ghi chú mới</span>
        </button>
        <button
          onClick={() => setCreateNotebookOpen(true)}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
          style={{ border: '1px dashed var(--color-border)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Plus className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Sổ ghi chú mới</span>
        </button>

        <button
          onClick={handleOpenTodayReport}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
          style={{ border: '1px dashed var(--color-border)' }}
        >
          <ClipboardList className="w-4 h-4" style={{ color: 'var(--color-cyan)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {hasTodayReport ? 'Mở báo cáo hôm nay' : 'Tạo báo cáo hôm nay'}
          </span>
        </button>

        <button type="button" onClick={() => setTaskManagerOpen(true)} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer" style={{ border: '1px dashed var(--color-border)' }}>
          <CheckSquare className="w-4 h-4 text-purple-300" /><span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Mở trung tâm công việc</span>
        </button>
        <button type="button" onClick={() => setActiveScheduleTab('schedule')} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer" style={{ border: '1px dashed var(--color-border)' }}>
          <CalendarDays className="w-4 h-4 text-amber-300" /><span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Mở lịch biểu</span>
        </button>

        <button
          onClick={handleGenerateDemoNotes}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/30 hover:border-purple-500/60 shadow-lg shadow-purple-950/20"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
            <span className="text-xs font-bold text-purple-200">📚 Tạo ghi chú mẫu cho tất cả các tính năng</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
            Kho hướng dẫn
          </span>
        </button>
      </div>

      {/* Recent Notebooks */}
      {recentNotebooks.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-tertiary)' }}>
            <Clock className="w-3 h-3" /> Gần đây
          </h2>
          <div className="space-y-1">
            {recentNotebooks.slice(0, 5).map((nb) => (
              <button
                key={nb.id}
                onClick={() => selectNotebook(nb.id)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer text-left"
                style={{ background: 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Notebook className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{nb.title}</span>
                <span className="text-xs ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>
                  {timeAgo(nb.updatedAt)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
