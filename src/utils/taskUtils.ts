// ============================================================
// MyNotes — Task & Deadline Utility Functions
// Task parsing, overdue calculation, and deadline metadata management.
// ============================================================

import type { Page, Notebook } from '../types';
import { todayDate } from './index';

export interface ParsedTask {
  id: string;
  pageId: string;
  pageTitle: string;
  notebookId: string;
  notebookTitle: string;
  text: string;
  completed: boolean;
  dueDate?: string; // YYYY-MM-DD format
  isOverdue: boolean;
  isDueToday: boolean;
  rawHtml: string;
}

/**
 * Extract due date from string using attribute or tag syntax
 * Matches @due(YYYY-MM-DD) or @YYYY-MM-DD or 📅 YYYY-MM-DD
 */
export function extractDueDateFromText(text: string): string | undefined {
  const match = text.match(/(?:@due\(|@|📅\s*)(20\d\d-[01]\d-[03]\d)\)?/i);
  return match ? match[1] : undefined;
}

/**
 * Clean due date tag from display text
 */
export function cleanTaskText(text: string): string {
  return text.replace(/(?:@due\([0-9-]+\)|@20\d\d-[01]\d-[03]\d|📅\s*20\d\d-[01]\d-[03]\d)/gi, '').trim();
}

/**
 * Parse all tasks from a single page HTML string
 */
export function parseTasksFromPage(page: Page, notebookTitle: string): ParsedTask[] {
  if (!page.content) return [];

  const tasks: ParsedTask[] = [];
  const today = todayDate();
  const parser = new DOMParser();
  const doc = parser.parseFromString(page.content, 'text/html');
  const taskNodes = doc.querySelectorAll('li[data-type="taskItem"]');

  taskNodes.forEach((node, index) => {
    const isChecked = node.getAttribute('data-checked') === 'true';
    const rawText = node.textContent?.trim() || '';
    
    // Read data-due attribute or parse text syntax
    let dueDate = node.getAttribute('data-due') || extractDueDateFromText(rawText);
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      dueDate = undefined;
    }

    const cleanedText = cleanTaskText(rawText);

    if (rawText) {
      const isOverdue = !isChecked && !!dueDate && dueDate < today;
      const isDueToday = !isChecked && !!dueDate && dueDate === today;

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
  const today = todayDate();
  const parser = new DOMParser();
  const doc = parser.parseFromString(page.content, 'text/html');
  const taskNodes = doc.querySelectorAll('li[data-type="taskItem"]');

  let count = 0;
  taskNodes.forEach((node) => {
    const isChecked = node.getAttribute('data-checked') === 'true';
    const rawText = node.textContent?.trim() || '';
    const dueDate = node.getAttribute('data-due') || extractDueDateFromText(rawText);
    if (!isChecked && dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && dueDate < today) {
      count++;
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

    if (cleanedNodeText === taskText || nodeText === taskText) {
      if (newDueDate) {
        node.setAttribute('data-due', newDueDate);
      } else {
        node.removeAttribute('data-due');
      }
    }
  });

  return doc.body.innerHTML;
}
