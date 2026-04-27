/**
 * DEBUG REGISTRY — Central Failure Store
 *
 * All system failures are written here with a unique traceId.
 * This is the single source of truth for the DebugAPI.
 * NOT for users. For AI agents, developers, and debugging workflows.
 */

export type DebugLayer =
  | 'UI'
  | 'Hook'
  | 'Engine'
  | 'API'
  | 'Schema'
  | 'Network'
  | 'Unknown';

export type FailureSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface FailureRecord {
  traceId: string;
  timestamp: string;
  layer: DebugLayer;
  component: string;
  type: string;
  error: string;
  rootCause: string | 'UNKNOWN';
  originLayer: DebugLayer;
  fixHint: string;
  severity: FailureSeverity;
  propsSnapshot?: Record<string, any>;
  inputSnapshot?: any;
  outputSnapshot?: any;
  meta?: Record<string, any>;
}

export interface ApiCallRecord {
  traceId: string;
  timestamp: string;
  endpoint: string;
  method: string;
  status: number | null;
  responseType: 'json' | 'html' | 'text' | 'empty' | 'timeout' | 'network-error';
  duration: number;
  error?: string;
  diagnosis?: string;
}

export interface SchemaErrorRecord {
  traceId: string;
  timestamp: string;
  type: 'SchemaError';
  layer: DebugLayer;
  source: string;
  field: string;
  expected: string;
  received: any;
  message: string;
}

export interface TraceStepRecord {
  traceId: string;
  step: string;
  status: 'ok' | 'failed' | 'skipped';
  timestamp: string;
  duration?: number;
  error?: string;
  data?: any;
}

// ─── In-memory stores ────────────────────────────────────────────────────────

const failures: FailureRecord[] = [];
const apiCalls: ApiCallRecord[] = [];
const schemaErrors: SchemaErrorRecord[] = [];
const traceSteps: Map<string, TraceStepRecord[]> = new Map();

const MAX_RECORDS = 200;

// ─── ID Generator ────────────────────────────────────────────────────────────

let _counter = 0;
export function generateTraceId(): string {
  _counter++;
  return `trace_${Date.now()}_${_counter}`;
}

// ─── Writers ─────────────────────────────────────────────────────────────────

export function registerFailure(record: Omit<FailureRecord, 'timestamp'>): FailureRecord {
  const full: FailureRecord = { ...record, timestamp: new Date().toISOString() };
  failures.push(full);
  if (failures.length > MAX_RECORDS) failures.splice(0, failures.length - MAX_RECORDS);
  return full;
}

export function registerApiCall(record: Omit<ApiCallRecord, 'timestamp'>): ApiCallRecord {
  const full: ApiCallRecord = { ...record, timestamp: new Date().toISOString() };
  apiCalls.push(full);
  if (apiCalls.length > MAX_RECORDS) apiCalls.splice(0, apiCalls.length - MAX_RECORDS);
  return full;
}

export function registerSchemaError(record: Omit<SchemaErrorRecord, 'timestamp' | 'type'>): SchemaErrorRecord {
  const full: SchemaErrorRecord = { ...record, type: 'SchemaError', timestamp: new Date().toISOString() };
  schemaErrors.push(full);
  if (schemaErrors.length > MAX_RECORDS) schemaErrors.splice(0, schemaErrors.length - MAX_RECORDS);
  return full;
}

export function registerTraceStep(step: TraceStepRecord): void {
  const existing = traceSteps.get(step.traceId) ?? [];
  existing.push(step);
  traceSteps.set(step.traceId, existing);
}

// ─── Readers ─────────────────────────────────────────────────────────────────

export function getLatestFailure(): FailureRecord | null {
  return failures.length > 0 ? failures[failures.length - 1] : null;
}

export function getFailureByTraceId(traceId: string): FailureRecord | null {
  return failures.find(f => f.traceId === traceId) ?? null;
}

export function getAllFailures(): FailureRecord[] {
  return [...failures].reverse();
}

export function getApiCallsByTraceId(traceId: string): ApiCallRecord[] {
  return apiCalls.filter(c => c.traceId === traceId);
}

export function getAllApiCalls(): ApiCallRecord[] {
  return [...apiCalls].reverse();
}

export function getSchemaErrorsByTraceId(traceId: string): SchemaErrorRecord[] {
  return schemaErrors.filter(e => e.traceId === traceId);
}

export function getTraceStepsByTraceId(traceId: string): TraceStepRecord[] {
  return traceSteps.get(traceId) ?? [];
}

// ─── Clear ────────────────────────────────────────────────────────────────────

export function clearRegistry(): void {
  failures.length = 0;
  apiCalls.length = 0;
  schemaErrors.length = 0;
  traceSteps.clear();
}
