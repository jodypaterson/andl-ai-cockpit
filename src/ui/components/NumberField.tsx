// Migrated NumberField (AT-P2.M4-09)
import React, { useState } from 'react';
import { withClamp, RANGES } from '../utils/ranges.js';

interface NumberFieldProps {
  path: string;
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
  disabled?: boolean;
}

export const NumberField: React.FC<NumberFieldProps> = ({ path, label, value, onChange, min, max, step, disabled }) => {
  const spec = RANGES[path];
  const r = spec?.range;
  const [lastClamped, setLastClamped] = useState(false);
  const inputId = React.useId();
  const clampId = React.useId();

  const apply = (raw: number) => {
    const { value: clamped, clamped: didClamp } = withClamp(path, raw);
    setLastClamped(didClamp);
    onChange(clamped);
  };

  return (
    <label htmlFor={inputId} style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
      <span style={{ marginBottom: 2 }}>{label}</span>
      <input
        type="number"
        id={inputId}
        value={value ?? ''}
        onChange={e => apply(Number((e.target as HTMLInputElement).value))}
        min={min ?? r?.min}
        max={max ?? r?.max}
        step={step ?? r?.step ?? 1}
        disabled={disabled}
        aria-describedby={lastClamped ? clampId : undefined}
        style={{
          background: 'var(--vscode-input-background)',
          border: '1px solid var(--vscode-input-border)',
          color: 'var(--vscode-foreground)',
          padding: '2px 6px',
          borderRadius: 3,
          width: 140,
        }}
      />
      {lastClamped && <span id={clampId} style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 10 }}>Value clamped</span>}
    </label>
  );
};

export default NumberField;