import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

// Mock rjsf to provide a save button that triggers onSubmit with sample data
jest.mock('@rjsf/core', () => ({
  __esModule: true,
  default: (props: any) => {
    const React = require('react');
    return React.createElement(
      'form',
      { 'data-testid': 'memory-form', onSubmit: (e: any) => { e.preventDefault(); props.onSubmit?.({ formData: { stm: { capacity: 50 }, ltm: { enabled: true, vectorStore: 'default' }, rag: { enabled: false, indexName: 'project-index' } } }); } },
      React.createElement('button', { type: 'submit', 'data-testid': 'save-memory' }, 'Save')
    );
  }
}));
jest.mock('@rjsf/validator-ajv8', () => ({ __esModule: true, default: {} }));

declare global { interface Window { vscode?: { postMessage: (msg: any) => void } } }

import { MemoryEditor } from '../../webview/src/MemoryEditor';

describe('MemoryEditor', () => {
  beforeEach(() => {
    window.vscode = { postMessage: jest.fn() } as any;
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('posts config:apply with updated memory on save', async () => {
    const container = document.getElementById('root')!;
    const root = createRoot(container);

    const schema = { properties: { memory: { type: 'object', properties: { stm: { type: 'object', properties: { capacity: { type: 'integer' } } } } } } } as any;
    const rootConfig = { memory: { stm: { capacity: 20 } } } as any;

    await act(async () => {
      root.render(<MemoryEditor schema={schema} rootConfig={rootConfig} onClose={() => {}} onSaved={() => {}} />);
    });

    const save = container.querySelector('[data-testid="save-memory"]') as HTMLButtonElement;
    expect(save).toBeTruthy();
    await act(async () => { save.click(); });

    expect(window.vscode!.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'config:apply', config: expect.objectContaining({ memory: expect.objectContaining({ stm: expect.objectContaining({ capacity: 50 }) }) }) }));
  });
});
