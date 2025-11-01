// Migrated Host Bridge (AT-P2.M4-09)
import { configStore } from '../state/configStore.js';
import { stableHash } from '../ai-config-utils.js';

// eslint-disable-next-line @typescript-eslint/naming-convention
declare const acquireVsCodeApi: undefined | (() => any);

export interface HydratePayload { type: 'config:hydrate'; config: Record<string, any>; hash?: string; }
export type HostInboundMessage = HydratePayload | { type: string; [k: string]: any };
export type HydratedListener = (config: Record<string, any>, hash?: string) => void;

class HostBridge {
  private vscodeApi: any;
  private hydratedListeners: Set<HydratedListener> = new Set();
  private started = false;
  private hydrationTimer: any;
  private hasHydrated = false;

  private ensureApi() {
    if (this.vscodeApi) { return; }
    try {
      const w: any = (typeof window !== 'undefined') ? window : undefined;
      if (w && w.__vscodeApi) { this.vscodeApi = w.__vscodeApi; return; }
      if (typeof acquireVsCodeApi === 'function') {
        this.vscodeApi = acquireVsCodeApi();
        if (w) { w.__vscodeApi = this.vscodeApi; }
      }
    } catch {}
  }

  start() {
    if (this.started) { return; }
    this.started = true;
    this.ensureApi();
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => this.onMessage(event.data as HostInboundMessage));
    }
    this.hydrationTimer = setTimeout(() => { if (!this.hasHydrated) { try { this.postMessage({ type: 'ai:config:current:request', reason: 'hostBridge:timeout' }); } catch {} } }, 600);
  }

  onHydrated(fn: HydratedListener): () => void { this.hydratedListeners.add(fn); return () => this.hydratedListeners.delete(fn); }

  private onMessage(msg: HostInboundMessage) {
    try {
      console.log('[ANDL][hostBridge][message]', (msg as any)?.type, Object.keys(((msg as any)?.config)||{}));
      if ((globalThis as any).__andlDebugVerbose && ((msg as any).type === 'config:hydrate' || (msg as any).type === 'ai:config:current')) {
        const cfg = (msg as any).config; const h = (msg as any).hash || (cfg? stableHash(cfg): undefined);
        console.log('[BUG-010][Hydrate][VERBOSE] inbound', { type: (msg as any).type, hash: h, cfgKeys: cfg? Object.keys(cfg).slice(0,8): [] });
      }
    } catch {}
    if ((msg as any).type === 'config:hydrate' || ((msg as any).type === 'ai:config:current' && (msg as any).config)) {
      const cfg = (msg as any).config;
      if (cfg && typeof cfg === 'object') {
        const h = (msg as any).hash || stableHash(cfg);
        this.hasHydrated = true;
        if (this.hydrationTimer) { try { clearTimeout(this.hydrationTimer); } catch {} }
        try {
          const st = configStore.getState();
          const hasDirty = st.dirtyGroups && st.dirtyGroups.size > 0;
          if (hasDirty) {
            const incomingHash = stableHash(cfg);
            const workingHash = st.working ? stableHash(st.working) : undefined;
            const recentEditWindowMs = 400;
            const sinceEdit = st.lastLocalEditTs ? Date.now() - st.lastLocalEditTs : Infinity;
            if ((globalThis as any).__andlDebugVerbose) {
              console.log('[BUG-010][Hydrate][VERBOSE] dirty guard', { incomingHash, workingHash, sinceEdit, recentEditWindowMs });
            }
            if (incomingHash === workingHash || sinceEdit < recentEditWindowMs) { return; }
          }
          if ((globalThis as any).__andlDebugVerbose) {
            const w = configStore.getState().working || {};
            const prevProviders = (w as any).providers || {};
            console.log('[BUG-010][Hydrate][VERBOSE] pre-hydrate preserve check', {
              hadModels: !!prevProviders.models?.length,
              hadAll: !!prevProviders.modelsAll?.length,
              hadStatuses: !!prevProviders.statuses && Object.keys(prevProviders.statuses).length>0,
            });
          }
          configStore.hydrate(cfg, h);
          if ((globalThis as any).__andlDebugVerbose) {
            const w2 = configStore.getState().working || {};
            const p2 = (w2 as any).providers || {};
            console.log('[BUG-010][Hydrate][VERBOSE] post-hydrate providers snapshot', {
              models: Array.isArray(p2.models)? p2.models.slice(0,5) : undefined,
              modelsAll: Array.isArray(p2.modelsAll)? p2.modelsAll.slice(0,3).map((m:any)=>m?.id) : undefined,
              statusesKeys: p2.statuses? Object.keys(p2.statuses).slice(0,5) : undefined,
            });
          }
        } catch {}
        for (const l of this.hydratedListeners) { try { l(cfg, h); } catch {} }
      }
      return;
    }
  }

  applyPatch(patch: Record<string, any>) {
    this.ensureApi();
    if (!this.vscodeApi) { return; }
    try { console.log('[ANDL][hostBridge][applyPatch] keys=', Object.keys(patch||{})); } catch {}
    this.vscodeApi.postMessage({ type: 'config:apply:hybrid', payload: patch });
  }
  postMessage(message: any) { this.ensureApi(); try { this.vscodeApi?.postMessage?.(message); } catch {} }
  applyConfigPatch(patch: Record<string, any>) { return this.applyPatch(patch); }
  saveAll(payload: Record<string, any>) {
    this.ensureApi();
    if (!this.vscodeApi) { return; }
    try { console.log('[ANDL][hostBridge][saveAll] roots=', Object.keys(payload||{})); } catch {}
    this.vscodeApi.postMessage({ type: 'settings:apply:v2', payload });
    try { console.log('[hostBridge] saveAll() message posted'); } catch {}
  }

  // duplicate ensureApi removed (defined above)
}

export const hostBridge = new HostBridge();
if (typeof window !== 'undefined') { (window as any).__andlHostBridge = hostBridge; }
