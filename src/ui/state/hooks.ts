// Migrated hooks (AT-P2.M4-09)
import { useEffect, useRef, useState } from 'react';
import { configStore, StoreState } from './configStore.js';

export function useConfigStore(): StoreState {
  const [snap, setSnap] = useState(configStore.getState());
  useEffect(() => configStore.subscribe(setSnap), []);
  return snap;
}
export function useConfigSlice<T>(selector: (s: StoreState) => T): T {
  const full = useConfigStore();
  const prevRef = useRef<T | undefined>(undefined);
  const sel = selector(full);
  if (prevRef.current !== sel) { prevRef.current = sel; }
  return prevRef.current as T;
}
export function useGroupDirty(groupId: string): boolean { return useConfigSlice(s => s.dirtyGroups.has(groupId)); }
export function useDirtyGroupCount(): number { return useConfigSlice(s => s.dirtyGroups.size); }
export function useDirtyGroupIds(): string[] { return useConfigSlice(s => Array.from(s.dirtyGroups.values())); }
