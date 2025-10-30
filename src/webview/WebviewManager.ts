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
        if (msg?.type === 'config:apply') {
          // Optional: persist whole config (not primary for AT-05)
          // Kept no-op to avoid altering broader behavior in this AT.
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
      `style-src ${webview.cspSource} 'nonce-${nonce}'`,
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
