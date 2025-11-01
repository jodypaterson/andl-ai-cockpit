// Migrated ProvidersGroup (AT-P2.M4-09)
import React from 'react';
import GroupCard from '../GroupCard.js';
import { hostBridge } from '../../messaging/hostBridge.js';
import { configStore } from '../../state/configStore.js';

export interface ProviderStatus {
  hasAuth?: boolean;
  hasGitHubAuth?: boolean;
  modelsAvailable?: boolean;
  usable?: boolean;
  keyLength?: number;
  source?: string;
}

export interface ProvidersGroupProps {
  executionMode: string;
  appliedExecutionMode: string;
  onApplyExecutionMode: (mode: string) => void;
  onExecutionModeChange?: (mode: string) => void;
  models: Array<{ id?: string; provider?: string; source?: string } | string>;
  modelsLoading?: boolean;
  providerStatuses: Record<string, ProviderStatus> | any;
  providerCreds: any;
  groupDirty: boolean;
}

function postVsMessage(message: any) {
  try {
    const acquire: any = (globalThis as any).acquireVsCodeApi;
    const api = (globalThis as any).__vscodeApi || (typeof acquire === 'function' ? acquire() : undefined);
    if (api && !(globalThis as any).__vscodeApi) { (globalThis as any).__vscodeApi = api; }
    api?.postMessage?.(message);
  } catch {}
}

const canonicalProvider = (value: string): string => {
  const raw = (value || '').toLowerCase().trim();
  if (!raw) return raw;
  const base = raw.split(/[\/:]/)[0] || raw;
  if (base === 'google' || base === 'googleai' || base === 'vertexai') return 'gemini';
  if (base === 'github-models' || base === 'gh-models' || base === 'gh') return 'github';
  return base;
};

function badgeForModelSource(src?: string) {
  if (!src) return null;
  if (src === 'primary' || src === 'static') return null;
  const color = src === 'dynamic' ? 'var(--vscode-gitDecoration.addedResourceForeground)'
    : src === 'diagnostics' ? 'var(--vscode-charts-yellow)'
    : src === 'fallback' ? 'var(--vscode-errorForeground)'
    : src === 'cache' ? 'var(--vscode-descriptionForeground)'
    : 'var(--vscode-descriptionForeground)';
  const title = src === 'dynamic' ? 'Live enumerated'
    : src === 'diagnostics' ? 'Diagnostic-derived'
    : src === 'fallback' ? 'Fallback baseline'
    : src === 'cache' ? 'From cache'
    : src;
  return <span style={{ fontSize:10, padding:'1px 4px', borderRadius:4, background:'var(--vscode-editor-inactiveSelectionBackground)', color }} title={title}>{src}</span>;
}

export const ProvidersGroup: React.FC<ProvidersGroupProps> = ({
  executionMode,
  appliedExecutionMode,
  onApplyExecutionMode,
  onExecutionModeChange,
  models,
  modelsLoading,
  providerStatuses,
  providerCreds,
  groupDirty,
}) => {
  const [verbose, setVerbose] = React.useState<boolean>(() => {
    try {
      const persisted = (globalThis as any).localStorage?.getItem?.('andl.ai.providers.verbose');
      if (persisted === '1' || persisted === 'true') return true;
      if (persisted === '0' || persisted === 'false') return false;
      return !!(globalThis as any).__andlDebugVerbose;
    } catch { return false; }
  });
  React.useEffect(() => {
    try { (globalThis as any).__andlDebugVerbose = !!verbose; } catch {}
    try { if ((globalThis as any).__andlDebugVerbose) console.log('[BUG-010][Providers][VERBOSE] Verbose logging', { verbose }); } catch {}
    try { postVsMessage({ type: 'debug:verbose:set', value: !!verbose, scope: 'providers' }); } catch {}
    try { (globalThis as any).localStorage?.setItem?.('andl.ai.providers.verbose', verbose ? '1' : '0'); } catch {}
  }, [verbose]);

  const [showAddModal, setShowAddModal] = React.useState(false);
  const [modalProvider, setModalProvider] = React.useState('openai');
  const [modalBaseUrl, setModalBaseUrl] = React.useState('');
  const [modalApiKey, setModalApiKey] = React.useState('');
  const [modalError, setModalError] = React.useState<string|undefined>();

  const submitAddProvider = React.useCallback(() => {
    try {
      console.log('[ProvidersGroup] submitAddProvider called: provider=%s, keyLength=%d, baseUrl=%s', modalProvider, (modalApiKey||'').length, modalBaseUrl);
      setModalError(undefined);
      const name = (modalProvider || '').trim();
      const apiKey = (modalApiKey || '').trim();
      const baseUrl = (modalBaseUrl || '').trim();
      if (!name) { setModalError('Provider is required'); return; }
      if (!apiKey) { setModalError('API key is required'); return; }
      const canonicalName = canonicalProvider(name);
      const payload: any = { [canonicalName]: apiKey };
      if (baseUrl) { payload[`${canonicalName}-base-url`] = baseUrl; }
      (hostBridge as any)['postMessage']?.({ type: 'ai:providerCreds:update', creds: payload });
      setShowAddModal(false);
      (hostBridge as any)['postMessage']?.({ type: 'ai:models:list', reason: 'add-provider-modal' });
      setModalProvider('openai'); setModalApiKey(''); setModalBaseUrl('');
    } catch (err) {
      console.error('[ProvidersGroup] submitAddProvider error:', err);
      setModalError(String(err));
    }
  }, [modalProvider, modalApiKey, modalBaseUrl]);

  const normalized = React.useMemo(() => models.map(m => typeof m === 'string'
    ? { id: m, provider: (m.includes('/')? m.split('/')[0]: 'unknown') }
    : m), [models]);

  React.useEffect(() => {
    try {
      if (!(globalThis as any).__andlDebugVerbose) return;
      const ids = normalized.map(m => m.id).filter(Boolean);
      console.log('[BUG-010][Providers][VERBOSE] models changed', {
        count: ids.length,
        sample: ids.slice(0, 5),
      });
    } catch {}
  }, [normalized.map(m=>m.id).join('|')]);

  const grouped = React.useMemo(() => {
    const map: Record<string, { models: any[] }> = {};
    for (const m of normalized) {
      const rawProv = (m.provider || (m.id?.split('/')?.[0]) || 'unknown');
      const prov = canonicalProvider(rawProv);
      (map[prov] ||= { models: [] }).models.push({ ...m, provider: prov });
    }
    try {
      if ((globalThis as any).__andlDebugVerbose) {
        const counts: Record<string, number> = {}; Object.keys(map).forEach(k=>counts[k]=map[k].models.length);
        console.log('[ProvidersGroup][DBG] grouped models by provider', counts);
      }
    } catch {}
    return map;
  }, [normalized]);

  const providerStatusMap = React.useMemo(() => {
    const map: Record<string, ProviderStatus> = {};
    if (providerStatuses && typeof providerStatuses === 'object') {
      for (const [key, value] of Object.entries(providerStatuses)) {
        if (!value) continue;
        map[canonicalProvider(key)] = value as ProviderStatus;
      }
    }
    return map;
  }, [providerStatuses]);

  const order = ['openai','anthropic','gemini','github','copilot','local','stub'];
  const editableMode = executionMode;
  const dirtyExecMode = appliedExecutionMode !== editableMode;
  const lengths = providerCreds.__lengths || {};
  const secretMode = !!providerCreds.__secretStorage;

  const loginCopilot = React.useCallback(() => {
    try { postVsMessage({ type: 'ai:provider:github:login', reason: 'providers-tab' }); } catch {}
  }, []);

  const providerCredsLoaded = !!providerCreds.__loaded;
  const providerLabels: Record<string, string> = {
    openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Google Gemini', github: 'GitHub Models', local: 'Local', stub: 'Stub'
  };

  const connectedProviders = React.useMemo(() => {
    const entries: Array<{ id: string; label: string; detail: string }> = [];
    const statusMap = providerStatusMap;
    const candidates = new Set<string>();
    for (const [id, len] of Object.entries(lengths)) {
      if (typeof len === 'number' && len > 0) { candidates.add(id); }
    }
    for (const [id, value] of Object.entries(providerCreds)) {
      if (id.startsWith('__')) continue;
      const len = lengths[id] ?? (value ? String(value).length : 0);
      if (len && len > 0) { candidates.add(id); }
    }
    candidates.forEach(id => {
      const length = lengths[id] ?? (providerCreds[id] ? String(providerCreds[id]).length : 0);
      if (!Number.isFinite(length) || length <= 0) return;
      const label = providerLabels[id] || (id.charAt(0).toUpperCase() + id.slice(1));
      const status = statusMap[id];
      const source = status?.source || (secretMode ? 'secret' : 'settings');
      const sourceLabel = source === 'secret' ? 'Secret storage' : source === 'settings' ? 'User settings' : (secretMode ? 'Secret storage' : 'User settings');
      const detail = `${length} chars • ${sourceLabel}`;
      entries.push({ id, label, detail });
    });
    return entries.sort((a, b) => a.label.localeCompare(b.label));
  }, [providerCreds, providerStatusMap, secretMode]);

  const copilotInfo = providerStatusMap['copilot'];
  const copilotAuthed = !!copilotInfo?.hasGitHubAuth;
  const copilotUsable = !!copilotInfo?.usable;
  const connectedList = React.useMemo(() => {
    const items = [...connectedProviders];
    if (copilotAuthed) {
      const label = 'GitHub Copilot';
      const detail = copilotUsable ? 'Signed in • models available' : 'Signed in';
      items.push({ id: 'copilot', label, detail });
    }
    return items;
  }, [connectedProviders, copilotAuthed, copilotUsable]);

  const rows: React.ReactNode[] = [];
  let displayedModelCount = 0;
  const copilotStatus = copilotInfo;
  for (const p of order) {
    if (!grouped[p]) continue;
    const pp = canonicalProvider(p);
    const status = providerStatusMap[pp];
    const hasAuth = p === 'copilot'
      ? !!status?.hasGitHubAuth
      : (!!status?.hasAuth || (lengths[pp] && lengths[pp] > 0));
    const provModels = grouped[p].models;
    rows.push(
      <li key={p+':hdr'} style={{ marginTop: rows.length?12:0, padding:'4px 6px', background:'var(--vscode-editor-inactiveSelectionBackground)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontWeight:600, fontSize:12 }}>{p.toUpperCase()}</span>
        {p === 'copilot' ? (() => {
          const usable = !!status?.usable;
          const hasGh = !!status?.hasGitHubAuth;
          const modelsAvail = !!status?.modelsAvailable;
          const label = usable ? 'ok' : (!hasGh ? 'sign-in' : (!modelsAvail ? 'no-models' : 'unavail'));
          const color = usable ? 'var(--vscode-testing-iconPassed)' : (!hasGh ? 'var(--vscode-errorForeground)' : 'var(--vscode-inputValidation-warningForeground)');
          const title = usable ? 'Copilot usable (signed in + models)' : (!hasGh ? 'Sign in to GitHub to enable Copilot' : (!modelsAvail ? 'No Copilot models enumerated' : 'Copilot unavailable'));
          return (
            <span style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:10, padding:'1px 6px', borderRadius:12, background:'var(--vscode-editor-inactiveSelectionBackground)', color }} title={title}>{label}</span>
              {!hasGh && <button onClick={loginCopilot} style={{ fontSize:10, padding:'2px 6px' }}>Sign In…</button>}
              <button onClick={()=> { try { 
                console.log('[AI-Config][webview][Providers] refresh:provider click', { provider: p, unhideAll: true });
                hostBridge.postMessage({ type:'ai:models:refresh:provider', providerId: p, unhideAll: true, reason:'providers-refresh-provider' }); 
              } catch {} }} style={{ fontSize:10, padding:'2px 6px', marginLeft:'auto' }} title={`Restore all ${p} models`}>↻ Refresh</button>
            </span>
          );
        })() : (
          <span style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
            <span style={{ fontSize:10, padding:'1px 6px', borderRadius:12, background: hasAuth? 'var(--vscode-editor-inactiveSelectionBackground)' : 'var(--vscode-inputValidation-errorBackground)', color: hasAuth? 'var(--vscode-testing-iconPassed)' : 'var(--vscode-errorForeground)' }} title={hasAuth? (status?.source ? `API key stored (${status.source})` : 'API key present') : 'No API key set – models will not be callable'}>{hasAuth? 'key:ok':'no-key'}</span>
            <button onClick={()=> { try { 
              console.log('[AI-Config][webview][Providers] refresh:provider click', { provider: p, unhideAll: true });
              hostBridge.postMessage({ type:'ai:models:refresh:provider', providerId: p, unhideAll: true, reason:'providers-refresh-provider' }); 
            } catch {} }} style={{ fontSize:10, padding:'2px 6px', marginLeft:'auto' }} title={`Restore all ${p} models`}>↻ Refresh</button>
          </span>
        )}
      </li>
    );
    for (const m of provModels) {
      const id = m.id || '';
      const provider = (m.provider || id.split('/')?.[0] || '').toLowerCase();
      rows.push(
        <li key={id} className="andl-model-row" style={{ fontSize:12, display:'flex', alignItems:'center', gap:8, padding:'2px 4px', borderBottom:'1px solid var(--vscode-editorGroup-border)', position:'relative' }}
          onMouseEnter={() => { try { console.log('[ProvidersGroup][DBG] hover enter row', id); } catch {} }}
          onMouseLeave={() => { try { console.log('[ProvidersGroup][DBG] hover leave row', id); } catch {} }}
        >
          <span style={{ flex:1 }}>{id}</span>
          {provider === 'copilot' && copilotStatus && (()=>{ const s = copilotStatus; const usable = !!s.usable; const hasAuth = !!s.hasGitHubAuth; const icon = usable? '✓': (hasAuth? '!':'↪'); const color = usable? 'var(--vscode-testing-iconPassed)' : (hasAuth? 'var(--vscode-inputValidation-warningForeground)':'var(--vscode-errorForeground)'); const title = usable? 'Copilot usable': (hasAuth? 'Copilot models not available':'Sign in to GitHub'); return <span title={title} style={{ color, fontSize:12, lineHeight:1 }}>{icon}</span>; })()}
          {badgeForModelSource(m.source)}
          <button
            type="button"
            className="andl-trash-btn"
            aria-label={`Exclude model ${id}`}
            onClick={()=> {
              try {
                const st = configStore.getState();
                const vis: string[] = Array.isArray(st.working?.providers?.models) ? st.working!.providers!.models as any : [];
                const beforeHas = vis.includes(id);
                const beforeCount = vis.length;
                console.log('[ProvidersGroup][DBG] trash click', { id, beforeHas, beforeCount });
                if (!beforeHas) {
                  try { hostBridge.postMessage({ type:'notify', level:'info', message:`${id} was already removed (pending sync).` }); } catch {}
                } else {
                  const next = vis.filter(v => v !== id);
                  configStore.update(['providers','models'], next);
                  const afterCount = next.length;
                  console.log('[ProvidersGroup][DBG] optimistic exclude applied', { id, afterCount });
                }
                hostBridge.postMessage({ type:'ai:models:exclude', modelId: id, reason:'trash-icon' });
              } catch (e) {
                console.error('[ProvidersGroup][ERR] exclude click handler failed', e);
              }
            }}
            style={{ fontSize:11, padding:'1px 4px', background:'transparent', border:'none', cursor:'pointer', position:'relative', zIndex:1 }}
            title="Exclude this model from list"
          >
            🗑
          </button>
        </li>
      );
      displayedModelCount++;
    }
  }

  if (modelsLoading) {
    rows.push(<li key="loading" style={{ fontSize:12, opacity:0.8, padding:'6px 6px' }} data-testid="models-loading-spinner">Loading models…</li>);
  } else if (!rows.length) {
    rows.push(<li key="none" style={{ fontSize:12, opacity:0.6, padding:'4px 6px' }}>No models enumerated (add keys & refresh)</li>);
  }

  return (
    <>
    <style>{`
      .andl-model-row .andl-trash-btn { opacity: 0; pointer-events: none; transition: opacity 80ms linear; }
      .andl-model-row:hover .andl-trash-btn, .andl-model-row:focus-within .andl-trash-btn { opacity: 0.9; pointer-events: auto; }
      .andl-model-row .andl-trash-btn:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
    `}</style>
    <GroupCard
      title="Providers"
      description="Execution mode, model discovery, visibility (hide unused), and provider credentials."
      dirty={groupDirty}
    >
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, minHeight:'60vh' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:16, minHeight:0 }}>
          <section>
            <h4 style={{ margin:'0 0 6px' }}>Execution Mode</h4>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <select value={editableMode} onChange={e=> (onExecutionModeChange? onExecutionModeChange((e.target as HTMLSelectElement).value): onApplyExecutionMode((e.target as HTMLSelectElement).value))} style={{ background:'var(--vscode-input-background)', color:'var(--vscode-foreground)', border:'1px solid var(--vscode-input-border)', padding:'2px 6px', borderRadius:4 }}>
                <option value="stub">Stub</option>
                <option value="dry-run">Dry Run</option>
                <option value="live">Live</option>
              </select>
              <button disabled={!dirtyExecMode} onClick={()=> onApplyExecutionMode(editableMode)}>Apply</button>
              {!dirtyExecMode && <span style={{ fontSize:10, opacity:0.6 }}>Applied</span>}
            </div>
            <p style={{ fontSize:11, opacity:0.7, margin:'4px 0 0' }}>Stub = offline; Live = real provider calls.</p>
          </section>
          <section style={{ display:'flex', flexDirection:'column', flexGrow:1, minHeight:0 }}>
            <h4 style={{ margin:'0 0 6px', display:'flex', alignItems:'center', gap:12 }}>Models ({displayedModelCount})
              <label style={{ marginLeft:'auto', fontSize:11, display:'inline-flex', alignItems:'center', gap:6 }} title="Toggle verbose debug logging for Providers">
                <input type="checkbox" checked={!!verbose} onChange={(e)=> setVerbose((e.target as HTMLInputElement).checked)} /> Verbose logs
              </label>
            </h4>
            <ul
              style={{ listStyle:'none', margin:0, padding:0, flexGrow:1, minHeight:0, overflowY:'auto', border:'1px solid var(--vscode-editorWidget-border)', borderRadius:4 }}
              aria-label="Model list"
            >
              {rows}
            </ul>
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button style={{ fontSize:11 }} onClick={()=> { try { postVsMessage({ type:'ai:models:list', reason:'providers-refresh-button' }); } catch {} }}>Refresh All Models</button>
            </div>
            <div style={{ marginTop:6, fontSize:10, opacity:0.65, lineHeight:1.4 }}>
              Click the trash icon (🗑) next to a model to exclude it from the list. Use the provider's Refresh button to restore all models for that provider.
              If new providers were just added, you may need to refresh enumeration (switch tabs or run <code>ANDL: Refresh Models</code> command) to see them.
            </div>
          </section>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <section>
            <h4 style={{ margin:'0 0 6px' }}>Connected Providers</h4>
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <button onClick={()=> setShowAddModal(true)} style={{ fontSize:11 }}>Add Provider…</button>
            </div>
            {!providerCredsLoaded && <div style={{ fontSize:11, opacity:0.6 }}>Loading provider credentials…</div>}
            {providerCredsLoaded && connectedList.length === 0 && (
              <div style={{ fontSize:11, opacity:0.6 }}>No provider keys detected yet.</div>
            )}
            {providerCredsLoaded && connectedList.length > 0 && (
              <ul style={{ listStyle:'none', margin:0, padding:0 }}>
                {connectedList.map(provider => (
                  <li key={provider.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 6px', borderBottom:'1px solid var(--vscode-editorWidget-border)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
                      <span style={{ fontWeight:500 }}>{provider.label}</span>
                      <span style={{ fontSize:11, opacity:0.75 }}>{provider.detail}</span>
                    </div>
                    <button 
                      onClick={() => {
                        const confirmed = confirm(`Delete ${provider.label} credentials?\n\nThis will remove the API key from secure storage. You can re-add it later.`);
                        if (confirmed) {
                          try {
                            (hostBridge as any)['postMessage']?.({ 
                              type: 'ai:providerCreds:delete', 
                              providerId: provider.id 
                            });
                          } catch (e) { console.error('Failed to delete provider credentials:', e); }
                        }
                      }}
                      style={{ 
                        fontSize:10, 
                        padding:'2px 6px', 
                        background:'var(--vscode-button-secondaryBackground)', 
                        color:'var(--vscode-button-secondaryForeground)',
                        border:'1px solid var(--vscode-button-border)',
                        borderRadius:3,
                        cursor:'pointer'
                      }}
                      title={`Delete ${provider.label} credentials`}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <h4 style={{ margin:'12px 0 6px' }}>Copilot Status</h4>
            <div style={{ fontSize:11, display:'flex', alignItems:'center', gap:8 }}>
              {copilotAuthed ? (
                <span style={{ color: copilotUsable ? 'var(--vscode-testing-iconPassed)' : 'var(--vscode-inputValidation-warningForeground)' }}>
                  {copilotUsable ? 'Connected and ready' : 'Signed in, waiting for models'}
                </span>
              ) : (
                <span style={{ color: 'var(--vscode-errorForeground)' }}>GitHub sign-in required</span>
              )}
              {!copilotAuthed && <button onClick={loginCopilot} style={{ fontSize:10, padding:'2px 6px' }}>Sign In…</button>}
            </div>
          </section>
          <section>
            <h4 style={{ margin:'0 0 6px' }}>Guidance</h4>
            <ul style={{ margin:'0 0 0 16px', padding:0 }}>
              <li style={{ fontSize:11, marginBottom:4 }}>Use Stub to work fully offline.</li>
              <li style={{ fontSize:11, marginBottom:4 }}>Switch to Live only after credentials are set.</li>
              <li style={{ fontSize:11, marginBottom:4 }}>Hide noisy models you never use.</li>
              <li style={{ fontSize:11, marginBottom:4 }}>Status badges reflect provider health.</li>
            </ul>
          </section>
        </div>
      </div>
    </GroupCard>
    {showAddModal && (
      <div role="dialog" aria-modal="true" aria-label="Add Provider" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
        <div style={{ background:'var(--vscode-editor-background)', color:'var(--vscode-foreground)', border:'1px solid var(--vscode-editorWidget-border)', borderRadius:6, minWidth:360, maxWidth:520, padding:12, boxShadow:'0 6px 24px rgba(0,0,0,0.4)' }}>
          <h3 style={{ margin:'0 0 8px' }}>Add Provider</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <label style={{ display:'flex', flexDirection:'column', fontSize:12 }}>
              <span style={{ marginBottom:2 }}>Provider</span>
              <select value={modalProvider} onChange={e=> setModalProvider((e.target as HTMLSelectElement).value)} style={{ background:'var(--vscode-input-background)', border:'1px solid var(--vscode-input-border)', color:'var(--vscode-foreground)', padding:'2px 6px', borderRadius:3 }}>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Google Gemini</option>
                <option value="github">GitHub Models (keyed)</option>
                <option value="local">Local</option>
                <option value="stub">Stub</option>
              </select>
            </label>
            <label style={{ display:'flex', flexDirection:'column', fontSize:12 }}>
              <span style={{ marginBottom:2 }}>Base URL (optional)</span>
              <input type="text" value={modalBaseUrl} onChange={e=> setModalBaseUrl((e.target as HTMLInputElement).value)} placeholder={
                modalProvider === 'anthropic' ? 'https://api.anthropic.com' :
                modalProvider === 'gemini' ? 'https://generativelanguage.googleapis.com' :
                modalProvider === 'github' ? 'https://models.inference.ai.azure.com' :
                modalProvider === 'local' ? 'http://localhost:11434' :
                'https://api.openai.com'
              } style={{ background:'var(--vscode-input-background)', border:'1px solid var(--vscode-input-border)', color:'var(--vscode-foreground)', padding:'2px 6px', borderRadius:3 }} />
            </label>
            <label style={{ display:'flex', flexDirection:'column', fontSize:12 }}>
              <span style={{ marginBottom:2 }}>API Key</span>
              <input type="password" value={modalApiKey} onChange={e=> setModalApiKey((e.target as HTMLInputElement).value)} placeholder={
                modalProvider === 'anthropic' ? 'sk-ant-api03-...' :
                modalProvider === 'gemini' ? 'AIzaSy...' :
                modalProvider === 'github' ? 'github_pat_...' :
                'sk-...'
              } style={{ background:'var(--vscode-input-background)', border:'1px solid var(--vscode-input-border)', color:'var(--vscode-foreground)', padding:'2px 6px', borderRadius:3 }} />
            </label>
            {modalError && <div style={{ color:'var(--vscode-errorForeground)', fontSize:12 }}>{modalError}</div>}
          </div>
          <div style={{ display:'flex', gap:8, marginTop:12, justifyContent:'flex-end' }}>
            <button onClick={()=> setShowAddModal(false)}>Cancel</button>
            <button onClick={submitAddProvider}>Save</button>
          </div>
          <div style={{ marginTop:8, fontSize:10, opacity:0.65 }}>
            Keys are stored using VS Code Settings or Secret Storage per your configuration. We never echo keys back.
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default ProvidersGroup;
