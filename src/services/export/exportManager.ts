// ============================================================
// MyNotes — Export & Import Manager
// Data portability: JSON Backup & Markdown Export/Import
// ============================================================

import { db } from '../database/db';
import { rebuildSearchIndex } from '../database/repository';
import type { Page, Notebook, Day, Tag } from '../../types';

export interface VaultBackupData {
  version: string;
  exportDate: string;
  days: Day[];
  notebooks: Notebook[];
  pages: Page[];
  tags?: Tag[];
}

/**
 * Export complete vault as JSON backup file
 */
export async function exportVaultAsJSON() {
  const days = await db.days.toArray();
  const notebooks = await db.notebooks.toArray();
  const pages = await db.pages.toArray();
  const tags = await db.tags.toArray();

  const backupData: VaultBackupData = {
    version: '5.0',
    exportDate: new Date().toISOString(),
    days,
    notebooks,
    pages,
    tags,
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const filename = `MyNotes-Backup-${new Date().toISOString().slice(0, 10)}.json`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export selected page as Markdown file (.md)
 */
export function exportPageAsMarkdown(page: Page, tags: Tag[] = []) {
  // Convert HTML content to simple Markdown lines
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = page.content || '';
  
  const tagLine = (page.tagIds || []).map((id) => tags.find((tag) => tag.id === id)?.name).filter(Boolean).map((name) => `#${name}`).join(' ');
  const markdownContent = `# ${page.title || 'Untitled Page'}\n\nDate Created: ${page.createdAt}\n${tagLine ? `Tags: ${tagLine}\n` : ''}\n---\n\n${tempDiv.innerText || tempDiv.textContent || ''}`;
  
  const blob = new Blob([markdownContent], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);

  const safeTitle = (page.title || 'Untitled').replace(/[^a-z0-9_-]/gi, '_');
  const filename = `${safeTitle}.md`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import JSON backup into IndexedDB
 */
export async function importVaultFromJSON(jsonFile: File): Promise<{ success: boolean; pagesImported: number; message: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const backup: VaultBackupData = JSON.parse(text);

        if (!backup.pages || !Array.isArray(backup.pages)) {
          throw new Error('Invalid backup file format.');
        }

        // Bulk put into database
        if (backup.days && backup.days.length > 0) {
          await db.days.bulkPut(backup.days);
        }

        if (backup.notebooks && backup.notebooks.length > 0) {
          await db.notebooks.bulkPut(backup.notebooks);
        }

        await db.tags.clear();
        if (backup.tags && Array.isArray(backup.tags)) await db.tags.bulkPut(backup.tags);
        await db.pages.bulkPut(backup.pages.map((page) => ({ ...page, tagIds: page.tagIds || [] })));
        await rebuildSearchIndex();

        resolve({
          success: true,
          pagesImported: backup.pages.length,
          message: `Successfully imported ${backup.pages.length} notes!`,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown import error';
        reject(new Error(errorMsg));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(jsonFile);
  });
}
