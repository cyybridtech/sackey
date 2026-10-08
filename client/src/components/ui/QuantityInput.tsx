import { useEffect, useState } from 'react';

interface QuantityInputProps {
  value: number;
  max: number;
  onChange: (value: number) => void;
  className?: string;
  ariaLabel: string;
}

export default function QuantityInput({
  value,
  max,
  onChange,
  className,
  ariaLabel,
}: QuantityInputProps) {
  const [draft, setDraft] = useState(String(value));
  const available = Number.isFinite(max) && max > 0;

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commitDraft = (input: string) => {
    const parsed = Number.parseInt(input, 10);
    const normalized = available
      ? Math.min(Math.max(parsed || 1, 1), max)
      : 1;
    setDraft(String(normalized));
    onChange(normalized);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={draft}
      aria-label={ariaLabel}
      disabled={!available}
      onChange={(event) => {
        const next = event.target.value;
        if (!/^\d*$/.test(next)) return;
        setDraft(next);
        if (next) {
          const parsed = Number.parseInt(next, 10);
          if (parsed >= 1 && parsed <= max) onChange(parsed);
        }
      }}
      onBlur={() => commitDraft(draft)}
      className={className}
    />
  );
}
