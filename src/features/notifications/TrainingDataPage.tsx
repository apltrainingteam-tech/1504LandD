import React, { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, CheckCircle, XCircle, Clock,
  RotateCcw, TrendingUp, Users, AlertCircle, Filter,
  Upload, BellRing
} from 'lucide-react';
import { usePlanningFlow, TrainingBatch, CandidateRecord, BatchAttStatus } from '../../core/context/PlanningFlowContext';
import { useMasterData } from '../../core/context/MasterDataContext';
import { Employee } from '../../types/employee';
import { Attendance } from '../../types/attendance';
import styles from './TrainingDataPage.module.css';

interface Props {
  employees: Employee[];
  attendance: Attendance[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<BatchAttStatus, { label: string; className: string; Icon: React.ElementType }> = {
  pending: { label: 'Pending', className: styles.statusPending, Icon: Clock },
  present: { label: 'Completed', className: styles.statusPresent, Icon: CheckCircle },
  absent: { label: 'Absent', className: styles.statusAbsent, Icon: XCircle },
};

const SOURCE_META = {
  NOTIFICATION: { label: 'Planned Training', className: styles.sourceNotification, Icon: BellRing },
  UPLOAD: { label: 'Uploaded Attendance', className: styles.sourceUpload, Icon: Upload },
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
    const key = `${a.trainingType}::${a.teamId}::${month}`;
    if (!map.has(key)) map.set(key, { rows: [] });
    map.get(key)!.rows.push(a);
  });

  const batches: TrainingBatch[] = [];

  map.forEach((val, key) => {
    const { rows } = val;
    const first = rows[0];
    // Determine date range from records
    const dates = rows.map(r => r.attendanceDate).filter(Boolean).sort();
    const startDate = dates[0] || first.month || '';
    const endDate = dates[dates.length - 1] || startDate;

    batches.push({
      id: `upload::${key}`,
      draftId: `upload::${key}`,
      source: 'UPLOAD',
      trainingType: String(first.trainingType),
      team: first.team || first.teamId || '',
      teamId: first.teamId || '',
      trainer: first.trainerId || '',
      startDate,
      endDate,
      committedAt: startDate,
      candidates: rows.map(r => ({
        empId: r.employeeId,
        attendance: r.attendanceStatus?.toLowerCase().includes('present') ? 'present' : 'absent' as BatchAttStatus,
        score: '',
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
    { key: 'absent', label: '✗', color: 'var(--danger)' },
  ];
  return (
    <div className={`${styles.attToggle} ${readOnly ? styles.attToggleReadOnly : ''}`}>
      {opts.map(o => {
        const act = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => !readOnly && onChange(o.key)}
            title={STATUS_META[o.key].label}
            disabled={readOnly}
            className={`${styles.attToggleBtn} ${readOnly ? styles.attToggleBtnDisabled : styles.attToggleBtnEnabled} ${act ? STATUS_META[o.key].className : ''}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

// ─── Per-batch Metrics ─────────────────────────────────────────────────────────

const batchMetrics = (candidates: CandidateRecord[]) => {
  const total = candidates.length;
  const present = candidates.filter(c => c.attendance === 'present').length;
  const absent = candidates.filter(c => c.attendance === 'absent').length;
  const scores = candidates.map(c => parseFloat(c.score)).filter(n => !isNaN(n));
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const attPct = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : null;
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
  const m = batchMetrics(batch.candidates);
  const sm = SOURCE_META[batch.source];
  const isUpload = batch.source === 'UPLOAD';

  return (
    <div className={styles.batchCard}>

      {/* ── LEVEL 1: Header ── */}
      <div
        onClick={() => setOpen(o => !o)}
        className={`${styles.batchHeader} ${open ? styles.batchHeaderOpen : ''}`}
      >
        {open ? <ChevronDown size={15} className={styles.chevron} />
          : <ChevronRight size={15} className={styles.chevron} />}

        {/* Source badge */}
        <span className={`${styles.sourceBadge} ${sm.className}`}>
          <sm.Icon size={10} />{sm.label}
        </span>

        {/* Training type */}
        <span className={styles.typeBadge}>
          {batch.trainingType}
        </span>

        {/* Team name */}
        <span className={styles.teamName}>
          {resolveTeam(batch.teamId, batch.team)}
        </span>

        {/* Date range */}
        <span className={styles.dateRange}>
          {fmtDate(batch.startDate)}
          {batch.endDate && batch.endDate !== batch.startDate ? ` → ${fmtDate(batch.endDate)}` : ''}
        </span>

        {/* Trainer */}
        {batch.trainer && (
          <span className={styles.trainerName}>
            👤 {resolveTrainer(batch.trainer)}
          </span>
        )}

        <div className={styles.spacer} />

        {/* Per-batch metrics */}
        <div className={styles.batchMetrics}>
          <Pill label="Total" value={m.total} className={styles.textAccent} />
          <Pill label="✓" value={m.present} className={styles.textSuccess} />
          <Pill label="✗" value={m.absent} className={styles.textDanger} />
          {m.attPct !== null && <Pill label="Att%" value={`${m.attPct}%`} className={m.attPct >= 80 ? styles.textSuccess : styles.textWarning} />}
          {m.avgScore !== null && <Pill label="Score" value={`${m.avgScore}`} className={styles.textPrimary} />}
        </div>
      </div>

      {/* ── LEVEL 2: Candidate Table ── */}
      {open && (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                {['Emp ID', 'Name', 'Designation', 'HQ', 'State', 'Attendance', 'Score', 'Status'].map(h => (
                  <th key={h} className={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batch.candidates.map((c, i) => {
                const emp = employees.find(e => String(e.employeeId) === c.empId);
                const rs = STATUS_META[c.attendance];
                return (
                  <tr key={c.empId} className={`${styles.tr} ${i % 2 !== 0 ? styles.trOdd : ''}`}>
                    <td className={`${styles.td} ${styles.tdEmpId}`}>{c.empId}</td>
                    <td className={`${styles.td} ${styles.tdName}`}>{emp?.name || '—'}</td>
                    <td className={`${styles.td} ${styles.tdSecondary}`}>{emp?.designation || '—'}</td>
                    <td className={`${styles.td} ${styles.tdSecondary}`}>{emp?.hq || '—'}</td>
                    <td className={`${styles.td} ${styles.tdSecondary}`}>{emp?.state || '—'}</td>
                    <td className={styles.td}>
                      {/* UPLOAD batches: attendance is read-only (from source file). NOTIFICATION: editable. */}
                      <AttToggle value={c.attendance} readOnly={isUpload} onChange={v => onUpdate(c.empId, { attendance: v })} />
                    </td>
                    <td className={styles.td}>
                      <input
                        type="number" min={0} max={100} placeholder="—"
                        value={c.score}
                        onChange={e => onUpdate(c.empId, { score: e.target.value })}
                        className={styles.scoreInput}
                        title="Score"
                        aria-label="Score"
                      />
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.statusBadge} ${rs.className}`}>
                        <rs.Icon size={10} />{rs.label}
                      </span>
                      {c.attendance === 'absent' && (
                        <div className={styles.reNominate}>
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

const Pill: React.FC<{ label: string; value: number | string; className: string }> = ({ label, value, className }) => (
  <div className={styles.pill}>
    <div className={`${styles.pillValue} ${className}`}>{value}</div>
    <div className={styles.pillLabel}>{label}</div>
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
  const [filterTeam, setFilterTeam] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterSource, setFilterSource] = useState<'' | 'NOTIFICATION' | 'UPLOAD'>('');

  const teamOptions = useMemo(() => [...new Set(allBatches.map(b => b.teamId).filter(Boolean))], [allBatches]);
  const typeOptions = useMemo(() => [...new Set(allBatches.map(b => b.trainingType).filter(Boolean))], [allBatches]);
  const monthOptions = useMemo(() =>
    [...new Set(allBatches.map(b => b.startDate?.substring(0, 7)).filter(Boolean))].sort().reverse(),
    [allBatches]
  );

  const filtered = useMemo(() =>
    allBatches.filter(b => {
      if (filterTeam && b.teamId !== filterTeam) return false;
      if (filterType && b.trainingType !== filterType) return false;
      if (filterMonth && b.startDate?.substring(0, 7) !== filterMonth) return false;
      if (filterSource && b.source !== filterSource) return false;
      return true;
    }),
    [allBatches, filterTeam, filterType, filterMonth, filterSource]
  );

  // ── Global metrics (across filtered) ─────────────────────────────────────
  const allC = filtered.flatMap(b => b.candidates);
  const gTotal = allC.length;
  const gPresent = allC.filter(c => c.attendance === 'present').length;
  const gAbsent = allC.filter(c => c.attendance === 'absent').length;
  const gPending = allC.filter(c => c.attendance === 'pending').length;
  const gAttPct = gPresent + gAbsent > 0 ? Math.round((gPresent / (gPresent + gAbsent)) * 100) : 0;
  const gScores = allC.map(c => parseFloat(c.score)).filter(n => !isNaN(n));
  const gAvg = gScores.length > 0 ? Math.round(gScores.reduce((a, b) => a + b, 0) / gScores.length) : null;

  const hasFilters = !!(filterTeam || filterType || filterMonth || filterSource);

  // ── Empty State ───────────────────────────────────────────────────────────
  if (allBatches.length === 0) {
    return (
      <div className={`animate-fade-in ${styles.page}`}>
        <h1 className={styles.title}>Training Data</h1>
        <p className={styles.subtitle}>
          Unified view of all uploaded attendance and planned training batches.
        </p>
        <div className={styles.emptyState}>
          <TrendingUp size={40} className={styles.emptyIcon} />
          <div className={styles.emptyTitle}>No training data yet</div>
          <div className={styles.emptyText}>
            Data appears here from two sources:<br />
            <strong>1.</strong> Upload attendance files via <strong>Upload Portal</strong><br />
            <strong>2.</strong> Send notification emails from <strong>Notification</strong> page (status → SENT)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`animate-fade-in ${styles.page}`}>

      {/* Page heading */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Training Data</h1>
          <p className={styles.subtitle}>
            Unified view · {allBatches.length} batch{allBatches.length !== 1 ? 'es' : ''} total
            ({notificationBatches.length} planned · {uploadBatches.length} uploaded)
          </p>
        </div>
      </div>

      {/* Global metrics */}
      <div className={styles.metricsGrid}>
        {[
          { label: 'Total', value: gTotal, className: styles.textAccent, Icon: Users },
          { label: 'Att %', value: `${gAttPct}%`, className: styles.textSuccess, Icon: TrendingUp },
          { label: 'Present', value: gPresent, className: styles.textSuccess, Icon: CheckCircle },
          { label: 'Drop-off', value: gAbsent, className: styles.textDanger, Icon: XCircle },
          { label: 'Pending', value: gPending, className: styles.textWarning, Icon: AlertCircle },
          { label: 'Avg Score', value: gAvg !== null ? gAvg : '—', className: styles.textPrimary, Icon: TrendingUp },
        ].map(k => (
          <div key={k.label} className={styles.metricCard}>
            <div className={`${styles.metricValue} ${k.className}`}>{k.value}</div>
            <div className={styles.metricLabel}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <Filter size={13} color="var(--text-secondary)" />

        {/* Source filter */}
        <div className={styles.sourceToggle}>
          {([
            { key: '', label: 'All' },
            { key: 'NOTIFICATION', label: '📋 Planned' },
            { key: 'UPLOAD', label: '⬆ Uploaded' },
          ] as { key: '' | 'NOTIFICATION' | 'UPLOAD'; label: string }[]).map(o => (
            <button
              key={o.key}
              onClick={() => setFilterSource(o.key)}
              className={`${styles.toggleBtn} ${filterSource === o.key ? styles.toggleBtnActive : ''}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <select
          value={filterTeam}
          onChange={e => setFilterTeam(e.target.value)}
          className={styles.select}
          title="Filter Team"
          aria-label="Filter Team"
        >
          <option value="">All Teams</option>
          {teamOptions.map(id => <option key={id} value={id}>{resolveTeam(id)}</option>)}
        </select>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className={styles.select}
          title="Filter Type"
          aria-label="Filter Type"
        >
          <option value="">All Types</option>
          {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className={styles.select}
          title="Filter Month"
          aria-label="Filter Month"
        >
          <option value="">All Months</option>
          {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>

        {hasFilters && (
          <button
            onClick={() => { setFilterTeam(''); setFilterType(''); setFilterMonth(''); setFilterSource(''); }}
            className={styles.clearBtn}
          >
            Clear
          </button>
        )}

        <span className={styles.showingText}>
          Showing <strong>{filtered.length}</strong> of {allBatches.length} batches
        </span>
      </div>

      {/* Batch list */}
      {filtered.length === 0 ? (
        <div className={styles.noResults}>
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




