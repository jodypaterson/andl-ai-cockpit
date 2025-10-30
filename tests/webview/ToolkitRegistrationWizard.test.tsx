import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { ToolkitRegistrationWizard } from '../../webview/src/ToolkitRegistrationWizard';

declare global { interface Window { vscode?: { postMessage: (msg: any) => void } } }

describe('ToolkitRegistrationWizard', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    (window as any).vscode = { postMessage: jest.fn() };
  });

  it('enumerates and registers tools via messaging', async () => {
    const container = document.getElementById('root')!;
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ToolkitRegistrationWizard
          providers={[{ id: 'openai', name: 'OpenAI' }]}
          existingIds={[]}
          onClose={() => {}}
          onRegistered={() => {}}
        />
      );
      // allow first paint
      await Promise.resolve();
    });

    // Step 1: select provider and Next
    const provCb = container.querySelector('input[data-testid="prov-openai"]') as HTMLInputElement | null;
    expect(provCb).not.toBeNull();
    await act(async () => {
      provCb!.click();
    });

    // Wait until Next is enabled (React state update)
    let next1 = container.querySelector('button[data-testid="next"]') as HTMLButtonElement | null;
    expect(next1).not.toBeNull();
    for (let i = 0; i < 5 && next1!.disabled; i++) {
      await new Promise(r => setTimeout(r, 0));
      next1 = container.querySelector('button[data-testid="next"]') as HTMLButtonElement | null;
    }
    expect(next1!.disabled).toBe(false);
    await act(async () => { next1!.click(); });

    // Step 2: click Enumerate (posts message)
    const enumerateBtn = container.querySelector('button[data-testid="enumerate"]') as HTMLButtonElement | null;
    expect(enumerateBtn).not.toBeNull();
    await act(async () => { enumerateBtn!.click(); await Promise.resolve(); });

    expect(window.vscode?.postMessage).toHaveBeenCalledWith({ type: 'toolkit:enumerate', providerIds: ['openai'] });

    // Simulate host response with two tools
    const tools = [
      { id: 'openai:status', name: 'OpenAI: Status', description: 'Probe', provider: 'openai' },
      { id: 'openai:list-models', name: 'OpenAI: List Models', description: 'List', provider: 'openai' }
    ];
    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'toolkit:enumerate:result', tools } }));
    });

    // Step 3: select one tool and go Next
    const toolCb = container.querySelector('input[data-testid="tool-openai:list-models"]') as HTMLInputElement | null;
    expect(toolCb).not.toBeNull();
    await act(async () => {
      toolCb!.click();
    });

    let next2 = container.querySelector('button[data-testid="next"]') as HTMLButtonElement | null;
    expect(next2).not.toBeNull();
    for (let i = 0; i < 5 && next2!.disabled; i++) {
      await new Promise(r => setTimeout(r, 0));
      next2 = container.querySelector('button[data-testid="next"]') as HTMLButtonElement | null;
    }
    expect(next2!.disabled).toBe(false);
    await act(async () => { next2!.click(); });

    // Step 4: no duplicates; Next
    const next3 = container.querySelector('button[data-testid="next"]') as HTMLButtonElement | null;
    expect(next3).not.toBeNull();
    await act(async () => { next3!.click(); await Promise.resolve(); });

    // Step 5: save; posts toolkit:register
    const saveBtn = container.querySelector('button[data-testid="save"]') as HTMLButtonElement | null;
    expect(saveBtn).not.toBeNull();
    await act(async () => { saveBtn!.click(); });

    expect((window as any).vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'toolkit:register',
    }));
  });
});
