import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { ProviderSetupWizard } from '../../webview/src/ProviderSetupWizard';

declare global { interface Window { vscode?: { postMessage: (msg: any) => void } } }

describe('ProviderSetupWizard', () => {
  beforeEach(() => {
    window.vscode = { postMessage: jest.fn() } as any;
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('walks through steps and posts messages', async () => {
    const container = document.getElementById('root')!;
    const root = createRoot(container);

    await act(async () => {
      root.render(<ProviderSetupWizard onClose={() => {}} onAdded={() => {}} />);
    });

    // Step 1: select provider default is openai, go next
  const nextBtn = container.querySelector('[data-testid="next"]') as HTMLButtonElement;
  expect(nextBtn).toBeTruthy();
    await act(async () => { nextBtn.click(); });

    // Step 2: enter api key and test
  const input = container.querySelector('[data-testid="api-key"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    await act(async () => {
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (desc && desc.set) {
        desc.set.call(input, 'sk-test');
      } else {
        (input as any).value = 'sk-test';
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

  const testBtn = container.querySelector('[data-testid="test"]') as HTMLButtonElement;
    await act(async () => { testBtn.click(); });
    expect(window.vscode!.postMessage).toHaveBeenCalledWith({ type: 'provider:test', providerId: 'openai', apiKey: 'sk-test' });

    // Simulate host reply success
    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'provider:test:result', ok: true } }));
    });

    // Step 4: save
  const saveBtn = container.querySelector('[data-testid="save"]') as HTMLButtonElement;
    await act(async () => { saveBtn.click(); });
    expect(window.vscode!.postMessage).toHaveBeenCalledWith({ type: 'provider:add', providerId: 'openai', providerName: 'OpenAI', apiKey: 'sk-test' });
  });
});
