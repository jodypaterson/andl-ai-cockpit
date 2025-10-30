import React, { useEffect, useMemo, useState } from 'react';

declare global {
  interface Window { vscode?: { postMessage: (msg: any) => void } }
}

export interface ToolMetadata {
  id: string;
  name: string;
  description?: string;
  provider: string;
  schema?: any;
}

interface Props {
  providers: Array<{ id: string; name: string }>;
  existingIds: string[];
  onClose: () => void;
  onRegistered: (tools: ToolMetadata[]) => void;
}

type Resolution = 'skip' | 'replace' | { rename: string };

export function ToolkitRegistrationWizard({ providers, existingIds, onClose, onRegistered }: Props) {
  const [step, setStep] = useState(1);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolMetadata[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === 'toolkit:enumerate:result') {
        setLoading(false);
        setDiscoverError(null);
        setTools(Array.isArray(msg.tools) ? msg.tools : []);
        setStep(3);
      } else if (msg?.type === 'toolkit:enumerate:error') {
        setLoading(false);
        setDiscoverError(String(msg.error ?? 'Discovery failed'));
      } else if (msg?.type === 'toolkit:register:success') {
        // Optimistic: notify parent for local update and close
        const registered = Array.isArray(msg.tools) ? msg.tools : [];
        onRegistered(registered);
      } else if (msg?.type === 'toolkit:register:error') {
        setSaveError(String(msg.error ?? 'Registration failed'));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onRegistered]);

  const duplicates = useMemo(() => {
    const idSet = new Set(existingIds);
    return selectedToolIds.filter(id => idSet.has(id));
  }, [selectedToolIds, existingIds]);

  function toggleProvider(id: string) {
    setSelectedProviders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleTool(id: string) {
    setSelectedToolIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function startEnumeration() {
    setLoading(true);
    setDiscoverError(null);
    window.vscode?.postMessage({ type: 'toolkit:enumerate', providerIds: selectedProviders });
  }

  function submitRegistration() {
    const selectedTools = tools.filter(t => selectedToolIds.includes(t.id));
    const payload = { tools: selectedTools, resolutions };
    window.vscode?.postMessage({ type: 'toolkit:register', ...payload });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)' }}>
      <div style={{ width: 640, margin: '10vh auto', background: '#1e1e1e', padding: 16, borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Toolkit Registration</h3>
        {step === 1 && (
          <div data-testid="step-1">
            <p>Select providers to enumerate tools from:</p>
            <div>
              {providers.length === 0 && <div>No providers configured. Add a provider first.</div>}
              {providers.map(p => (
                <label key={p.id} style={{ display: 'block', marginBottom: 6 }}>
                  <input
                    data-testid={`prov-${p.id}`}
                    type="checkbox"
                    checked={selectedProviders.includes(p.id)}
                    onChange={() => toggleProvider(p.id)}
                  />{' '}
                  {p.name} <span style={{ opacity: 0.7 }}>({p.id})</span>
                </label>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <button data-testid="next" onClick={() => setStep(2)} disabled={selectedProviders.length === 0}>Next</button>
              <button data-testid="cancel" onClick={onClose} style={{ marginLeft: 8 }}>Cancel</button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div data-testid="step-2">
            <p>Discovering tools…</p>
            {discoverError && <div style={{ color: 'salmon' }}>{discoverError}</div>}
            <div style={{ marginTop: 12 }}>
              <button data-testid="enumerate" onClick={startEnumeration} disabled={loading}>Enumerate</button>
              <button data-testid="back" onClick={() => setStep(1)} style={{ marginLeft: 8 }}>Back</button>
              <button data-testid="cancel" onClick={onClose} style={{ marginLeft: 8 }}>Cancel</button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div data-testid="step-3">
            <p>Select tools to register:</p>
            {tools.length === 0 && <div>No tools discovered.</div>}
            <div>
              {tools.map(t => (
                <label key={t.id} style={{ display: 'block', marginBottom: 6 }}>
                  <input
                    data-testid={`tool-${t.id}`}
                    type="checkbox"
                    checked={selectedToolIds.includes(t.id)}
                    onChange={() => toggleTool(t.id)}
                  />{' '}
                  <strong>{t.name}</strong> <span style={{ opacity: 0.7 }}>({t.id})</span>
                  <div style={{ opacity: 0.8, fontSize: 12 }}>{t.description ?? ''}</div>
                </label>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <button data-testid="next" onClick={() => setStep(4)} disabled={selectedToolIds.length === 0}>Next</button>
              <button data-testid="back" onClick={() => setStep(2)} style={{ marginLeft: 8 }}>Back</button>
              <button data-testid="cancel" onClick={onClose} style={{ marginLeft: 8 }}>Cancel</button>
            </div>
          </div>
        )}
        {step === 4 && (
          <div data-testid="step-4">
            <p>Resolve duplicates:</p>
            {duplicates.length === 0 && <div>No conflicts detected.</div>}
            {duplicates.map(id => (
              <div key={id} style={{ marginBottom: 8 }}>
                <div>Duplicate ID: <code>{id}</code></div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <label>
                    <input
                      data-testid={`dup-${id}-skip`}
                      type="radio"
                      name={`dup-${id}`}
                      checked={resolutions[id] === 'skip'}
                      onChange={() => setResolutions(prev => ({ ...prev, [id]: 'skip' }))}
                    /> Skip
                  </label>
                  <label>
                    <input
                      data-testid={`dup-${id}-replace`}
                      type="radio"
                      name={`dup-${id}`}
                      checked={resolutions[id] === 'replace'}
                      onChange={() => setResolutions(prev => ({ ...prev, [id]: 'replace' }))}
                    /> Replace
                  </label>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <button data-testid="next" onClick={() => setStep(5)}>Next</button>
              <button data-testid="back" onClick={() => setStep(3)} style={{ marginLeft: 8 }}>Back</button>
              <button data-testid="cancel" onClick={onClose} style={{ marginLeft: 8 }}>Cancel</button>
            </div>
          </div>
        )}
        {step === 5 && (
          <div data-testid="step-5">
            <p>Confirm registration of selected tools.</p>
            {saveError && <div style={{ color: 'salmon' }}>{saveError}</div>}
            <div style={{ marginTop: 12 }}>
              <button data-testid="save" onClick={submitRegistration}>Register</button>
              <button data-testid="back" onClick={() => setStep(4)} style={{ marginLeft: 8 }}>Back</button>
              <button data-testid="cancel" onClick={onClose} style={{ marginLeft: 8 }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ToolkitRegistrationWizard;
