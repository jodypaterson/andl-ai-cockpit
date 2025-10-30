import * as vscode from 'vscode';
import { VsCodeSettingsPersistence } from '../persistence/VsCodeSettingsPersistence.js';

export class WebviewManager {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async show(): Promise<void> {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'andlAiConfig',
        'ANDL AI Configuration',
        vscode.ViewColumn.Active,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [this.context.extensionUri]
        }
      );
      this.panel.onDidDispose(() => { this.panel = undefined; });
      this.panel.webview.html = await this.renderHtml(this.panel.webview);
    } else {
      this.panel.reveal(vscode.ViewColumn.Active);
    }
    // Hydrate after show
    const persistence = new VsCodeSettingsPersistence(this.context);
    const schema = await persistence.getSchema();
    const config = await persistence.getConfig();
    this.panel!.webview.postMessage({ type: 'config:hydrate', schema, config });

    // Wire message handlers once per panel creation
    this.panel!.webview.onDidReceiveMessage(async (msg) => {
      const webview = this.panel!.webview;
      try {
        // Debug verbosity toggle (no-op placeholder)
        if (msg?.type === 'debug:verbose:set') {
          // Intentionally no-op; UI controls its own verbosity. Kept for protocol compatibility.
        }
        // Provider credential updates from ProvidersGroup modal
        if (msg?.type === 'ai:providerCreds:update') {
          const creds = (msg && typeof msg === 'object') ? (msg.creds || {}) : {};
          try {
            for (const [key, value] of Object.entries(creds)) {
              if (!value) continue;
              const k = String(key);
              if (k.endsWith('-base-url')) {
                // Persist optional base URL under providers.baseUrls.<provider>
                const baseProvider = k.replace(/-base-url$/, '');
                const cfg = vscode.workspace.getConfiguration('andl.ai');
                const prev = (cfg.get<any>('providers') ?? {});
                const baseUrls = { ...(prev.baseUrls || {}) };
                baseUrls[baseProvider] = String(value);
                await cfg.update('providers', { ...prev, baseUrls }, vscode.ConfigurationTarget.Global);
              } else {
                // Treat as API key secret
                const providerId = k;
                const secretName = `andl-ai-${providerId}-key`;
                await this.context.secrets.store(secretName, String(value));
                const cfg = vscode.workspace.getConfiguration('andl.ai');
                const prev = (cfg.get<any>('providers') ?? {});
                const credentials = { ...(prev.credentials || {}) };
                credentials[providerId] = secretName;
                await cfg.update('providers', { ...prev, credentials }, vscode.ConfigurationTarget.Global);
              }
            }
          } catch (e) {
            console.warn('[ANDL][providerCreds:update] Failed to persist creds', e);
          }
          // Rehydrate after updates
          const persistence2 = new VsCodeSettingsPersistence(this.context);
          const schema2 = await persistence2.getSchema();
          const config2 = await persistence2.getConfig();
          webview.postMessage({ type: 'config:hydrate', schema: schema2, config: config2 });
        }
        if (msg?.type === 'ai:models:list') {
          // Trigger rehydrate; model enumeration is handled elsewhere or mocked for now
          const persistence2 = new VsCodeSettingsPersistence(this.context);
          const schema2 = await persistence2.getSchema();
          const config2 = await persistence2.getConfig();
          webview.postMessage({ type: 'config:hydrate', schema: schema2, config: config2 });
        }
        if (msg?.type === 'ai:models:refresh:provider') {
          // Clear explicit visibility filters to "unhide all" models for provider
          try {
            const provId = String(msg.providerId || '').trim();
            const cfg = vscode.workspace.getConfiguration('andl.ai');
            const providers = (cfg.get<any>('providers') ?? {});
            // If a visible models list exists, drop provider-specific filters by clearing the list
            if (Array.isArray(providers.models)) {
              await cfg.update('providers', { ...providers, models: [] }, vscode.ConfigurationTarget.Global);
            }
          } catch (e) {
            console.warn('[ANDL][models:refresh:provider] Failed to refresh provider', e);
          }
          const persistence2 = new VsCodeSettingsPersistence(this.context);
          const schema2 = await persistence2.getSchema();
          const config2 = await persistence2.getConfig();
          webview.postMessage({ type: 'config:hydrate', schema: schema2, config: config2 });
        }
        if (msg?.type === 'ai:models:exclude') {
          try {
            const modelId = String(msg.modelId || '').trim();
            if (modelId) {
              const cfg = vscode.workspace.getConfiguration('andl.ai');
              const providers = (cfg.get<any>('providers') ?? {});
              const current: string[] = Array.isArray(providers.models) ? providers.models.slice() : [];
              const next = current.includes(modelId) ? current : [...current, modelId].filter((m) => m !== modelId);
              const filtered = next.filter((m) => m !== modelId);
              await cfg.update('providers', { ...providers, models: filtered }, vscode.ConfigurationTarget.Global);
            }
          } catch (e) {
            console.warn('[ANDL][models:exclude] Failed to exclude model', e);
          }
          const persistence2 = new VsCodeSettingsPersistence(this.context);
          const schema2 = await persistence2.getSchema();
          const config2 = await persistence2.getConfig();
          webview.postMessage({ type: 'config:hydrate', schema: schema2, config: config2 });
        }
        if (msg?.type === 'provider:test') {
          const { providerId, apiKey } = msg;
          // For AT-05: mock validation (non-empty key). Real HTTP checks deferred to AT-06.
          const ok = typeof apiKey === 'string' && apiKey.trim().length > 0 && typeof providerId === 'string' && providerId.trim().length > 0;
          webview.postMessage({ type: 'provider:test:result', ok, error: ok ? undefined : 'API key required.' });
        }
        if (msg?.type === 'provider:add') {
          const { providerId, providerName, apiKey } = msg;
          if (!providerId || !providerName || !apiKey) {
            webview.postMessage({ type: 'provider:add:error', error: 'Missing provider id/name or API key.' });
            return;
          }
          const secretName = `andl-ai-${providerId}-key`;
          await this.context.secrets.store(secretName, String(apiKey));
          // Update providers list in settings
          const cfg = vscode.workspace.getConfiguration('andl.ai');
          const existing = (cfg.get<any[]>('providers') ?? []).filter(Boolean);
          const updated = [...existing.filter(p => p?.id !== providerId), { id: providerId, name: providerName }];
          await cfg.update('providers', updated, vscode.ConfigurationTarget.Global);
          // Rehydrate after successful save
          const persistence = new VsCodeSettingsPersistence(this.context);
          const schema = await persistence.getSchema();
          const config = await persistence.getConfig();
          webview.postMessage({ type: 'provider:add:success', providerId, apiKeySecret: secretName });
          webview.postMessage({ type: 'config:hydrate', schema, config });
        }
        // Unified apply handlers from extracted UI library and legacy flows
        if (msg?.type === 'config:apply:hybrid' || msg?.type === 'settings:apply:v2') {
          const payload = (msg && typeof msg === 'object') ? (msg.payload ?? msg.config ?? undefined) : undefined;
          if (payload && typeof payload === 'object') {
            const cfg = vscode.workspace.getConfiguration('andl.ai');
            // Persist each top-level key found in payload
            // e.g., { memory: {...}, providers: {...}, toolkit: {...}, prompt: {...} }
            for (const [key, value] of Object.entries(payload)) {
              try {
                await cfg.update(key, value, vscode.ConfigurationTarget.Global);
              } catch (e) {
                // Non-fatal per-key; surface in console and continue
                console.warn(`[ANDL][settings-apply] Failed to update andl.ai.${key}:`, e);
              }
            }
          }
          // Rehydrate after apply
          const persistence2 = new VsCodeSettingsPersistence(this.context);
          const schema2 = await persistence2.getSchema();
          const config2 = await persistence2.getConfig();
          webview.postMessage({ type: 'config:hydrate', schema: schema2, config: config2 });
        }
        if (msg?.type === 'config:apply') {
          // Persist memory section if present (AT-07 scope)
          const cfg = vscode.workspace.getConfiguration('andl.ai');
          const next = (msg && typeof msg === 'object') ? msg.config : undefined;
          if (next && typeof next === 'object' && next.memory) {
            await cfg.update('memory', next.memory, vscode.ConfigurationTarget.Global);
          }
          // Rehydrate after apply
          const persistence2 = new VsCodeSettingsPersistence(this.context);
          const schema2 = await persistence2.getSchema();
          const config2 = await persistence2.getConfig();
          webview.postMessage({ type: 'config:hydrate', schema: schema2, config: config2 });
        }
        // Execution mode immediate apply notifications (support both :set and :change)
        if (msg?.type === 'ai:executionMode:set' || msg?.type === 'ai:executionMode:change') {
          const mode = String(msg.value ?? msg.mode ?? '').trim();
          if (mode) {
            const cfg = vscode.workspace.getConfiguration('andl.ai');
            const providers = cfg.get<any>('providers') ?? {};
            await cfg.update('providers', { ...providers, executionMode: mode }, vscode.ConfigurationTarget.Global);
          }
          // Rehydrate so UI reflects applied execution mode
          const persistence2 = new VsCodeSettingsPersistence(this.context);
          const schema2 = await persistence2.getSchema();
          const config2 = await persistence2.getConfig();
          webview.postMessage({ type: 'config:hydrate', schema: schema2, config: config2 });
        }
        if (msg?.type === 'toolkit:enumerate') {
          const providerIds: string[] = Array.isArray(msg.providerIds) ? msg.providerIds : [];
          // For AT-06: mock discovery; real HTTP OpenAPI parsing deferred
          const discovered = providerIds.flatMap((pid) => ([
            { id: `${pid}:status`, name: `${prettyName(pid)}: Status`, description: 'Provider status probe', provider: pid },
            { id: `${pid}:list-models`, name: `${prettyName(pid)}: List Models`, description: 'List available models', provider: pid },
          ]));
          webview.postMessage({ type: 'toolkit:enumerate:result', tools: discovered });
        }
        if (msg?.type === 'toolkit:register') {
          const tools = Array.isArray(msg.tools) ? msg.tools : [];
          const resolutions: Record<string, any> = (msg.resolutions && typeof msg.resolutions === 'object') ? msg.resolutions : {};
          const cfg = vscode.workspace.getConfiguration('andl.ai');
          const toolkit = (cfg.get<any>('toolkit') ?? {});
          const current: any[] = Array.isArray(toolkit.registeredTools) ? toolkit.registeredTools.slice() : [];
          const byId = new Map<string, any>(current.map(t => [String(t?.id ?? ''), t] as const));
          const registered: any[] = [];
          for (const t of tools) {
            if (!t || !t.id) continue;
            const id = String(t.id);
            const resolution = resolutions[id];
            const exists = byId.has(id);
            if (exists) {
              if (resolution === 'replace') {
                byId.set(id, t);
                registered.push(t);
              } else if (resolution && typeof resolution === 'object' && typeof resolution.rename === 'string' && resolution.rename) {
                const newId = String(resolution.rename);
                const renamed = { ...t, id: newId };
                byId.set(newId, renamed);
                registered.push(renamed);
              } else {
                // default: skip
              }
            } else {
              byId.set(id, t);
              registered.push(t);
            }
          }
          const nextRegistered = Array.from(byId.values());
          const nextToolkit = { ...toolkit, registeredTools: nextRegistered };
          await cfg.update('toolkit', nextToolkit, vscode.ConfigurationTarget.Global);
          // Rehydrate after success
          const persistence2 = new VsCodeSettingsPersistence(this.context);
          const schema2 = await persistence2.getSchema();
          const config2 = await persistence2.getConfig();
          webview.postMessage({ type: 'toolkit:register:success', tools: registered });
          webview.postMessage({ type: 'config:hydrate', schema: schema2, config: config2 });
        }
        // Current state request (toolbar reload and host handshake path)
        if (msg?.type === 'ai:config:current:request') {
          const persistence2 = new VsCodeSettingsPersistence(this.context);
          const schema2 = await persistence2.getSchema();
          const config2 = await persistence2.getConfig();
          webview.postMessage({ type: 'config:hydrate', schema: schema2, config: config2 });
        }
      } catch (err: any) {
        webview.postMessage({ type: 'error', error: String(err?.message ?? err ?? 'Unknown error') });
      }
    });
  }

  private async renderHtml(webview: vscode.Webview): Promise<string> {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js'));
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} https: data:`,
      `style-src ${webview.cspSource} 'nonce-${nonce}' 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`
    ].join('; ');
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ANDL AI Configuration</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}">const vscode = acquireVsCodeApi && acquireVsCodeApi();</script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

function getNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

function prettyName(id: string): string {
  switch (id) {
    case 'openai': return 'OpenAI';
    case 'anthropic': return 'Anthropic';
    case 'gemini': return 'Google Gemini';
    case 'github': return 'GitHub Models';
    default: return id;
  }
}
