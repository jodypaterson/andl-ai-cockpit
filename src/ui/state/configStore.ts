// Migrated Config Store (AT-P2.M4-09)
import { stableHash, computeConfigDiff, deepMerge } from '../ai-config-utils.js';
import { withClamp } from '../utils/ranges.js';

export type AnyConfig = Record<string, any>;

export interface StoreState {
  original: AnyConfig | undefined;
  working: AnyConfig | undefined;
  dirtyGroups: Set<string>;
  lastHydratedHash?: string;
  history?: { ts: number; patch: AnyConfig; groupIds: string[] }[];
  lastLocalEditTs?: number;
}

export type StoreListener = (s: StoreState) => void;

const GROUP_ROOT_PATHS: Record<string, string[]> = {
  memory: ['memory'],
  resilience: ['resilience'],
  budgets: ['budgets'],
  cache: ['cache'],
  prompt: ['prompt'],
  security: ['security'],
  attachments: ['attachments'],
  diagnostics: ['telemetry', 'performance'],
  toolkit: ['toolkit'],
};

const ROOT_TO_GROUP: Record<string, string> = {};
for (const [gid, roots] of Object.entries(GROUP_ROOT_PATHS)) {
  for (const r of roots) { if (!ROOT_TO_GROUP[r]) { ROOT_TO_GROUP[r] = gid; } }
}

function getByPath(obj: any, path: string[]): any { return path.reduce((acc, key) => (acc ? acc[key] : undefined), obj); }
function setByPath(base: any, path: string[], value: any): any {
  if (!path.length) { return value; }
  const [head, ...rest] = path;
  const clone = Array.isArray(base) ? [...base] : { ...(base ?? {}) };
  clone[head] = setByPath(base ? base[head] : undefined, rest, value);
  return clone;
}

class ConfigStore {
  private state: StoreState = { original: undefined, working: undefined, dirtyGroups: new Set(), history: [] };
  private listeners: Set<StoreListener> = new Set();

  subscribe(fn: StoreListener): () => void { this.listeners.add(fn); fn(this.state); return () => this.listeners.delete(fn); }
  private emit() {
    const snap: StoreState = { original: this.state.original, working: this.state.working, dirtyGroups: new Set(this.state.dirtyGroups), lastHydratedHash: this.state.lastHydratedHash, history: this.state.history, lastLocalEditTs: this.state.lastLocalEditTs };
    for (const l of this.listeners) { l(snap); }
  }

  hydrate(original: AnyConfig, hydratedHash?: string) {
    const prevWorking = this.state.working || {};
    const preservedProviders = {
      models: prevWorking?.providers?.models,
      modelsAll: prevWorking?.providers?.modelsAll,
      statuses: prevWorking?.providers?.statuses,
      modelsLoading: prevWorking?.providers?.modelsLoading,
      credentials: prevWorking?.providers?.credentials,
    } as any;

    const seeded = deepMerge({}, original);
    if (!seeded.telemetry) { seeded.telemetry = { exportEnabled: false, samplingRate: 1 }; }
    if (!seeded.performance) { seeded.performance = { detailLatencyWarnMs: 1500, stagingLatencyWarnMs: 800, detailLatencyCritMs: 4000, stagingLatencyCritMs: 2500 }; }
    if (!seeded.security) { seeded.security = {}; }
    if (!seeded.security.redaction) { seeded.security.redaction = { enabled: true, patterns: ['SECRET_[A-Z0-9]{8}'] }; }
    else {
      if (seeded.security.redaction.enabled === undefined) { seeded.security.redaction.enabled = true; }
      if (!Array.isArray(seeded.security.redaction.patterns) || seeded.security.redaction.patterns.length === 0) { seeded.security.redaction.patterns = ['SECRET_[A-Z0-9]{8}']; }
    }
    if (!seeded.security.audit) { seeded.security.audit = { enabled: true, maxEntries: 500 }; }
    else {
      if (seeded.security.audit.enabled === undefined) { seeded.security.audit.enabled = true; }
      if (typeof seeded.security.audit.maxEntries !== 'number') { seeded.security.audit.maxEntries = 500; }
    }
    if (!seeded.prompt) { seeded.prompt = {}; }
    const p = seeded.prompt as AnyConfig;
    if (!p.cognitive) { p.cognitive = {}; }
    const c = p.cognitive as AnyConfig;
    if (c.cogEnabled === undefined) c.cogEnabled = false;
    if (c.cogDistillMode === undefined) c.cogDistillMode = 'single';
    if (c.cogDistillMaxChars === undefined) c.cogDistillMaxChars = 1200;
    if (c.cogObsMaxBuffer === undefined) c.cogObsMaxBuffer = 200;
    if (c.cogCriticEnabled === undefined) c.cogCriticEnabled = false;
    if (c.cogCriticMode === undefined) c.cogCriticMode = 'brief';
    if (c.cogCriticMaxRetries === undefined) c.cogCriticMaxRetries = 1;
    if (c.chatRagSessionMemory === undefined) c.chatRagSessionMemory = false;
    if (c.chatProactiveRetrieval === undefined) c.chatProactiveRetrieval = false;
    if (c.chatProactiveMaxChars === undefined) c.chatProactiveMaxChars = 1200;

    if (!p.loop) { p.loop = {}; }
    const l = p.loop as AnyConfig;
    if (l.enabled === undefined) l.enabled = false;
    if (l.maxIterations === undefined) l.maxIterations = 3;

    this.state.original = deepMerge({}, seeded);
    this.state.working = deepMerge({}, seeded);

    if (preservedProviders && typeof preservedProviders === 'object') {
      const w = this.state.working as AnyConfig;
      if (!w.providers) { (w as any).providers = {}; }
      const wp = (w as any).providers as AnyConfig;
      if (preservedProviders.models !== undefined) { wp.models = preservedProviders.models; }
      if (preservedProviders.modelsAll !== undefined) { wp.modelsAll = preservedProviders.modelsAll; }
      if (preservedProviders.statuses !== undefined) { wp.statuses = preservedProviders.statuses; }
      if (preservedProviders.modelsLoading !== undefined) { wp.modelsLoading = preservedProviders.modelsLoading; }
      if (preservedProviders.credentials !== undefined) { wp.credentials = preservedProviders.credentials; }
    }
    this.state.dirtyGroups.clear();
    if (hydratedHash) { this.state.lastHydratedHash = hydratedHash; }
    this.emit();
  }

  resetPromptDefaults() {
    if (!this.state.working) return;
    const current = this.state.working;
    const prompt = deepMerge({}, (current as AnyConfig).prompt || {});
    const cognitive = deepMerge({}, (prompt as AnyConfig).cognitive || {});
    cognitive.cogEnabled = false;
    cognitive.cogDistillMode = 'single';
    cognitive.cogDistillMaxChars = 1200;
    cognitive.cogObsMaxBuffer = 200;
    cognitive.cogCriticEnabled = false;
    cognitive.cogCriticMode = 'brief';
    cognitive.cogCriticMaxRetries = 1;
    cognitive.chatRagSessionMemory = false;
    cognitive.chatProactiveRetrieval = false;
    cognitive.chatProactiveMaxChars = 1200;
    (prompt as AnyConfig).cognitive = cognitive;
    this.update(['prompt'], prompt);
  }

  update(path: string[], value: any) {
    if (!this.state.working) { return; }
    const before = getByPath(this.state.working, path);
    const clampPath = path.join('.');
    if (clampPath === 'attachments.allowedMimeTypes' && Array.isArray(value)) {
      value = value.filter(v => typeof v === 'string').map(v => v.trim()).filter(v => v.length > 0);
    }
    const { value: clampedValue } = withClamp(clampPath, value);
    if (before === clampedValue) { return; }
    this.state.working = setByPath(this.state.working, path, clampedValue);
    this.state.lastLocalEditTs = Date.now();
    const groupId = ROOT_TO_GROUP[path[0]] || path[0];
    const groupDiff = this.computeGroupDiff(groupId);
    if (groupDiff) { this.state.dirtyGroups.add(groupId); } else { this.state.dirtyGroups.delete(groupId); }
    this.emit();
  }

  computeGroupDiff(groupId: string): AnyConfig | undefined {
    if (!this.state.original || !this.state.working) { return undefined; }
    const rootPaths = GROUP_ROOT_PATHS[groupId]; if (!rootPaths) { return undefined; }
    const diffAccumulator: AnyConfig = {}; let changed = false;
    for (const root of rootPaths) {
      const origSlice = (this.state.original as any)[root];
      const workSlice = (this.state.working as any)[root];
      const d = computeConfigDiff(origSlice, workSlice);
      if (d !== undefined) { (diffAccumulator as any)[root] = d; changed = true; }
    }
    return changed ? diffAccumulator : undefined;
  }

  applyGroup(groupId: string): AnyConfig | undefined {
    const diff = this.computeGroupDiff(groupId); if (!diff) { return undefined; }
    this.state.original = deepMerge(this.state.original || {}, diff);
    this.state.working = deepMerge(this.state.working || {}, diff);
    const post = this.computeGroupDiff(groupId); if (!post) { this.state.dirtyGroups.delete(groupId); }
    this.emit();
    this.recordHistory(diff, [groupId]);
    return diff;
  }

  computeAllDiff(): AnyConfig | undefined {
    if (!this.state.original || !this.state.working) { return undefined; }
    const groupIds = Object.keys(GROUP_ROOT_PATHS).sort(); let changed = false; const out: AnyConfig = {};
    for (const gid of groupIds) {
      const d = this.computeGroupDiff(gid);
      if (d) { for (const [k,v] of Object.entries(d)) { out[k] = v as any; } changed = true; }
    }
    return changed ? out : undefined;
  }

  applyAll(): AnyConfig | undefined {
    const patch = this.computeAllDiff(); if (!patch) { return undefined; }
    this.state.original = deepMerge(this.state.original || {}, patch);
    this.state.working = deepMerge(this.state.working || {}, patch);
    for (const gid of Object.keys(GROUP_ROOT_PATHS)) { if (!this.computeGroupDiff(gid)) { this.state.dirtyGroups.delete(gid); } }
    this.emit();
    const contributing: string[] = [];
    for (const gid of Object.keys(GROUP_ROOT_PATHS)) { const roots = GROUP_ROOT_PATHS[gid]; if (roots.some(r => (patch as any)[r] !== undefined)) { contributing.push(gid); } }
    this.recordHistory(patch, contributing);
    return patch;
  }

  markClean(groupId: string) { this.state.dirtyGroups.delete(groupId); this.emit(); }
  getState(): StoreState { return this.state; }
  clearHistory() { if (this.state.history && this.state.history.length) { this.state.history = []; this.emit(); } }
  private recordHistory(patch: AnyConfig, groupIds: string[]) {
    const entry = { ts: Date.now(), patch: deepMerge({}, patch), groupIds: [...groupIds] }; const hist = this.state.history || (this.state.history = []); hist.unshift(entry); if (hist.length > 20) { hist.pop(); }
  }
}

export const configStore = new ConfigStore();
if (typeof window !== 'undefined') { (window as any).__andlConfigStore = configStore; }

export type { StoreState as StoreStateType };