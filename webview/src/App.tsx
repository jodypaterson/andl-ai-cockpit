import React, { useEffect, useState } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { ProviderSetupWizard } from './ProviderSetupWizard';

declare global {
  interface Window { vscode?: { postMessage: (msg: any) => void }; }
}

export default function App() {
  const [schema, setSchema] = useState<Record<string, any> | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [wizardOpen, setWizardOpen] = useState(false);

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
        <button onClick={() => setWizardOpen(true)}>Add Provider</button>
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
    </div>
  );
}
