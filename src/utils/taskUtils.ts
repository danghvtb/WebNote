// ============================================================
// MyNotes — Advanced Task & Deadline Utility Functions
// Supports Natural Language Date Parsing (NLP), exact Date+Time (YYYY-MM-DDTHH:mm),
// smart relative time countdowns, and 1-click preset modifiers.
// ============================================================

import type { Page, Notebook } from '../types';

export interface ParsedTask {
  id: string;
  pageId: string;
  pageTitle: string;
  notebookId: string;
  notebookTitle: string;
  text: string;
  completed: boolean;
  dueDate?: string; // YYYY-MM-DDTHH:mm or YYYY-MM-DD ISO format
  isOverdue: boolean;
  isDueToday: boolean;
  rawHtml: string;
}

/**
 * Format a Date object to YYYY-MM-DDTHH:mm for datetime-local inputs & attributes
 */
export function formatDateTimeISO(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Safely format any date string to YYYY-MM-DDTHH:mm for datetime-local input
 */
export function formatForDateTimeInput(dateStr?: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(trimmed)) return trimmed.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T18:00`;
  
  try {
    const d = new Date(trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T'));
    if (!isNaN(d.getTime())) {
      return formatDateTimeISO(d);
    }
  } catch {
    // fallback
  }
  return '';
}

/**
 * Parse Natural Language Date phrases into exact YYYY-MM-DDTHH:mm string
 * Handles: @today, @homnay, @tomorrow, @ngaymai, @thuhai, @sau 3 gio, @in 2 hours, @YYYY-MM-DD HH:mm
 */
export function extractDueDateFromText(text: string): string | undefined {
  const now = new Date();

  // Explicit YYYY-MM-DD HH:mm or YYYY-MM-DDTHH:mm
  const dateTimeMatch = text.match(/(?:@due\(|@|📅\s*)(20\d\d-[01]\d-[03]\d[ T][0-2]\d:[0-5]\d)\)?/i);
  if (dateTimeMatch) {
    return dateTimeMatch[1].replace(' ', 'T');
  }

  // Explicit YYYY-MM-DD date
  const dateMatch = text.match(/(?:@due\(|@|📅\s*)(20\d\d-[01]\d-[03]\d)\)?/i);
  if (dateMatch) {
    return `${dateMatch[1]}T18:00`;
  }

  const lower = text.toLowerCase();

  // Natural Language: Today
  if (/@(today|homnay|hôm\s*nay)/i.test(lower)) {
    const d = new Date();
    d.setHours(18, 0, 0, 0);
    return formatDateTimeISO(d);
  }

  // Natural Language: Tomorrow
  if (/@(tomorrow|ngaymai|ngày\s*mai)/i.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return formatDateTimeISO(d);
  }

  // Natural Language: Next Monday
  if (/@(thuhai|thứ\s*hai|next\s*monday)/i.test(lower)) {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() + (day === 0 ? 1 : 8 - day);
    d.setDate(diff);
    d.setHours(9, 0, 0, 0);
    return formatDateTimeISO(d);
  }

  // Relative hours: @sau 3 gio or @in 2 hours
  const hoursMatch = lower.match(/@(?:sau|in)\s*(\d+)\s*(?:gio|giờ|hours|hour|h)/i);
  if (hoursMatch) {
    const hrs = parseInt(hoursMatch[1], 10);
    const d = new Date(now.getTime() + hrs * 60 * 60 * 1000);
    return formatDateTimeISO(d);
  }

  return undefined;
}

/**
 * Clean deadline tags and NLP keywords from display text
 */
export function cleanTaskText(text: string): string {
  return text
    .replace(/(?:@due\([^)]+\)|@20\d\d-[01]\d-[03]\d(?:[ T][0-2]\d:[0-5]\d)?|📅\s*20\d\d-[01]\d-[03]\d(?:[ T][0-2]\d:[0-5]\d)?)/gi, '')
    .replace(/@(?:today|homnay|hôm\s*nay|tomorrow|ngaymai|ngày\s*mai|thuhai|thứ\s*hai|next\s*monday)/gi, '')
    .replace(/@(?:sau|in)\s*\d+\s*(?:gio|giờ|hours|hour|h)/gi, '')
    .trim();
}

/**
 * Smart Relative Time Countdown & Formatting
 * Returns: "🔴 Quá hạn 2 giờ 15 phút", "🔥 Hôm nay 17:30 (Còn 45 phút)", "⚡ Ngày mai 09:00"
 */
export function formatRelativeDeadline(dueDateStr: string): { label: string; isOverdue: boolean; isDueToday: boolean } {
  const due = new Date(dueDateStr.includes('T') ? dueDateStr : `${dueDateStr}T18:00`);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const timeStr = `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`;
  const dateStr = `${String(due.getDate()).padStart(2, '0')}/${String(due.getMonth() + 1).padStart(2, '0')}`;

  const isSameDay = due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate();

  // OVERDUE
  if (diffMs < 0) {
    const absMins = Math.abs(diffMins);
    const absHours = Math.abs(diffHours);
    const absDays = Math.abs(diffDays);

    let text = '';
    if (absMins < 60) {
      text = `Quá hạn ${absMins} phút`;
    } else if (absHours < 24) {
      text = `Quá hạn ${absHours} giờ`;
    } else {
      text = `Quá hạn ${absDays} ngày`;
    }

    return { label: `🔴 ${text} (${dateStr} ${timeStr})`, isOverdue: true, isDueToday: isSameDay };
  }

  // DUE TODAY
  if (isSameDay) {
    let countdown = '';
    if (diffMins < 60) {
      countdown = `Còn ${diffMins}m`;
    } else {
      countdown = `Còn ${diffHours}h`;
    }
    return { label: `🔥 Hôm nay ${timeStr} (${countdown})`, isOverdue: false, isDueToday: true };
  }

  // DUE TOMORROW
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = due.getFullYear() === tomorrow.getFullYear() &&
    due.getMonth() === tomorrow.getMonth() &&
    due.getDate() === tomorrow.getDate();

  if (isTomorrow) {
    return { label: `⚡ Ngày mai ${timeStr}`, isOverdue: false, isDueToday: false };
  }

  // FUTURE DEADLINE
  return { label: `📅 ${dateStr} ${timeStr} (Còn ${diffDays} ngày)`, isOverdue: false, isDueToday: false };
}

/**
 * 1-Click Quick Preset Generator
 */
export function getQuickPresetDate(action: 'today' | 'tomorrow' | 'add_1h' | 'add_1d' | 'add_1w', currentDueDate?: string): string {
  const base = currentDueDate ? new Date(currentDueDate.includes('T') ? currentDueDate : `${currentDueDate}T18:00`) : new Date();

  switch (action) {
    case 'today': {
      const d = new Date();
      d.setHours(18, 0, 0, 0);
      return formatDateTimeISO(d);
    }
    case 'tomorrow': {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return formatDateTimeISO(d);
    }
    case 'add_1h': {
      const d = new Date(base.getTime() + 60 * 60 * 1000);
      return formatDateTimeISO(d);
    }
    case 'add_1d': {
      const d = new Date(base.getTime() + 24 * 60 * 60 * 1000);
      return formatDateTimeISO(d);
    }
    case 'add_1w': {
      const d = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
      return formatDateTimeISO(d);
    }
  }
}

/**
 * Parse all tasks from a single page HTML string
 */
export function parseTasksFromPage(page: Page, notebookTitle: string): ParsedTask[] {
  if (!page.content) return [];

  const tasks: ParsedTask[] = [];
  const nowMs = Date.now();
  const parser = new DOMParser();
  const doc = parser.parseFromString(page.content, 'text/html');
  const taskNodes = doc.querySelectorAll('li[data-type="taskItem"]');

  taskNodes.forEach((node, index) => {
    const isChecked = node.getAttribute('data-checked') === 'true';
    const rawText = node.textContent?.trim() || '';
    
    // Read data-due attribute or parse NLP text syntax
    let dueDate = node.getAttribute('data-due') || extractDueDateFromText(rawText);
    const cleanedText = cleanTaskText(rawText);

    if (rawText) {
      let isOverdue = false;
      let isDueToday = false;

      if (dueDate && !isChecked) {
        const dueMs = new Date(dueDate.includes('T') ? dueDate : `${dueDate}T18:00`).getTime();
        isOverdue = dueMs < nowMs;
        const due = new Date(dueMs);
        const now = new Date();
        isDueToday = due.getFullYear() === now.getFullYear() &&
          due.getMonth() === now.getMonth() &&
          due.getDate() === now.getDate();
      }

      tasks.push({
        id: `${page.id}-task-${index}`,
        pageId: page.id,
        pageTitle: page.title || 'Untitled',
        notebookId: page.notebookId,
        notebookTitle,
        text: cleanedText || rawText,
        completed: isChecked,
        dueDate,
        isOverdue,
        isDueToday,
        rawHtml: node.outerHTML,
      });
    }
  });

  return tasks;
}

/**
 * Extract all tasks across all pages
 */
export function parseAllTasks(pages: Page[], notebooks: Notebook[]): ParsedTask[] {
  const allTasks: ParsedTask[] = [];

  pages.forEach((page) => {
    const notebook = notebooks.find((nb) => nb.id === page.notebookId);
    const notebookTitle = notebook ? notebook.title : 'Uncategorized';
    const pageTasks = parseTasksFromPage(page, notebookTitle);
    allTasks.push(...pageTasks);
  });

  return allTasks;
}

/**
 * Calculate overdue task count for a single page
 */
export function getPageOverdueCount(page: Page): number {
  if (!page.content) return 0;
  const nowMs = Date.now();
  const parser = new DOMParser();
  const doc = parser.parseFromString(page.content, 'text/html');
  const taskNodes = doc.querySelectorAll('li[data-type="taskItem"]');

  let count = 0;
  taskNodes.forEach((node) => {
    const isChecked = node.getAttribute('data-checked') === 'true';
    const rawText = node.textContent?.trim() || '';
    const dueDate = node.getAttribute('data-due') || extractDueDateFromText(rawText);
    if (!isChecked && dueDate) {
      const dueMs = new Date(dueDate.includes('T') ? dueDate : `${dueDate}T18:00`).getTime();
      if (dueMs < nowMs) count++;
    }
  });

  return count;
}

/**
 * Calculate overdue task count for an entire notebook
 */
export function getNotebookOverdueCount(notebookId: string, pages: Page[]): number {
  const notebookPages = pages.filter((p) => p.notebookId === notebookId);
  return notebookPages.reduce((sum, page) => sum + getPageOverdueCount(page), 0);
}

/**
 * Update a task's due date inside page HTML string
 */
export function updateTaskDueDateInHtml(
  pageContent: string,
  taskText: string,
  newDueDate: string | null
): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(pageContent, 'text/html');
  const taskNodes = doc.querySelectorAll('li[data-type="taskItem"]');

  taskNodes.forEach((node) => {
    const nodeText = node.textContent?.trim() || '';
    const cleanedNodeText = cleanTaskText(nodeText);

    if (cleanedNodeText === taskText || nodeText.includes(taskText) || taskText.includes(cleanedNodeText)) {
      if (newDueDate) {
        node.setAttribute('data-due', newDueDate);
      } else {
        node.removeAttribute('data-due');
      }
    }
  });

  return doc.body.innerHTML;
}
