// Migrated GlobalToolbar (AT-P2.M4-09)
import React, { useState, useRef } from 'react';
import { useDirtyGroupCount } from '../state/hooks.js';
import { configStore } from '../state/configStore.js';
import { hostBridge } from '../messaging/hostBridge.js';

interface GlobalToolbarProps { onFilterChange?: (v: string) => void; onReload?: () => void; }

export const GlobalToolbar: React.FC<GlobalToolbarProps> = ({ onFilterChange, onReload }) => {
  const dirtyCount = useDirtyGroupCount();
  const [filter, setFilter] = useState('');
  const liveRef = useRef<HTMLDivElement | null>(null);

  const applyAll = () => {
    const patch = configStore.applyAll();
    if (patch && Object.keys(patch).length) {
      try { console.log('[webview] webview:apply-all:emit:config:apply:hybrid', Object.keys(patch)); } catch {}
      hostBridge.applyPatch(patch);
      if (liveRef.current) liveRef.current.textContent = `Applied changes to ${Object.keys(patch).length} group roots.`;
    } else {
      const st = configStore.getState();
      const working = (st && st.working) ? st.working : {};
      try { console.log('[webview] webview:apply-all:emit:settings:apply:v2', Object.keys(working||{})); } catch {}
      hostBridge.saveAll(working as any);
      if (liveRef.current) liveRef.current.textContent = 'Applied full configuration (no group diffs).';
    }
  };
  const reload = () => { if (onReload) onReload(); if (liveRef.current) liveRef.current.textContent = 'Reload requested (waiting for host hydrate message).'; };

  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'6px 10px', border:'1px solid var(--vscode-editorWidget-border)', borderRadius:4, marginBottom:16, background:'var(--vscode-editor-background)' }}>
      <div style={{ fontWeight:600 }}>AI Config</div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }} aria-label="Unsaved groups">
        <span style={{ fontSize:12 }}>Unsaved:</span>
        <span style={{ fontSize:12, fontWeight:600, color: dirtyCount ? 'var(--vscode-editorWarning-foreground)' : 'var(--vscode-descriptionForeground)' }}>{dirtyCount}</span>
      </div>
      <button onClick={applyAll} aria-label="Apply all unsaved group changes" disabled={!dirtyCount}>Apply All</button>
      <button onClick={reload} aria-label="Reload configuration from host">Reload</button>
      <div style={{ flex:1 }} />
      <label style={{ display:'flex', alignItems:'center', fontSize:12, gap:4 }}>
        <span>Filter</span>
        <input aria-label="Filter settings" value={filter} onChange={e=> { const v = (e.target as HTMLInputElement).value; setFilter(v); onFilterChange?.(v); }} placeholder="Type to filter (future)" style={{ background:'var(--vscode-input-background)', border:'1px solid var(--vscode-input-border)', color:'var(--vscode-foreground)', padding:'2px 6px', borderRadius:3, width:180 }} />
      </label>
      <div ref={liveRef} aria-live="polite" style={{ position:'absolute', left:-9999, height:1, width:1, overflow:'hidden' }} />
    </div>
  );
};

export default GlobalToolbar;