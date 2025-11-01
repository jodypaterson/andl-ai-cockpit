// Migrated Toggle (AT-P2.M4-09)
import React from 'react';

interface ToggleProps { label: string; checked: boolean | undefined; onChange: (v: boolean) => void; disabled?: boolean; }

export const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange, disabled }) => {
  const id = React.useId();
  return (
    <span style={{ display:'flex', alignItems:'center', fontSize:12, gap:8 }}>
      <input id={id} type="checkbox" checked={!!checked} onChange={e=>onChange(!!(e.target as HTMLInputElement).checked)} disabled={disabled} style={{ width:16, height:16 }} />
      <label htmlFor={id} style={{ cursor:'pointer' }}>{label}</label>
    </span>
  );
};

export default Toggle;