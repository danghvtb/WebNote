import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Time24PickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
}

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

function normalizeTypedTime(value: string): string {
  const cleaned = value.replace(/[^\d:]/g, '').slice(0, 5);

  if (cleaned.includes(':')) {
    const [rawHour, rawMinute = ''] = cleaned.split(':');
    return `${rawHour.slice(0, 2).padStart(2, '0')}:${rawMinute.slice(0, 2)}`;
  }

  const digits = cleaned.replace(':', '');

  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

function isCompleteTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function Time24Picker({
  value,
  onChange,
  className = '',
  inputClassName = '',
  ariaLabel = 'Giờ theo định dạng 24 giờ',
}: Time24PickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [open]);

  const commitTime = (nextValue: string) => {
    setDraft(nextValue);
    if (isCompleteTime(nextValue)) onChange(nextValue);
  };

  const handleInputChange = (nextValue: string) => {
    const normalized = normalizeTypedTime(nextValue);
    setDraft(normalized);

    if (!normalized) {
      onChange('');
    } else if (isCompleteTime(normalized)) {
      onChange(normalized);
    }
  };

  const handleInputBlur = () => {
    if (!draft) return;
    if (!isCompleteTime(draft)) setDraft(value);
  };

  const selectedHour = isCompleteTime(value) ? value.slice(0, 2) : '00';
  const selectedMinute = isCompleteTime(value) ? value.slice(3, 5) : '00';

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={handleInputBlur}
          placeholder="HH:mm"
          maxLength={5}
          className={`w-full min-w-0 bg-transparent outline-none cursor-text ${inputClassName}`}
          aria-label={ariaLabel}
          autoComplete="off"
        />
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((current) => !current)}
          className="flex-shrink-0 text-slate-500 hover:text-purple-300 cursor-pointer"
          aria-label="Mở bộ chọn giờ 24 giờ"
          aria-expanded={open}
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 right-0 top-full mt-1 w-[142px] rounded-md border border-slate-600 bg-slate-800 p-1.5 shadow-xl">
          <div className="grid grid-cols-2 gap-1 text-center text-[9px] font-semibold text-slate-400">
            <span>Giờ</span>
            <span>Phút</span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            <div className="max-h-40 overflow-y-auto rounded bg-slate-950/70 p-0.5">
              {HOURS.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commitTime(`${hour}:${selectedMinute}`)}
                  className={`block w-full rounded px-2 py-1 text-[11px] cursor-pointer ${
                    hour === selectedHour
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {hour}
                </button>
              ))}
            </div>
            <div className="max-h-40 overflow-y-auto rounded bg-slate-950/70 p-0.5">
              {MINUTES.map((minute) => (
                <button
                  key={minute}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commitTime(`${selectedHour}:${minute}`)}
                  className={`block w-full rounded px-2 py-1 text-[11px] cursor-pointer ${
                    minute === selectedMinute
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {minute}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
