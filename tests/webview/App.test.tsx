import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
// Mock rjsf to avoid heavy rendering and timing dependencies
jest.mock('@rjsf/core', () => ({
  __esModule: true,
  default: (props: any) => {
    const React = require('react');
    return React.createElement('form', { 'data-testid': 'form' });
  }
}));
jest.mock('@rjsf/validator-ajv8', () => ({ __esModule: true, default: {} }));

import App from '../../webview/src/App';

// Load schema from source for the hydration message
import { readFileSync } from 'node:fs';
import path from 'node:path';

function delay(ms = 0) {
  return new Promise((res) => setTimeout(res, ms));
}

describe('webview App', () => {
  it('renders a form after receiving config:hydrate', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById('root')!;

    const root = createRoot(container);
    await act(async () => {
      root.render(<App />);
    });

    const schemaPath = path.join(process.cwd(), 'src', 'schemas', 'ConfigSchema.json');
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, any>;

    const config = {
      providers: [],
      memory: {},
      toolkit: {},
      models: {},
      resilience: {}
    };

    // Dispatch the hydration message the App listens for
    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'config:hydrate', schema, config } }));
    });

    // Wait briefly then expect mock form to exist
  await act(async () => { await delay(20); });
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
  });
});
