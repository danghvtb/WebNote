// ============================================================
// MyNotes — Data Repository
// Business logic for CRUD operations on Days, Notebooks, Pages.
// Abstracts IndexedDB from UI components.
// ============================================================

import { db } from './db';
import type {
  Day,
  Notebook,
  Page,
  SearchEntry,
  ScheduleBlock,
  CustomUserTask,
  WorkCategory,
  Tag,
  Project,
  WorkReport,
  WorkReportProjectEntry,
  Attachment,
  Revision,
  SearchFilters,
} from '../../types';
import {
  generateId,
  dayIdFromDate,
  todayId,
  todayDate,
  nowISO,
  stripHtml,
} from '../../utils';
import { parseAllTasks } from '../../utils/taskUtils';

export function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function tagKey(name: string): string {
  return normalizeTagName(name).toLocaleLowerCase();
}

export async function getAllTags(): Promise<Tag[]> {
  return db.tags.orderBy('name').toArray();
}

export async function createTag(name: string): Promise<Tag> {
  const displayName = normalizeTagName(name);
  if (!displayName) throw new Error('Tag name cannot be empty');
  const normalizedName = tagKey(displayName);
  if (await db.tags.where('normalizedName').equals(normalizedName).first()) throw new Error('A tag with this name already exists');
  const now = nowISO();
  const tag: Tag = { id: generateId('tag'), name: displayName, normalizedName, createdAt: now, updatedAt: now };
  await db.tags.add(tag);
  return tag;
}

export async function renameTag(tagId: string, name: string): Promise<Tag> {
  const tag = await db.tags.get(tagId);
  if (!tag) throw new Error('Tag not found');
  const displayName = normalizeTagName(name);
  if (!displayName) throw new Error('Tag name cannot be empty');
  const normalizedName = tagKey(displayName);
  const duplicate = await db.tags.where('normalizedName').equals(normalizedName).first();
  if (duplicate && duplicate.id !== tagId) throw new Error('A tag with this name already exists');
  const updated = { ...tag, name: displayName, normalizedName, updatedAt: nowISO() };
  await db.tags.put(updated);
  const pages = await db.pages.filter((p) => (p.tagIds || []).includes(tagId)).toArray();
  for (const page of pages) {
    const notebook = await db.notebooks.get(page.notebookId);
    if (notebook) await updateSearchIndexForPage(page, notebook.title);
  }
  return updated;
}

export async function deleteTag(tagId: string): Promise<string[]> {
  const tag = await db.tags.get(tagId);
  if (!tag) return [];
  const affected = await db.pages.filter((p) => (p.tagIds || []).includes(tagId)).toArray();
  await db.transaction('rw', [db.tags, db.pages, db.notebooks, db.searchIndex], async () => {
    await db.tags.delete(tagId);
    for (const page of affected) {
      const updated = { ...page, tagIds: (page.tagIds || []).filter((id) => id !== tagId), updatedAt: nowISO() };
      await db.pages.put(updated);
      const notebook = await db.notebooks.get(page.notebookId);
      if (notebook) await updateSearchIndexForPage(updated, notebook.title);
    }
  });
  return affected.map((p) => p.id);
}

export async function setPageTags(pageId: string, tagIds: string[]): Promise<Page | undefined> {
  const page = await db.pages.get(pageId);
  if (!page) return undefined;
  const validIds: string[] = [];
  for (const id of Array.from(new Set(tagIds))) if (await db.tags.get(id)) validIds.push(id);
  const updated = { ...page, tagIds: validIds, updatedAt: nowISO() };
  await db.transaction('rw', [db.pages, db.notebooks, db.tags, db.searchIndex], async () => {
    await db.pages.put(updated);
    const notebook = await db.notebooks.get(page.notebookId);
    if (notebook) await updateSearchIndexForPage(updated, notebook.title);
  });
  return updated;
}

// ===================== PROJECT OPERATIONS =====================

export function normalizeProjectName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function projectKey(name: string): string {
  return normalizeProjectName(name).toLocaleLowerCase();
}

export async function getProjects(includeDeleted = false): Promise<Project[]> {
  return db.projects
    .orderBy('name')
    .filter((project) => includeDeleted || !project.deletedAt)
    .toArray();
}

export async function createProject(name: string, description = ''): Promise<Project> {
  const displayName = normalizeProjectName(name);
  if (!displayName) throw new Error('Project name cannot be empty');
  const normalizedName = projectKey(displayName);
  const duplicates = await db.projects.where('normalizedName').equals(normalizedName).toArray();
  if (duplicates.length > 0) throw new Error('A project with this name already exists');

  const now = nowISO();
  const project: Project = {
    id: generateId('project'),
    name: displayName,
    normalizedName,
    description: description.trim(),
    createdAt: now,
    updatedAt: now,
  };
  await db.projects.put(project);
  return project;
}

export async function updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'description'>>): Promise<Project> {
  const project = await db.projects.get(id);
  if (!project) throw new Error('Project not found');

  const displayName = updates.name === undefined ? project.name : normalizeProjectName(updates.name);
  if (!displayName) throw new Error('Project name cannot be empty');
  const normalizedName = projectKey(displayName);
  const duplicates = await db.projects.where('normalizedName').equals(normalizedName).toArray();
  if (duplicates.some((project) => project.id !== id && !project.deletedAt)) throw new Error('A project with this name already exists');

  const updated: Project = {
    ...project,
    name: displayName,
    normalizedName,
    description: updates.description === undefined ? project.description : updates.description.trim(),
    updatedAt: nowISO(),
  };
  await db.projects.put(updated);
  return updated;
}

export async function archiveProject(id: string): Promise<Project | undefined> {
  const project = await db.projects.get(id);
  if (!project) return undefined;
  const updated = { ...project, deletedAt: nowISO(), updatedAt: nowISO() };
  await db.projects.put(updated);
  return updated;
}

export async function restoreProject(id: string): Promise<Project | undefined> {
  const project = await db.projects.get(id);
  if (!project) return undefined;
  const duplicates = await db.projects.where('normalizedName').equals(project.normalizedName).toArray();
  if (duplicates.some((candidate) => candidate.id !== id && !candidate.deletedAt)) throw new Error('A project with this name already exists');
  const { deletedAt: _deletedAt, ...rest } = project;
  const restored = { ...rest, updatedAt: nowISO() };
  await db.projects.put(restored);
  return restored;
}

export async function getProjectUsageCount(projectId: string): Promise<number> {
  return db.workReports
    .filter((report) => !report.deletedAt && report.projectEntries.some((entry) => entry.projectId === projectId))
    .count();
}

// ===================== WORK REPORT OPERATIONS =====================

export async function getWorkReportByDay(dayId: string, includeDeleted = false): Promise<WorkReport | undefined> {
  const report = await db.workReports.where('dayId').equals(dayId).first();
  if (report?.deletedAt && !includeDeleted) return undefined;
  return report;
}

export async function getWorkReportById(id: string, includeDeleted = false): Promise<WorkReport | undefined> {
  const report = await db.workReports.get(id);
  if (report?.deletedAt && !includeDeleted) return undefined;
  return report;
}

export async function getAllWorkReports(includeDeleted = false): Promise<WorkReport[]> {
  return db.workReports.filter((report) => includeDeleted || !report.deletedAt).toArray();
}

export async function createOrGetWorkReport(dayId: string): Promise<WorkReport> {
  const existing = await db.workReports.where('dayId').equals(dayId).first();
  if (existing) {
    if (existing.deletedAt) {
      const restored = { ...existing, deletedAt: undefined, updatedAt: nowISO() };
      await db.workReports.put(restored);
      await updateSearchIndexForWorkReport(restored);
      return restored;
    }
    return existing;
  }

  const now = nowISO();
  const report: WorkReport = {
    id: generateId('report'),
    dayId,
    projectEntries: [],
    issue: '',
    solution: '',
    nextWork: '',
    createdAt: now,
    updatedAt: now,
  };
  await db.workReports.add(report);
  await updateSearchIndexForWorkReport(report);
  return report;
}

export async function updateWorkReport(
  id: string,
  updates: Partial<Pick<WorkReport, 'projectEntries' | 'issue' | 'solution' | 'nextWork'>>,
): Promise<WorkReport | undefined> {
  const report = await db.workReports.get(id);
  if (!report) return undefined;
  const projectEntries: WorkReportProjectEntry[] = updates.projectEntries
    ? Array.from(new Map(updates.projectEntries.map((entry) => [entry.projectId, entry])).values())
    : report.projectEntries;
  const updated: WorkReport = { ...report, ...updates, projectEntries, updatedAt: nowISO() };
  await db.workReports.put(updated);
  await updateSearchIndexForWorkReport(updated);
  return updated;
}

export async function deleteWorkReport(id: string): Promise<void> {
  const report = await db.workReports.get(id);
  if (!report) return;
  await db.workReports.update(id, { deletedAt: nowISO(), updatedAt: nowISO() });
  await db.searchIndex.where('entityId').equals(id).delete();
}

/** Permanently remove a deleted work report and its search entry. */
export async function permanentlyDeleteWorkReport(id: string): Promise<void> {
  await db.transaction('rw', [db.workReports, db.searchIndex], async () => {
    await db.workReports.delete(id);
    await db.searchIndex.where('entityId').equals(id).delete();
  });
}

export async function restoreWorkReport(id: string): Promise<WorkReport | undefined> {
  const report = await db.workReports.get(id);
  if (!report) return undefined;
  const restored = { ...report, deletedAt: undefined, updatedAt: nowISO() };
  await db.workReports.put(restored);
  await updateSearchIndexForWorkReport(restored);
  return restored;
}

export async function getTrashSummary(): Promise<{ pages: number; notebooks: number; workReports: number; total: number }> {
  const [pages, notebooks, workReports] = await Promise.all([
    db.pages.filter((page) => Boolean(page.deleted)).count(),
    db.notebooks.filter((notebook) => Boolean(notebook.deleted)).count(),
    db.workReports.filter((report) => Boolean(report.deletedAt)).count(),
  ]);
  return { pages, notebooks, workReports, total: pages + notebooks + workReports };
}

export async function emptyTrash(): Promise<void> {
  const [pages, notebooks, reports] = await Promise.all([
    db.pages.filter((page) => Boolean(page.deleted)).toArray(),
    db.notebooks.filter((notebook) => Boolean(notebook.deleted)).toArray(),
    db.workReports.filter((report) => Boolean(report.deletedAt)).toArray(),
  ]);
  for (const page of pages) await permanentlyDeletePage(page.id);
  for (const notebook of notebooks) await permanentlyDeleteNotebook(notebook.id);
  for (const report of reports) await permanentlyDeleteWorkReport(report.id);
}

export function formatWorkReport(report: WorkReport, date: string): string {
  const formattedDate = date
    ? date.split('-').reverse().join('/')
    : '';
  const plusLines = (value: string) => value.split(/\r?\n/).filter((line) => line.trim()).map((line) => `+ ${line.trim()}`).join('\n');
  let text = `Báo cáo công việc ${formattedDate}\n`;
  text += '- Tên dự án:\n';
  report.projectEntries.forEach((entry, index) => {
    text += `${index + 1}. ${entry.projectNameSnapshot}\n`;
    text += '- Nội dung công việc:\n';
    text += `${plusLines(entry.content)}\n`;
    text += '- Kết quả công việc:\n';
    text += `${plusLines(entry.result)}\n`;
  });
  text += `\n- Vấn đề tồn tại:\n${plusLines(report.issue)}`;
  text += `\n\n- Hướng giải quyết:\n${plusLines(report.solution)}`;
  text += `\n\n- Công việc ngày tiếp theo:\n${plusLines(report.nextWork)}`;
  return text;
}

// ===================== ATTACHMENTS =====================

export async function getPageAttachments(pageId: string, includeDeleted = false): Promise<Attachment[]> {
  const attachments = await db.attachments.where('pageId').equals(pageId).toArray();
  return includeDeleted ? attachments : attachments.filter((attachment) => !attachment.deletedAt);
}

export async function addPageAttachment(input: Omit<Attachment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Attachment> {
  const now = nowISO();
  const attachment: Attachment = { ...input, id: generateId('attachment'), createdAt: now, updatedAt: now };
  await db.attachments.put(attachment);
  return attachment;
}

export async function deletePageAttachment(id: string): Promise<void> {
  const attachment = await db.attachments.get(id);
  if (!attachment) return;
  await db.attachments.put({ ...attachment, deletedAt: nowISO(), updatedAt: nowISO() });
}

export async function restorePageAttachment(id: string): Promise<Attachment | undefined> {
  const attachment = await db.attachments.get(id);
  if (!attachment) return undefined;
  const restored = { ...attachment, deletedAt: undefined, updatedAt: nowISO() };
  await db.attachments.put(restored);
  return restored;
}

export async function getDeletedAttachments(): Promise<Attachment[]> {
  return db.attachments.filter((attachment) => Boolean(attachment.deletedAt)).toArray();
}

export async function permanentlyDeletePageAttachment(id: string): Promise<void> {
  await db.attachments.delete(id);
}

// ===================== DAY OPERATIONS =====================

/**
 * Get or create today's Day record.
 */
export async function ensureToday(): Promise<Day> {
  const id = todayId();
  const existing = await db.days.get(id);
  if (existing) return existing;

  const day: Day = {
    id,
    date: todayDate(),
  };
  await db.days.put(day);
  return day;
}

/**
 * Get or create a Day for a specific date.
 */
export async function ensureDay(date: string): Promise<Day> {
  const id = dayIdFromDate(date);
  const existing = await db.days.get(id);
  if (existing) return existing;

  const day: Day = { id, date };
  await db.days.put(day);
  return day;
}

/**
 * Get all days, sorted by date descending (newest first).
 */
export async function getAllDays(): Promise<Day[]> {
  const days = await db.days.orderBy('date').reverse().toArray();
  return days;
}

/**
 * Get days grouped by month.
 */
export async function getDaysGroupedByMonth(): Promise<Map<string, Day[]>> {
  const days = await getAllDays();
  const grouped = new Map<string, Day[]>();

  for (const day of days) {
    const [year, month] = day.date.split('-');
    const key = `${year}-${month}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(day);
  }

  return grouped;
}

// ===================== NOTEBOOK OPERATIONS =====================

/**
 * Create a new Notebook.
 */
export async function createNotebook(
  title: string,
  dateId?: string,
  icon: string = 'notebook'
): Promise<Notebook> {
  const targetDayId = dateId || todayId();

  // Ensure the day exists
  if (!dateId) {
    await ensureToday();
  }

  const now = nowISO();
  const notebook: Notebook = {
    id: generateId('nb'),
    dateId: targetDayId,
    title,
    icon,
    createdAt: now,
    updatedAt: now,
    pageIds: [],
  };

  await db.notebooks.put(notebook);
  await updateSearchIndexForNotebook(notebook);
  return notebook;
}

/**
 * Get all notebooks for a day.
 */
export async function getNotebooksByDay(dayId: string): Promise<Notebook[]> {
  const notebooks = await db.notebooks
    .where('dateId')
    .equals(dayId)
    .filter((nb) => !nb.deleted)
    .sortBy('updatedAt');
  return notebooks.reverse().sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)));
}

/**
 * Get a notebook by ID.
 */
export async function getNotebook(notebookId: string): Promise<Notebook | undefined> {
  return db.notebooks.get(notebookId);
}

/**
 * Update a notebook.
 */
export async function updateNotebook(
  notebookId: string,
  updates: Partial<Pick<Notebook, 'title' | 'icon' | 'pageIds'>>
): Promise<Notebook | undefined> {
  const notebook = await db.notebooks.get(notebookId);
  if (!notebook) return undefined;

  const updated = {
    ...notebook,
    ...updates,
    updatedAt: nowISO(),
  };

  await db.notebooks.put(updated);
  await updateSearchIndexForNotebook(updated);
  return updated;
}

/**
 * Soft-delete a notebook and its pages.
 */
export async function deleteNotebook(notebookId: string): Promise<void> {
  const notebook = await db.notebooks.get(notebookId);
  if (!notebook) return;

  const pages = await db.pages.where('notebookId').equals(notebookId).toArray();

  const now = nowISO();
  // Keep notebook and pages recoverable in Trash. This also prevents a later
  // cloud snapshot from resurrecting children that were intentionally removed.
  await db.notebooks.update(notebookId, { deleted: true, deletedAt: now, updatedAt: now });
  await db.pages.where('notebookId').equals(notebookId).modify({ deleted: true, deletedAt: now, updatedAt: now });
  await db.attachments.where('pageId').anyOf(pages.map((page) => page.id)).modify({ deletedAt: now, updatedAt: now }).catch(() => {});

  // Remove from search index
  await db.searchIndex.where('entityId').equals(notebookId).delete();
  for (const page of pages) {
    await db.searchIndex.where('entityId').equals(page.id).delete();
  }
}

/**
 * Duplicate a notebook with all its pages.
 */
export async function duplicateNotebook(notebookId: string): Promise<Notebook | null> {
  const original = await db.notebooks.get(notebookId);
  if (!original) return null;

  const now = nowISO();
  const newNotebook: Notebook = {
    ...original,
    id: generateId('nb'),
    title: `${original.title} (Copy)`,
    createdAt: now,
    updatedAt: now,
    pageIds: [],
  };

  // Duplicate pages
  const pages = await db.pages.where('notebookId').equals(notebookId).toArray();
  for (const page of pages) {
    const newPage: Page = {
      ...page,
      id: generateId('page'),
      notebookId: newNotebook.id,
      createdAt: now,
      updatedAt: now,
    };
    await db.pages.put(newPage);
    newNotebook.pageIds.push(newPage.id);
    await updateSearchIndexForPage(newPage, newNotebook.title);
  }

  await db.notebooks.put(newNotebook);
  await updateSearchIndexForNotebook(newNotebook);
  return newNotebook;
}

/**
 * Get recently modified notebooks across all days.
 */
export async function getRecentNotebooks(limit: number = 10): Promise<Notebook[]> {
  return db.notebooks
    .orderBy('updatedAt')
    .reverse()
    .filter((nb) => !nb.deleted)
    .limit(limit)
    .toArray();
}

/**
 * Get total notebook count for a day.
 */
export async function getNotebookCountByDay(dayId: string): Promise<number> {
  return db.notebooks
    .where('dateId')
    .equals(dayId)
    .filter((nb) => !nb.deleted)
    .count();
}

// ===================== PAGE OPERATIONS =====================

/**
 * Create a new Page in a Notebook.
 */
export async function createPage(
  notebookId: string,
  title: string = 'Chưa có tiêu đề'
): Promise<Page> {
  const notebook = await db.notebooks.get(notebookId);
  if (!notebook) throw new Error(`Notebook ${notebookId} not found`);

  const now = nowISO();
  const order = notebook.pageIds.length;
  const page: Page = {
    id: generateId('page'),
    notebookId,
    title,
    content: '',
    order,
    createdAt: now,
    updatedAt: now,
    tagIds: [],
  };

  await db.pages.put(page);

  // Add page to notebook's pageIds
  const updatedPageIds = [...notebook.pageIds, page.id];
  await db.notebooks.update(notebookId, {
    pageIds: updatedPageIds,
    updatedAt: now,
  });

  await updateSearchIndexForPage(page, notebook.title);
  return page;
}

/**
 * Get all pages for a notebook.
 */
export async function getPagesByNotebook(notebookId: string): Promise<Page[]> {
  const pages = await db.pages
    .where('notebookId')
    .equals(notebookId)
    .filter((p) => !p.deleted)
    .sortBy('order');
  return pages.sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) || a.order - b.order);
}

/**
 * Get a page by ID.
 */
export async function getPage(pageId: string): Promise<Page | undefined> {
  return db.pages.get(pageId);
}

export async function restoreNotebook(notebookId: string): Promise<Notebook | undefined> {
  const notebook = await db.notebooks.get(notebookId);
  if (!notebook) return undefined;
  const now = nowISO();
  const restored = { ...notebook, deleted: false, deletedAt: undefined, updatedAt: now };
  await db.notebooks.put(restored);
  await db.pages.where('notebookId').equals(notebookId).modify({ deleted: false, deletedAt: undefined, updatedAt: now });
  const pageIds = (await db.pages.where('notebookId').equals(notebookId).toArray()).map((page) => page.id);
  if (pageIds.length) await db.attachments.where('pageId').anyOf(pageIds).modify({ deletedAt: undefined, updatedAt: now }).catch(() => {});
  await updateSearchIndexForNotebook(restored);
  return restored;
}

export async function getDeletedNotebooks(): Promise<Notebook[]> {
  return db.notebooks.filter((notebook) => !!notebook.deleted).reverse().sortBy('updatedAt');
}

export async function permanentlyDeleteNotebook(notebookId: string): Promise<void> {
  const pages = await db.pages.where('notebookId').equals(notebookId).toArray();
  await db.transaction('rw', [db.notebooks, db.pages, db.attachments, db.revisions, db.searchIndex], async () => {
    await db.notebooks.delete(notebookId);
    await db.pages.where('notebookId').equals(notebookId).delete();
    await db.attachments.where('pageId').anyOf(pages.map((page) => page.id)).delete().catch(() => {});
    for (const page of pages) {
      await db.revisions.where('pageId').equals(page.id).delete();
      await db.searchIndex.where('entityId').equals(page.id).delete();
    }
    await db.searchIndex.where('entityId').equals(notebookId).delete();
  });
}

// ===================== REVISION OPERATIONS =====================

/** Save a point-in-time page snapshot for recovery/history. */
export async function createRevision(pageId: string, deviceId = 'browser'): Promise<Revision | undefined> {
  const page = await db.pages.get(pageId);
  if (!page) return undefined;
  const revision: Revision = {
    id: generateId('rev'),
    pageId,
    content: page.content,
    title: page.title,
    createdAt: nowISO(),
    deviceId,
  };
  await db.revisions.put(revision);
  return revision;
}

export async function getPageRevisions(pageId: string, limit = 30): Promise<Revision[]> {
  const revisions = await db.revisions.where('pageId').equals(pageId).sortBy('createdAt');
  return revisions.reverse().slice(0, limit);
}

export async function setPagePinned(pageId: string, isPinned: boolean): Promise<Page | undefined> {
  const page = await db.pages.get(pageId);
  if (!page) return undefined;
  const updated = { ...page, isPinned, updatedAt: nowISO() };
  await db.pages.put(updated);
  return updated;
}

export async function setNotebookPinned(notebookId: string, isPinned: boolean): Promise<Notebook | undefined> {
  const notebook = await db.notebooks.get(notebookId);
  if (!notebook) return undefined;
  const updated = { ...notebook, isPinned, updatedAt: nowISO() };
  await db.notebooks.put(updated);
  await updateSearchIndexForNotebook(updated);
  return updated;
}

/** Restore a revision while preserving the current page as a new revision. */
export async function restoreRevision(revisionId: string): Promise<Page | undefined> {
  const revision = await db.revisions.get(revisionId);
  if (!revision) return undefined;
  const page = await db.pages.get(revision.pageId);
  if (!page) return undefined;
  await createRevision(page.id);
  return updatePageContent(page.id, revision.content, revision.title);
}

export async function prunePageRevisions(pageId: string, max = 30): Promise<void> {
  const revisions = await db.revisions.where('pageId').equals(pageId).sortBy('createdAt');
  if (revisions.length <= max) return;
  await db.revisions.bulkDelete(revisions.slice(0, revisions.length - max).map((revision) => revision.id));
}

export const pruneRevisions = prunePageRevisions;

export async function setPinned(entity: 'page' | 'notebook', id: string, pinned: boolean): Promise<Page | Notebook | undefined> {
  return entity === 'page' ? setPagePinned(id, pinned) : setNotebookPinned(id, pinned);
}

/**
 * Update a page's content (called by autosave).
 */
export async function updatePageContent(
  pageId: string,
  content: string,
  title?: string,
): Promise<Page | undefined> {
  const page = await db.pages.get(pageId);
  if (!page) return undefined;

  const updated = {
    ...page,
    content,
    ...(title === undefined ? {} : { title }),
    updatedAt: nowISO(),
  };

  await db.pages.put(updated);

  // Get notebook title for search index
  const notebook = await db.notebooks.get(page.notebookId);
  if (notebook) {
    await updateSearchIndexForPage(updated, notebook.title);
  }

  return updated;
}

/**
 * Update a page's title.
 */
export async function updatePageTitle(
  pageId: string,
  title: string
): Promise<Page | undefined> {
  const page = await db.pages.get(pageId);
  if (!page) return undefined;

  const updated = { ...page, title, updatedAt: nowISO() };
  await db.pages.put(updated);

  const notebook = await db.notebooks.get(page.notebookId);
  if (notebook) {
    await updateSearchIndexForPage(updated, notebook.title);
  }

  return updated;
}

/**
 * Soft-delete a page (move to Trash).
 */
export async function deletePage(pageId: string): Promise<void> {
  const page = await db.pages.get(pageId);
  if (!page) return;

  const now = nowISO();

  // Mark as deleted in IndexedDB
  await db.pages.update(pageId, {
    deleted: true,
    deletedAt: now,
    updatedAt: now,
  });
  await db.attachments.where('pageId').equals(pageId).modify({ deletedAt: now, updatedAt: now }).catch(() => {});

  // Remove from notebook's pageIds
  const notebook = await db.notebooks.get(page.notebookId);
  if (notebook) {
    const updatedPageIds = notebook.pageIds.filter((id) => id !== pageId);
    await db.notebooks.update(notebook.id, {
      pageIds: updatedPageIds,
      updatedAt: now,
    });
  }

  // Remove from search index
  await db.searchIndex.where('entityId').equals(pageId).delete();
}

/**
 * Restore a soft-deleted page back into its notebook.
 */
export async function restorePage(pageId: string): Promise<Page | null> {
  const page = await db.pages.get(pageId);
  if (!page) return null;

  const now = nowISO();

  // Restore page record
  const restoredPage: Page = {
    ...page,
    deleted: false,
    updatedAt: now,
  };
  await db.pages.put(restoredPage);
  await db.attachments.where('pageId').equals(pageId).modify({ deletedAt: undefined, updatedAt: now }).catch(() => {});

  // Re-add to notebook's pageIds if not present
  const notebook = await db.notebooks.get(page.notebookId);
  if (notebook) {
    if (!notebook.pageIds.includes(pageId)) {
      const updatedPageIds = [...notebook.pageIds, pageId];
      await db.notebooks.update(notebook.id, {
        pageIds: updatedPageIds,
        updatedAt: now,
      });
    }
    await updateSearchIndexForPage(restoredPage, notebook.title);
  }

  return restoredPage;
}

/**
 * Permanently delete a page (Hard delete from Dexie and clean up revisions/schedules).
 */
export async function permanentlyDeletePage(pageId: string): Promise<void> {
  const page = await db.pages.get(pageId);

  // Remove from IndexedDB pages table
  await db.pages.delete(pageId);
  await db.attachments.where('pageId').equals(pageId).delete().catch(() => {});

  // Remove from notebook if still present
  if (page) {
    const notebook = await db.notebooks.get(page.notebookId);
    if (notebook && notebook.pageIds.includes(pageId)) {
      const updatedPageIds = notebook.pageIds.filter((id) => id !== pageId);
      await db.notebooks.update(notebook.id, {
        pageIds: updatedPageIds,
        updatedAt: nowISO(),
      });
    }
  }

  // Remove from search index
  await db.searchIndex.where('entityId').equals(pageId).delete();

  // Clean up all revisions of this page
  await db.revisions.where('pageId').equals(pageId).delete().catch(() => {});

  // Clean up or detach any scheduleBlocks linked to this page
  const linkedBlocks = await db.scheduleBlocks.where('pageId').equals(pageId).toArray();
  for (const block of linkedBlocks) {
    await db.scheduleBlocks.update(block.id, {
      pageId: undefined,
      updatedAt: nowISO(),
    });
  }
}

/**
 * Get all soft-deleted pages (Trash).
 */
export async function getDeletedPages(): Promise<Page[]> {
  return db.pages
    .filter((p) => !!p.deleted)
    .reverse()
    .sortBy('updatedAt');
}

/**
 * Reorder pages within a notebook (after drag & drop).
 */
export async function reorderPages(
  notebookId: string,
  pageIds: string[]
): Promise<void> {
  const now = nowISO();

  // Update each page's order
  for (let i = 0; i < pageIds.length; i++) {
    await db.pages.update(pageIds[i], { order: i, updatedAt: now });
  }

  // Update notebook's pageIds
  await db.notebooks.update(notebookId, { pageIds, updatedAt: now });
}

// ===================== SEARCH INDEX =====================

/**
 * Update search index entry for a notebook.
 */
async function updateSearchIndexForNotebook(notebook: Notebook): Promise<void> {
  const entry: SearchEntry = {
    id: `search_${notebook.id}`,
    type: 'notebook',
    entityId: notebook.id,
    title: notebook.title,
    content: notebook.title,
    date: notebook.dateId.replace('day_', '').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
  };
  await db.searchIndex.put(entry);
}

/**
 * Update search index entry for a page.
 */
async function updateSearchIndexForPage(page: Page, notebookTitle: string): Promise<void> {
  const plainContent = stripHtml(page.content);
  const entry: SearchEntry = {
    id: `search_${page.id}`,
    type: 'page',
    entityId: page.id,
    title: page.title,
    content: plainContent,
    date: '',
    notebookId: page.notebookId,
    notebookTitle,
    tagIds: page.tagIds || [],
    tagNames: await Promise.all((page.tagIds || []).map(async (id) => (await db.tags.get(id))?.name || '')),
  };
  await db.searchIndex.put(entry);
}

async function updateSearchIndexForWorkReport(report: WorkReport): Promise<void> {
  const day = await db.days.get(report.dayId);
  const projectNames = report.projectEntries.map((entry) => entry.projectNameSnapshot).filter(Boolean);
  const content = [
    projectNames.join(' '),
    ...report.projectEntries.flatMap((entry) => [entry.content, entry.result]),
    report.issue,
    report.solution,
    report.nextWork,
  ].filter(Boolean).join('\n');
  const entry: SearchEntry = {
    id: `search_${report.id}`,
    type: 'work_report',
    entityId: report.id,
    title: `Báo cáo công việc ${day?.date ? day.date.split('-').reverse().join('/') : ''}`.trim(),
    content,
    date: day?.date || '',
    dayId: report.dayId,
    projectIds: report.projectEntries.map((entry) => entry.projectId),
  };
  await db.searchIndex.put(entry);
}

/**
 * Search across all indexed content.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
    .trim();
}

export async function searchAll(queryOrFilters: string | SearchFilters, legacyTagIds: string[] = []): Promise<SearchEntry[]> {
  const filters: SearchFilters = typeof queryOrFilters === 'string'
    ? { query: queryOrFilters, tagIds: legacyTagIds }
    : queryOrFilters;
  const query = filters.query || '';
  const tagIds = filters.tagIds || [];
  if (!query.trim() && tagIds.length === 0 && !filters.types?.length && !filters.projectIds?.length && !filters.startDate && !filters.endDate && !filters.taskStatus) return [];

  const lowerQuery = normalizeSearchText(query);
  const entries = await db.searchIndex.toArray();

  return entries
    .map((entry) => {
      const title = normalizeSearchText(entry.title);
      const content = normalizeSearchText(entry.content);
      const notebook = normalizeSearchText(entry.notebookTitle || '');
      const tags = (entry.tagNames || []).map(normalizeSearchText);
      let score = 0;
      const matchedFields: string[] = [];
      if (lowerQuery) {
        if (title === lowerQuery) { score += 100; matchedFields.push('title'); }
        else if (title.startsWith(lowerQuery)) { score += 60; matchedFields.push('title'); }
        else if (title.includes(lowerQuery)) { score += 35; matchedFields.push('title'); }
        if (tags.some((tag) => tag === lowerQuery)) { score += 30; matchedFields.push('tag'); }
        else if (tags.some((tag) => tag.includes(lowerQuery))) { score += 15; matchedFields.push('tag'); }
        if (notebook.includes(lowerQuery)) { score += 10; matchedFields.push('notebook'); }
        if (content.includes(lowerQuery)) { score += 5; matchedFields.push('content'); }
      }
      return { entry: { ...entry, matchedFields }, score };
    })
    .filter((entry) => {
      const item = entry.entry;
      if (tagIds.length > 0 && (item.type !== 'page' || !tagIds.every((id) => (item.tagIds || []).includes(id)))) return false;
      if (filters.types?.length && !filters.types.includes(item.type)) return false;
      if (filters.projectIds?.length && !((item.projectId && filters.projectIds.includes(item.projectId)) || (item.projectIds || []).some((id) => filters.projectIds!.includes(id)))) return false;
      if (filters.startDate && item.date < filters.startDate) return false;
      if (filters.endDate && item.date > filters.endDate) return false;
      if (filters.taskStatus && filters.taskStatus !== 'all') {
        if (item.type !== 'task') return false;
        if (filters.taskStatus === 'pending' && item.taskStatus !== 'todo' && item.taskStatus !== 'in_progress') return false;
        if (filters.taskStatus !== 'pending' && item.taskStatus !== filters.taskStatus) return false;
      }
      if (!query.trim()) return true;
      return entry.score > 0;
    })
    .sort((a, b) => b.score - a.score || b.entry.date.localeCompare(a.entry.date))
    .slice(0, 20)
    .map(({ entry }) => entry);
}

export async function rebuildSearchIndex(): Promise<void> {
  const [notebooks, pages, reports, tags, projects, tasks, schedules] = await Promise.all([
    db.notebooks.filter((nb) => !nb.deleted).toArray(),
    db.pages.filter((p) => !p.deleted).toArray(),
    db.workReports.filter((report) => !report.deletedAt).toArray(),
    db.tags.toArray(),
    db.projects.filter((project) => !project.deletedAt).toArray(),
    db.customTasks.toArray(),
    db.scheduleBlocks.toArray(),
  ]);
  const tagNames = new Map(tags.map((tag) => [tag.id, tag.name]));
  const notebookTitles = new Map(notebooks.map((notebook) => [notebook.id, notebook.title]));
  const notebookDayIds = new Map(notebooks.map((notebook) => [notebook.id, notebook.dateId]));
  const dayDates = new Map((await db.days.toArray()).map((day) => [day.id, day.date]));
  const entries: SearchEntry[] = [
    ...notebooks.map((notebook): SearchEntry => ({
      id: `search_${notebook.id}`,
      type: 'notebook',
      entityId: notebook.id,
      title: notebook.title,
      content: notebook.title,
      date: notebook.dateId.replace('day_', '').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
    })),
    ...pages.map((page): SearchEntry => ({
      id: `search_${page.id}`,
      type: 'page',
      entityId: page.id,
      title: page.title,
      content: stripHtml(page.content),
      date: dayDates.get(notebookDayIds.get(page.notebookId) || '') || '',
      notebookId: page.notebookId,
      notebookTitle: notebookTitles.get(page.notebookId) || '',
      tagIds: page.tagIds || [],
      tagNames: (page.tagIds || []).map((id) => tagNames.get(id) || '').filter(Boolean),
    })),
    ...reports.map((report): SearchEntry => {
      const projectNames = report.projectEntries.map((entry) => entry.projectNameSnapshot).filter(Boolean);
      return {
        id: `search_${report.id}`,
        type: 'work_report',
        entityId: report.id,
        title: `Báo cáo công việc ${dayDates.get(report.dayId)?.split('-').reverse().join('/') || ''}`.trim(),
        content: [projectNames.join(' '), ...report.projectEntries.flatMap((entry) => [entry.content, entry.result]), report.issue, report.solution, report.nextWork].filter(Boolean).join('\n'),
        date: dayDates.get(report.dayId) || '',
        dayId: report.dayId,
        projectIds: report.projectEntries.map((entry) => entry.projectId),
      };
    }),
    ...projects.map((project): SearchEntry => ({
      id: `search_${project.id}`, type: 'project', entityId: project.id,
      title: project.name, content: [project.name, project.description || ''].filter(Boolean).join('\n'), date: project.updatedAt.slice(0, 10), projectId: project.id,
    })),
    ...tasks.map((task): SearchEntry => ({
      id: `search_${task.id}`, type: 'task', entityId: task.id,
      title: task.title, content: [task.title, task.description || '', task.categoryName || ''].filter(Boolean).join('\n'), date: task.dueDate || task.updatedAt.slice(0, 10), taskStatus: task.status !== 'completed' && task.dueDate && task.dueDate < todayDate() ? 'overdue' : task.status,
    })),
    ...(typeof DOMParser !== 'undefined' ? parseAllTasks(pages, notebooks, true).map((task): SearchEntry => ({
      id: `search_${task.id}`, type: 'task', entityId: task.id, title: task.text,
      content: [task.text, task.pageTitle, task.notebookTitle].filter(Boolean).join('\n'),
      date: task.dueDate || '', pageId: task.pageId, notebookId: task.notebookId,
      taskStatus: task.completed ? 'completed' : task.isOverdue ? 'overdue' : 'todo',
    })) : []),
    ...schedules.map((block): SearchEntry => ({
      id: `search_${block.id}`, type: 'schedule', entityId: block.id,
      title: block.title, content: [block.title, block.description || ''].filter(Boolean).join('\n'), date: block.date,
      pageId: block.pageId, notebookId: block.notebookId,
    })),
  ];
  await db.transaction('rw', db.searchIndex, async () => {
    await db.searchIndex.clear();
    if (entries.length) await db.searchIndex.bulkPut(entries);
  });
}

// ===================== BULK OPERATIONS =====================

/**
 * Load all data from a database.json payload into IndexedDB.
 * Used during initial sync from Google Drive.
 */
export async function loadFromDatabase(data: {
  days: Day[];
  notebooks: Notebook[];
  pages?: Page[];
  scheduleBlocks?: ScheduleBlock[];
  customTasks?: CustomUserTask[];
  workCategories?: WorkCategory[];
  tags?: Tag[];
  projects?: Project[];
  workReports?: WorkReport[];
  attachments?: Attachment[];
}): Promise<void> {
  if (typeof performance !== 'undefined') performance.mark('mynotes:local-apply-start');
  await db.transaction('rw', [db.days, db.notebooks, db.pages, db.scheduleBlocks, db.customTasks, db.workCategories, db.tags, db.projects, db.workReports, db.attachments, db.searchIndex], async () => {
    // Clear existing data
    await db.days.clear();
    await db.notebooks.clear();
    await db.tags.clear();
    await db.projects.clear();
    await db.workReports.clear();

    // Load days
    if (data.days?.length) {
      await db.days.bulkPut(data.days);
    }

    // Load notebooks
    if (data.notebooks?.length) {
      await db.notebooks.bulkPut(data.notebooks);
    }

    // A full snapshot explicitly includes pages, including an empty array.
    if (Array.isArray(data.pages)) {
      await db.pages.clear();
      if (data.pages.length) await db.pages.bulkPut(data.pages.map((page) => ({ ...page, tagIds: page.tagIds || [] })));
    }
    if (data.tags?.length) await db.tags.bulkPut(data.tags);
    if (data.projects?.length) await db.projects.bulkPut(data.projects);
    if (data.workReports?.length) {
      await db.workReports.bulkPut(data.workReports.map((report) => ({
        ...report,
        projectEntries: Array.isArray(report.projectEntries) ? report.projectEntries : [],
      })));
    }
    if (Array.isArray(data.attachments)) {
      await db.attachments.clear();
      if (data.attachments.length) await db.attachments.bulkPut(data.attachments);
    }

    // Load scheduleBlocks
    await db.scheduleBlocks.clear();
    if (data.scheduleBlocks?.length) {
      await db.scheduleBlocks.bulkPut(data.scheduleBlocks);
    }

    // Load customTasks
    await db.customTasks.clear();
    if (data.customTasks?.length) {
      await db.customTasks.bulkPut(data.customTasks);
    }

    // Load workCategories
    await db.workCategories.clear();
    if (data.workCategories?.length) {
      await db.workCategories.bulkPut(data.workCategories);
    }

    // Build the index in memory and write it once. The previous implementation
    // performed a database lookup for every page tag and one put per entry.
    await db.searchIndex.clear();
    const tagNames = new Map((data.tags || []).map((tag) => [tag.id, tag.name]));
    const notebookTitles = new Map((data.notebooks || []).map((notebook) => [notebook.id, notebook.title]));
    const notebookDayIds = new Map((data.notebooks || []).map((notebook) => [notebook.id, notebook.dateId]));
    const dayDates = new Map((data.days || []).map((day) => [day.id, day.date]));
    const entries: SearchEntry[] = [];
    for (const nb of data.notebooks || []) {
      if (!nb.deleted) entries.push({
        id: `search_${nb.id}`, type: 'notebook', entityId: nb.id,
        title: nb.title, content: nb.title,
        date: nb.dateId.replace('day_', '').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
      });
    }
    for (const page of data.pages || []) {
      if (!page.deleted) entries.push({
        id: `search_${page.id}`, type: 'page', entityId: page.id,
        title: page.title, content: stripHtml(page.content), date: dayDates.get(notebookDayIds.get(page.notebookId) || '') || '',
        notebookId: page.notebookId, notebookTitle: notebookTitles.get(page.notebookId) || '',
        tagIds: page.tagIds || [],
        tagNames: (page.tagIds || []).map((id) => tagNames.get(id) || '').filter(Boolean),
      });
    }
    for (const report of data.workReports || []) {
      if (!report.deletedAt) {
        const projectNames = report.projectEntries.map((entry) => entry.projectNameSnapshot).filter(Boolean);
        entries.push({
          id: `search_${report.id}`, type: 'work_report', entityId: report.id,
          title: `Báo cáo công việc ${dayDates.get(report.dayId)?.split('-').reverse().join('/') || ''}`.trim(),
          content: [projectNames.join(' '), ...report.projectEntries.flatMap((entry) => [entry.content, entry.result]), report.issue, report.solution, report.nextWork].filter(Boolean).join('\n'),
        date: dayDates.get(report.dayId) || '', dayId: report.dayId,
        projectIds: report.projectEntries.map((entry) => entry.projectId),
        });
      }
    }
    for (const project of data.projects || []) {
      if (!project.deletedAt) entries.push({ id: `search_${project.id}`, type: 'project', entityId: project.id, title: project.name, content: [project.name, project.description || ''].filter(Boolean).join('\n'), date: project.updatedAt.slice(0, 10), projectId: project.id });
    }
    for (const task of data.customTasks || []) {
      entries.push({ id: `search_${task.id}`, type: 'task', entityId: task.id, title: task.title, content: [task.title, task.description || '', task.categoryName || ''].filter(Boolean).join('\n'), date: task.dueDate || task.updatedAt.slice(0, 10), taskStatus: task.status !== 'completed' && task.dueDate && task.dueDate < todayDate() ? 'overdue' : task.status });
    }
    if (typeof DOMParser !== 'undefined') {
      for (const task of parseAllTasks(data.pages || [], data.notebooks || [], true)) {
        entries.push({ id: `search_${task.id}`, type: 'task', entityId: task.id, title: task.text, content: [task.text, task.pageTitle, task.notebookTitle].filter(Boolean).join('\n'), date: task.dueDate || '', pageId: task.pageId, notebookId: task.notebookId, taskStatus: task.completed ? 'completed' : task.isOverdue ? 'overdue' : 'todo' });
      }
    }
    for (const block of data.scheduleBlocks || []) {
      entries.push({ id: `search_${block.id}`, type: 'schedule', entityId: block.id, title: block.title, content: [block.title, block.description || ''].filter(Boolean).join('\n'), date: block.date, pageId: block.pageId, notebookId: block.notebookId });
    }
    if (entries.length) await db.searchIndex.bulkPut(entries);
  });
  if (typeof performance !== 'undefined') {
    performance.mark('mynotes:local-apply-end');
    try { performance.measure('mynotes:local-apply', 'mynotes:local-apply-start', 'mynotes:local-apply-end'); } catch { /* unsupported in older browsers */ }
  }
}

/**
 * Export all data as a database object for saving to Google Drive.
 */
export async function exportDatabase(): Promise<{
  version: number;
  updatedAt: string;
  days: Day[];
  notebooks: Notebook[];
  pages: Page[];
  tags: Tag[];
  projects: Project[];
  workReports: WorkReport[];
  scheduleBlocks: ScheduleBlock[];
  customTasks: CustomUserTask[];
  workCategories: WorkCategory[];
  attachments: Attachment[];
}> {
  const days = await db.days.toArray();
  const notebooks = await db.notebooks.toArray();
  // Include both active and soft-deleted pages so Trash Bin syncs across devices
  const pages = await db.pages.toArray();
  const tags = await db.tags.toArray();
  const projects = await db.projects.toArray();
  const workReports = await db.workReports.toArray();
  const scheduleBlocks = await db.scheduleBlocks.toArray();
  const customTasks = await db.customTasks.toArray();
  const workCategories = await db.workCategories.toArray();
  const attachments = await db.attachments.toArray();

  return {
    version: 3,
    updatedAt: nowISO(),
    days,
    notebooks,
    pages,
    tags,
    projects,
    workReports,
    scheduleBlocks,
    customTasks,
    workCategories,
    attachments,
  };
}

/**
 * Get all active pages across all notebooks in the entire vault.
 */
export async function getAllVaultPages(): Promise<Page[]> {
  return db.pages.filter((p) => !p.deleted).toArray();
}

/**
 * Get all active notebooks across the entire vault.
 */
export async function getAllVaultNotebooks(): Promise<Notebook[]> {
  return db.notebooks.filter((nb) => !nb.deleted).toArray();
}

/**
 * Completely clear all local IndexedDB tables and sync queue.
 * Used only for explicit local-data reset/account replacement. Login and
 * reconnect preserve the cache and merge pending operations instead.
 */
export async function clearAllLocalData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.days,
      db.notebooks,
      db.pages,
      db.scheduleBlocks,
      db.customTasks,
      db.workCategories,
      db.tags,
      db.projects,
      db.workReports,
      db.attachments,
      db.appState,
      db.searchIndex,
      db.syncQueue,
    ],
    async () => {
      await db.days.clear();
      await db.notebooks.clear();
      await db.pages.clear();
      await db.scheduleBlocks.clear();
      await db.customTasks.clear();
      await db.workCategories.clear();
      await db.tags.clear();
      await db.projects.clear();
      await db.workReports.clear();
      await db.attachments.clear();
      await db.appState.delete('sync.database.metadata');
      await db.searchIndex.clear();
      await db.syncQueue.clear();
    }
  );
}

/** Return the account that owns the active local vault, if known. */
export async function getVaultOwnerEmail(): Promise<string | null> {
  const record = await db.appState.get('sync.database.metadata');
  if (!record?.value) return null;
  try {
    const metadata = JSON.parse(record.value) as { ownerEmail?: string };
    return metadata.ownerEmail || null;
  } catch {
    return null;
  }
}
