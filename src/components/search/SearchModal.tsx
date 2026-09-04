// ============================================================
// MyNotes — Search Modal (Ctrl+K)
// Global search across notebooks and pages.
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, FileText, Notebook, X } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useNotesStore } from '../../stores/notesStore';
import { searchAll } from '../../services/database/repository';
import type { SearchEntry } from '../../types';
import { createExcerpt } from '../../utils';

export function SearchModal() {
  const { searchOpen, setSearchOpen, searchQuery, setSearchQuery } = useAppStore();
  const { selectNotebook, selectPage } = useNotesStore();
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setResults([]);
      setSelectedIndex(0);
    }
  }, [searchOpen]);

  // Debounced search
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchTimer.current) clearTimeout(searchTimer.current);

      if (!query.trim()) {
        setResults([]);
        return;
      }

      searchTimer.current = setTimeout(async () => {
        const entries = await searchAll(query);
        setResults(entries);
        setSelectedIndex(0);
      }, 200);
    },
    [setSearchQuery]
  );

  // Navigate to search result
  const handleSelect = useCallback(
    (entry: SearchEntry) => {
      if (entry.type === 'notebook') {
        selectNotebook(entry.entityId);
      } else if (entry.type === 'page') {
        if (entry.notebookId) {
          selectNotebook(entry.notebookId);
        }
        selectPage(entry.entityId);
      }
      setSearchOpen(false);
    },
    [selectNotebook, selectPage, setSearchOpen]
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

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {results.length === 0 && searchQuery.trim() ? (
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
                  ) : (
                    <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {entry.title}
                    </p>
                    {entry.content && entry.type === 'page' && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                        {createExcerpt(entry.content, 80)}
                      </p>
                    )}
                    {entry.notebookTitle && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                        in {entry.notebookTitle}
                      </p>
                    )}
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
