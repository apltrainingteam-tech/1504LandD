/**
 * SCHEMA VALIDATOR — Data Shape Validator (Zero External Dependencies)
 *
 * Validates Hook output, API responses, and Engine output against
 * expected contracts. Reports structured SchemaError records.
 * NOT for users. For AI agents, developers, and debugging workflows.
 */

import {
  registerSchemaError,
  generateTraceId,
  type DebugLayer,
  type SchemaErrorRecord,
} from './debugRegistry';

// ─── Schema DSL ───────────────────────────────────────────────────────────────

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'any'
  | 'string|number'
  | 'string|undefined'
  | 'number|undefined'
  | 'array|undefined'
  | 'object|undefined';

export interface FieldRule {
  type: FieldType;
  required?: boolean;
  minLength?: number;         // for strings/arrays
  minItems?: number;          // for arrays
  allowEmpty?: boolean;       // allow empty arrays
  itemShape?: SchemaContract; // for typed arrays
}

export type SchemaContract = Record<string, FieldRule>;

export interface ValidationResult {
  valid: boolean;
  errors: SchemaErrorRecord[];
}

// ─── Built-in Contracts ───────────────────────────────────────────────────────

export const CONTRACTS = {
  /** Output of any getCollection() API call */
  apiCollectionResponse: {
    success: { type: 'boolean', required: true },
    data: { type: 'array|undefined', allowEmpty: true },
  } as SchemaContract,

  /** A single Employee record */
  employee: {
    id: { type: 'string', required: true },
    name: { type: 'string', required: true },
  } as SchemaContract,

  /** A single Attendance record */
  attendance: {
    employeeId: { type: 'string', required: true },
    trainingName: { type: 'string', required: true },
  } as SchemaContract,

  /** Chart data point (any chart series) */
  chartDataPoint: {
    name: { type: 'string|number', required: true },
    value: { type: 'number|undefined' },
  } as SchemaContract,

  /** Hook output guard — hooks must return arrays */
  hookArrayOutput: {
    // Checks that data is an array — used for hooks returning arrays
  } as SchemaContract,

  /** Engine result envelope */
  engineResult: {
    success: { type: 'boolean', required: true },
    data: { type: 'any', required: false },
  } as SchemaContract,
} as const;

// ─── Validator ────────────────────────────────────────────────────────────────

export function validateSchema(
  data: unknown,
  contract: SchemaContract,
  options: {
    traceId?: string;
    source: string;
    layer: DebugLayer;
  }
): ValidationResult {
  const traceId = options.traceId ?? generateTraceId();
  const errors: SchemaErrorRecord[] = [];

  if (data === null || data === undefined) {
    const record = registerSchemaError({
      traceId,
      layer: options.layer,
      source: options.source,
      field: 'root',
      expected: 'non-null object',
      received: data,
      message: `Received ${data} — expected an object matching the schema contract`,
    });
    errors.push(record);
    return { valid: false, errors };
  }

  if (typeof data !== 'object' || Array.isArray(data)) {
    const record = registerSchemaError({
      traceId,
      layer: options.layer,
      source: options.source,
      field: 'root',
      expected: 'object',
      received: typeof data,
      message: `Expected object, received ${Array.isArray(data) ? 'array' : typeof data}`,
    });
    errors.push(record);
    return { valid: false, errors };
  }

  const obj = data as Record<string, any>;

  for (const [field, rule] of Object.entries(contract)) {
    const value = obj[field];
    const isUndefined = value === undefined || value === null;

    if (rule.required && isUndefined) {
      const record = registerSchemaError({
        traceId,
        layer: options.layer,
        source: options.source,
        field,
        expected: `required ${rule.type}`,
        received: value,
        message: `Required field "${field}" is ${value === null ? 'null' : 'missing'}`,
      });
      errors.push(record);
      continue;
    }

    if (isUndefined) continue; // optional and absent — OK

    const typeError = checkType(value, rule.type);
    if (typeError) {
      const record = registerSchemaError({
        traceId,
        layer: options.layer,
        source: options.source,
        field,
        expected: rule.type,
        received: typeof value,
        message: `Field "${field}": ${typeError}`,
      });
      errors.push(record);
      continue;
    }

    // Additional constraints
    if ((rule.type === 'string' || rule.type === 'string|number') && typeof value === 'string') {
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        const record = registerSchemaError({
          traceId,
          layer: options.layer,
          source: options.source,
          field,
          expected: `string with minLength ${rule.minLength}`,
          received: value,
          message: `Field "${field}" length (${value.length}) is below minimum (${rule.minLength})`,
        });
        errors.push(record);
      }
    }

    if (rule.type === 'array' || rule.type === 'array|undefined') {
      if (!Array.isArray(value)) continue;
      if (rule.minItems !== undefined && !rule.allowEmpty && value.length < rule.minItems) {
        const record = registerSchemaError({
          traceId,
          layer: options.layer,
          source: options.source,
          field,
          expected: `array with at least ${rule.minItems} items`,
          received: `array with ${value.length} items`,
          message: `Field "${field}" has ${value.length} items, expected at least ${rule.minItems}`,
        });
        errors.push(record);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Validate that a value is an array (for hook output) */
export function validateIsArray(
  data: unknown,
  options: { traceId?: string; source: string; layer: DebugLayer }
): ValidationResult {
  const traceId = options.traceId ?? generateTraceId();
  if (!Array.isArray(data)) {
    const record = registerSchemaError({
      traceId,
      layer: options.layer,
      source: options.source,
      field: 'root',
      expected: 'array',
      received: typeof data,
      message: `Expected array output, received ${typeof data}`,
    });
    return { valid: false, errors: [record] };
  }
  return { valid: true, errors: [] };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function checkType(value: any, type: FieldType): string | null {
  switch (type) {
    case 'any': return null;
    case 'string': return typeof value === 'string' ? null : `expected string, got ${typeof value}`;
    case 'number': return typeof value === 'number' ? null : `expected number, got ${typeof value}`;
    case 'boolean': return typeof value === 'boolean' ? null : `expected boolean, got ${typeof value}`;
    case 'array': return Array.isArray(value) ? null : `expected array, got ${typeof value}`;
    case 'object': return (typeof value === 'object' && !Array.isArray(value)) ? null : `expected object, got ${typeof value}`;
    case 'string|number': return (typeof value === 'string' || typeof value === 'number') ? null : `expected string|number, got ${typeof value}`;
    case 'string|undefined': return (typeof value === 'string' || value === undefined) ? null : `expected string|undefined, got ${typeof value}`;
    case 'number|undefined': return (typeof value === 'number' || value === undefined) ? null : `expected number|undefined, got ${typeof value}`;
    case 'array|undefined': return (Array.isArray(value) || value === undefined) ? null : `expected array|undefined, got ${typeof value}`;
    case 'object|undefined': return ((typeof value === 'object' && !Array.isArray(value)) || value === undefined) ? null : `expected object|undefined, got ${typeof value}`;
    default: return null;
  }
}
