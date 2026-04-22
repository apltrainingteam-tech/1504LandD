import React, { useState, useMemo, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, RotateCcw, TrendingUp, Users, AlertCircle } from 'lucide-react';
import { usePlanningFlow } from '../../context/PlanningFlowContext';
import { Employee } from '../../types/employee';
import { Attendance } from '../../types/attendance';

interface Props {
  employees: Employee[];
  attendance: Attendance[];
}

type AttStatus = 'pending' | 'present' | 'absent';

interface TrainingRow {
  draftId:      string;
  empId:        string;
  name:         string;
  team:         string;
  trainingType: string;
  planDate:     string;
  attendance:   AttStatus;
  score:        string;
}

const fmtDate = (s?: string) =>
  !s ? '—' : new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const STATUS_META: Record<AttStatus, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  pending: { label: 'Pending',   color: '#d97706',          bg: 'rgba(245,158,11,.12)', Icon: Clock       },
  present: { label: 'Completed', color: 'var(--success)',   bg: 'rgba(16,185,129,.12)', Icon: CheckCircle  },
  absent:  { label: 'Drop-off',  color: 'var(--danger)',    bg: 'rgba(239,68,68,.12)',  Icon: XCircle     },
};

const AttToggle: React.FC<{ value: AttStatus; onChange: (v: AttStatus) => void }> = ({ value, onChange }) => {
  const order: AttStatus[] = ['pending', 'present', 'absent'];
  return (
    <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', width: 'fit-content' }}>
      {order.map(s => {
        const m   = STATUS_META[s];
        const act = value === s;
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            title={m.label}
            style={{
              padding: '4px 10px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700,
              background: act ? m.color : 'transparent',
              color: act ? '#fff' : 'var(--text-secondary)',
              transition: 'all .12s',
            }}
          >
            {s === 'pending' ? '—' : s === 'present' ? '✓' : '✗'}
          </button>
        );
      })}
    </div>
  );
};

export const TrainingDataPage: React.FC<Props> = ({ employees, attendance }) => {
  const { getDrafts, selectionSession } = usePlanningFlow();

  const sessionTeamIds = selectionSession?.teamIds ?? [];

  // Local override state: draftId+empId → {attendance, score}
  const [overrides, setOverrides] = useState<Record<string, { attendance: AttStatus; score: string }>>({});

  const key = (draftId: string, empId: string) => `${draftId}::${empId}`;

  const executionDrafts = useMemo(() =>
    getDrafts({ teamIds: sessionTeamIds.length > 0 ? sessionTeamIds : undefined })
      .filter(d => d.status === 'SENT' || d.status === 'COMPLETED'),
    [getDrafts, sessionTeamIds]
  );

  // Build rows
  const rows = useMemo((): TrainingRow[] =>
    executionDrafts.flatMap(draft =>
      draft.candidates.map(empId => {
        const emp     = employees.find(e => String(e.employeeId) === empId);
        const attRec  = attendance.find(a =>
          a.employeeId === empId &&
          a.trainingType?.toUpperCase() === draft.trainingType?.toUpperCase() &&
          (draft.startDate ? a.attendanceDate >= draft.startDate.substring(0, 10) : true)
        );

        const k        = key(draft.id, empId);
        const override = overrides[k];

        const attStatus: AttStatus = override?.attendance
          ?? (attRec
            ? attRec.attendanceStatus?.toLowerCase().includes('present') ? 'present' : 'absent'
            : 'pending');

        return {
          draftId:      draft.id,
          empId,
          name:         emp?.name || '—',
          team:         emp?.team || draft.team || '—',
          trainingType: draft.trainingType,
          planDate:     draft.startDate || '',
          attendance:   attStatus,
          score:        override?.score ?? '',
        };
      })
    ),
    [executionDrafts, employees, attendance, overrides]
  );

  const setAttendance = useCallback((draftId: string, empId: string, val: AttStatus) => {
    const k = key(draftId, empId);
    setOverrides(prev => ({ ...prev, [k]: { ...prev[k], attendance: val, score: prev[k]?.score ?? '' } }));
  }, []);

  const setScore = useCallback((draftId: string, empId: string, val: string) => {
    const k = key(draftId, empId);
    setOverrides(prev => ({ ...prev, [k]: { ...prev[k], score: val, attendance: prev[k]?.attendance ?? 'pending' } }));
  }, []);

  // Metrics
  const total    = rows.length;
  const present  = rows.filter(r => r.attendance === 'present').length;
  const absent   = rows.filter(r => r.attendance === 'absent').length;
  const pending  = rows.filter(r => r.attendance === 'pending').length;
  const attPct   = total > 0 ? Math.round((present / total) * 100) : 0;

  if (executionDrafts.length === 0) {
    return (
      <div className="animate-fade-in" style={{ padding: '24px' }}>
        <h1 style={{ margin: '0 0 20px', fontSize: '26px', fontWeight: 700 }}>Training Data</h1>
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <TrendingUp size={38} style={{ margin: '0 auto 14px', color: 'var(--border-color)' }} />
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>No plans in training phase</div>
          <div style={{ fontSize: '13px' }}>
            Plans appear here after the <strong>Notification</strong> email is sent (status → SENT).
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ padding: '24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700 }}>Training Data</h1>
        <p style={{ margin: '5px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Track attendance and performance for nominated candidates.
        </p>
      </div>
      {/* Metrics */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Planned', value: total,      color: 'var(--accent-primary)', Icon: Users       },
          { label: 'Attendance %',  value: `${attPct}%`, color: 'var(--success)',      Icon: TrendingUp  },
          { label: 'Present',       value: present,    color: '#059669',               Icon: CheckCircle  },
          { label: 'Drop-off',      value: absent,     color: 'var(--danger)',         Icon: XCircle     },
          { label: 'Pending',       value: pending,    color: '#d97706',               Icon: AlertCircle },
          { label: 'Re-nominate',   value: absent,     color: '#d97706',               Icon: RotateCcw   },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 16px', minWidth: '100px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: '3px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border-color)' }}>
              {['Emp ID', 'Name', 'Team', 'Training', 'Planned Date', 'Attendance', 'Score', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const m = STATUS_META[row.attendance];
              return (
                <tr key={`${row.draftId}-${row.empId}`}
                  style={{ borderBottom: '1px solid var(--border-color)', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,.015)', transition: 'background .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,.015)'}
                >
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{row.empId}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{row.name}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px' }}>{row.team}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(99,102,241,.1)', color: 'var(--accent-primary)', fontSize: '11px', fontWeight: 700 }}>{row.trainingType}</span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}>{fmtDate(row.planDate)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <AttToggle value={row.attendance} onChange={v => setAttendance(row.draftId, row.empId, v)} />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <input
                      type="number"
                      min={0} max={100}
                      placeholder="0–100"
                      value={row.score}
                      onChange={e => setScore(row.draftId, row.empId, e.target.value)}
                      style={{ width: '70px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', background: 'var(--bg)', color: 'var(--text-primary)' }}
                    />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '12px', background: m.bg, color: m.color, fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      <m.Icon size={10} />{m.label}
                    </span>
                    {row.attendance === 'absent' && (
                      <div style={{ marginTop: '3px', fontSize: '10px', color: '#d97706', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <RotateCcw size={9} />Re-nominate
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
