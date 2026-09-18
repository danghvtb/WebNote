// ============================================================
// MyNotes 3.0 — Knowledge Graph View Modal
// Interactive 2D canvas visualization of all connected notes.
// ============================================================

import { useEffect, useRef } from 'react';
import { X, Network } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';

export function GraphViewModal() {
  const { graphViewOpen, setGraphViewOpen } = useAppStore();
  const { notebooks, pages, selectNotebook, selectPage } = useNotesStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    ctx.clearRect(0, 0, width, height);

    // Build Nodes
    const nodes: Array<{ id: string; type: 'notebook' | 'page'; label: string; x: number; y: number; radius: number; color: string }> = [];
    const links: Array<{ source: number; target: number }> = [];

    // Add Central Root Node
    nodes.push({ id: 'root', type: 'notebook', label: 'MyNotes Vault', x: centerX, y: centerY, radius: 14, color: '#8B5CF6' });

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

      nodes.push({ id: pg.id, type: 'page', label: pg.title || 'Untitled', x, y, radius: 6, color: '#10B981' });
      links.push({ source: nbNodeIndex !== -1 ? nbNodeIndex : 0, target: nodes.length - 1 });
    });

    // Render Links
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

      // Label
      ctx.font = '11px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#CBD5E1';
      ctx.textAlign = 'center';
      ctx.fillText(node.label.length > 14 ? node.label.slice(0, 12) + '…' : node.label, node.x, node.y + node.radius + 14);
    });

    // Node click handler
    const handleCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

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
    return () => canvas.removeEventListener('click', handleCanvasClick);
  }, [graphViewOpen, notebooks, pages, selectNotebook, selectPage, setGraphViewOpen]);

  if (!graphViewOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-5xl h-[85vh] rounded-3xl glass-card border border-cyan-500/30 flex flex-col overflow-hidden shadow-2xl glow-accent">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Interactive Knowledge Graph</h3>
              <p className="text-xs text-slate-400">Visualizing connections across {notebooks.length} Notebooks and {pages.length} Pages</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-xs text-slate-400 hidden sm:flex">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" /> Root</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" /> Notebook</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Page</span>
            </div>
            <button onClick={() => setGraphViewOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative bg-slate-950/80 flex items-center justify-center overflow-hidden">
          <canvas ref={canvasRef} className="w-full h-full cursor-pointer" />
        </div>
      </div>
    </div>
  );
}
