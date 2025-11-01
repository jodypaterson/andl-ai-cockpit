// Migrated ranges & clamp utilities (AT-P2.M4-09)

export interface RangeSpec { min?: number; max?: number; step?: number; }
export interface RangedDefault { def: number | boolean | string; range?: RangeSpec; }

export const RANGES: Record<string, RangedDefault> = {
  'memory.stm.maxItems': { def: 50, range: { min:1, max:1000 } },
  'memory.stm.maxChars': { def: 8000, range: { min:100, max:200000 } },
  'memory.session.summaryAfterTurns': { def: 8, range:{ min:1, max:100 } },
  'memory.session.maxTranscriptChars': { def: 15000, range:{ min:1000, max:500000 } },
  'memory.rag.k': { def: 3, range:{ min:1, max:30 } },
  'memory.rag.chunker.maxChars': { def: 1200, range: { min:200, max:8000 } },
  'memory.rag.embedder.dim': { def: 64, range: { min:8, max:2048, step:8 } },
  'memory.rag.store.maxItems': { def: 500, range:{ min:10, max:100000 } },
  'memory.ltm.maxItems': { def: 2000, range:{ min:100, max:10000 } },
  'memory.ltm.maxCharsPerItem': { def: 2000, range:{ min:500, max:10000 } },
  'memory.proactive.ragK': { def: 3, range:{ min:1, max:30 } },
  'memory.proactive.ltmK': { def: 3, range:{ min:1, max:30 } },
  'memory.proactive.maxChars': { def: 8000, range:{ min:200, max:10000 } },
  'prompt.normalization.maxChars': { def: 15000, range:{ min:1000, max:200000 } },
  // Loop control
  'prompt.loop.maxIterations': { def: 3, range: { min: 1, max: 20 } },
  // Cognitive controls
  'prompt.cognitive.cogDistillMaxChars': { def: 1200, range: { min: 100, max: 20000 } },
  'prompt.cognitive.cogObsMaxBuffer': { def: 200, range: { min: 1, max: 10000 } },
  'prompt.cognitive.cogCriticMaxRetries': { def: 1, range: { min: 0, max: 10 } },
  'prompt.cognitive.chatProactiveMaxChars': { def: 1200, range: { min: 100, max: 20000 } },
  'cache.response.ttlMs': { def: 300000, range:{ min:60000, max:3600000 } },
  'cache.response.maxEntries': { def: 200, range:{ min:10, max:5000 } },
  'cache.response.maxEntryChars': { def: 60000, range:{ min:1000, max:200000 } },
  'resilience.retry.maxAttempts': { def: 3, range:{ min:1, max:10 } },
  'resilience.retry.baseDelayMs': { def: 150, range:{ min:100, max:5000 } },
  'resilience.retry.maxDelayMs': { def: 2000, range:{ min:1000, max:60000 } },
  'resilience.concurrency.maxConcurrent': { def: 4, range:{ min:1, max:50 } },
  'resilience.circuit.failureThreshold': { def: 3, range:{ min:1, max:20 } },
  'resilience.circuit.halfOpenAfterMs': { def: 15000, range:{ min:5000, max:60000 } },
  'budgets.dailyUsd': { def: 50, range:{ min:0 } },
  'budgets.warnPercent': { def: 0.8, range:{ min:0, max:1 } },
  'budgets.maxCallUsd': { def: 5, range:{ min:0 } },
  'telemetry.samplingRate': { def: 1, range:{ min:0, max:1 } },
  'performance.detailLatencyWarnMs': { def: 1500, range:{ min:100, max:20000 } },
  'performance.stagingLatencyWarnMs': { def: 800, range:{ min:100, max:30000 } },
  'performance.detailLatencyCritMs': { def: 4000, range:{ min:500, max:60000 } },
  'performance.stagingLatencyCritMs': { def: 2500, range:{ min:500, max:60000 } },
  'security.audit.maxEntries': { def: 500, range:{ min:50, max:20000 } },
};

export function clampValue(path: string, value: any): any {
  const spec = RANGES[path];
  if (!spec || !spec.range) { return value; }
  if (typeof value !== 'number' || Number.isNaN(value)) { return value; }
  const { min, max, step } = spec.range;
  let out = value;
  if (typeof min === 'number' && out < min) { out = min; }
  if (typeof max === 'number' && out > max) { out = max; }
  if (typeof step === 'number' && step > 0) {
    out = Math.floor(out / step) * step;
    if (typeof min === 'number' && out < min) { out = min; }
    if (typeof max === 'number' && out > max) { out = max; }
  }
  return out;
}

export function withClamp(path: string, value: any): { value: any; clamped: boolean } {
  const clamped = clampValue(path, value);
  return { value: clamped, clamped: clamped !== value };
}

export function getDefault(path: string): any { return RANGES[path]?.def; }
