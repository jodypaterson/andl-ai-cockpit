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
