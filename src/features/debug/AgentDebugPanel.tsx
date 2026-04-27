/**
 * AGENT DEBUG PANEL — Primary Debug UI
 *
 * Visual interface for the DebugAPI. Shows context, errors, traces,
 * API diagnostics, data snapshots, and root cause analysis.
 * Only visible in dev/non-production + SUPERADMIN role.
 * NOT for users. For AI agents, developers, and debugging workflows.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bug, X, RefreshCw, Trash2, ShieldAlert, CheckCircle2,
  AlertTriangle, Activity, Globe, Database, Layers, Zap, ChevronRight
} from 'lucide-react';
import { DebugAPI } from '../../core/debug/DebugAPI';
import type { FailureRecord, RootCauseReport, AgentDebugResponse } from '../../core/debug/DebugAPI';
import { getCurrentUser } from '../../core/context/userContext';
import { DEBUG_MODE } from '../../core/constants/debugConfig';
import styles from './AgentDebugPanel.module.css';

// ─── Tab definition ───────────────────────────────────────────────────────────

type Tab = 'overview' | 'trace' | 'schema' | 'api' | 'rootcause' | 'history';

interface TabDef {
  id: Tab;
  label: string;
  step: string;
}

const TABS: TabDef[] = [
  { id: 'overview',  label: 'Failure',   step: 'S1' },
  { id: 'trace',     label: 'Trace',     step: 'S2' },
  { id: 'schema',    label: 'Schema',    step: 'S3' },
  { id: 'api',       label: 'API',       step: 'S4' },
  { id: 'rootcause', label: 'Root Cause',step: 'S5' },
  { id: 'history',   label: 'History',   step: '···' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const AgentDebugPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [report, setReport] = useState<AgentDebugResponse | null>(null);
  const [failure, setFailure] = useState<FailureRecord | null>(null);
  const [rootCause, setRootCause] = useState<RootCauseReport | null>(null);
  const [failureCount, setFailureCount] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<string>('—');

  // Guard — dev + superadmin only
  const user = getCurrentUser();
  const isSuperAdmin = user.role === 'super_admin';
  const isDev = !import.meta.env.PROD;

  if (!DEBUG_MODE || !isDev || !isSuperAdmin) return null;

  const runProtocol = useCallback(() => {
    const latest = DebugAPI.getLatestFailure();
    setFailure(latest);
    setFailureCount(DebugAPI.getAllFailures().length);

    if (latest) {
      const r = DebugAPI.runAgentProtocol(latest.traceId);
      setReport(r);
      const rc = DebugAPI.getRootCause(latest.traceId);
      setRootCause(rc);
    } else {
      setReport(DebugAPI.runAgentProtocol());
      setRootCause(null);
    }

    setLastRefresh(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const count = DebugAPI.getAllFailures().length;
      setFailureCount(count);
    }, 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (open) runProtocol();
  }, [open, runProtocol]);

  const handleClear = () => {
    DebugAPI.clearAll();
    setReport(null);
    setFailure(null);
    setRootCause(null);
    setFailureCount(0);
    setLastRefresh('—');
  };

  const schemaErrors = report?.evidence?.schema ?? [];
  const apiCalls     = report?.evidence?.api?.calls ?? [];
  const traceSteps   = report?.evidence?.trace ?? [];
  const apiFailures  = apiCalls.filter(c => c.status !== null && c.status >= 400 || c.responseType === 'network-error' || c.responseType === 'timeout' || c.responseType === 'html');
  const allHistory   = DebugAPI.getAllFailures();

  const hasIssue = (tab: Tab): boolean => {
    if (tab === 'schema') return schemaErrors.length > 0;
    if (tab === 'api') return apiFailures.length > 0;
    if (tab === 'rootcause') return rootCause?.rootCause === 'UNKNOWN';
    if (tab === 'overview') return !!failure;
    if (tab === 'trace') return traceSteps.some(s => s.status === 'failed');
    return false;
  };

  return (
    <>
      {/* Floating Trigger */}
      <button
        className={styles.trigger}
        onClick={() => setOpen(v => !v)}
        title="Agent Debug Panel"
        id="agent-debug-trigger"
      >
        <Bug size={20} />
        {failureCount > 0 && (
          <span className={styles.triggerBadge}>{failureCount > 99 ? '99+' : failureCount}</span>
        )}
      </button>

      {/* Panel */}
      <div className={`${styles.panel} ${open ? styles.open : ''}`} role="complementary" aria-label="Agent Debug Panel">

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.badge}>
              <span className={styles.badgeDot} />
              DEBUG LAYER
            </div>
            <span className={styles.title}>Agent Intelligence</span>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconBtn} onClick={runProtocol} title="Refresh" id="debug-refresh-btn">
              <RefreshCw size={13} />
            </button>
            <button className={`${styles.iconBtn} ${styles.danger}`} onClick={handleClear} title="Clear all" id="debug-clear-btn">
              <Trash2 size={13} />
            </button>
            <button className={styles.iconBtn} onClick={() => setOpen(false)} title="Close" id="debug-close-btn">
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Protocol Step Tabs */}
        <div className={styles.protocolBar}>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`${styles.step} ${activeTab === t.id ? styles.active : ''} ${hasIssue(t.id) ? styles.hasIssue : ''}`}
              onClick={() => setActiveTab(t.id)}
              id={`debug-tab-${t.id}`}
            >
              <span className={styles.stepNum}>{t.step}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className={styles.body}>

          {/* ── S1: Latest Failure ─────────────────────────── */}
          {activeTab === 'overview' && (
            <>
              {!failure ? (
                <div className={styles.emptyState}>
                  <CheckCircle2 size={32} className={styles.emptyIcon} color="#3fb950" />
                  <p className={styles.emptyText}>No failures recorded.<br />System is clean.</p>
                  <p style={{ fontSize: '10px', color: '#484f58' }}>Last checked: {lastRefresh}</p>
                </div>
              ) : (
                <>
                  <div className={styles.section}>
                    <div className={`${styles.sectionTitle} ${styles.error}`}>
                      <ShieldAlert size={12} /> Latest Failure
                    </div>
                    <div className={styles.failureCard}>
                      <div className={styles.failureMeta}>
                        <span className={`${styles.tag} ${styles[`layer-${failure.layer}`]}`}>{failure.layer}</span>
                        <span className={`${styles.tag} ${styles[`severity-${failure.severity}`]}`}>{failure.severity}</span>
                        <span className={styles.tag} style={{ background: 'rgba(255,255,255,0.05)', color: '#8b949e' }}>{failure.type}</span>
                      </div>
                      <div className={styles.failureError}>{failure.error}</div>
                      <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '6px' }}>
                        <strong style={{ color: '#484f58' }}>Component:</strong> {failure.component}
                      </div>
                      <div className={styles.failureHint}>
                        💡 {failure.fixHint}
                      </div>
                      <div className={styles.traceId}>traceId: {failure.traceId}</div>
                    </div>
                  </div>

                  {failure.propsSnapshot && (
                    <div className={styles.section}>
                      <div className={styles.sectionTitle}>Props Snapshot</div>
                      <div className={styles.jsonViewer}>
                        {JSON.stringify(failure.propsSnapshot, null, 2)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── S2: Trace ──────────────────────────────────── */}
          {activeTab === 'trace' && (
            <>
              {traceSteps.length === 0 ? (
                <div className={styles.emptyState}>
                  <Activity size={28} className={styles.emptyIcon} />
                  <p className={styles.emptyText}>No trace steps recorded.<br />Run the protocol first.</p>
                </div>
              ) : (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>
                    <Activity size={12} /> Execution Timeline
                    <span style={{ marginLeft: 'auto', color: '#484f58' }}>{traceSteps.length} steps</span>
                  </div>
                  <div className={styles.timeline}>
                    {traceSteps.map((s, i) => (
                      <div key={i} className={styles.timelineItem}>
                        <div className={`${styles.timelineDot} ${styles[s.status]}`} />
                        <div className={styles.timelineStep}>
                          {s.step}
                          {s.error && <span className={styles.timelineErr}>↳ {s.error}</span>}
                        </div>
                        {s.duration != null && (
                          <span className={styles.timelineDuration}>{s.duration.toFixed(1)}ms</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── S3: Schema Errors ──────────────────────────── */}
          {activeTab === 'schema' && (
            <>
              {schemaErrors.length === 0 ? (
                <div className={styles.emptyState}>
                  <CheckCircle2 size={28} className={styles.emptyIcon} color="#3fb950" />
                  <p className={styles.emptyText}>No schema violations detected.<br />Data contracts are intact.</p>
                </div>
              ) : (
                <div className={styles.section}>
                  <div className={`${styles.sectionTitle} ${styles.error}`}>
                    <Database size={12} /> Contract Violations ({schemaErrors.length})
                  </div>
                  <div className={`${styles.codeSearchWarning}`}>
                    ⛔ Schema violation detected. STOP debugging. Report contract violation. Code search BLOCKED.
                  </div>
                  {schemaErrors.map((e, i) => (
                    <div key={i} className={styles.schemaError}>
                      <div className={styles.schemaField}>{e.source} → {e.field}</div>
                      <div className={styles.schemaDetail}>
                        Expected: <strong style={{ color: '#58a6ff' }}>{e.expected}</strong><br />
                        Received: <strong style={{ color: '#f85149' }}>{JSON.stringify(e.received)}</strong><br />
                        {e.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── S4: API Diagnostics ────────────────────────── */}
          {activeTab === 'api' && (
            <>
              {apiCalls.length === 0 ? (
                <div className={styles.emptyState}>
                  <Globe size={28} className={styles.emptyIcon} />
                  <p className={styles.emptyText}>No API calls recorded.<br />Trigger a data fetch first.</p>
                </div>
              ) : (
                <div className={styles.section}>
                  <div className={`${styles.sectionTitle} ${apiFailures.length > 0 ? styles.error : styles.ok}`}>
                    <Globe size={12} /> API Calls ({apiCalls.length} total, {apiFailures.length} failed)
                  </div>
                  {apiCalls.map((c, i) => {
                    const failed = (c.status !== null && c.status >= 400) || c.responseType === 'network-error' || c.responseType === 'timeout' || c.responseType === 'html';
                    return (
                      <div key={i} className={styles.apiCall}>
                        <div className={styles.apiCallHeader}>
                          <span className={styles.methodTag}>{c.method}</span>
                          <span className={`${styles.statusTag} ${failed ? styles.fail : styles.ok}`}>
                            {c.status ?? c.responseType}
                          </span>
                          <span className={styles.timelineDuration}>{c.duration.toFixed(0)}ms</span>
                        </div>
                        <div className={styles.apiEndpoint}>{c.endpoint}</div>
                        {c.diagnosis && <div className={styles.apiDiag}>↳ {c.diagnosis}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── S5: Root Cause ─────────────────────────────── */}
          {activeTab === 'rootcause' && (
            <>
              {!rootCause ? (
                <div className={styles.emptyState}>
                  <Zap size={28} className={styles.emptyIcon} />
                  <p className={styles.emptyText}>No root cause analysis yet.<br />Run the protocol first.</p>
                </div>
              ) : (
                <>
                  <div className={styles.section}>
                    <div className={`${styles.sectionTitle} ${rootCause.rootCause === 'UNKNOWN' ? styles.warn : styles.info}`}>
                      <Zap size={12} /> Root Cause Analysis
                    </div>
                    <div className={styles.rootCauseBlock}>
                      <div className={styles.rootCauseLabel}>Root Cause</div>
                      <div className={`${styles.rootCauseText} ${rootCause.rootCause === 'UNKNOWN' ? styles.unknown : ''}`}>
                        {rootCause.rootCause}
                      </div>
                      <div className={`${styles.confidenceBadge} ${styles[`confidence-${rootCause.confidence}`]}`}>
                        Confidence: {rootCause.confidence.toUpperCase()} · Origin: {rootCause.originLayer}
                      </div>
                    </div>

                    <div className={styles.sectionTitle} style={{ marginTop: '16px' }}>
                      <ChevronRight size={12} /> Fix
                    </div>
                    <div className={styles.failureHint} style={{ borderTop: 'none', paddingTop: 0 }}>
                      {rootCause.fix}
                    </div>
                  </div>

                  {/* Code search gate */}
                  <div className={rootCause.rootCause === 'UNKNOWN' ? styles.codeSearchAllowed : styles.codeSearchWarning}>
                    {rootCause.rootCause === 'UNKNOWN'
                      ? '⚠ rootCause = UNKNOWN — Code search is now permitted. Debug Layer exhausted.'
                      : '⛔ Code search is BLOCKED. Root cause identified. Do not search codebase.'}
                  </div>

                  {/* Upstream chain */}
                  {rootCause.upstream.length > 0 && (
                    <div className={styles.section}>
                      <div className={styles.sectionTitle}>
                        <Layers size={12} /> Upstream Event Chain
                      </div>
                      <div className={styles.timeline}>
                        {rootCause.upstream.map((u, i) => (
                          <div key={i} className={styles.timelineItem}>
                            <div className={`${styles.timelineDot} ${styles[u.status]}`} />
                            <div className={styles.timelineStep}>
                              <span style={{ color: '#484f58' }}>[{u.layer}]</span> {u.step}
                              {u.detail && <span className={styles.timelineErr}>↳ {u.detail}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── History ────────────────────────────────────── */}
          {activeTab === 'history' && (
            <>
              {allHistory.length === 0 ? (
                <div className={styles.emptyState}>
                  <CheckCircle2 size={28} className={styles.emptyIcon} color="#3fb950" />
                  <p className={styles.emptyText}>No failure history yet.</p>
                </div>
              ) : (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>
                    All Failures ({allHistory.length})
                  </div>
                  {allHistory.map((f, i) => (
                    <div
                      key={i}
                      className={styles.historyItem}
                      onClick={() => {
                        setFailure(f);
                        const rc = DebugAPI.getRootCause(f.traceId);
                        const rpt = DebugAPI.runAgentProtocol(f.traceId);
                        setRootCause(rc);
                        setReport(rpt);
                        setActiveTab('overview');
                      }}
                      title="Click to inspect this failure"
                    >
                      <span className={`${styles.tag} ${styles[`layer-${f.layer}`]}`}>{f.layer}</span>
                      <span className={styles.historyStep}>{f.component}: {f.error}</span>
                      <span className={styles.historyTime}>{new Date(f.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.runBtn} onClick={runProtocol} id="debug-run-protocol-btn">
            <Bug size={13} />
            Run Agent Protocol
          </button>
          <button className={styles.clearBtn} onClick={handleClear} id="debug-clear-footer-btn">
            <Trash2 size={12} />
            Clear
          </button>
        </div>

      </div>
    </>
  );
};
