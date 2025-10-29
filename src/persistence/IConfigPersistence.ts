import type * as Contracts from '@andl/contracts';

export interface IConfigPersistence {
  getConfig(): Promise<Contracts.config.ConfigSnapshot>;
  updateConfig(deltas: Contracts.config.ConfigDelta[]): Promise<Contracts.config.ConfigValidationResult>;
  getSchema(): Promise<Record<string, any>>;
}
