// Simple accessible tab bar for AI Config sections (AT-P2.M4-09)
import React from 'react';

export interface TabDef { id: string; label: string; }

interface TabBarProps {
  tabs: TabDef[];
  current: string;
  onChange: (id: string) => void;
}

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--vscode-foreground)',
  padding: '6px 10px',
  cursor: 'pointer',
  borderBottom: '2px solid transparent',
};

export const TabBar: React.FC<TabBarProps> = ({ tabs, current, onChange }) => {
  return (
    <div role="tablist" aria-label="AI Config Sections" style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--vscode-editorWidget-border)', marginTop: 8 }}>
      {tabs.map(t => {
        const selected = t.id === current;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-${t.id}`}
            onClick={() => onChange(t.id)}
            style={{
              ...btnStyle,
              borderBottomColor: selected ? 'var(--vscode-focusBorder)' : 'transparent',
              fontWeight: selected ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
};

export default TabBar;