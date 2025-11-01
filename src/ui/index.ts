// UI Library entry (AT-P2.M4-09)
// Base components
export { GroupCard } from './components/GroupCard.js';
export { default as GroupCardDefault } from './components/GroupCard.js';
export { TabBar } from './components/TabBar.js';
export { DragDropList } from './components/DragDropList.js';
export { Toggle } from './components/Toggle.js';
export { NumberField } from './components/NumberField.js';
export { GlobalToolbar } from './components/GlobalToolbar.js';

// Groups (initial set)
export { ProvidersGroup } from './components/groups/ProvidersGroup.js';

// State & messaging
export { configStore } from './state/configStore.js';
export type { StoreStateType as StoreState } from './state/configStore.js';
export { useConfigStore, useConfigSlice, useGroupDirty, useDirtyGroupCount, useDirtyGroupIds } from './state/hooks.js';
export { hostBridge } from './messaging/hostBridge.js';

// Utils
export * from './ai-config-utils.js';
export * from './utils/ranges.js';
