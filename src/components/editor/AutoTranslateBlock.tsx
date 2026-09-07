// ============================================================
// MyNotes — Live Auto-Translation Editor Block Component
// Real-time translation as you type ("Viết đến đâu dịch đến đấy")
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { Languages, ArrowRightLeft, Copy, Check, ArrowDown, RefreshCw, Pause, Play, X, Sparkles } from 'lucide-react';
import { translateLiveText } from '../../services/ai/geminiService';
import { useAppStore } from '../../stores/appStore';

export interface AutoTranslateBlockProps {
  noteContent: string;
  onInsertTranslation: (translatedText: string) => void;
  onReplaceNote: (translatedText: string) => void;
  onClose: () => void;
}

const LANGUAGE_OPTIONS = [
  { code: 'auto', name: '✨ Tự động phát hiện (Auto)' },
  { code: 'vi', name: '🇻🇳 Tiếng Việt (Vietnamese)' },
  { code: 'en', name: '🇬🇧 Tiếng Anh (English)' },
  { code: 'ja', name: '🇯🇵 Tiếng Nhật (Japanese)' },
  { code: 'ko', name: '🇰🇷 Tiếng Hàn (Korean)' },
  { code: 'zh', name: '🇨🇳 Tiếng Trung (Chinese)' },
  { code: 'fr', name: '🇫🇷 Tiếng Pháp (French)' },
  { code: 'de', name: '🇩🇪 Tiếng Đức (German)' },
  { code: 'es', name: '🇪🇸 Tiếng Tây Ban Nha (Spanish)' },
  { code: 'ru', name: '🇷🇺 Tiếng Nga (Russian)' },
];

const TARGET_LANGUAGE_OPTIONS = LANGUAGE_OPTIONS.filter((l) => l.code !== 'auto');

export function AutoTranslateBlock({
  noteContent,
  onInsertTranslation,
  onReplaceNote,
  onClose,
}: AutoTranslateBlockProps) {
  const [sourceLang, setSourceLang] = useState<string>('auto');
  const [targetLang, setTargetLang] = useState<string>('en');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const { addNotification } = useAppStore();

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to extract clean plain text from note HTML for accurate translation
  const getCleanText = (html: string): string => {
    if (!html) return '';
    if (typeof document !== 'undefined') {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      return tempDiv.innerText || tempDiv.textContent || '';
    }
    return html.replace(/<[^>]*>/g, ' ');
  };

  // Debounced translation runner
  useEffect(() => {
    if (isPaused) return;

    const plainText = getCleanText(noteContent).trim();
    if (!plainText) {
      setTranslatedText('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const result = await translateLiveText(plainText, sourceLang, targetLang);
        setTranslatedText(result);
      } catch (err) {
        console.error('[AutoTranslateBlock] Translation failed:', err);
      } finally {
        setIsLoading(false);
      }
    }, 600); // 600ms debounce for smooth live typing

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [noteContent, sourceLang, targetLang, isPaused]);

  const handleSwapLanguages = () => {
    if (sourceLang === 'auto') {
      setSourceLang('en');
      setTargetLang('vi');
    } else {
      const prevSource = sourceLang;
      setSourceLang(targetLang);
      setTargetLang(prevSource);
    }
  };

  const handleCopy = () => {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText);
    setCopied(true);
    addNotification('info', 'Đã sao chép bản dịch!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    if (!translatedText) return;
    onInsertTranslation(translatedText);
    addNotification('success', 'Đã chèn bản dịch vào ghi chú!');
  };

  const handleReplace = () => {
    if (!translatedText) return;
    onReplaceNote(translatedText);
    addNotification('success', 'Đã thay thế nội dung bằng bản dịch!');
  };

  return (
    <div className="mb-6 p-4.5 rounded-2xl bg-slate-900/90 border border-purple-500/30 shadow-2xl backdrop-blur-xl space-y-4 animate-fade-in transition-all">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-300 shadow-inner">
            <Languages className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
              Block Auto Dịch Trực Tiếp
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-900/50 border border-purple-400/40 text-purple-300 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-yellow-400" /> Live Translate
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Tự động dịch nội dung ghi chú theo thời gian thực khi bạn viết</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Pause / Resume Live Sync */}
          <button
            type="button"
            onClick={() => setIsPaused((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
              isPaused
                ? 'bg-amber-950/80 border-amber-500/40 text-amber-300 hover:bg-amber-900/80'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title={isPaused ? 'Tiếp tục tự động dịch' : 'Tạm dừng tự động dịch'}
          >
            {isPaused ? <Play className="w-3 h-3 text-amber-400" /> : <Pause className="w-3 h-3 text-slate-400" />}
            <span>{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
          </button>

          {/* Close Block */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer transition-all"
            title="Đóng khối dịch"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Language Pickers & Settings */}
      <div className="flex flex-wrap items-center gap-2.5 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
        {/* Source Language Select */}
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Ngôn ngữ nguồn</label>
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="w-full text-xs bg-slate-900 border border-purple-500/30 text-purple-200 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer focus:border-purple-400"
          >
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Swap Button */}
        <button
          type="button"
          onClick={handleSwapLanguages}
          className="mt-4 p-2 rounded-lg bg-purple-950/60 border border-purple-500/30 text-purple-300 hover:bg-purple-900/60 transition-all cursor-pointer"
          title="Đổi ngược ngôn ngữ nguồn và đích"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
        </button>

        {/* Target Language Select */}
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Ngôn ngữ đích</label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="w-full text-xs bg-slate-900 border border-purple-500/30 text-purple-200 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer focus:border-purple-400"
          >
            {TARGET_LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Live Translated Output Display */}
      <div className="relative rounded-xl bg-slate-950/90 border border-slate-800 p-3.5 text-xs text-slate-200 min-h-[90px] max-h-60 overflow-y-auto space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-1.5 mb-1.5">
          <span className="font-semibold text-purple-300 flex items-center gap-1.5">
            🌐 Bản dịch trực tiếp:
          </span>

          <span className="flex items-center gap-1.5 text-[10px]">
            {isLoading ? (
              <span className="flex items-center gap-1 text-purple-400 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> Đang dịch...
              </span>
            ) : isPaused ? (
              <span className="text-amber-400">⏸️ Tạm dừng đồng bộ</span>
            ) : translatedText ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Live Sync Active
              </span>
            ) : (
              <span className="text-slate-500">Hãy gõ văn bản trong ghi chú...</span>
            )}
          </span>
        </div>

        {translatedText ? (
          <div className="whitespace-pre-wrap leading-relaxed text-slate-200 font-normal">
            {translatedText}
          </div>
        ) : (
          <div className="text-slate-500 italic text-[11px] py-4 text-center">
            Viết đến đâu bản dịch sẽ cập nhật trực tiếp tại đây...
          </div>
        )}
      </div>

      {/* Action Controls */}
      {translatedText && (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
          </button>

          <button
            type="button"
            onClick={handleInsert}
            className="px-3 py-1.5 rounded-lg bg-purple-950/80 border border-purple-500/40 text-purple-200 hover:bg-purple-900 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
          >
            <ArrowDown className="w-3.5 h-3.5 text-purple-400" />
            <span>Chèn vào cuối ghi chú</span>
          </button>

          <button
            type="button"
            onClick={handleReplace}
            className="px-3 py-1.5 rounded-lg bg-purple-600 border border-purple-500 text-white hover:bg-purple-500 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thay thế toàn bộ ghi chú</span>
          </button>
        </div>
      )}
    </div>
  );
}
