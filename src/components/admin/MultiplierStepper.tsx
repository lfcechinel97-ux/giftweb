import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

interface MultiplierStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

export function MultiplierStepper({
  value,
  onChange,
  min = 1,
  max = 10,
  step = 0.1,
  disabled = false,
}: MultiplierStepperProps) {
  const [text, setText] = useState(() => value.toFixed(2).replace(".", ","));

  useEffect(() => {
    setText(value.toFixed(2).replace(".", ","));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = parseFloat(raw.replace(",", "."));
    if (!isFinite(parsed)) {
      setText(value.toFixed(2).replace(".", ","));
      return;
    }
    const next = round2(clamp(parsed, min, max));
    onChange(next);
    setText(next.toFixed(2).replace(".", ","));
  };

  const dec = () => onChange(round2(clamp(value - step, min, max)));
  const inc = () => onChange(round2(clamp(value + step, min, max)));

  return (
    <div className="inline-flex items-center rounded-md border border-input bg-background overflow-hidden">
      <button
        type="button"
        onClick={dec}
        disabled={disabled || value <= min}
        className="h-8 w-7 flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        aria-label="Diminuir"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="h-8 w-14 text-center text-sm font-medium tabular-nums bg-transparent outline-none border-x border-input"
      />
      <button
        type="button"
        onClick={inc}
        disabled={disabled || value >= max}
        className="h-8 w-7 flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        aria-label="Aumentar"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
