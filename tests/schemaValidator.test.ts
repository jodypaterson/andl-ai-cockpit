import { validateConfig } from '../src/validation/schemaValidator.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('schemaValidator', () => {
  const schemaPath = path.join(process.cwd(), 'src', 'schemas', 'ConfigSchema.json');
  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, any>;

  it('accepts a minimal valid config shape', () => {
    const config = {
      providers: [],
      memory: {},
      toolkit: {},
      models: {},
      resilience: {}
    };
    const result = validateConfig(schema, config);
    expect(result.valid).toBe(true);
  });

  it('rejects an invalid providers value', () => {
    const bad = {
      providers: 'not-an-array',
      memory: {},
      toolkit: {},
      models: {},
      resilience: {}
    } as any;
    const result = validateConfig(schema, bad);
    expect(result.valid).toBe(false);
    expect(result.errors && result.errors.length).toBeGreaterThan(0);
  });
});
