import * as vscode from 'vscode';
import { WebviewManager } from './webview/WebviewManager.js';

export async function activate(context: vscode.ExtensionContext) {
  const manager = new WebviewManager(context);
  const disposable = vscode.commands.registerCommand('andl.ai.cockpit.open', async () => {
    await manager.show();
  });
  context.subscriptions.push(disposable);
}

export function deactivate() {
  // noop for now
}
