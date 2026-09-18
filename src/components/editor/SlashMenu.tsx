/* oxlint-disable react(set-state-in-effect, react-hooks(exhaustive-deps)) -- keyboard menu listener follows open state. */
import React, { useEffect, useState, useRef } from 'react';
import { Editor } from '@tiptap/react';
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  CheckSquare,
  Code,
  Quote,
  Table as TableIcon,
  Minus,
  Sparkles,
  Calendar,
  Languages,
} from 'lucide-react';

interface SlashMenuProps {
  editor: Editor;
  isOpen: boolean;
  onClose: () => void;
  onOpenAI: () => void;
  onToggleTranslate?: () => void;
}

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  description: string;
  command: (editor: Editor) => void;
}

export function SlashMenu({ editor, isOpen, onClose, onOpenAI, onToggleTranslate }: SlashMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const menuItems: MenuItem[] = [
    {
      icon: <Heading1 className="w-4 h-4 text-purple-400" />,
      label: 'Tiêu đề 1',
      description: 'Tiêu đề phần lớn',
      command: (ed) => ed.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      icon: <Heading2 className="w-4 h-4 text-purple-400" />,
      label: 'Tiêu đề 2',
      description: 'Tiêu đề phần vừa',
      command: (ed) => ed.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      icon: <Heading3 className="w-4 h-4 text-purple-400" />,
      label: 'Tiêu đề 3',
      description: 'Tiêu đề phần nhỏ',
      command: (ed) => ed.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      icon: <List className="w-4 h-4 text-purple-400" />,
      label: 'Danh sách dấu đầu dòng',
      description: 'Tạo danh sách đơn giản',
      command: (ed) => ed.chain().focus().toggleBulletList().run(),
    },
    {
      icon: <CheckSquare className="w-4 h-4 text-purple-400" />,
      label: 'Danh sách công việc',
      description: 'Theo dõi việc bằng ô chọn',
      command: (ed) => ed.chain().focus().toggleTaskList().run(),
    },
    {
      icon: <Calendar className="w-4 h-4 text-rose-400" />,
      label: 'Công việc có hạn',
      description: 'Chèn việc với thời hạn @today',
      command: (ed) => {
        const d = new Date();
        d.setHours(18, 0, 0, 0);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const iso = `${yyyy}-${mm}-${dd}T18:00`;
        ed.chain().focus().toggleTaskList().insertContent(`Công việc đính kèm thời hạn @due(${iso})`).run();
      },
    },
    {
      icon: <Code className="w-4 h-4 text-purple-400" />,
      label: 'Khối mã',
      description: 'Đoạn mã có tô màu cú pháp',
      command: (ed) => ed.chain().focus().toggleCodeBlock().run(),
    },
    {
      icon: <Quote className="w-4 h-4 text-purple-400" />,
      label: 'Trích dẫn',
      description: 'Chèn một khối trích dẫn',
      command: (ed) => ed.chain().focus().toggleBlockquote().run(),
    },
    {
      icon: <TableIcon className="w-4 h-4 text-purple-400" />,
      label: 'Bảng',
      description: 'Chèn bảng 3x3',
      command: (ed) => ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      icon: <Minus className="w-4 h-4 text-purple-400" />,
      label: 'Đường phân cách',
      description: 'Phân tách nội dung trực quan',
      command: (ed) => ed.chain().focus().setHorizontalRule().run(),
    },
    {
      icon: <Sparkles className="w-4 h-4 text-yellow-400" />,
      label: 'Trợ lý AI',
      description: 'Tạo, tóm tắt hoặc trau chuốt văn bản',
      command: () => onOpenAI(),
    },
    {
      icon: <Languages className="w-4 h-4 text-purple-400" />,
      label: 'Auto Dịch (Live Translate)',
      description: 'Bật/tắt block tự động dịch trực tiếp',
      command: () => onToggleTranslate?.(),
    },
  ];

  useEffect(() => {
    // Reset selection when the command menu opens or its query changes.
    // oxlint-disable-next-line react(set-state-in-effect)
    // oxlint-disable-next-line react(set-state-in-effect)
    setSelectedIndex(0);
  }, [isOpen]);

  const handleExecute = (item: MenuItem) => {
    // If text ends with '/', delete the slash first
    const { from, to } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 1), from);
    if (textBefore === '/') {
      editor.chain().focus().deleteRange({ from: from - 1, to }).run();
    }
    item.command(editor);
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % menuItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (menuItems[selectedIndex]) {
          handleExecute(menuItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // The menu is intentionally recreated from editor callbacks; handlers are
  // event-scoped and do not need to restart the listener on every render.
  // oxlint-disable-next-line react-hooks(exhaustive-deps)
  // oxlint-disable-next-line react-hooks(exhaustive-deps)
  }, [isOpen, selectedIndex, menuItems]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 left-6 top-16 w-72 max-h-80 overflow-y-auto bg-slate-900/95 border border-purple-500/30 rounded-xl shadow-2xl backdrop-blur-md p-1.5 scrollbar-thin scrollbar-thumb-purple-500/20"
      style={{
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(168, 85, 247, 0.15)',
      }}
    >
      <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-purple-400/80 border-b border-purple-500/10 mb-1 flex items-center justify-between">
        <span>Menu lệnh nhanh</span>
        <span className="text-slate-500">Esc để đóng</span>
      </div>
      {menuItems.map((item, idx) => (
        <button
          key={item.label}
          onClick={() => handleExecute(item)}
          className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-all cursor-pointer ${
            idx === selectedIndex
              ? 'bg-purple-600/30 border border-purple-500/40 text-purple-100'
              : 'text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          <div className="p-1.5 rounded-md bg-purple-950/50 border border-purple-500/20">
            {item.icon}
          </div>
          <div>
            <div className="text-xs font-medium text-slate-200">{item.label}</div>
            <div className="text-[11px] text-slate-400">{item.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
