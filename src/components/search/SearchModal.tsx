// ============================================================
// MyNotes — Search Modal (Ctrl+K)
// Global search across notebooks and pages.
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, FileText, Notebook, ClipboardList, X, Tag as TagIcon } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useNotesStore } from '../../stores/notesStore';
import { searchAll } from '../../services/database/repository';
import type { SearchEntry } from '../../types';
import { createExcerpt } from '../../utils';
import { useWorkReportStore } from '../../stores/workReportStore';

export function SearchModal() {
  const { searchOpen, setSearchOpen, searchQuery, setSearchQuery } = useAppStore();
  const { selectDay, selectNotebook, selectPage, tags, loadTags } = useNotesStore();
  const { openOrCreateReport } = useWorkReportStore();
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setResults([]);
      setSelectedIndex(0);
      setSelectedTagIds([]);
      loadTags();
    }
  }, [searchOpen, loadTags]);

  // Debounced search
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchTimer.current) clearTimeout(searchTimer.current);

      if (!query.trim() && selectedTagIds.length === 0) { setResults([]); return; }
      searchTimer.current = setTimeout(async () => {
        setResults(await searchAll(query, selectedTagIds));
        setSelectedIndex(0);
      }, 200);
    },
    [setSearchQuery, selectedTagIds]
  );

  const toggleTag = (id: string) => {
    const next = selectedTagIds.includes(id) ? selectedTagIds.filter((x) => x !== id) : [...selectedTagIds, id];
    setSelectedTagIds(next);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQuery.trim() && next.length === 0) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => { setResults(await searchAll(searchQuery, next)); setSelectedIndex(0); }, 200);
  };

  // Navigate to search result
  const handleSelect = useCallback(
    async (entry: SearchEntry) => {
      if (entry.type === 'notebook') {
        selectNotebook(entry.entityId);
      } else if (entry.type === 'page') {
        if (entry.notebookId) {
          selectNotebook(entry.notebookId);
        }
        selectPage(entry.entityId);
      } else if (entry.type === 'work_report' && entry.dayId) {
        await selectDay(entry.dayId);
        useNotesStore.getState().clearPageSelection();
        await openOrCreateReport(entry.dayId);
      }
      setSearchOpen(false);
    },
    [selectDay, selectNotebook, selectPage, setSearchOpen, openOrCreateReport]
  );

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) handleSelect(results[selectedIndex]);
        break;
      case 'Escape':
        setSearchOpen(false);
        break;
    }
  };

  if (!searchOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={() => setSearchOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-xl overflow-hidden animate-scale-in"
        style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <Search className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search all notes, notebooks, and pages..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--color-text-primary)' }}
            aria-label="Search notes"
          />
          <button
            onClick={() => setSearchOpen(false)}
            className="p-1 rounded cursor-pointer"
            style={{ color: 'var(--color-text-tertiary)' }}
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-[var(--color-border)] flex flex-wrap items-center gap-1.5">
          <TagIcon className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
          {tags.map((tag) => <button key={tag.id} onClick={() => toggleTag(tag.id)} className={`px-2 py-0.5 rounded-full text-xs cursor-pointer border ${selectedTagIds.includes(tag.id) ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50' : 'text-[var(--color-text-tertiary)] border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'}`}>#{tag.name}</button>)}
          {tags.length === 0 && <span className="text-xs text-[var(--color-text-tertiary)]">Chưa có thẻ</span>}
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {results.length === 0 && (searchQuery.trim() || selectedTagIds.length > 0) ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No results found</p>
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Type to search across all your notes</p>
            </div>
          ) : (
            <div className="py-2">
              <div className="px-4 py-1">
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </span>
              </div>
              {results.map((entry, index) => (
                <button
                  key={entry.id}
                  onClick={() => handleSelect(entry)}
                  className="w-full text-left flex items-start gap-3 px-4 py-2.5 transition-colors cursor-pointer"
                  style={{
                    background: index === selectedIndex ? 'var(--color-bg-hover)' : 'transparent',
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {entry.type === 'notebook' ? (
                    <Notebook className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
                  ) : entry.type === 'work_report' ? (
                    <ClipboardList className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
                  ) : (
                    <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {entry.title}
                    </p>
                    {entry.content && (entry.type === 'page' || entry.type === 'work_report') && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                        {createExcerpt(entry.content, 80)}
                      </p>
                    )}
                    {entry.notebookTitle && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                        in {entry.notebookTitle}
                      </p>
                    )}
                    {entry.type === 'work_report' && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Báo cáo theo ngày</p>}
                    {entry.type === 'page' && (entry.tagNames || []).length > 0 && <div className="flex gap-1 mt-1">{(entry.tagNames || []).map((name) => <span key={name} className="text-[10px] text-cyan-300">#{name}</span>)}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2" style={{ borderTop: '1px solid var(--color-border)' }}>
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            ↑↓ Navigate
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            ↵ Open
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Esc Close
          </span>
        </div>
      </div>
    </div>
  );
}
