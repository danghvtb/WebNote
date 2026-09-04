// ============================================================
// MyNotes — Google Drive API Service
// Low-level Google Drive API v3 wrapper.
// All Drive operations go through this service layer.
// ============================================================

import { ensureAccessToken } from './auth';
import type { DriveFile, DriveFileList } from '../../types';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const JSON_MIME = 'application/json';

/**
 * Make an authenticated request to Google Drive API.
 * Handles token refresh and error responses.
 */
async function driveRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await ensureAccessToken();

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token might have just expired — try once more
    const newToken = await ensureAccessToken();
    headers.set('Authorization', `Bearer ${newToken}`);
    const retryResponse = await fetch(url, { ...options, headers });
    if (!retryResponse.ok) {
      throw new DriveApiError(
        `Drive API error: ${retryResponse.status}`,
        retryResponse.status,
        await retryResponse.text()
      );
    }
    return retryResponse;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new DriveApiError(
      `Drive API error: ${response.status}`,
      response.status,
      errorBody
    );
  }

  return response;
}

/**
 * Custom error class for Drive API errors.
 */
export class DriveApiError extends Error {
  status: number;
  body: string;

  constructor(
    message: string,
    status: number,
    body: string
  ) {
    super(message);
    this.name = 'DriveApiError';
    this.status = status;
    this.body = body;
  }
}

// ===================== FOLDER OPERATIONS =====================

/**
 * Search for files/folders in Google Drive.
 */
export async function searchFiles(
  query: string,
  fields: string = 'files(id,name,mimeType,parents,createdTime,modifiedTime)'
): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: query,
    fields,
    spaces: 'drive',
    orderBy: 'modifiedTime desc',
  });

  const response = await driveRequest(`${DRIVE_API_BASE}/files?${params}`);
  const data: DriveFileList = await response.json();
  return data.files || [];
}

/**
 * Find folders by name.
 */
export async function findFolders(name: string): Promise<DriveFile[]> {
  const query = `name='${name}' and mimeType='${FOLDER_MIME}' and trashed=false`;
  return searchFiles(query);
}

/**
 * Create a folder in Google Drive.
 */
export async function createFolder(
  name: string,
  parentId?: string
): Promise<DriveFile> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: FOLDER_MIME,
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await driveRequest(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: { 'Content-Type': JSON_MIME },
    body: JSON.stringify(metadata),
  });

  return response.json();
}

/**
 * Check if a file/folder exists by ID.
 */
export async function fileExists(fileId: string): Promise<boolean> {
  try {
    const response = await driveRequest(
      `${DRIVE_API_BASE}/files/${fileId}?fields=id,trashed`
    );
    const data = await response.json();
    return !data.trashed;
  } catch (err) {
    if (err instanceof DriveApiError && err.status === 404) {
      return false;
    }
    throw err;
  }
}

/**
 * Get file metadata by ID.
 */
export async function getFileMetadata(
  fileId: string,
  fields: string = 'id,name,mimeType,modifiedTime,size,parents'
): Promise<DriveFile> {
  const response = await driveRequest(
    `${DRIVE_API_BASE}/files/${fileId}?fields=${fields}`
  );
  return response.json();
}

// ===================== FILE OPERATIONS =====================

/**
 * List files in a folder.
 */
export async function listFiles(
  folderId: string,
  mimeType?: string
): Promise<DriveFile[]> {
  let query = `'${folderId}' in parents and trashed=false`;
  if (mimeType) {
    query += ` and mimeType='${mimeType}'`;
  }
  return searchFiles(query);
}

/**
 * Find a specific file by name within a folder.
 */
export async function findFileInFolder(
  folderId: string,
  fileName: string
): Promise<DriveFile | null> {
  const query = `'${folderId}' in parents and name='${fileName}' and trashed=false`;
  const files = await searchFiles(query);
  return files.length > 0 ? files[0] : null;
}

/**
 * Create a text/JSON file in Google Drive.
 * Uses multipart upload for metadata + content.
 */
export async function createFile(
  name: string,
  content: string,
  parentId: string,
  mimeType: string = JSON_MIME
): Promise<DriveFile> {
  const metadata = {
    name,
    parents: [parentId],
  };

  const boundary = '-------mynotes_boundary';
  const body = [
    `--${boundary}`,
    `Content-Type: ${JSON_MIME}; charset=UTF-8`,
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  const response = await driveRequest(
    `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  return response.json();
}

/**
 * Update an existing file's content.
 */
export async function updateFile(
  fileId: string,
  content: string,
  mimeType: string = JSON_MIME
): Promise<DriveFile> {
  const response = await driveRequest(
    `${DRIVE_UPLOAD_BASE}/files/${fileId}?uploadType=media&fields=id,name,mimeType,modifiedTime`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': mimeType },
      body: content,
    }
  );

  return response.json();
}

/**
 * Download a file's content.
 */
export async function downloadFile(fileId: string): Promise<string> {
  const response = await driveRequest(
    `${DRIVE_API_BASE}/files/${fileId}?alt=media`
  );
  return response.text();
}

/**
 * Delete (trash) a file.
 */
export async function trashFile(fileId: string): Promise<void> {
  await driveRequest(`${DRIVE_API_BASE}/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': JSON_MIME },
    body: JSON.stringify({ trashed: true }),
  });
}

/**
 * Permanently delete a file.
 */
export async function deleteFile(fileId: string): Promise<void> {
  await driveRequest(`${DRIVE_API_BASE}/files/${fileId}`, {
    method: 'DELETE',
  });
}

// ===================== BINARY FILE OPERATIONS =====================

/**
 * Upload a binary file (image, attachment).
 */
export async function uploadBinaryFile(
  name: string,
  blob: Blob,
  parentId: string
): Promise<DriveFile> {
  const metadata = {
    name,
    parents: [parentId],
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: JSON_MIME })
  );
  form.append('file', blob);

  const token = await ensureAccessToken();
  const response = await fetch(
    `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (!response.ok) {
    throw new DriveApiError(
      `Upload failed: ${response.status}`,
      response.status,
      await response.text()
    );
  }

  return response.json();
}

/**
 * Download a file as blob (for images/attachments).
 */
export async function downloadFileAsBlob(fileId: string): Promise<Blob> {
  const response = await driveRequest(
    `${DRIVE_API_BASE}/files/${fileId}?alt=media`
  );
  return response.blob();
}
