// ============================================================
// MyNotes — Export & Import Manager
// Data portability: JSON Backup & Markdown Export/Import
// ============================================================

import { db } from '../database/db';
import type { Page, Notebook, Day } from '../../types';

export interface VaultBackupData {
  version: string;
  exportDate: string;
  days: Day[];
  notebooks: Notebook[];
  pages: Page[];
}

/**
 * Export complete vault as JSON backup file
 */
export async function exportVaultAsJSON() {
  const days = await db.days.toArray();
  const notebooks = await db.notebooks.toArray();
  const pages = await db.pages.toArray();

  const backupData: VaultBackupData = {
    version: '4.0',
    exportDate: new Date().toISOString(),
    days,
    notebooks,
    pages,
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
export function exportPageAsMarkdown(page: Page) {
  // Convert HTML content to simple Markdown lines
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = page.content || '';
  
  const markdownContent = `# ${page.title || 'Untitled Page'}\n\nDate Created: ${page.createdAt}\n\n---\n\n${tempDiv.innerText || tempDiv.textContent || ''}`;
  
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

        await db.pages.bulkPut(backup.pages);

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
