import { useEffect, useState } from 'react';

interface MoneyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  ariaLabel: string;
}

export default function MoneyInput({ value, onChange, className, ariaLabel }: MoneyInputProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft);
    const normalized = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : 0;
    setDraft(normalized.toFixed(2));
    onChange(normalized);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      aria-label={ariaLabel}
      onChange={(event) => {
        const next = event.target.value;
        if (!/^\d*\.?\d{0,2}$/.test(next)) return;
        setDraft(next);
      }}
      onBlur={commit}
      className={className}
    />
  );
}
