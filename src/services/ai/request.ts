import type { AiRequestPreview, AiScope, Page } from '../../types';
import { parsePageToCleanText } from './geminiService';

/**
 * Build the exact text context shown in the AI scope preview. Keeping this in
 * one pure-ish helper makes it harder for a new AI action to accidentally
 * send the entire vault when the user selected a narrower scope.
 */
export function buildAiRequest(scope: AiScope, pages: Page[]): AiRequestPreview {
  const ids = new Set(scope.ids || []);
  const selected = pages.filter((page) => {
    if (scope.type === 'vault') return true;
    if (scope.type === 'current_page' || scope.type === 'selected_pages') return ids.has(page.id);
    return ids.has(page.notebookId);
  });
  const context = selected.map(parsePageToCleanText).join('\n');
  return { scope, pageCount: selected.length, payloadBytes: context.length, context };
}

