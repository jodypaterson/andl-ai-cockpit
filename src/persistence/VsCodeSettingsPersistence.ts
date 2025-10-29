import * as vscode from 'vscode';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type * as Contracts from '@andl/contracts';
import { validateConfig } from '../validation/schemaValidator.js';
import type { IConfigPersistence } from './IConfigPersistence.js';

export class VsCodeSettingsPersistence implements IConfigPersistence {
  private schemaCache?: Record<string, any>;
  constructor(private readonly context: vscode.ExtensionContext) {}

  async getSchema(): Promise<Record<string, any>> {
    if (this.schemaCache) return this.schemaCache;
    const schemaPath = path.join(this.context.extensionPath, 'dist', 'schemas', 'ConfigSchema.json');
    const raw = await fs.readFile(schemaPath, 'utf-8');
    const parsed = JSON.parse(raw);
    this.schemaCache = parsed;
    return parsed;
  }

  async getConfig(): Promise<Contracts.config.ConfigSnapshot> {
    const cfg = vscode.workspace.getConfiguration('andl.ai');

    // Respect workspace-over-user precedence explicitly using inspect()
    const pick = <T>(key: string, fallback: T): T => {
      const inspected = cfg.inspect<T>(key as any) as any;
      if (inspected && typeof inspected === 'object') {
        return (inspected.workspaceValue ?? inspected.globalValue ?? inspected.defaultValue ?? fallback) as T;
      }
      return (cfg.get(key) as T) ?? fallback;
    };

    // Providers: augment with secret presence via apiKeySecret reference (no raw key exposure)
    const providersRaw = pick<any[]>('providers', []) ?? [];
    const providers: Contracts.config.ProviderConfig[] = [];
    for (const p of providersRaw) {
      if (!p || typeof p !== 'object') continue;
      const id = String(p.id ?? '').trim();
      const name = String(p.name ?? '').trim();
      if (!id || !name) continue;
      const secretRef = await this.getProviderSecretRef(id);
      const entry: Contracts.config.ProviderConfig = {
        id,
        name,
        ...(secretRef ? { apiKeySecret: secretRef } : {})
      };
      providers.push(entry);
    }

    // Other sections with safe defaults
    const memory: Contracts.config.MemoryConfig = pick('memory', {}) ?? {};
    const toolkit: Contracts.config.ToolkitConfig = pick('toolkit', {}) ?? {};
    const models: Contracts.config.ModelSelectionConfig = pick('models', {}) ?? {};
    const resilience: Contracts.config.ResilienceConfig = pick('resilience', {}) ?? {};

    return { providers, memory, toolkit, models, resilience };
  }

  /** Derive the SecretStorage reference name and return it when a secret exists. */
  private async getProviderSecretRef(providerId: string): Promise<string | undefined> {
    // Convention: andl-ai-<provider-id>-key
    const secretName = `andl-ai-${providerId}-key`;
    try {
      const val = await this.context.secrets.get(secretName);
      if (val && val.length > 0) return secretName; // expose reference only
    } catch {
      // Ignore secret access errors; treat as missing
    }
    return undefined;
  }

  async updateConfig(deltas: Contracts.config.ConfigDelta[]): Promise<Contracts.config.ConfigValidationResult> {
    // Apply deltas to current config (in-memory), validate, then persist (persistence deferred for AT-04)
    const current = await this.getConfig();
    const next = applyDeltas(current, deltas);
    const schema = await this.getSchema();
    const result = validateConfig(schema, next);
    if (!result.valid) return result;
    // Persist (basic): write object under 'andl.ai'
    const cfg = vscode.workspace.getConfiguration();
    await cfg.update('andl.ai', next, vscode.ConfigurationTarget.Global);
    return { valid: true };
  }
}

function applyDeltas<T extends Record<string, any>>(base: T, deltas: Contracts.config.ConfigDelta[]): T {
  const clone: any = JSON.parse(JSON.stringify(base));
  for (const d of deltas) {
    const path = d.path;
    if (!path) continue;
    if (d.operation === 'delete') {
      deleteByPath(clone, path);
    } else if (d.operation === 'set') {
      setByPath(clone, path, d.value);
    }
  }
  return clone;
}

function setByPath(obj: any, path: string, value: any) {
  const segs = toSegments(path);
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const k = segs[i];
    if (!(k in cur) || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[segs[segs.length - 1]] = value;
}

function deleteByPath(obj: any, path: string) {
  const segs = toSegments(path);
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const k = segs[i];
    if (!(k in cur)) return;
    cur = cur[k];
  }
  delete cur[segs[segs.length - 1]];
}

function toSegments(path: string): (string | number)[] {
  // supports dot and bracket: providers[0].id
  const segs: (string | number)[] = [];
  let buf = '';
  for (let i = 0; i < path.length; i++) {
    const ch = path[i];
    if (ch === '.') {
      if (buf) { segs.push(buf); buf = ''; }
    } else if (ch === '[') {
      if (buf) { segs.push(buf); buf = ''; }
      let j = i + 1; let num = '';
      while (j < path.length && path[j] !== ']') { num += path[j++]; }
      i = j; // skip ']'
      const n = Number(num);
      segs.push(Number.isNaN(n) ? num : n);
    } else {
      buf += ch;
    }
  }
  if (buf) segs.push(buf);
  return segs;
}
