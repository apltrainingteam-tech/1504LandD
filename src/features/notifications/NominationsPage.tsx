import React, { useState, useMemo } from 'react';
import { CheckCircle, Lock, AlertTriangle, Filter, Users } from 'lucide-react';
import { usePlanningFlow, NominationDraft } from '../../context/PlanningFlowContext';
import { Employee } from '../../types/employee';
import { TrainingNomination } from '../../types/attendance';
import { parseAnyDate } from '../../utils/dateParser';

/** Calculates tenure from DOJ to today → "Xyr Ym" */
function calcTenure(doj: string | undefined | null): string {
  if (!doj) return '--';
  const parsed = parseAnyDate(doj);
  if (!parsed) return '--';
  const start = new Date(parsed);
  if (isNaN(start.getTime())) return '--';
  const today = new Date();
  let years = today.getFullYear() - start.getFullYear();
  let months = today.getMonth() - start.getMonth();
  if (today.getDate() < start.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years < 0) return '--';
  return `${years}yr ${months}m`;
}

/** Returns DOJ as ms for sorting; missing DOJ goes to end */
function dojMs(doj: string | undefined | null): number {
  if (!doj) return Infinity;
  const parsed = parseAnyDate(doj);
  if (!parsed) return Infinity;
  const t = new Date(parsed).getTime();
  return isNaN(t) ? Infinity : t;
}

interface Props {
  employees: Employee[];
  nominations: TrainingNomination[];
}

type FilterMode = 'all' | 'first' | 'repeat';

const DES_COLORS: Record<string, { bg: string; color: string }> = {
  MR:            { bg: 'rgba(59,130,246,.12)',  color: '#2563eb' },
  FLM:           { bg: 'rgba(16,185,129,.12)',  color: '#059669' },
  SLM:           { bg: 'rgba(139,92,246,.12)',  color: '#7c3aed' },
  'SR MANAGER':  { bg: 'rgba(245,158,11,.12)',  color: '#d97706' },
  'SR. MANAGER': { bg: 'rgba(245,158,11,.12)',  color: '#d97706' },
};

const normDes = (d?: string) => (d || '').toUpperCase().split('(')[0].trim() || 'Other';
const fmtDate = (s?: string) => !s ? '' : new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

const DesBadge: React.FC<{ des: string }> = ({ des }) => {
  const s = DES_COLORS[des] ?? { bg: 'rgba(0,0,0,.06)', color: '#6b7280' };
  return (
    <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {des || '—'}
    </span>
  );
};

/** Builds a per-employee array of historical nomination dates (up to 5), sorted oldest-first. */
const buildNoticeHistory = (nominations: TrainingNomination[], trainingType?: string): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  nominations
    .filter(n => !trainingType || n.trainingType.toUpperCase() === trainingType.toUpperCase())
    .sort((a, b) => a.notificationDate.localeCompare(b.notificationDate))
    .forEach(n => {
      if (!map.has(n.employeeId)) map.set(n.employeeId, []);
      const arr = map.get(n.employeeId)!;
      if (arr.length < 5) arr.push(n.notificationDate);
    });
  return map;
};

export const NominationsPage: React.FC<Props> = ({ employees, nominations }) => {
  const { getDrafts, updateDraft, selectionSession } = usePlanningFlow();

  const sessionTeamIds = selectionSession?.teamIds ?? [];
  const sessionType    = selectionSession?.trainingType;

  const [activeTeamId, setActiveTeamId]   = useState<string>(sessionTeamIds[0] ?? '');
  const [filterMode, setFilterMode]       = useState<FilterMode>('all');

  const teamDrafts = useMemo(() => getDrafts({ teamIds: sessionTeamIds }), [getDrafts, sessionTeamIds]);
  const draft: NominationDraft | undefined = useMemo(
    () => teamDrafts.find(d => d.teamId === (activeTeamId || sessionTeamIds[0])),
    [teamDrafts, activeTeamId, sessionTeamIds]
  );

  // Historical notice map
  const noticeMap = useMemo(() => buildNoticeHistory(nominations, sessionType), [nominations, sessionType]);

  // All employees for the active team
  const teamEmps = useMemo(() =>
    employees.filter(e => e.teamId === (activeTeamId || sessionTeamIds[0])),
    [employees, activeTeamId, sessionTeamIds]
  );

  // Apply filter chip + sort oldest joiner first
  const filteredEmps = useMemo(() => {
    let list: Employee[];
    switch (filterMode) {
      case 'first':  list = teamEmps.filter(e => (noticeMap.get(String(e.employeeId))?.length ?? 0) === 0); break;
      case 'repeat': list = teamEmps.filter(e => (noticeMap.get(String(e.employeeId))?.length ?? 0) >= 2); break;
      default:       list = [...teamEmps];
    }
    // Sort: oldest DOJ first (smallest timestamp = joined earliest)
    return list.sort((a, b) => dojMs(a.doj) - dojMs(b.doj));
  }, [teamEmps, noticeMap, filterMode]);

  const isLocked = draft ? draft.status !== 'DRAFT' : false;

  const toggleEmp = (empId: string, checked: boolean) => {
    if (!draft || isLocked) return;
    let next = [...draft.candidates];
    if (checked) {
      if (!next.includes(empId) && next.length < 40) next.push(empId);
    } else {
      next = next.filter(id => id !== empId);
    }
    updateDraft(draft.id, { candidates: next });
  };

  const handleApprove = () => {
    if (!draft) return;
    if (draft.candidates.length === 0) { alert('Select at least 1 candidate before approving.'); return; }
    if (!window.confirm(`Approve ${draft.candidates.length} candidates?`)) return;
    updateDraft(draft.id, { status: 'APPROVED', approvedBy: 'Sales Head', approvedAt: new Date().toISOString() });
  };

  // Stats
  const included = draft?.candidates.length ?? 0;
  const repeatCount = filteredEmps.filter(e => (noticeMap.get(String(e.employeeId))?.length ?? 0) >= 2).length;

  if (sessionTeamIds.length === 0) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Users size={40} style={{ margin: '0 auto 12px', color: 'var(--border-color)' }} />
        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>No active planning session</div>
        <div style={{ fontSize: '13px' }}>Select teams in <strong>Training Requirement</strong> and create plans on the <strong>Calendar</strong>.</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ padding: '24px' }}>
      {/* Page heading */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700 }}>Nominations</h1>
          <p style={{ margin: '5px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Select candidates, review history, and approve the nomination list.
          </p>
        </div>
        {selectionSession && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: 'rgba(16,185,129,.1)', color: '#059669', border: '1px solid rgba(16,185,129,.3)' }}>
            ● {selectionSession.trainingType} · {selectionSession.teams.join(', ')}
          </span>
        )}
      </div>

      {/* Team tabs */}
      {sessionTeamIds.length > 1 && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '16px', overflowX: 'auto' }}>
          {sessionTeamIds.map(tid => {
            const d = teamDrafts.find(x => x.teamId === tid);
            const tName = d?.team || tid;
            const done = d && d.status !== 'DRAFT';
            const active = (activeTeamId || sessionTeamIds[0]) === tid;
            return (
              <button key={tid} onClick={() => setActiveTeamId(tid)} style={{
                padding: '9px 18px', border: 'none', borderBottom: `2px solid ${active ? 'var(--accent-primary)' : 'transparent'}`,
                background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: active ? 700 : 500,
                color: active ? 'var(--accent-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}>
                {tName}{done && <CheckCircle size={12} color="var(--success)" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {/* Filter chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={13} color="var(--text-secondary)" />
          {([
            { key: 'all',    label: `All (${teamEmps.length})` },
            { key: 'first',  label: `First Time (${teamEmps.filter(e=>(noticeMap.get(String(e.employeeId))?.length??0)===0).length})` },
            { key: 'repeat', label: `Repeat 2+ (${repeatCount})`, warn: true },
          ] as { key: FilterMode; label: string; warn?: boolean }[]).map(f => (
            <button key={f.key} onClick={() => setFilterMode(f.key)} style={{
              padding: '4px 12px', borderRadius: '20px', border: `1px solid ${filterMode === f.key ? (f.warn ? 'var(--danger)' : 'var(--accent-primary)') : 'var(--border-color)'}`,
              background: filterMode === f.key ? (f.warn ? 'rgba(239,68,68,.08)' : 'rgba(99,102,241,.08)') : 'transparent',
              color: filterMode === f.key ? (f.warn ? 'var(--danger)' : 'var(--accent-primary)') : 'var(--text-secondary)',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer'
            }}>{f.label}</button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* status pill */}
          {draft && (
            <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
              background: draft.status === 'DRAFT' ? 'rgba(245,158,11,.12)' : 'rgba(16,185,129,.12)',
              color: draft.status === 'DRAFT' ? '#d97706' : '#059669',
              display: 'flex', alignItems: 'center', gap: '4px'
            }}>
              {draft.status === 'DRAFT' ? <AlertTriangle size={11} /> : <CheckCircle size={11} />}
              {draft.status}
            </span>
          )}
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Selected: <strong style={{ color: 'var(--accent-primary)' }}>{included}</strong>/40
          </span>
        </div>
      </div>

      {/* TABLE */}
      <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border-color)' }}>
              {!isLocked && <th style={{ padding: '10px 12px', width: '36px' }} />}
              <th style={thStyle}>Emp ID</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Designation</th>
              <th style={thStyle}>HQ</th>
              <th style={thStyle}>State</th>
              <th style={{ ...thStyle, color: 'var(--accent-primary)' }}>Tenure</th>
              {[1,2,3,4,5].map(n => (
                <th key={n} style={{ ...thStyle, color: n >= 3 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                  Notice {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEmps.length === 0 ? (
              <tr><td colSpan={isLocked ? 11 : 12} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No employees match this filter.</td></tr>
            ) : filteredEmps.map((emp, i) => {
              const eid     = String(emp.employeeId);
              const isIn    = draft?.candidates.includes(eid) ?? false;
              const history = noticeMap.get(eid) ?? [];
              const isRepeat = history.length >= 2;
              const isHighRepeat = history.length >= 3;

              return (
                <tr
                  key={emp.employeeId}
                  onClick={() => !isLocked && toggleEmp(eid, !isIn)}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    background: isHighRepeat ? 'rgba(239,68,68,.03)' : isIn ? (i%2===0?'rgba(99,102,241,.05)':'rgba(99,102,241,.03)') : (i%2===0?'transparent':'rgba(0,0,0,.01)'),
                    cursor: isLocked ? 'default' : 'pointer', transition: 'background .1s',
                    opacity: !draft || isIn ? 1 : 0.5
                  }}
                  onMouseEnter={e => { if (!isLocked) e.currentTarget.style.background = 'rgba(99,102,241,.07)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isHighRepeat ? 'rgba(239,68,68,.03)' : isIn ? (i%2===0?'rgba(99,102,241,.05)':'rgba(99,102,241,.03)') : (i%2===0?'transparent':'rgba(0,0,0,.01)'); }}
                >
                  {!isLocked && (
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <input type="checkbox" checked={isIn} onChange={() => toggleEmp(eid, !isIn)} onClick={e => e.stopPropagation()} style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer', width: '14px', height: '14px' }} />
                    </td>
                  )}
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{emp.employeeId}</td>
                  <td style={{ padding: '8px 10px', fontWeight: isIn ? 600 : 400, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {emp.name}
                    {isHighRepeat && <span title="3+ nominations" style={{ fontSize: '10px', background: 'rgba(239,68,68,.12)', color: 'var(--danger)', padding: '1px 6px', borderRadius: '8px', fontWeight: 700 }}>N{history.length}</span>}
                    {isRepeat && !isHighRepeat && <span title="Repeat nomination" style={{ fontSize: '10px', background: 'rgba(245,158,11,.12)', color: '#d97706', padding: '1px 6px', borderRadius: '8px', fontWeight: 700 }}>N{history.length}</span>}
                  </td>
                  <td style={{ padding: '8px 10px' }}><DesBadge des={normDes(emp.designation)} /></td>
                  <td style={{ padding: '8px 10px' }}>{emp.hq || '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{emp.state || '—'}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
                      fontSize: '11px', fontWeight: 700,
                      background: 'rgba(99,102,241,.1)', color: 'var(--accent-primary)',
                      whiteSpace: 'nowrap'
                    }} title={emp.doj || ''}>
                      {calcTenure(emp.doj)}
                    </span>
                  </td>
                  {[0,1,2,3,4].map(idx => (
                    <td key={idx} style={{ padding: '8px 10px', fontSize: '11px', color: idx >= 2 ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: idx >= 2 ? 700 : 400 }}>
                      {fmtDate(history[idx])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Action bar */}
      {draft && (
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 0', borderTop: '1px solid var(--border-color)' }}>
          {isLocked ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <Lock size={13} />
              {draft.status === 'APPROVED' && `Approved by ${draft.approvedBy || 'Sales Head'}${draft.approvedAt ? ' on ' + fmtDate(draft.approvedAt) : ''}`}
              {draft.status === 'SENT' && 'Sent'}
              {draft.status === 'COMPLETED' && 'Completed'}
            </div>
          ) : (
            <>
              <button className="btn btn-secondary">Save Draft</button>
              <button
                onClick={handleApprove}
                disabled={included === 0}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', border: 'none', background: included === 0 ? 'var(--border-color)' : 'var(--success)', color: 'white', fontWeight: 700, fontSize: '13px', cursor: included === 0 ? 'not-allowed' : 'pointer' }}
              >
                <CheckCircle size={14} /> Approve ({included})
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: '10px 10px', textAlign: 'left', fontSize: '11px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-secondary)', whiteSpace: 'nowrap'
};
