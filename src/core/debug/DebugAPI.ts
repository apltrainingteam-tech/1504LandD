/**
 * DEBUG API — Primary Entry Point for All Debugging
 *
 * ⚠️  MANDATORY AGENT PROTOCOL:
 *    ALL debugging MUST start here.
 *    Codebase search is BLOCKED until this API is exhausted.
 *
 * Usage:
 *   import { DebugAPI } from '@/core/debug/DebugAPI';
 *   const failure = DebugAPI.getLatestFailure();
 *   const trace   = DebugAPI.getTrace(failure.traceId);
 *   const schema  = DebugAPI.getSchemaErrors(failure.traceId);
 *   const api     = DebugAPI.getApiDiagnostics(failure.traceId);
 *   const cause   = DebugAPI.getRootCause(failure.traceId);
 *
 * NOT for users. For AI agents, developers, and debugging workflows.
 */

import {
  getLatestFailure as _getLatestFailure,
  getFailureByTraceId,
  getAllFailures,
  getSchemaErrorsByTraceId,
  getAllApiCalls,
  clearRegistry,
  type FailureRecord,
  type SchemaErrorRecord,
} from './debugRegistry';
import { getTrace, getTraceAsTimeline } from './debugTraceEngine';
import { getApiDiagnostics, type ApiDiagnosticsReport } from './apiDiagnostics';
import { getRootCause, type RootCauseReport } from './rootCauseEngine';

// ─── Exported Types ───────────────────────────────────────────────────────────

export type { FailureRecord, SchemaErrorRecord, ApiDiagnosticsReport, RootCauseReport };

// ─── Agent Debug Protocol Response ───────────────────────────────────────────

export interface AgentDebugResponse {
  issueType: string;
  failedLayer: string;
  rootCause: string;
  evidence: {
    trace: ReturnType<typeof getTrace>;
    schema: SchemaErrorRecord[];
    api: ApiDiagnosticsReport;
  };
  fix: string;
  codeSearchRequired: boolean;
  analysisTime: string;
}

// ─── DebugAPI Surface ─────────────────────────────────────────────────────────

export const DebugAPI = {
  /**
   * STEP 1: Fetch the most recent system failure.
   * Always start here. Returns null if no failures recorded.
   */
  getLatestFailure(): FailureRecord | null {
    return _getLatestFailure();
  },

  /**
   * STEP 2: Get the full execution trace for a traceId.
   * Returns ordered list of steps with status, timing, and error.
   */
  getTrace(traceId: string) {
    return getTrace(traceId);
  },

  /**
   * STEP 2b: Get trace as a human-readable timeline string.
   */
  getTraceTimeline(traceId: string): string {
    return getTraceAsTimeline(traceId);
  },

  /**
   * STEP 3: Get schema/contract validation errors for a traceId.
   * If errors exist → STOP and report contract violation.
   */
  getSchemaErrors(traceId: string): SchemaErrorRecord[] {
    return getSchemaErrorsByTraceId(traceId);
  },

  /**
   * STEP 4: Get API diagnostics (endpoint, status, response type, diagnosis).
   */
  getApiDiagnostics(traceId: string): ApiDiagnosticsReport {
    return getApiDiagnostics(traceId);
  },

  /**
   * STEP 5: Get structured root cause analysis for a traceId.
   * FINAL STEP before code search.
   */
  getRootCause(traceId: string): RootCauseReport {
    return getRootCause(traceId);
  },

  /**
   * FULL AGENT PROTOCOL — Run all 5 steps in sequence for a traceId.
   * Returns a structured AgentDebugResponse ready for agent consumption.
   *
   * codeSearchRequired === true ONLY when rootCause === 'UNKNOWN'
   */
  runAgentProtocol(traceId?: string): AgentDebugResponse {
    const failure = traceId ? getFailureByTraceId(traceId) : _getLatestFailure();

    if (!failure) {
      return {
        issueType: 'NO_FAILURE_RECORDED',
        failedLayer: 'Unknown',
        rootCause: 'UNKNOWN',
        evidence: {
          trace: [],
          schema: [],
          api: {
            traceId: traceId ?? 'none',
            calls: [],
            summary: { total: 0, failed: 0, slowest: null, primaryIssue: null },
          },
        },
        fix: 'Debug Layer incomplete — no failure signals found. Ensure instrumentation is active and the error occurred after the Debug Layer was initialized.',
        codeSearchRequired: true,
        analysisTime: new Date().toISOString(),
      };
    }

    const resolvedTraceId = failure.traceId;
    const trace = getTrace(resolvedTraceId);
    const schemaErrors = getSchemaErrorsByTraceId(resolvedTraceId);
    const apiDiag = getApiDiagnostics(resolvedTraceId);
    const rootCauseReport = getRootCause(resolvedTraceId);

    // If schema errors found → code search blocked
    const codeSearchRequired = rootCauseReport.rootCause === 'UNKNOWN';

    return {
      issueType: failure.type,
      failedLayer: failure.layer,
      rootCause: rootCauseReport.rootCause,
      evidence: {
        trace,
        schema: schemaErrors,
        api: apiDiag,
      },
      fix: rootCauseReport.fix,
      codeSearchRequired,
      analysisTime: rootCauseReport.analysisTime,
    };
  },

  /**
   * History — get all recorded failures (newest first).
   */
  getAllFailures() {
    return getAllFailures();
  },

  /**
   * History — get all API calls (newest first).
   */
  getAllApiCalls() {
    return getAllApiCalls();
  },

  /**
   * Admin — clear all debug state.
   */
  clearAll() {
    clearRegistry();
  },
} as const;

// ─── Dev console shortcut ─────────────────────────────────────────────────────
// Makes DebugAPI accessible from browser console: window.__DebugAPI
if (typeof window !== 'undefined') {
  (window as any).__DebugAPI = DebugAPI;
}
