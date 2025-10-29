import React, { useEffect, useState } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';

declare global {
  interface Window { vscode?: { postMessage: (msg: any) => void }; }
}

export default function App() {
  const [schema, setSchema] = useState<Record<string, any> | null>(null);
  const [formData, setFormData] = useState<any>({});

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
      <Form
        schema={schema}
        formData={formData}
        validator={validator}
        onChange={(e) => setFormData(e.formData)}
        onSubmit={(e) => {
          window.vscode?.postMessage({ type: 'config:apply', config: e.formData });
        }}
      />
    </div>
  );
}
