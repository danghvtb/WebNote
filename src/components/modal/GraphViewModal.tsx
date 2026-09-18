// ============================================================
// MyNotes 3.0 — Knowledge Graph View Modal
// Interactive 2D canvas visualization of all connected notes.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { X, Network, Plus, Minus, Search, RotateCcw } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { extractWikiLinks, normalizeComparableText } from '../../utils';
import { useWorkReportStore } from '../../stores/workReportStore';
import { DialogShell } from '../common/DialogShell';

const normalizeNodeLabel = normalizeComparableText;

export function GraphViewModal() {
  const { graphViewOpen, setGraphViewOpen } = useAppStore();
  const { notebooks, pages, tags, selectedPageId, selectNotebook, selectPage } = useNotesStore();
  const projects = useWorkReportStore((state) => state.projects);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [graphSearch, setGraphSearch] = useState('');
  const [visibleTypes, setVisibleTypes] = useState<Array<'notebook' | 'page' | 'tag' | 'project'>>(['notebook', 'page', 'tag', 'project']);

  useEffect(() => {
    if (!graphViewOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = canvas.parentElement?.clientWidth || 800;
    canvas.height = canvas.parentElement?.clientHeight || 500;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Build Nodes
    const nodes: Array<{ id: string; type: 'notebook' | 'page' | 'tag' | 'project'; label: string; x: number; y: number; radius: number; color: string }> = [];
    const links: Array<{ source: number; target: number }> = [];

    // Add Central Root Node
    nodes.push({ id: 'root', type: 'notebook', label: 'Kho WebNote', x: centerX, y: centerY, radius: 14, color: '#8B5CF6' });

    // Add Notebook Nodes in inner circle
    const nbRadius = Math.min(width, height) * 0.28;
    notebooks.forEach((nb, index) => {
      const angle = (index / Math.max(1, notebooks.length)) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * nbRadius;
      const y = centerY + Math.sin(angle) * nbRadius;
      nodes.push({ id: nb.id, type: 'notebook', label: nb.title, x, y, radius: 10, color: '#06B6D4' });
      links.push({ source: 0, target: nodes.length - 1 });
    });

    // Add Page Nodes around notebooks
    pages.forEach((pg, index) => {
      const nbNodeIndex = nodes.findIndex((n) => n.id === pg.notebookId);
      const parentNode = nbNodeIndex !== -1 ? nodes[nbNodeIndex] : nodes[0];

      const angle = (index / Math.max(1, pages.length)) * Math.PI * 2 + 0.5;
      const dist = 60 + (index % 3) * 20;
      const x = parentNode.x + Math.cos(angle) * dist;
      const y = parentNode.y + Math.sin(angle) * dist;

      nodes.push({ id: pg.id, type: 'page', label: pg.title || 'Chưa có tiêu đề', x, y, radius: 6, color: '#10B981' });
      links.push({ source: nbNodeIndex !== -1 ? nbNodeIndex : 0, target: nodes.length - 1 });
    });

    // Tags and active projects provide cross-cutting knowledge nodes.
    tags.forEach((tag, index) => {
      const angle = (index / Math.max(1, tags.length)) * Math.PI * 2 + Math.PI / 4;
      nodes.push({ id: `tag:${tag.id}`, type: 'tag', label: `#${tag.name}`, x: centerX + Math.cos(angle) * Math.min(width, height) * 0.43, y: centerY + Math.sin(angle) * Math.min(width, height) * 0.43, radius: 6, color: '#F59E0B' });
      pages.filter((page) => (page.tagIds || []).includes(tag.id)).forEach((page) => {
        const source = nodes.findIndex((node) => node.id === page.id);
        const target = nodes.length - 1;
        if (source >= 0) links.push({ source, target });
      });
    });
    projects.forEach((project, index) => {
      const angle = (index / Math.max(1, projects.length)) * Math.PI * 2 - Math.PI / 4;
      nodes.push({ id: `project:${project.id}`, type: 'project', label: project.name, x: centerX + Math.cos(angle) * Math.min(width, height) * 0.43, y: centerY + Math.sin(angle) * Math.min(width, height) * 0.43, radius: 7, color: '#EC4899' });
      links.push({ source: 0, target: nodes.length - 1 });
    });

    // Add real knowledge edges for wiki links such as [[Another page]].
    // The hierarchy edges above remain as context; wiki edges are rendered
    // with the same visual language and point directly between page nodes.
    const pageByTitle = new Map(pages.map((page) => [normalizeNodeLabel(page.title), page]));
    pages.forEach((page) => {
      const source = nodes.findIndex((node) => node.id === page.id);
      if (source < 0) return;
      for (const linkedTitle of extractWikiLinks(page.content || '')) {
        const targetPage = pageByTitle.get(normalizeNodeLabel(linkedTitle));
        const target = targetPage ? nodes.findIndex((node) => node.id === targetPage.id) : -1;
        if (target >= 0 && target !== source) links.push({ source, target });
      }
    });

    // Render Links
    ctx.setTransform(zoom, 0, 0, zoom, pan.x, pan.y);
    ctx.lineWidth = 1.5;
    links.forEach((link) => {
      const s = nodes[link.source];
      const t = nodes[link.target];
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.25)';
      ctx.stroke();
    });

    // Render Nodes & Glow
    nodes.forEach((node) => {
      const matchesSearch = visibleTypes.includes(node.type) && (!graphSearch.trim() || normalizeNodeLabel(node.label).includes(normalizeNodeLabel(graphSearch)));
      ctx.globalAlpha = matchesSearch ? 1 : 0.16;
      // Glow
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2);
      ctx.fillStyle = node.color + '33';
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();
      if (node.id === selectedPageId) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 7, 0, Math.PI * 2);
        ctx.strokeStyle = '#F8FAFC';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label
      ctx.font = '11px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#CBD5E1';
      ctx.textAlign = 'center';
      ctx.fillText(node.label.length > 14 ? node.label.slice(0, 12) + '…' : node.label, node.x, node.y + node.radius + 14);
      ctx.globalAlpha = 1;
    });

    // Node click handler
    const handleCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = (e.clientX - rect.left - pan.x) / zoom;
      const clickY = (e.clientY - rect.top - pan.y) / zoom;

      for (const node of nodes) {
        const dist = Math.hypot(clickX - node.x, clickY - node.y);
        if (dist <= node.radius + 4) {
          if (node.type === 'notebook' && node.id !== 'root') {
            selectNotebook(node.id);
            setGraphViewOpen(false);
          } else if (node.type === 'page') {
            selectPage(node.id);
            setGraphViewOpen(false);
          }
          break;
        }
      }
    };

    canvas.addEventListener('click', handleCanvasClick);
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((current) => Math.min(2.5, Math.max(0.5, current + (event.deltaY < 0 ? 0.1 : -0.1))));
    };
    let dragging = false;
    let lastPoint = { x: 0, y: 0 };
    const handlePointerDown = (event: PointerEvent) => { dragging = true; lastPoint = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); };
    const handlePointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      setPan((current) => ({ x: current.x + event.clientX - lastPoint.x, y: current.y + event.clientY - lastPoint.y }));
      lastPoint = { x: event.clientX, y: event.clientY };
    };
    const stopDragging = () => { dragging = false; };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', stopDragging);
    canvas.addEventListener('pointercancel', stopDragging);
    return () => {
      canvas.removeEventListener('click', handleCanvasClick);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', stopDragging);
      canvas.removeEventListener('pointercancel', stopDragging);
    };
  }, [graphViewOpen, notebooks, pages, tags, projects, selectedPageId, selectNotebook, selectPage, setGraphViewOpen, zoom, pan, graphSearch, visibleTypes]);

  if (!graphViewOpen) return null;

  return (
    <DialogShell open={graphViewOpen} onClose={() => setGraphViewOpen(false)} ariaLabel="Đồ thị kiến thức" className="w-full max-w-5xl h-[85vh] rounded-3xl glass-card border border-cyan-500/30 flex flex-col overflow-hidden shadow-2xl glow-accent">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Sơ đồ liên kết tri thức</h3>
          <p className="text-xs text-slate-400">Liên kết {notebooks.length} sổ, {pages.length} trang, {tags.length} thẻ và {projects.length} dự án</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-1" aria-label="Bộ lọc loại nút">{([['notebook', 'Sổ'], ['page', 'Trang'], ['tag', 'Thẻ'], ['project', 'Dự án']] as const).map(([type, label]) => <button type="button" key={type} onClick={() => setVisibleTypes((current) => current.includes(type) ? (current.length === 1 ? current : current.filter((item) => item !== type)) : [...current, type])} className={`px-1.5 py-1 rounded text-[10px] border ${visibleTypes.includes(type) ? 'border-cyan-400/40 text-cyan-200 bg-cyan-500/10' : 'border-slate-700 text-slate-500'}`}>{label}</button>)}</div>
            <label className="hidden md:flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-400"><Search className="w-3.5 h-3.5" /><input value={graphSearch} onChange={(event) => setGraphSearch(event.target.value)} placeholder="Tìm nút..." className="w-24 bg-transparent outline-none text-slate-200" aria-label="Tìm trong đồ thị" /></label>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setZoom((value) => Math.min(2.5, value + 0.1))} className="touch-target p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer" aria-label="Phóng to"><Plus className="w-4 h-4" /></button>
              <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))} className="touch-target p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer" aria-label="Thu nhỏ"><Minus className="w-4 h-4" /></button>
              <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="touch-target p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer" aria-label="Đặt lại graph"><RotateCcw className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 hidden sm:flex">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" /> Gốc</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" /> Sổ</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Trang</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Thẻ</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block" /> Dự án</span>
            </div>
            <button type="button" onClick={() => setGraphViewOpen(false)} className="touch-target p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer" aria-label="Đóng đồ thị">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative bg-slate-950/80 flex items-center justify-center overflow-hidden">
          <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing touch-none" role="img" aria-label="Đồ thị liên kết kiến thức; kéo để di chuyển, cuộn để phóng to" />
        </div>
        <details className="border-t border-slate-800 bg-slate-900/70 px-4 py-2 text-xs text-slate-400">
          <summary className="cursor-pointer">Danh sách nút ({pages.length + notebooks.length + tags.length + projects.length})</summary>
          <div className="mt-2 max-h-24 overflow-y-auto grid grid-cols-2 md:grid-cols-4 gap-1">
            {[...notebooks.map((item) => ({ id: item.id, label: item.title, type: 'Sổ' as const })), ...pages.map((item) => ({ id: item.id, label: item.title || 'Chưa có tiêu đề', type: 'Trang' as const })), ...tags.map((item) => ({ id: item.id, label: `#${item.name}`, type: 'Thẻ' as const })), ...projects.filter((item) => !item.deletedAt).map((item) => ({ id: item.id, label: item.name, type: 'Dự án' as const }))].map((item) => <button type="button" key={`${item.type}-${item.id}`} className="touch-target text-left truncate rounded px-2 py-1 hover:bg-slate-800" onClick={() => { if (item.type === 'Sổ') selectNotebook(item.id); else if (item.type === 'Trang') selectPage(item.id); setGraphViewOpen(false); }}>{item.type}: {item.label}</button>)}
          </div>
        </details>
    </DialogShell>
  );
}
