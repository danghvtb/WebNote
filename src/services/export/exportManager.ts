// ============================================================
// WebNote - Export & Import Manager
// Complete, validated and atomic vault backups.
// ============================================================

import { db } from '../database/db';
import { formatWorkReport, rebuildSearchIndex } from '../database/repository';
import type {
  AppSettings,
  CustomUserTask,
  Day,
  Notebook,
  Page,
  Project,
  Revision,
  ScheduleBlock,
  Tag,
  WorkCategory,
  WorkReport,
  Attachment,
} from '../../types';
import { DEFAULT_SETTINGS } from '../../types';
import { areNotificationsEnabled, areSoundNotificationsEnabled } from '../notification/notificationManager';

/** Current interchange format. Older backups are intentionally accepted. */
export const BACKUP_VERSION = '7.0';

export interface VaultBackupData {
  version: string;
  exportDate: string;
  days: Day[];
  notebooks: Notebook[];
  pages: Page[];
  tags: Tag[];
  projects: Project[];
  workReports: WorkReport[];
  scheduleBlocks: ScheduleBlock[];
  customTasks: CustomUserTask[];
  workCategories: WorkCategory[];
  attachments?: Attachment[];
  revisions: Revision[];
  settings: AppSettings;
}

export interface ImportPlan {
  backup: VaultBackupData;
  version: string;
  counts: {
    days: number;
    notebooks: number;
    pages: number;
    tags: number;
    projects: number;
    workReports: number;
    scheduleBlocks: number;
    customTasks: number;
    workCategories: number;
    revisions: number;
    attachments: number;
  };
  warnings: string[];
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function settingsFromLocalStorage(): AppSettings {
  if (!isBrowser()) return { ...DEFAULT_SETTINGS };
  const theme = localStorage.getItem('mynotes_theme');
  let reportTemplates: AppSettings['reportTemplates'] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem('mynotes_report_templates') || '[]');
    if (Array.isArray(parsed)) {
      reportTemplates = parsed.filter((item): item is NonNullable<AppSettings['reportTemplates']>[number] => (
        item && typeof item === 'object' && typeof item.id === 'string' && typeof item.name === 'string'
        && typeof item.issue === 'string' && typeof item.solution === 'string' && typeof item.nextWork === 'string'
      ));
    }
  } catch {
    reportTemplates = [];
  }
  return {
    ...DEFAULT_SETTINGS,
    theme: theme === 'light' || theme === 'system' || theme === 'dark' ? theme : DEFAULT_SETTINGS.theme,
    notificationsEnabled: areNotificationsEnabled(),
    notificationSoundEnabled: areSoundNotificationsEnabled(),
    reportTemplates,
  };
}

function normalizeSettings(value: unknown): AppSettings {
  const candidate = value && typeof value === 'object' ? value as Partial<AppSettings> : {};
  return {
    ...DEFAULT_SETTINGS,
    ...candidate,
    theme: candidate.theme === 'light' || candidate.theme === 'system' || candidate.theme === 'dark'
      ? candidate.theme
      : DEFAULT_SETTINGS.theme,
    editorFontSize: typeof candidate.editorFontSize === 'number' && Number.isFinite(candidate.editorFontSize)
      ? candidate.editorFontSize
      : DEFAULT_SETTINGS.editorFontSize,
    editorLineHeight: typeof candidate.editorLineHeight === 'number' && Number.isFinite(candidate.editorLineHeight)
      ? candidate.editorLineHeight
      : DEFAULT_SETTINGS.editorLineHeight,
    codeTheme: typeof candidate.codeTheme === 'string' ? candidate.codeTheme : DEFAULT_SETTINGS.codeTheme,
    notificationsEnabled: typeof candidate.notificationsEnabled === 'boolean' ? candidate.notificationsEnabled : undefined,
    notificationSoundEnabled: typeof candidate.notificationSoundEnabled === 'boolean' ? candidate.notificationSoundEnabled : undefined,
    reportTemplates: Array.isArray(candidate.reportTemplates)
      ? candidate.reportTemplates.filter((item): item is NonNullable<AppSettings['reportTemplates']>[number] => (
        item && typeof item.id === 'string' && typeof item.name === 'string'
        && typeof item.issue === 'string' && typeof item.solution === 'string' && typeof item.nextWork === 'string'
      ))
      : [],
  };
}

function asArray<T>(value: unknown, name: string, warnings: string[], required = false): T[] {
  if (value === undefined || value === null) {
    if (required) throw new Error(`Backup thiếu trường bắt buộc: ${name}.`);
    warnings.push(`Backup cũ không có ${name}; đã dùng mảng rỗng.`);
    return [];
  }
  if (!Array.isArray(value)) throw new Error(`Trường ${name} trong backup phải là mảng.`);
  return value as T[];
}

function ensureUniqueIds<T extends { id?: unknown }>(items: T[], collection: string): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !item.id.trim()) {
      throw new Error(`${collection} chứa bản ghi không có id hợp lệ.`);
    }
    if (ids.has(item.id)) throw new Error(`${collection} bị trùng id: ${item.id}.`);
    ids.add(item.id);
  }
}

function normalizeBackup(raw: unknown): ImportPlan {
  if (!raw || typeof raw !== 'object') throw new Error('Nội dung backup không hợp lệ.');
  const source = raw as Record<string, unknown>;
  const warnings: string[] = [];

  // Never apply a snapshot produced by a newer application: unknown fields or
  // cascade rules could otherwise be silently discarded during replace restore.
  const sourceVersion = typeof source.version === 'string' ? source.version : 'legacy';
  const majorVersion = Number.parseInt(sourceVersion.split('.')[0], 10);
  if (Number.isFinite(majorVersion) && majorVersion > Number.parseInt(BACKUP_VERSION, 10)) {
    throw new Error(`Backup version ${sourceVersion} is newer than this app (${BACKUP_VERSION}). Update WebNote before restoring.`);
  }

  const days = asArray<Day>(source.days, 'days', warnings);
  const notebooks = asArray<Notebook>(source.notebooks, 'notebooks', warnings);
  // Pages are the only collection required by the original backup format.
  const pages = asArray<Page>(source.pages, 'pages', warnings, true).map((page) => ({
    ...page,
    tagIds: Array.isArray(page.tagIds) ? Array.from(new Set(page.tagIds.filter((id): id is string => typeof id === 'string'))) : [],
  }));
  const tags = asArray<Tag>(source.tags, 'tags', warnings);
  const projects = asArray<Project>(source.projects, 'projects', warnings);
  const workReports = asArray<WorkReport>(source.workReports, 'workReports', warnings).map((report) => ({
    ...report,
    projectEntries: Array.isArray(report.projectEntries) ? report.projectEntries : [],
    issue: typeof report.issue === 'string' ? report.issue : '',
    solution: typeof report.solution === 'string' ? report.solution : '',
    nextWork: typeof report.nextWork === 'string' ? report.nextWork : '',
  }));
  const scheduleBlocks = asArray<ScheduleBlock>(source.scheduleBlocks, 'scheduleBlocks', warnings);
  const customTasks = asArray<CustomUserTask>(source.customTasks, 'customTasks', warnings);
  const workCategories = asArray<WorkCategory>(source.workCategories, 'workCategories', warnings);
  const revisions = asArray<Revision>(source.revisions, 'revisions', warnings);
  const attachments = asArray<Attachment>(source.attachments, 'attachments', warnings);

  ensureUniqueIds(days, 'days');
  ensureUniqueIds(notebooks, 'notebooks');
  ensureUniqueIds(pages, 'pages');
  ensureUniqueIds(tags, 'tags');
  ensureUniqueIds(projects, 'projects');
  ensureUniqueIds(workReports, 'workReports');
  ensureUniqueIds(scheduleBlocks, 'scheduleBlocks');
  ensureUniqueIds(customTasks, 'customTasks');
  ensureUniqueIds(workCategories, 'workCategories');
  ensureUniqueIds(revisions, 'revisions');
  ensureUniqueIds(attachments, 'attachments');

  const dayIds = new Set(days.map((day) => day.id));
  const notebookIds = new Set(notebooks.map((notebook) => notebook.id));
  const pageIds = new Set(pages.map((page) => page.id));
  const tagIds = new Set(tags.map((tag) => tag.id));

  for (const notebook of notebooks) {
    if (!dayIds.has(notebook.dateId)) throw new Error(`Notebook ${notebook.id} tham chiếu ngày không tồn tại.`);
  }
  for (const page of pages) {
    if (!notebookIds.has(page.notebookId)) throw new Error(`Page ${page.id} tham chiếu notebook không tồn tại.`);
    if (page.tagIds.some((tagId) => !tagIds.has(tagId))) {
      throw new Error(`Page ${page.id} tham chiếu thẻ không tồn tại.`);
    }
  }
  const reportDays = new Set<string>();
  for (const report of workReports) {
    if (!dayIds.has(report.dayId)) throw new Error(`Báo cáo ${report.id} tham chiếu ngày không tồn tại.`);
    if (!report.deletedAt && reportDays.has(report.dayId)) throw new Error(`Có nhiều hơn một báo cáo trong ngày ${report.dayId}.`);
    if (!report.deletedAt) reportDays.add(report.dayId);
  }
  for (const revision of revisions) {
    if (!pageIds.has(revision.pageId)) throw new Error(`Revision ${revision.id} tham chiếu page không tồn tại.`);
  }
  for (const attachment of attachments) {
    if (!pageIds.has(attachment.pageId)) throw new Error(`Attachment ${attachment.id} tham chiếu page không tồn tại.`);
  }

  const backup: VaultBackupData = {
    version: sourceVersion,
    exportDate: typeof source.exportDate === 'string' ? source.exportDate : new Date().toISOString(),
    days,
    notebooks,
    pages,
    tags,
    projects,
    workReports,
    scheduleBlocks,
    customTasks,
    workCategories,
    revisions,
    attachments,
    settings: normalizeSettings(source.settings),
  };
  return {
    backup,
    version: backup.version,
    warnings,
    counts: {
      days: days.length,
      notebooks: notebooks.length,
      pages: pages.length,
      tags: tags.length,
      projects: projects.length,
      workReports: workReports.length,
      scheduleBlocks: scheduleBlocks.length,
      customTasks: customTasks.length,
      workCategories: workCategories.length,
      revisions: revisions.length,
      attachments: attachments.length,
    },
  };
}

function downloadBackupData(backup: VaultBackupData, filename: string): void {
  if (!isBrowser() || typeof URL.createObjectURL !== 'function') return;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Export all active work reports as one chronological Markdown document. */
export async function exportWorkReportsAsMarkdown(startDate?: string, endDate?: string): Promise<number> {
  const [reports, days] = await Promise.all([db.workReports.filter((report) => !report.deletedAt).toArray(), db.days.toArray()]);
  const dates = new Map(days.map((day) => [day.id, day.date]));
  const selected = reports
    .map((report) => ({ report, date: dates.get(report.dayId) || report.dayId.replace(/^day_/, '') }))
    .filter(({ date }) => (!startDate || date >= startDate) && (!endDate || date <= endDate))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!isBrowser()) return selected.length;
  const markdown = selected.map(({ report, date }) => formatWorkReport(report, date)).join('\n\n---\n\n');
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `WebNote-Bao-cao-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return selected.length;
}

export async function exportScheduleAsICS(): Promise<number> {
  const blocks = await db.scheduleBlocks.toArray();
  if (!isBrowser()) return blocks.length;
  const toICSDate = (date: string, time = '09:00') => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
  const body = blocks.map((block) => `BEGIN:VEVENT\nUID:${block.id}@webnote\nDTSTART:${toICSDate(block.date, block.startTime)}\nDTEND:${toICSDate(block.date, block.endTime || block.startTime || '10:00')}\nSUMMARY:${(block.title || '').replace(/[\n,;]/g, ' ')}\nEND:VEVENT`).join('\n');
  const blob = new Blob([`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//WebNote//Schedule//VI\n${body}\nEND:VCALENDAR`], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `WebNote-Lich-${new Date().toISOString().slice(0, 10)}.ics`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  return blocks.length;
}

export async function exportTasksAsCSV(): Promise<number> {
  const tasks = await db.customTasks.toArray();
  if (!isBrowser()) return tasks.length;
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = ['id,title,status,dueDate,description', ...tasks.map((task) => [task.id, task.title, task.status, task.dueDate || '', task.description || ''].map(escape).join(','))].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `WebNote-Cong-viec-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  return tasks.length;
}

/** Read every local collection without exposing credentials or access tokens. */
export async function createVaultBackupData(): Promise<VaultBackupData> {
  const [days, notebooks, pages, tags, projects, workReports, scheduleBlocks, customTasks, workCategories, revisions, attachments] = await Promise.all([
    db.days.toArray(),
    db.notebooks.toArray(),
    db.pages.toArray(),
    db.tags.toArray(),
    db.projects.toArray(),
    db.workReports.toArray(),
    db.scheduleBlocks.toArray(),
    db.customTasks.toArray(),
    db.workCategories.toArray(),
    db.revisions.toArray(),
    db.attachments.toArray(),
  ]);
  return {
    version: BACKUP_VERSION,
    exportDate: new Date().toISOString(),
    days,
    notebooks,
    pages: pages.map((page) => ({ ...page, tagIds: page.tagIds || [] })),
    tags,
    projects,
    workReports,
    scheduleBlocks,
    customTasks,
    workCategories,
    revisions,
    attachments,
    settings: settingsFromLocalStorage(),
  };
}

/** Create an in-memory recovery snapshot. Import uses it before replacing data. */
export async function createRecoveryBackup(): Promise<VaultBackupData> {
  return createVaultBackupData();
}

/** Export complete vault as a JSON backup file. */
export async function exportVaultAsJSON(): Promise<VaultBackupData> {
  const backup = await createVaultBackupData();
  downloadBackupData(backup, `WebNote-Backup-${new Date().toISOString().slice(0, 10)}.json`);
  return backup;
}

/** Export selected page as Markdown, including resolved tag names. */
export function exportPageAsMarkdown(page: Page, tags: Tag[] = []): void {
  if (!isBrowser()) return;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = page.content || '';
  const tagLine = (page.tagIds || [])
    .map((id) => tags.find((tag) => tag.id === id)?.name)
    .filter((name): name is string => !!name)
    .map((name) => `#${name}`)
    .join(' ');
  const markdownContent = `# ${page.title || 'Chưa có tiêu đề'}\n\nNgày tạo: ${page.createdAt}\n${tagLine ? `Thẻ: ${tagLine}\n` : ''}\n---\n\n${tempDiv.innerText || tempDiv.textContent || ''}`;
  const blob = new Blob([markdownContent], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const safeTitle = (page.title || 'Chưa có tiêu đề').replace(/[^a-z0-9_-]/gi, '_');
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeTitle}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Parse and validate a backup without modifying IndexedDB. */
export async function inspectBackup(file: File): Promise<ImportPlan> {
  const text = await file.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('File backup không phải JSON hợp lệ.');
  }
  return normalizeBackup(raw);
}

/**
 * Replace all vault collections atomically. Search index is rebuilt only after
 * the transaction has committed, so a malformed backup can never erase data.
 */
export async function restoreVaultData(backup: VaultBackupData): Promise<void> {
  await db.transaction(
    'rw',
    [db.days, db.notebooks, db.pages, db.revisions, db.scheduleBlocks, db.customTasks, db.workCategories, db.tags, db.projects, db.workReports, db.attachments, db.searchIndex],
    async () => {
      await Promise.all([
        db.days.clear(), db.notebooks.clear(), db.pages.clear(), db.revisions.clear(),
        db.scheduleBlocks.clear(), db.customTasks.clear(), db.workCategories.clear(),
        db.tags.clear(), db.projects.clear(), db.workReports.clear(), db.attachments.clear(), db.searchIndex.clear(),
      ]);
      if (backup.days.length) await db.days.bulkPut(backup.days);
      if (backup.notebooks.length) await db.notebooks.bulkPut(backup.notebooks);
      if (backup.pages.length) await db.pages.bulkPut(backup.pages);
      if (backup.revisions.length) await db.revisions.bulkPut(backup.revisions);
      if (backup.scheduleBlocks.length) await db.scheduleBlocks.bulkPut(backup.scheduleBlocks);
      if (backup.customTasks.length) await db.customTasks.bulkPut(backup.customTasks);
      if (backup.workCategories.length) await db.workCategories.bulkPut(backup.workCategories);
      if (backup.tags.length) await db.tags.bulkPut(backup.tags);
      if (backup.projects.length) await db.projects.bulkPut(backup.projects);
      if (backup.workReports.length) await db.workReports.bulkPut(backup.workReports);
      if (backup.attachments?.length) await db.attachments.bulkPut(backup.attachments);
    },
  );
  await rebuildSearchIndex();
  if (isBrowser()) {
    localStorage.setItem('mynotes_theme', backup.settings.theme);
    if (typeof backup.settings.notificationsEnabled === 'boolean') {
      localStorage.setItem('mynotes_notifications_enabled', backup.settings.notificationsEnabled ? '1' : '0');
    }
    if (typeof backup.settings.notificationSoundEnabled === 'boolean') {
      localStorage.setItem('mynotes_notification_sound_enabled', backup.settings.notificationSoundEnabled ? '1' : '0');
    }
    if (backup.settings.reportTemplates) {
      localStorage.setItem('mynotes_report_templates', JSON.stringify(backup.settings.reportTemplates));
    }
  }
}

/** Public API name used by integrations and future UI flows. */
export const restoreBackup = restoreVaultData;

/** Validate, create a downloadable recovery copy, then atomically restore. */
export async function importVaultFromJSON(jsonFile: File): Promise<{ success: boolean; pagesImported: number; message: string; plan: ImportPlan }> {
  const plan = await inspectBackup(jsonFile);
  const recovery = await createRecoveryBackup();
  downloadBackupData(recovery, `WebNote-Recovery-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await restoreVaultData(plan.backup);
  const warningSuffix = plan.warnings.length ? ` ${plan.warnings.join(' ')}` : '';
  return {
    success: true,
    pagesImported: plan.backup.pages.length,
    message: `Đã khôi phục ${plan.backup.pages.length} page và toàn bộ dữ liệu liên quan.${warningSuffix}`,
    plan,
  };
}
