import { useEffect, useState } from 'react';

interface MoneyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  ariaLabel: string;
}

export default function MoneyInput({ value, onChange, className, ariaLabel }: MoneyInputProps) {
  const [draft, setDraft] = useState(String(value || ''));

  useEffect(() => {
    const parsed = parseFloat(draft);
    const currentNum = Number.isFinite(parsed) ? parsed : 0;
    if (value !== currentNum) {
      setDraft(value > 0 ? String(value) : '');
    }
  }, [value]);

  const commit = () => {
    const parsed = parseFloat(draft);
    const normalized = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : 0;
    setDraft(normalized > 0 ? String(normalized) : '');
    onChange(normalized);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      placeholder="0.00"
      aria-label={ariaLabel}
      onFocus={(e) => {
        if (draft === '0' || draft === '0.00') {
          setDraft('');
        } else {
          e.target.select();
        }
      }}
      onChange={(event) => {
        const next = event.target.value;
        if (!/^\d*\.?\d{0,2}$/.test(next)) return;
        setDraft(next);
        const parsed = parseFloat(next);
        // Immediately notify parent so buttons/alerts activate live while typing
        onChange(Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
      }}
      onBlur={commit}
      className={className}
    />
  );
}
