import { downloadFile, findFileInFolder } from '../google/drive';
import { getRootFolderId } from '../google/rootFolderManager';

export interface RecoveredPageSnapshot {
  id: string;
  title: string;
  content: string;
  notebookId?: string;
  tagIds?: string[];
}

/** Recover the last non-empty page-file copy kept in Drive's pages folder. */
export async function recoverPageSnapshot(pageId: string): Promise<RecoveredPageSnapshot | null> {
  const rootFolderId = await getRootFolderId();
  if (!rootFolderId) return null;
  const pagesFolder = await findFileInFolder(rootFolderId, 'pages');
  if (!pagesFolder) return null;
  const pageFile = await findFileInFolder(pagesFolder.id, `${pageId}.json`);
  if (!pageFile) return null;
  const raw = JSON.parse(await downloadFile(pageFile.id)) as Partial<RecoveredPageSnapshot>;
  if (raw.id !== pageId || typeof raw.content !== 'string' || !raw.content.trim()) return null;
  return {
    id: pageId,
    title: typeof raw.title === 'string' ? raw.title : 'Chưa có tiêu đề',
    content: raw.content,
    notebookId: raw.notebookId,
    tagIds: Array.isArray(raw.tagIds) ? raw.tagIds.filter((id): id is string => typeof id === 'string') : [],
  };
}
