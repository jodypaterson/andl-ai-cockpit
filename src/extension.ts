import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('andl.ai.cockpit.open', async () => {
    vscode.window.showInformationMessage('ANDL AI Cockpit activated. Configuration hub coming soon.');
  });
  context.subscriptions.push(disposable);
}

export function deactivate() {
  // noop for now
}
