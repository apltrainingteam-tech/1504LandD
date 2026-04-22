import React, { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, CheckCircle, XCircle, Clock,
  RotateCcw, TrendingUp, Users, AlertCircle, Filter,
  Upload, BellRing
} from 'lucide-react';
import { usePlanningFlow, TrainingBatch, CandidateRecord, BatchAttStatus } from '../../context/PlanningFlowContext';
import { useMasterData } from '../../context/MasterDataContext';
import { Employee } from '../../types/employee';
import { Attendance } from '../../types/attendance';

interface Props {
  employees: Employee[];
  attendance: Attendance[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<BatchAttStatus, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  pending: { label: 'Pending',   color: '#d97706',        bg: 'rgba(245,158,11,.12)',  Icon: Clock      },
  present: { label: 'Completed', color: '#059669',        bg: 'rgba(16,185,129,.12)',  Icon: CheckCircle },
  absent:  { label: 'Drop-off',  color: 'var(--danger)',  bg: 'rgba(239,68,68,.12)',   Icon: XCircle     },
};

const SOURCE_META = {
  NOTIFICATION: { label: 'Planned Training',     color: '#2563eb', bg: 'rgba(37,99,235,.1)',  Icon: BellRing },
  UPLOAD:       { label: 'Uploaded Attendance',  color: '#059669', bg: 'rgba(5,150,105,.1)',  Icon: Upload   },
} as const;

const fmtDate = (s?: string) =>
  !s ? '—' : new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const monthLabel = (s?: string) =>
  !s ? '' : new Date(s + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

// ─── Derive UPLOAD batches from raw Attendance records ─────────────────────────
// Groups attendance records by [trainingType + teamId + month].

const deriveUploadBatches = (attendance: Attendance[]): TrainingBatch[] => {
  const map = new Map<string, { rows: Attendance[] }>();

  attendance.forEach(a => {
    if (!a.trainingType || !a.teamId) return;
    const month = (a.month || a.attendanceDate?.substring(0, 7) || '');
    const key   = `${a.trainingType}::${a.teamId}::${month}`;
    if (!map.has(key)) map.set(key, { rows: [] });
    map.get(key)!.rows.push(a);
  });

  const batches: TrainingBatch[] = [];

  map.forEach((val, key) => {
    const { rows } = val;
    const first = rows[0];
    // Determine date range from records
    const dates     = rows.map(r => r.attendanceDate).filter(Boolean).sort();
    const startDate = dates[0]  || first.month || '';
    const endDate   = dates[dates.length - 1] || startDate;

    batches.push({
      id:           `upload::${key}`,
      draftId:      `upload::${key}`,
      source:       'UPLOAD',
      trainingType: String(first.trainingType),
      team:         first.team || first.teamId || '',
      teamId:       first.teamId || '',
      trainer:      first.trainerId || '',
      startDate,
      endDate,
      committedAt:  startDate,
      candidates:   rows.map(r => ({
        empId:      r.employeeId,
        attendance: r.attendanceStatus?.toLowerCase().includes('present') ? 'present' : 'absent' as BatchAttStatus,
        score:      '',
      })),
    });
  });

  // Latest startDate first
  return batches.sort((a, b) => b.startDate.localeCompare(a.startDate));
};

// ─── Attendance Toggle ─────────────────────────────────────────────────────────

const AttToggle: React.FC<{
  value: BatchAttStatus;
  readOnly?: boolean;
  onChange: (v: BatchAttStatus) => void;
}> = ({ value, readOnly, onChange }) => {
  const opts: { key: BatchAttStatus; label: string; color: string }[] = [
    { key: 'pending', label: '—', color: '#d97706' },
    { key: 'present', label: '✓', color: '#059669' },
    { key: 'absent',  label: '✗', color: 'var(--danger)' },
  ];
  return (
    <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', width: 'fit-content', opacity: readOnly ? 0.7 : 1 }}>
      {opts.map(o => {
        const act = value === o.key;
        return (
          <button key={o.key} onClick={() => !readOnly && onChange(o.key)} title={STATUS_META[o.key].label}
            disabled={readOnly}
            style={{
              padding: '4px 11px', border: 'none', cursor: readOnly ? 'default' : 'pointer',
              fontSize: '12px', fontWeight: 700,
              background: act ? o.color : 'transparent',
              color:      act ? '#fff'  : 'var(--text-secondary)',
              transition: 'all .12s',
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

// ─── Per-batch Metrics ─────────────────────────────────────────────────────────

const batchMetrics = (candidates: CandidateRecord[]) => {
  const total   = candidates.length;
  const present = candidates.filter(c => c.attendance === 'present').length;
  const absent  = candidates.filter(c => c.attendance === 'absent').length;
  const scores  = candidates.map(c => parseFloat(c.score)).filter(n => !isNaN(n));
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const attPct   = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : null;
  return { total, present, absent, pending: total - present - absent, avgScore, attPct };
};

// ─── Batch Card ────────────────────────────────────────────────────────────────

const BatchCard: React.FC<{
  batch: TrainingBatch;
  employees: Employee[];
  resolveTrainer: (id?: string) => string;
  resolveTeam: (id?: string, fb?: string) => string;
  onUpdate: (empId: string, update: Partial<CandidateRecord>) => void;
}> = ({ batch, employees, resolveTrainer, resolveTeam, onUpdate }) => {
  const [open, setOpen] = useState(false);
  const m   = batchMetrics(batch.candidates);
  const sm  = SOURCE_META[batch.source];
  const isUpload = batch.source === 'UPLOAD';

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', marginBottom: '10px' }}>

      {/* ── LEVEL 1: Header ── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 18px',
          background: 'var(--bg-card)', cursor: 'pointer',
          borderBottom: open ? '1px solid var(--border-color)' : 'none',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,.03)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
      >
        {open ? <ChevronDown size={15} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
               : <ChevronRight size={15} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />}

        {/* Source badge */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '20px', background: sm.bg, color: sm.color, fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' }}>
          <sm.Icon size={10} />{sm.label}
        </span>

        {/* Training type */}
        <span style={{ padding: '3px 10px', borderRadius: '20px', background: 'rgba(99,102,241,.1)', color: 'var(--accent-primary)', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
          {batch.trainingType}
        </span>

        {/* Team name */}
        <span style={{ fontWeight: 700, fontSize: '14px' }}>
          {resolveTeam(batch.teamId, batch.team)}
        </span>

        {/* Date range */}
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {fmtDate(batch.startDate)}
          {batch.endDate && batch.endDate !== batch.startDate ? ` → ${fmtDate(batch.endDate)}` : ''}
        </span>

        {/* Trainer */}
        {batch.trainer && (
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            👤 {resolveTrainer(batch.trainer)}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Per-batch metrics */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Pill label="Total"    value={m.total}                          color="var(--accent-primary)" />
          <Pill label="✓"       value={m.present}                         color="#059669"              />
          <Pill label="✗"       value={m.absent}                          color="var(--danger)"        />
          {m.attPct !== null && <Pill label="Att%" value={`${m.attPct}%`} color={m.attPct >= 80 ? '#059669' : '#d97706'} />}
          {m.avgScore !== null && <Pill label="Score" value={`${m.avgScore}`} color="var(--text-primary)" />}
        </div>
      </div>

      {/* ── LEVEL 2: Candidate Table ── */}
      {open && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,.022)', borderBottom: '1px solid var(--border-color)' }}>
                {['Emp ID', 'Name', 'Designation', 'HQ', 'State', 'Attendance', 'Score', 'Status'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batch.candidates.map((c, i) => {
                const emp = employees.find(e => String(e.employeeId) === c.empId);
                const rs  = STATUS_META[c.attendance];
                return (
                  <tr key={c.empId}
                    style={{ borderBottom: '1px solid var(--border-color)', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,.01)', transition: 'background .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,.035)')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,.01)')}
                  >
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>{c.empId}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 500 }}>{emp?.name || '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{emp?.designation || '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: '12px' }}>{emp?.hq || '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: '12px' }}>{emp?.state || '—'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      {/* UPLOAD batches: attendance is read-only (from source file). NOTIFICATION: editable. */}
                      <AttToggle value={c.attendance} readOnly={isUpload} onChange={v => onUpdate(c.empId, { attendance: v })} />
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <input
                        type="number" min={0} max={100} placeholder="—"
                        value={c.score}
                        onChange={e => onUpdate(c.empId, { score: e.target.value })}
                        style={{ width: '62px', padding: '4px 7px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', background: 'var(--bg)', color: 'var(--text-primary)', textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '12px', background: rs.bg, color: rs.color, fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        <rs.Icon size={10} />{rs.label}
                      </span>
                      {c.attendance === 'absent' && (
                        <div style={{ marginTop: '3px', fontSize: '10px', color: '#d97706', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
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
      )}
    </div>
  );
};

const Pill: React.FC<{ label: string; value: number | string; color: string }> = ({ label, value, color }) => (
  <div style={{ textAlign: 'center', minWidth: '36px' }}>
    <div style={{ fontSize: '13px', fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{label}</div>
  </div>
);

// ─── Main Page ─────────────────────────────────────────────────────────────────

export const TrainingDataPage: React.FC<Props> = ({ employees, attendance }) => {
  const { getBatches, updateBatchCandidate } = usePlanningFlow();
  const { teams: masterTeams, trainers: masterTrainers } = useMasterData();

  const resolveTrainer = (id?: string) =>
    masterTrainers.find(t => t.id === id)?.trainerName || (id || '—');
  const resolveTeam = (id?: string, fb?: string) =>
    masterTeams.find(t => t.id === id)?.teamName || (fb || id || '—');

  // ── Derive UPLOAD batches from attendance prop ─────────────────────────────
  const uploadBatches = useMemo(() => deriveUploadBatches(attendance), [attendance]);

  // ── Merge: NOTIFICATION (context) + UPLOAD (derived) ───────────────────────
  // De-dupe by id, then sort by startDate descending (latest first)
  const notificationBatches = getBatches();
  const allBatches: TrainingBatch[] = useMemo(() => {
    const seen = new Set<string>();
    const merged = [...notificationBatches, ...uploadBatches].filter(b => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
    return merged.sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [notificationBatches, uploadBatches]);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterTeam,   setFilterTeam]   = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterMonth,  setFilterMonth]  = useState('');
  const [filterSource, setFilterSource] = useState<'' | 'NOTIFICATION' | 'UPLOAD'>('');

  const teamOptions  = useMemo(() => [...new Set(allBatches.map(b => b.teamId).filter(Boolean))], [allBatches]);
  const typeOptions  = useMemo(() => [...new Set(allBatches.map(b => b.trainingType).filter(Boolean))], [allBatches]);
  const monthOptions = useMemo(() =>
    [...new Set(allBatches.map(b => b.startDate?.substring(0, 7)).filter(Boolean))].sort().reverse(),
    [allBatches]
  );

  const filtered = useMemo(() =>
    allBatches.filter(b => {
      if (filterTeam   && b.teamId       !== filterTeam)   return false;
      if (filterType   && b.trainingType !== filterType)   return false;
      if (filterMonth  && b.startDate?.substring(0, 7) !== filterMonth) return false;
      if (filterSource && b.source       !== filterSource) return false;
      return true;
    }),
    [allBatches, filterTeam, filterType, filterMonth, filterSource]
  );

  // ── Global metrics (across filtered) ─────────────────────────────────────
  const allC    = filtered.flatMap(b => b.candidates);
  const gTotal  = allC.length;
  const gPresent= allC.filter(c => c.attendance === 'present').length;
  const gAbsent = allC.filter(c => c.attendance === 'absent').length;
  const gPending= allC.filter(c => c.attendance === 'pending').length;
  const gAttPct = gPresent + gAbsent > 0 ? Math.round((gPresent / (gPresent + gAbsent)) * 100) : 0;
  const gScores = allC.map(c => parseFloat(c.score)).filter(n => !isNaN(n));
  const gAvg    = gScores.length > 0 ? Math.round(gScores.reduce((a, b) => a + b, 0) / gScores.length) : null;

  const hasFilters = !!(filterTeam || filterType || filterMonth || filterSource);

  // ── Empty State ───────────────────────────────────────────────────────────
  if (allBatches.length === 0) {
    return (
      <div className="animate-fade-in" style={{ padding: '24px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 700 }}>Training Data</h1>
        <p style={{ margin: '0 0 32px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Unified view of all uploaded attendance and planned training batches.
        </p>
        <div style={{ padding: '56px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
          <TrendingUp size={40} style={{ margin: '0 auto 14px', color: 'var(--border-color)' }} />
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No training data yet</div>
          <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
            Data appears here from two sources:<br />
            <strong>1.</strong> Upload attendance files via <strong>Upload Portal</strong><br />
            <strong>2.</strong> Send notification emails from <strong>Notification</strong> page (status → SENT)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ padding: '24px' }}>

      {/* Page heading */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700 }}>Training Data</h1>
          <p style={{ margin: '5px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Unified view · {allBatches.length} batch{allBatches.length !== 1 ? 'es' : ''} total
            ({notificationBatches.length} planned · {uploadBatches.length} uploaded)
          </p>
        </div>
      </div>

      {/* Global metrics */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total',    value: gTotal,                    color: 'var(--accent-primary)', Icon: Users       },
          { label: 'Att %',    value: `${gAttPct}%`,             color: '#059669',               Icon: TrendingUp  },
          { label: 'Present',  value: gPresent,                  color: '#059669',               Icon: CheckCircle },
          { label: 'Drop-off', value: gAbsent,                   color: 'var(--danger)',         Icon: XCircle     },
          { label: 'Pending',  value: gPending,                  color: '#d97706',               Icon: AlertCircle },
          { label: 'Avg Score',value: gAvg !== null ? gAvg : '—', color: 'var(--text-primary)',  Icon: TrendingUp  },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 16px', minWidth: '76px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: '3px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={13} color="var(--text-secondary)" />

        {/* Source filter */}
        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          {([
            { key: '', label: 'All' },
            { key: 'NOTIFICATION', label: '📋 Planned' },
            { key: 'UPLOAD',       label: '⬆ Uploaded' },
          ] as { key: '' | 'NOTIFICATION' | 'UPLOAD'; label: string }[]).map(o => (
            <button key={o.key} onClick={() => setFilterSource(o.key)} style={{
              padding: '5px 11px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
              background: filterSource === o.key ? 'var(--accent-primary)' : 'transparent',
              color:      filterSource === o.key ? '#fff' : 'var(--text-secondary)',
              transition: 'all .12s',
            }}>{o.label}</button>
          ))}
        </div>

        <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer' }}>
          <option value="">All Teams</option>
          {teamOptions.map(id => <option key={id} value={id}>{resolveTeam(id)}</option>)}
        </select>

        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer' }}>
          <option value="">All Types</option>
          {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer' }}>
          <option value="">All Months</option>
          {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>

        {hasFilters && (
          <button onClick={() => { setFilterTeam(''); setFilterType(''); setFilterMonth(''); setFilterSource(''); }}
            style={{ padding: '5px 12px', borderRadius: '7px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
            Clear
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-secondary)' }}>
          Showing <strong>{filtered.length}</strong> of {allBatches.length} batches
        </span>
      </div>

      {/* Batch list */}
      {filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '10px', fontSize: '13px' }}>
          No batches match the current filters.
        </div>
      ) : (
        filtered.map(batch => (
          <BatchCard
            key={batch.id}
            batch={batch}
            employees={employees}
            resolveTrainer={resolveTrainer}
            resolveTeam={resolveTeam}
            onUpdate={(empId, update) =>
              batch.source === 'NOTIFICATION'
                ? updateBatchCandidate(batch.id, empId, update)
                : undefined // UPLOAD attendance is read-only (from source file)
            }
          />
        ))
      )}
    </div>
  );
};
