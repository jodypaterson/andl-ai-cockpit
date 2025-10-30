import React, { useEffect, useState } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { ProviderSetupWizard } from './ProviderSetupWizard';
import { ToolkitRegistrationWizard } from './ToolkitRegistrationWizard';
import { MemoryEditor } from './MemoryEditor';

declare global {
  interface Window { vscode?: { postMessage: (msg: any) => void }; }
}

export default function App() {
  const [schema, setSchema] = useState<Record<string, any> | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [wizardOpen, setWizardOpen] = useState(false);
  const [toolkitWizardOpen, setToolkitWizardOpen] = useState(false);
  const [memoryEditorOpen, setMemoryEditorOpen] = useState(false);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === 'config:hydrate') {
        setSchema(msg.schema);
        setFormData(msg.config);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  if (!schema) return <div style={{ padding: 12 }}>Loading configuration…</div>;

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>AI Configuration</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button data-testid="add-provider" onClick={() => setWizardOpen(true)}>Add Provider</button>
          <button data-testid="register-tools" onClick={() => setToolkitWizardOpen(true)}>Register Tools</button>
          <button data-testid="edit-memory" onClick={() => setMemoryEditorOpen(true)}>Edit Memory Settings</button>
        </div>
      </div>
      <Form
        schema={schema}
        formData={formData}
        validator={validator}
        onChange={(e) => setFormData(e.formData)}
        onSubmit={(e) => {
          window.vscode?.postMessage({ type: 'config:apply', config: e.formData });
        }}
      />
      {wizardOpen && (
        <ProviderSetupWizard
          onClose={() => setWizardOpen(false)}
          onAdded={(p: { id: string; name: string }) => {
            // Optimistically reflect locally; host will also rehydrate.
            const next = { ...(formData || {}) };
            const cur = Array.isArray(next.providers) ? next.providers.slice() : [];
            const secret = `andl-ai-${p.id}-key`;
            const entry = { id: p.id, name: p.name, apiKeySecret: secret };
            next.providers = [...cur.filter((x: any) => x?.id !== p.id), entry];
            setFormData(next);
            setWizardOpen(false);
          }}
        />
      )}
      {toolkitWizardOpen && (
        <ToolkitRegistrationWizard
          providers={Array.isArray(formData?.providers) ? formData.providers : []}
          existingIds={Array.isArray(formData?.toolkit?.registeredTools)
            ? formData.toolkit.registeredTools.map((t: any) => t?.id).filter(Boolean)
            : []}
          onClose={() => setToolkitWizardOpen(false)}
          onRegistered={(tools: any[]) => {
            // Optimistically reflect locally; host will also rehydrate
            const next = { ...(formData || {}) };
            const tk = { ...(next.toolkit || {}) } as any;
            const cur = Array.isArray(tk.registeredTools) ? tk.registeredTools.slice() : [];
            const ids = new Set(cur.map((t: any) => t?.id));
            for (const t of tools) {
              if (!t?.id) continue;
              // replace by id if exists, else add
              const idx = cur.findIndex((x: any) => x?.id === t.id);
              if (idx >= 0) cur[idx] = t; else cur.push(t);
              ids.add(t.id);
            }
            tk.registeredTools = cur;
            next.toolkit = tk;
            setFormData(next);
            setToolkitWizardOpen(false);
          }}
        />
      )}
      {memoryEditorOpen && (
        <MemoryEditor
          schema={schema}
          rootConfig={formData}
          onClose={() => setMemoryEditorOpen(false)}
          onSaved={(updatedMemory: any) => {
            // Optimistically update local state; host will rehydrate
            const next = { ...(formData || {}) };
            next.memory = updatedMemory;
            setFormData(next);
            setMemoryEditorOpen(false);
          }}
        />
      )}
    </div>
  );
}
