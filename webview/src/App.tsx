import React, { useEffect, useState } from 'react';
// Consume extracted UI library (internal import)
import { GlobalToolbar, ProvidersGroup, GroupCard, Toggle, NumberField, useConfigStore, configStore, hostBridge } from '../../src/ui/index.js';

declare global {
  interface Window { vscode?: { postMessage: (msg: any) => void }; }
}

export default function App() {
  // Start host bridge for hydration/messages
  useEffect(() => { hostBridge.start(); }, []);

  const state = useConfigStore();
  const working = (state?.working || {}) as any;
  const original = (state?.original || {}) as any;
  const [newToolId, setNewToolId] = useState('');
  const [newToolName, setNewToolName] = useState('');

  // Derive Providers props
  const execMode: string = String(working?.providers?.executionMode || original?.providers?.executionMode || 'stub');
  const appliedExecMode: string = String(original?.providers?.executionMode || 'stub');
  const onExecModeChange = (mode: string) => {
    // Optimistically update local working state
    configStore.update(['providers', 'executionMode'], mode);
  };
  const onApplyExecMode = (mode: string) => {
    // Persist via host message while keeping local state in sync
    configStore.update(['providers', 'executionMode'], mode);
    hostBridge.postMessage({ type: 'ai:executionMode:set', value: mode });
  };

  const models = (Array.isArray(working?.providers?.modelsAll) ? working.providers.modelsAll : (Array.isArray(working?.providers?.models) ? working.providers.models : [])) as any[];
  const modelsLoading = !!working?.providers?.modelsLoading;
  const providerStatuses = (working?.providers?.statuses || {}) as Record<string, any>;
  const providerCreds = (working?.providers?.credentials || { __loaded: false }) as any;
  const groupDirty = state?.dirtyGroups?.has?.('providers') || false;

  const onReload = () => hostBridge.postMessage({ type: 'ai:config:current:request', reason: 'toolbar:reload' });

  const hasHydrated = !!state?.working;
  if (!hasHydrated) return <div style={{ padding: 12 }}>Loading configuration…</div>;

  return (
    <div style={{ padding: 12 }}>
      <GlobalToolbar onReload={onReload} />
      <ProvidersGroup
        executionMode={execMode}
        appliedExecutionMode={appliedExecMode}
        onExecutionModeChange={onExecModeChange}
        onApplyExecutionMode={onApplyExecMode}
        models={models}
        modelsLoading={modelsLoading}
        providerStatuses={providerStatuses}
        providerCreds={providerCreds}
        groupDirty={groupDirty}
      />

      {/* Toolkit minimal editor */}
      <GroupCard title="Toolkit" description="Register simple tools for testing. Use ai-client for full capabilities.">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input
            placeholder="tool id (e.g., gemini:status)"
            value={newToolId}
            onChange={(e) => setNewToolId(e.target.value)}
            style={{ flex: 2 }}
            data-testid="tool-id-input"
          />
          <input
            placeholder="tool name"
            value={newToolName}
            onChange={(e) => setNewToolName(e.target.value)}
            style={{ flex: 3 }}
            data-testid="tool-name-input"
          />
          <button
            onClick={() => {
              const id = newToolId.trim(); const name = newToolName.trim() || newToolId.trim();
              if (!id) return;
              // Optimistic local update
              const st = configStore.getState();
              const base = { ...(st.working || {}) } as any;
              const tk = { ...(base.toolkit || {}) } as any;
              const cur = Array.isArray(tk.registeredTools) ? tk.registeredTools.slice() : [];
              const idx = cur.findIndex((x: any) => x?.id === id);
              const tool = { id, name } as any;
              if (idx >= 0) cur[idx] = tool; else cur.push(tool);
              tk.registeredTools = cur;
              configStore.update(['toolkit'], tk);
              // Persist via host
              hostBridge.postMessage({ type: 'toolkit:register', tools: [tool] });
              setNewToolId(''); setNewToolName('');
            }}
            data-testid="register-tool"
          >Register</button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Registered tools: {Array.isArray((working as any)?.toolkit?.registeredTools) ? (working as any).toolkit.registeredTools.length : 0}
        </div>
      </GroupCard>

      {/* Memory minimal editor */}
      <GroupCard title="Memory" description="Basic memory settings (demo).">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 8 }}>
          <NumberField
            path="memory.stm.maxItems"
            label="STM max items"
            value={Number(((working as any)?.memory?.stm?.maxItems ?? 50))}
            min={1}
            max={500}
            step={1}
            onChange={(v: number) => configStore.update(['memory', 'stm', 'maxItems'], v)}
          />
          <Toggle
            label="Session memory enabled"
            checked={!!((working as any)?.memory?.session?.enabled)}
            onChange={(checked: boolean) => configStore.update(['memory', 'session', 'enabled'], checked)}
          />
          <button
            onClick={() => {
              const patch = configStore.applyAll();
              if (patch) { hostBridge.saveAll(patch as any); }
            }}
            data-testid="memory-save-all"
          >Save All</button>
        </div>
      </GroupCard>
    </div>
  );
}
