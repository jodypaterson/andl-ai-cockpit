import { VsCodeSettingsPersistence } from '../../src/persistence/VsCodeSettingsPersistence.js';
import type * as vscode from 'vscode';

describe('VsCodeSettingsPersistence.getConfig (providers hydration)', () => {
  function mockConfig(values: Record<string, any>) {
    const inspect = (key: string) => {
      const v = values[key];
      return {
        defaultValue: undefined,
        globalValue: v?.global,
        workspaceValue: v?.workspace
      } as any;
    };
    const get = (key: string) => {
      const v = values[key];
      return (v?.workspace ?? v?.global ?? undefined);
    };
  return { inspect, get } as any;
  }

  function makeContext(secrets: Record<string, string | undefined>) {
    const ctx = {
      extensionPath: '/tmp/andl',
      secrets: {
        get: jest.fn(async (name: string) => secrets[name])
      }
    } as unknown as vscode.ExtensionContext;
    return ctx;
  }

  beforeEach(() => {
    jest.resetModules();
  });

  it('returns minimal config when no settings exist', async () => {
    jest.doMock('vscode', () => ({
      workspace: {
        getConfiguration: () => mockConfig({})
      }
    }), { virtual: true });
    const { VsCodeSettingsPersistence: Impl } = await import('../../src/persistence/VsCodeSettingsPersistence.js');
    const p = new Impl(makeContext({}));
    const cfg = await p.getConfig();
    expect(cfg.providers).toEqual([]);
    expect(cfg.memory).toEqual({});
  });

  it('hydrates providers from workspace settings and marks apiKeySecret when secret exists', async () => {
    jest.doMock('vscode', () => ({
      workspace: {
        getConfiguration: () => mockConfig({
          providers: { workspace: [ { id: 'openai', name: 'OpenAI' }, { id: 'anthropic', name: 'Anthropic' } ] }
        })
      }
    }), { virtual: true });
    const { VsCodeSettingsPersistence: Impl } = await import('../../src/persistence/VsCodeSettingsPersistence.js');
    const p = new Impl(makeContext({ 'andl-ai-openai-key': 'abc123' }));
    const cfg = await p.getConfig();
    const openai = cfg.providers.find(p => p.id === 'openai')! as any;
    const anthropic = cfg.providers.find(p => p.id === 'anthropic')! as any;
    expect(openai.apiKeySecret).toBe('andl-ai-openai-key');
    expect(anthropic.apiKeySecret).toBeUndefined();
  });

  it('falls back to user/global settings when workspace value absent', async () => {
    jest.doMock('vscode', () => ({
      workspace: {
        getConfiguration: () => mockConfig({
          providers: { global: [ { id: 'gemini', name: 'Google Gemini' } ] }
        })
      }
    }), { virtual: true });
    const { VsCodeSettingsPersistence: Impl } = await import('../../src/persistence/VsCodeSettingsPersistence.js');
    const p = new Impl(makeContext({}));
    const cfg = await p.getConfig();
    expect(cfg.providers.map(p => p.id)).toEqual(['gemini']);
  });
});
