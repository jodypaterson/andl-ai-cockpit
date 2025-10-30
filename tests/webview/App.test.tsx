import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import App from '../../webview/src/App';

// Load schema from source for the hydration message
import { readFileSync } from 'node:fs';
import path from 'node:path';

function delay(ms = 0) {
  return new Promise((res) => setTimeout(res, ms));
}

describe('webview App', () => {
  it('renders GlobalToolbar after receiving config:hydrate', async () => {
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

    // Wait briefly then expect toolbar content to exist
    await act(async () => { await delay(20); });
    expect(container.textContent).toContain('AI Config');
  });
});
