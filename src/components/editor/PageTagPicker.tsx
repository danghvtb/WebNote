import { useMemo, useState } from 'react';
import { Plus, X, Settings2, Tag as TagIcon } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { queueSync } from '../../services/sync/syncManager';

export function PageTagPicker({ pageId, tagIds = [] }: { pageId: string; tagIds?: string[] }) {
  const { tags, createTag, setPageTags } = useNotesStore();
  const { setTagManagerOpen, addNotification } = useAppStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = tags.filter((tag) => tagIds.includes(tag.id));
  const options = useMemo(() => tags.filter((tag) => !tagIds.includes(tag.id) && tag.name.toLowerCase().includes(query.trim().toLowerCase())), [tags, tagIds, query]);

  const update = async (next: string[]) => {
    await setPageTags(pageId, next);
    await queueSync('update', 'page', pageId, { tagIds: next });
  };
  const add = async (name: string) => {
    try {
      let tag = tags.find((t) => t.name.toLowerCase() === name.trim().toLowerCase());
      if (!tag) { tag = await createTag(name); await queueSync('create', 'tag', tag.id); }
      await update([...tagIds, tag.id]); setQuery(''); setOpen(false);
    } catch (e) { addNotification('error', e instanceof Error ? e.message : 'Không thể gắn thẻ'); }
  };

  return <div className="flex flex-wrap items-center gap-1.5 mb-5 relative">
    <TagIcon className="w-4 h-4 text-[var(--color-text-tertiary)]" />
    {selected.map((tag) => <span key={tag.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">#{tag.name}<button onClick={() => update(tagIds.filter((id) => id !== tag.id))} className="cursor-pointer"><X className="w-3 h-3" /></button></span>)}
    <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] cursor-pointer"><Plus className="w-3.5 h-3.5" /> Thêm thẻ</button>
    <button onClick={() => setTagManagerOpen(true)} className="p-1 text-[var(--color-text-tertiary)] hover:text-cyan-300 cursor-pointer" title="Quản lý thẻ"><Settings2 className="w-3.5 h-3.5" /></button>
    {open && <div className="absolute left-0 top-7 z-20 w-64 rounded-xl p-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] shadow-xl"><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && query.trim() && options.length === 0) add(query); if (e.key === 'Escape') setOpen(false); }} placeholder="Tìm hoặc tạo thẻ..." className="w-full px-2.5 py-2 rounded-lg bg-[var(--color-bg-tertiary)] outline-none text-xs" />{options.map((tag) => <button key={tag.id} onClick={() => add(tag.name)} className="block w-full text-left px-2.5 py-2 mt-1 rounded-lg text-xs hover:bg-[var(--color-bg-hover)] cursor-pointer">#{tag.name}</button>)}{query.trim() && options.length === 0 && <button onClick={() => add(query)} className="w-full text-left px-2.5 py-2 mt-1 rounded-lg text-xs text-cyan-300 hover:bg-[var(--color-bg-hover)] cursor-pointer">Tạo #{query.trim()}</button>}</div>}
  </div>;
}
