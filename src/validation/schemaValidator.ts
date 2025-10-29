import * as AjvNS from 'ajv';
import * as AjvFormatsNS from 'ajv-formats';
import type * as Contracts from '@andl/contracts';

export function createValidator(schema: Record<string, any>) {
  const Ajv = (AjvNS as any).default ?? AjvNS;
  const ajv = new Ajv({ allErrors: true, strict: false });
  const addFormats = (AjvFormatsNS as any).default ?? AjvFormatsNS;
  addFormats(ajv);
  const validate = ajv.compile(schema);
  return (config: unknown): Contracts.config.ConfigValidationResult => {
    const valid = validate(config) as boolean;
    if (valid) return { valid: true };
    const errors = (validate.errors || []).map(toConfigError);
    return { valid: false, errors };
  };
}

export function validateConfig(schema: Record<string, any>, config: unknown): Contracts.config.ConfigValidationResult {
  return createValidator(schema)(config);
}

function toConfigError(err: AjvNS.ErrorObject): Contracts.config.ConfigError {
  return {
    path: jsonPathFromInstancePath(err.instancePath),
    message: err.message || 'invalid',
    code: err.keyword || 'validation'
  };
}

function jsonPathFromInstancePath(instancePath: string): string {
  // Ajv instancePath like: /providers/0/id → providers[0].id
  if (!instancePath) return '';
  const parts = instancePath.split('/').filter(Boolean);
  let path = '';
  for (const p of parts) {
    const num = Number(p);
    if (!Number.isNaN(num)) {
      path += `[${num}]`;
    } else {
      path += path ? `.${p}` : p;
    }
  }
  return path;
}
