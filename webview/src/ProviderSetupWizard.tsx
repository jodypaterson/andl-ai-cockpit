import React, { useEffect, useState } from 'react';

declare global {
  interface Window { vscode?: { postMessage: (msg: any) => void }; }
}

type ProviderChoice = 'openai' | 'anthropic' | 'gemini' | 'github';

export function ProviderSetupWizard(props: {
  onClose: () => void;
  onAdded: (p: { id: string; name: string }) => void;
}) {
  const { onClose, onAdded } = props;
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [provider, setProvider] = useState<ProviderChoice>('openai');
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === 'provider:test:result') {
        setTesting(false);
        if (msg.ok) {
          setTestError(null);
          setStep(4);
        } else {
          setTestError(msg.error || 'Validation failed.');
        }
      }
      if (msg?.type === 'provider:add:success') {
        setSaving(false);
        setSaveError(null);
        const { providerId } = msg;
        const name = toName(providerId);
        onAdded({ id: providerId, name });
      }
      if (msg?.type === 'provider:add:error') {
        setSaving(false);
        setSaveError(msg.error || 'Unable to save provider.');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onAdded]);

  function toName(id: string): string {
    switch (id) {
      case 'openai': return 'OpenAI';
      case 'anthropic': return 'Anthropic';
      case 'gemini': return 'Google Gemini';
      case 'github': return 'GitHub Models';
      default: return id;
    }
  }

  function renderStep() {
    if (step === 1) {
      return (
        <div>
          <h3>Select Provider</h3>
          <select value={provider} onChange={(e) => setProvider(e.target.value as ProviderChoice)}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Google Gemini</option>
            <option value="github">GitHub Models</option>
          </select>
          <div style={{ marginTop: 12 }}>
            <button data-testid="next" onClick={() => setStep(2)}>Next</button>
            <button data-testid="cancel" onClick={onClose} style={{ marginLeft: 8 }}>Cancel</button>
          </div>
        </div>
      );
    }
    if (step === 2) {
      return (
        <div>
          <h3>Enter API Key</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ width: '100%' }}
              data-testid="api-key"
            />
            <label>
              <input type="checkbox" checked={showKey} onChange={() => setShowKey(!showKey)} /> Show
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setStep(1)}>Back</button>
            <button
              onClick={() => {
                setTesting(true);
                setTestError(null);
                window.vscode?.postMessage({ type: 'provider:test', providerId: provider, apiKey });
              }}
              style={{ marginLeft: 8 }}
              disabled={!apiKey || testing}
              data-testid="test"
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            <button onClick={onClose} style={{ marginLeft: 8 }}>Cancel</button>
          </div>
          {testError && <div style={{ color: 'red', marginTop: 8 }}>{testError}</div>}
        </div>
      );
    }
    if (step === 3) {
      // Reserved for future intermediate steps if needed
      return null;
    }
    // step === 4
    const name = toName(provider);
    return (
      <div>
        <h3>Confirm & Save</h3>
        <p>Provider: <strong>{name}</strong></p>
        <p>API key looks valid. Save credentials to SecretStorage?</p>
        <div style={{ marginTop: 12 }}>
          <button onClick={() => setStep(2)}>Back</button>
          <button
            onClick={() => {
              setSaving(true);
              setSaveError(null);
              window.vscode?.postMessage({ type: 'provider:add', providerId: provider, providerName: name, apiKey });
            }}
            style={{ marginLeft: 8 }}
            disabled={saving}
            data-testid="save"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onClose} style={{ marginLeft: 8 }}>Cancel</button>
        </div>
        {saveError && <div style={{ color: 'red', marginTop: 8 }}>{saveError}</div>}
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)' }}>
      <div style={{ width: 520, margin: '10% auto', background: 'white', padding: 16, borderRadius: 6, boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
        <h2 style={{ marginTop: 0 }}>Add Provider</h2>
        {renderStep()}
      </div>
    </div>
  );
}
