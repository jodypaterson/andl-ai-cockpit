import React from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';

declare global {
  interface Window { vscode?: { postMessage: (msg: any) => void } }
}

interface Props {
  schema: Record<string, any>;
  rootConfig: any;
  onClose: () => void;
  onSaved: (memory: any) => void;
}

export function MemoryEditor({ schema, rootConfig, onClose, onSaved }: Props) {
  const memorySchema = schema?.properties?.memory ?? { type: 'object', title: 'Memory Settings', properties: {} };
  const initial = rootConfig?.memory ?? {};

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)' }}>
      <div style={{ background: 'var(--vscode-editor-background,#1e1e1e)', color: 'var(--vscode-editor-foreground,#ddd)', padding: 16, margin: '5% auto', width: 520, borderRadius: 6 }}>
        <h3 style={{ marginTop: 0 }}>Memory Configuration</h3>
        <Form
          schema={memorySchema}
          formData={initial}
          validator={validator}
          onSubmit={(e) => {
            const updatedMemory = e.formData ?? {};
            const nextConfig = { ...(rootConfig || {}), memory: updatedMemory };
            window.vscode?.postMessage({ type: 'config:apply', config: nextConfig });
            onSaved(updatedMemory);
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" data-testid="cancel-memory" onClick={onClose}>Cancel</button>
            <button type="submit" data-testid="save-memory">Save</button>
          </div>
        </Form>
      </div>
    </div>
  );
}
