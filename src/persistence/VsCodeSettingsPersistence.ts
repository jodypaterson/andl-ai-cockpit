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
    // Minimal seed respecting schema shape
    const providers: Contracts.config.ProviderConfig[] = cfg.get('providers') ?? [];
    const memory: Contracts.config.MemoryConfig = cfg.get('memory') ?? {};
    const toolkit: Contracts.config.ToolkitConfig = cfg.get('toolkit') ?? {};
    const models: Contracts.config.ModelSelectionConfig = cfg.get('models') ?? {};
    const resilience: Contracts.config.ResilienceConfig = cfg.get('resilience') ?? {};
    return { providers, memory, toolkit, models, resilience };
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
