import React, { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, CheckCircle, XCircle, Clock,
  RotateCcw, TrendingUp, Users, AlertCircle, Filter,
  Upload, BellRing, Eye, Edit2, Save, Trash2, ClipboardCheck, Database, Calendar
} from 'lucide-react';
import { usePlanningFlow } from '../../core/context/PlanningFlowContext';
import { TrainingBatch, CandidateRecord, BatchAttStatus, Attendance } from '../../types/attendance';
import { useMasterData } from '../../core/context/MasterDataContext';
import { getCurrentUser } from '../../core/context/userContext';
import { useEditTrainingData } from './useEditTrainingData';
import { Employee } from '../../types/employee';
import { buildChangeSet } from '../../core/engines/editEngine';
import API_BASE from '../../config/api';
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
      trainingId: `upload::${key}`,
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
  const present = candidates.filter((c: CandidateRecord) => c.attendance === 'present').length;
  const absent = candidates.filter((c: CandidateRecord) => c.attendance === 'absent').length;
  const scores = candidates.map((c: CandidateRecord) => parseFloat(c.score)).filter(n => !isNaN(n));
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const attPct = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : null;
  return { total, present, absent, pending: total - present - absent, avgScore, attPct };
};

const Pill: React.FC<{ label: string; value: number | string; className: string }> = ({ label, value, className }) => (
  <div className={styles.pill}>
    <div className={`${styles.pillValue} ${className}`}>{value}</div>
    <div className={styles.pillLabel}>{label}</div>
  </div>
);

// ── Candidate Row (Memoized) ───────────────────────────────────────────────────

interface CandidateRowProps {
  candidate: CandidateRecord;
  employee?: Employee;
  isSelected: boolean;
  buffered?: Partial<CandidateRecord>;
  isUpload: boolean;
  onUpdate: (empId: string, update: Partial<CandidateRecord>) => void;
  onToggleRow: (empId: string) => void;
  index: number;
  isEditMode: boolean;
}


const CandidateRow = React.memo<CandidateRowProps>(({
  candidate, employee, isSelected, buffered, isUpload, onUpdate, onToggleRow, index, isEditMode
}) => {

  const curAtt = buffered?.attendance || candidate.attendance;
  const curScore = buffered?.score !== undefined ? buffered.score : candidate.score;
  const isAttEdited = buffered?.attendance !== undefined && buffered.attendance !== candidate.attendance;
  const isScoreEdited = buffered?.score !== undefined && buffered.score !== candidate.score;
  const rs = STATUS_META[curAtt];

  return (
    <tr className={`${styles.tr} ${index % 2 !== 0 ? styles.trOdd : ''} ${isSelected ? styles.trSelected : ''}`}>
      <td className={styles.tdCheckbox}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={isSelected}
          onChange={() => onToggleRow(candidate.empId)}
          disabled={!isEditMode}
          onClick={e => e.stopPropagation()}
        />

      </td>
      <td className={`${styles.td} ${styles.tdEmpId}`}>{candidate.empId}</td>
      <td className={`${styles.td} ${styles.tdName}`}>{employee?.name || '—'}</td>
      <td className={`${styles.td} ${styles.tdSecondary}`}>{employee?.designation || '—'}</td>
      <td className={`${styles.td} ${styles.tdSecondary}`}>{employee?.hq || '—'}</td>
      <td className={`${styles.td} ${styles.tdSecondary}`}>{employee?.state || '—'}</td>
      <td className={`${styles.td} ${isAttEdited ? styles.editedCell : ''}`} title={isAttEdited ? `${STATUS_META[candidate.attendance].label} → ${STATUS_META[curAtt].label}` : undefined}>
        <AttToggle value={curAtt} readOnly={isUpload} onChange={v => onUpdate(candidate.empId, { attendance: v })} />
      </td>
      <td className={`${styles.td} ${isScoreEdited ? styles.editedCell : ''}`} title={isScoreEdited ? `${candidate.score || '—'} → ${curScore}` : undefined}>
        <input
          type="number" min={0} max={100} placeholder="—"
          value={curScore}
          onChange={e => onUpdate(candidate.empId, { score: e.target.value })}
          className={styles.scoreInput}
          title="Score"
        />
      </td>
      <td className={styles.td}>
        <span className={`${styles.statusBadge} ${rs.className}`}>
          <rs.Icon size={10} />{rs.label}
        </span>
        {curAtt === 'absent' && (
          <div className={styles.reNominate}>
            <RotateCcw size={9} />Re-nominate
          </div>
        )}
      </td>
    </tr>
  );
});

// ── Batch Card (Memoized) ──────────────────────────────────────────────────────

const BatchCard: React.FC<{
  batch: TrainingBatch;
  employees: Employee[];
  resolveTrainer: (id?: string) => string;
  resolveTeam: (id?: string, fb?: string) => string;
  onUpdate: (empId: string, update: Partial<CandidateRecord>) => void;
  selectedIds: Set<string>;
  editBuffer: Record<string, Partial<CandidateRecord>>;
  onToggleRow: (batchId: string, empId: string) => void;
  onToggleBatch: (batchId: string, empIds: string[]) => void;
  isEditMode: boolean;
}> = React.memo(({ batch, employees, resolveTrainer, resolveTeam, onUpdate, selectedIds, editBuffer, onToggleRow, onToggleBatch, isEditMode }) => {

  const [open, setOpen] = useState(false);
  const m = useMemo(() => batchMetrics(batch.candidates), [batch.candidates]);
  const sm = SOURCE_META[batch.source as keyof typeof SOURCE_META];
  const isUpload = batch.source === 'UPLOAD';

  const isBatchSelected = useMemo(() => 
    batch.candidates.every((c: CandidateRecord) => selectedIds.has(`${batch.id}::${c.empId}`)),
    [batch.id, batch.candidates, selectedIds]
  );

  return (
    <div className={styles.batchCard}>

      {/* ── LEVEL 1: Header ── */}
      <div
        onClick={() => setOpen(o => !o)}
        className={`${styles.batchHeader} ${open ? styles.batchHeaderOpen : ''} ${isEditMode ? styles.editMode : styles.viewMode}`}
      >

        <div className={styles.batchPrimary}>
          <input
            type="checkbox"
            className={styles.checkbox}
            style={{ marginRight: '10px' }}
            checked={isBatchSelected}
            onChange={(e) => { e.stopPropagation(); onToggleBatch(batch.id, batch.candidates.map((c: CandidateRecord) => c.empId)); }}
            disabled={!isEditMode}
            onClick={e => e.stopPropagation()}
          />

          {open ? <ChevronDown size={15} className={styles.chevron} />
            : <ChevronRight size={15} className={styles.chevron} />}
        </div>

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
                <th className={styles.thCheckbox}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={isBatchSelected}
                    onChange={() => onToggleBatch(batch.id, batch.candidates.map((c: CandidateRecord) => c.empId))}
                    disabled={!isEditMode}
                    title="Select all in batch"
                  />
                </th>

                {['Emp ID', 'Name', 'Designation', 'HQ', 'State', 'Attendance', 'Score', 'Status'].map(h => (
                  <th key={h} className={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batch.candidates.map((c: CandidateRecord, i: number) => {
                const key = `${batch.id}::${c.empId}`;
                return (
                  <CandidateRow
                    key={c.empId}
                    index={i}
                    candidate={c}
                    employee={employees.find(e => String(e.employeeId) === c.empId)}
                    isSelected={selectedIds.has(key)}
                    buffered={editBuffer[key]}
                    isUpload={isUpload}
                    onUpdate={(eid, upd) => onUpdate(eid, upd)}
                    onToggleRow={(eid) => onToggleRow(batch.id, eid)}
                    isEditMode={isEditMode}
                  />

                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

// ─── Main Page ─────────────────────────────────────────────────────────────────

export const TrainingDataPage: React.FC<Props> = ({ employees, attendance }) => {
  const { getBatches, updateBatchCandidate } = usePlanningFlow();
  const { teams: masterTeams, trainers: masterTrainers } = useMasterData();
  const user = getCurrentUser();
  const isSuperAdmin = user.role === 'super_admin' || (user.role as string) === 'SUPERADMIN';

  // ── Derive UPLOAD batches from attendance prop ─────────────────────────────
  const uploadBatches = useMemo(() => deriveUploadBatches(attendance), [attendance]);

  // --- Merge: NOTIFICATION (context) + UPLOAD (derived) -----------------------
  const notificationBatches = useMemo(() => getBatches(), [getBatches]);

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

  // ── Selection & Edit Hook ────────────────────────────────────────────────
  const allFilteredCandidateKeys = useMemo(() => 
    filtered.flatMap(b => b.candidates.map((c: CandidateRecord) => `${b.id}::${c.empId}`)),
    [filtered]
  );

  const {
    isEditMode,
    selectedIds,
    editBuffer,
    isAllSelected,
    isSomeSelected,
    toggleEditMode,
    selectRow,
    selectBatch,
    selectAll,
    clearSelection,
    updateCell,
    applyBulkEdit,
    saveChanges,
    resetBuffer
  } = useEditTrainingData({ filteredCandidateKeys: allFilteredCandidateKeys });

  const [saving, setSaving] = useState(false);

  // ── Change Summary Metrics ─────────────────────────────────────────────────
  const { changeSet, summary } = useMemo(() => {
    const cs = buildChangeSet(editBuffer, allBatches);
    const keys = Object.keys(cs);
    const tImpacted = new Set(keys.map(k => k.split('::')[0])).size;
    
    let attChanges = 0;
    let scoreChanges = 0;
    (Object.values(cs) as Partial<CandidateRecord>[]).forEach(c => {
      if (c.attendance !== undefined) attChanges++;
      if (c.score !== undefined) scoreChanges++;
    });

    return {
      changeSet: cs,
      summary: {
        rows: keys.length,
        trainings: tImpacted,
        fields: attChanges + scoreChanges,
        attendance: attChanges,
        score: scoreChanges
      }
    };
  }, [editBuffer, allBatches]);

  const handleSave = async () => {
    if (Object.keys(editBuffer).length === 0) return;
    
    // Safeguard: High-volume update warning
    if (summary.rows > 100) {
      if (!window.confirm(`⚠️ LARGE UPDATE WARNING: You are about to update ${summary.rows} records at once. Do you wish to proceed?`)) {
        return;
      }
    }

    setSaving(true);
    const result = await saveChanges(allBatches);
    setSaving(false);

    if (result.success) {
      // In a real app, we'd trigger a data refresh here
      alert('Changes saved successfully!');
      window.location.reload(); // Simple refresh to show updated data
    } else {
      alert(`Save failed: ${result.error}`);
    }
  };

  const handleUndo = async () => {
    if (!window.confirm('Are you sure you want to revert the last save? This cannot be undone.')) return;
    
    try {
      const response = await fetch(`${API_BASE}/training-data/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      if (result.success) {
        alert('Last save reverted successfully!');
        window.location.reload();
      } else {
        alert(`Undo failed: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const resolveTrainer = (id?: string) =>
    masterTrainers.find(t => t.id === id)?.trainerName || (id || '—');
  const resolveTeam = (id?: string, fb?: string) =>
    masterTeams.find(t => t.id === id)?.teamName || (fb || id || '—');

  // ── Global metrics (across filtered) ─────────────────────────────────────
  const allC = filtered.flatMap(b => b.candidates);
  const gTotal = allC.length;
  const gPresent = allC.filter((c: CandidateRecord) => c.attendance === 'present').length;
  const gAbsent = allC.filter((c: CandidateRecord) => c.attendance === 'absent').length;
  const gPending = allC.filter((c: CandidateRecord) => c.attendance === 'pending').length;
  const gAttPct = gPresent + gAbsent > 0 ? Math.round((gPresent / (gPresent + gAbsent)) * 100) : 0;
  const gScores = allC.map((c: CandidateRecord) => parseFloat(c.score)).filter(n => !isNaN(n));
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

        {isSuperAdmin && (
          <div className={styles.modeToggle}>
            <button
              className={`${styles.modeBtn} ${!isEditMode ? styles.modeBtnActive : ''}`}
              onClick={toggleEditMode}
            >
              <Eye size={14} /> View Mode
            </button>
            <button
              className={`${styles.modeBtn} ${isEditMode ? styles.modeBtnActive : ''}`}
              onClick={toggleEditMode}
            >
              <Edit2 size={14} /> Edit Mode
            </button>
          </div>
        )}
      </div>

      {isEditMode && summary.rows > 0 && (
        <div className={styles.saveSummary}>
          <div className={styles.summaryItem}>
            <div className={`${styles.summaryIcon} ${styles.iconPurple}`}><Users size={18} /></div>
            <div>
              <div className={styles.summaryValue}>{summary.rows}</div>
              <div className={styles.summaryLabel}>Rows Affected</div>
            </div>
          </div>
          <div className={styles.summaryItem}>
            <div className={`${styles.summaryIcon} ${styles.iconBlue}`}><ClipboardCheck size={18} /></div>
            <div>
              <div className={styles.summaryValue}>{summary.fields}</div>
              <div className={styles.summaryLabel}>Fields Changed ({summary.attendance} att, {summary.score} score)</div>
            </div>
          </div>
          <div className={styles.summaryItem}>
            <div className={`${styles.summaryIcon} ${styles.iconGreen}`}><Database size={18} /></div>
            <div>
              <div className={styles.summaryValue}>{summary.trainings}</div>
              <div className={styles.summaryLabel}>Trainings Impacted</div>
            </div>
          </div>
          <div className={styles.summaryActions}>
            <button 
              className={`${styles.btnSaveLarge} ${saving ? styles.btnSaving : ''}`} 
              onClick={handleSave}
              disabled={saving}
            >
              <Save size={16} /> {saving ? 'Saving...' : 'Save All Changes'}
            </button>
            <button className={styles.btnDiscardSmall} onClick={resetBuffer} disabled={saving}>
              Discard All
            </button>
          </div>
        </div>
      )}

      <div className={styles.toolbarRow}>
        {isSuperAdmin && !isEditMode && (
          <button className={styles.btnUndo} onClick={handleUndo} title="Revert the most recent bulk update">
            <RotateCcw size={14} /> Undo Last Save
          </button>
        )}
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
      </div>

      {/* Selection Toolbar */}
      <div className={`${styles.selectionBar} ${isEditMode ? styles.editMode : styles.viewMode}`}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={isAllSelected}
          ref={el => {
            if (el) el.indeterminate = isSomeSelected;
          }}
          onChange={selectAll}
          disabled={!isEditMode}
          title="Select all filtered rows"
        />
        <span className={styles.selectionCount}>
          {selectedIds.size > 0 
            ? <strong>{selectedIds.size} rows selected</strong>
            : <span>Select all filtered (<strong>{allFilteredCandidateKeys.length}</strong>)</span>
          }
        </span>
        
        {selectedIds.size > 0 && (
          <div className={styles.bulkActions}>
            <button className={styles.bulkBtn} onClick={() => applyBulkEdit('attendance', 'present')}>
              <CheckCircle size={14} /> Mark Present
            </button>
            <button className={styles.bulkBtn} onClick={() => applyBulkEdit('attendance', 'absent')}>
              <XCircle size={14} /> Mark Absent
            </button>
            <button className={styles.bulkBtn} onClick={() => {
              const score = prompt('Enter score for selected rows (0-100):');
              if (score !== null && score !== '') {
                applyBulkEdit('score', score);
              }
            }}>
              <TrendingUp size={14} /> Update Score
            </button>
          </div>
        )}

        {selectedIds.size > 0 && (
          <button className={styles.clearSelectionBtn} onClick={clearSelection}>
            Clear Selection
          </button>
        )}
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
              updateCell(batch.id, empId, update)
            }
            selectedIds={selectedIds}
            editBuffer={editBuffer}
            onToggleRow={selectRow}
            onToggleBatch={selectBatch}
            isEditMode={isEditMode}
          />

        ))
      )}
    </div>
  );
};




