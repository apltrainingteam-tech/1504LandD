import React, { useState, useMemo, memo } from 'react';
import {
  ChevronDown, ChevronRight, CheckCircle, XCircle, Clock,
  RotateCcw, TrendingUp, Users, AlertCircle, Filter,
  Upload, BellRing, Eye, Edit2, Save, Trash2, ClipboardCheck, Database, Calendar
} from 'lucide-react';
import TrainerAvatar from '../../shared/components/ui/TrainerAvatar';
import { usePlanningFlow } from '../../core/context/PlanningFlowContext';
import { TrainingBatch, CandidateRecord, BatchAttStatus, Attendance } from '../../types/attendance';
import { useMasterData } from '../../core/context/MasterDataContext';
import { getCurrentUser } from '../../core/context/userContext';
import { useEditTrainingData } from './useEditTrainingData';
import { Employee } from '../../types/employee';
import { buildChangeSet } from '../../core/engines/editEngine';
import API_BASE from '../../config/api';
import styles from './TrainingDataPage.module.css';
import { useTrainingData } from '../../shared/hooks/useTrainingData';
import { TRAINING_TEMPLATES, TEMPLATE_FIELD_MAP, RATING_FIELDS } from '../../core/constants/trainingTemplates';
import { normalizeTrainingType, toProperCase } from '../../core/engines/normalizationEngine';
import { TrainingScore } from '../../types/attendance';

interface Props {
  employees: Employee[];
  attendance: Attendance[];
  scores: TrainingScore[];
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

const isExcelSerial = (val: any) => typeof val === 'number' && val > 1000;
const excelSerialToDate = (serial: number) => {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  return new Date(excelEpoch.getTime() + serial * 86400000);
};

const fmtDate = (s?: string | number) => {
  if (!s) return '-';
  let d: Date;
  if (isExcelSerial(s)) {
    d = excelSerialToDate(s as number);
  } else {
    d = new Date(s);
  }
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const monthLabel = (s?: string | number) => {
  if (!s) return '';
  let d: Date;
  if (isExcelSerial(s)) {
    d = excelSerialToDate(s as number);
  } else {
    d = new Date(s + '-01');
  }
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const getScoreColorClass = (val: number | string | null | undefined, field?: string) => {
  if (val === null || val === undefined || val === '') return '';
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return '';

  // Specialized Rating Logic (1-5 Scale)
  if (field && RATING_FIELDS.has(field) && field !== 'tScore' && field !== 'notified' && field !== 'apDate') {
    if (num >= 5) return styles.rating5;
    if (num >= 4) return styles.rating4;
    if (num >= 3) return styles.rating3;
    if (num >= 2) return styles.rating2;
    return styles.rating1;
  }

  // Standard Percentage Logic
  if (num >= 90) return styles.scoreGreen;
  if (num >= 75) return styles.scoreBlue;
  if (num >= 60) return styles.scoreAmber;
  return styles.scoreRed;
};

// ─── Attendance Toggle ─────────────────────────────────────────────────────────

const AttToggle: React.FC<{
  value: BatchAttStatus;
  readOnly?: boolean;
  onChange: (v: BatchAttStatus) => void;
}> = ({ value, readOnly, onChange }) => {
  const opts: { key: BatchAttStatus; label: string; color: string }[] = [
    { key: 'pending', label: '-', color: '#d97706' },
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
  const active = candidates.filter(c => !c.isVoided);
  const total = active.length;
  const present = active.filter((c: CandidateRecord) => c.attendance === 'present').length;
  const absent = active.filter((c: CandidateRecord) => c.attendance === 'absent').length;
  const scores = active.map((c: CandidateRecord) => {
    const s = c.scores || {};
    // Primary score candidates in priority order
    const val = s.score ?? s.percent ?? s.tScore ?? Object.values(s).find(v => typeof v === 'number');
    return typeof val === 'number' ? val : parseFloat(val as any);
  }).filter(n => !isNaN(n));
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
  templateColumns: string[];
}

const CandidateRow = memo<CandidateRowProps>(({
  candidate, employee, isSelected, buffered, isUpload, onUpdate, onToggleRow, index, isEditMode, templateColumns
}) => {
  const curAtt = buffered?.attendance || candidate.attendance;
  const combinedScores = { ...(candidate.scores || {}), ...(buffered?.scores || {}) };
  const curIsVoided = buffered?.isVoided !== undefined ? buffered.isVoided : candidate.isVoided;

  const isAttEdited = buffered?.attendance !== undefined && buffered.attendance !== candidate.attendance;
  const isVoidEdited = buffered?.isVoided !== undefined && buffered.isVoided !== candidate.isVoided;

  const rs = STATUS_META[curAtt] ?? STATUS_META['pending'];

  return (
    <tr className={`${styles.tr} ${index % 2 !== 0 ? styles.trOdd : ''} ${isSelected ? styles.trSelected : ''} ${curIsVoided ? styles.trVoided : ''} ${isVoidEdited ? styles.editedRow : ''}`}>
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
      <td className={`${styles.td} ${styles.tdEmpId} ${curIsVoided ? styles.strike : ''}`}>{candidate.empId}</td>
      <td className={`${styles.td} ${styles.tdName} ${curIsVoided ? styles.strike : ''}`}>{toProperCase(employee?.name) || '-'}</td>
      <td className={`${styles.td} ${styles.tdSecondary} ${curIsVoided ? styles.strike : ''}`}>{toProperCase(employee?.designation) || '-'}</td>
      <td className={`${styles.td} ${styles.tdSecondary} ${curIsVoided ? styles.strike : ''}`}>{toProperCase(employee?.hq) || '-'}</td>
      <td className={`${styles.td} ${styles.tdSecondary} ${curIsVoided ? styles.strike : ''}`}>{toProperCase(employee?.state) || '-'}</td>
      
      {templateColumns.map(col => {
        const field = TEMPLATE_FIELD_MAP[col];
        const val = combinedScores[field];
        const isEdited = buffered?.scores?.[field] !== undefined && buffered.scores[field] !== candidate.scores?.[field];
        const isNumeric = typeof val === 'number';
        const isDateField = col.toLowerCase().includes('date');
        const isNotifiedField = col.toLowerCase().includes('notified');

        return (
          <td key={col} className={`${styles.td} ${styles.tdScore} ${isEdited ? styles.editedCell : ''}`}>
            {isEditMode ? (
              <div className={styles.scoreCell}>
                <input
                  type="number" min={0} max={100} placeholder="-"
                  value={val ?? ''}
                  onChange={e => {
                    const newScores = { ...combinedScores, [field]: e.target.value === '' ? null : parseFloat(e.target.value) };
                    onUpdate(candidate.empId, { scores: newScores });
                  }}
                  className={`${styles.scoreInput} ${getScoreColorClass(val, field)}`}
                />
                {isNumeric && !isDateField && !isNotifiedField && <span className={styles.pctUnit}>%</span>}
              </div>
            ) : (
              <div className={`${styles.scoreDisplay} ${curIsVoided ? styles.strike : ''} ${getScoreColorClass(val, field)}`}>
                {val === null || val === undefined || val === '' ? '-'
                  : (isNumeric && !isDateField && !isNotifiedField && !RATING_FIELDS.has(field)) ? `${Math.round(val)}%`
                  : isNumeric ? Math.round(val)
                  : val}
              </div>
            )}
          </td>
        );
      })}

      <td className={`${styles.td} ${isAttEdited ? styles.editedCell : ''}`}>
        <AttToggle value={curAtt} readOnly={isUpload} onChange={v => onUpdate(candidate.empId, { attendance: v })} />
      </td>

      <td className={styles.td}>
        {curIsVoided ? (
          <span className={`${styles.statusBadge} ${styles.statusVoided}`}>
            <XCircle size={10} />Voided
          </span>
        ) : (
          <span className={`${styles.statusBadge} ${rs.className}`}>
            <rs.Icon size={10} />{rs.label}
          </span>
        )}
        {!curIsVoided && curAtt === 'absent' && (
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
  resolveTrainerAvatar: (id: string) => string | null;
  resolveTeam: (id?: string, fb?: string) => string;
  onUpdate: (empId: string, update: Partial<CandidateRecord>) => void;
  selectedIds: Set<string>;
  editBuffer: Record<string, Partial<CandidateRecord>>;
  onToggleRow: (batchId: string, empId: string) => void;
  onToggleBatch: (batchId: string, empIds: string[]) => void;
  isEditMode: boolean;
}> = memo(({ batch, employees, resolveTrainer, resolveTrainerAvatar, resolveTeam, onUpdate, selectedIds, editBuffer, onToggleRow, onToggleBatch, isEditMode }) => {
  const { trainers: masterTrainers } = useMasterData();
  const [open, setOpen] = useState(false);
  const m = useMemo(() => batchMetrics(batch.candidates), [batch.candidates]);
  const templateColumns = useMemo(() => TRAINING_TEMPLATES[normalizeTrainingType(batch.trainingType)] || ['Score'], [batch.trainingType]);
  const isUpload = batch.source === 'UPLOAD';

  const isBatchSelected = useMemo(() =>
    batch.candidates.every((c: CandidateRecord) => selectedIds.has(`${batch.id}::${c.empId}`)),
    [batch.id, batch.candidates, selectedIds]
  );

  return (
    <div className={`${styles.batchCard} ${
      batch.trainingType.includes('IP') && !batch.trainingType.includes('Pre') ? styles.borderIP :
      batch.trainingType.includes('AP') && !batch.trainingType.includes('Pre') ? styles.borderAP :
      batch.trainingType.includes('MIP') ? styles.borderMIP :
      batch.trainingType.includes('Capsule') ? styles.borderCapsule :
      batch.trainingType.includes('Refresher') ? styles.borderRefresher :
      batch.trainingType.includes('Pre-AP') ? styles.borderPreAP : ''
    }`}>
      <div
        onClick={() => setOpen(o => !o)}
        className={`${styles.batchHeader} ${open ? styles.batchHeaderOpen : ''} ${isEditMode ? styles.editMode : styles.viewMode} ${batch.isVoided ? styles.batchVoided : ''}`}
      >
        <div className={styles.colSelection}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={isBatchSelected}
            onChange={(e) => { e.stopPropagation(); onToggleBatch(batch.id, batch.candidates.map((c: CandidateRecord) => c.empId)); }}
            disabled={!isEditMode}
            title="Select all in batch"
            onClick={e => e.stopPropagation()}
          />
          {open ? <ChevronDown size={15} className={styles.chevron} />
            : <ChevronRight size={15} className={styles.chevron} />}
        </div>

        <div className={styles.colTeam}>
          <div className={styles.teamHero}>
            <span className={styles.teamSubtext}>
              {batch.team}
            </span>
            {batch.isVoided && (
              <span className={styles.voidBadge}>Voided</span>
            )}
          </div>
        </div>

        <div className={styles.colType}>
          <span className={`${styles.typeBadge} ${
            batch.trainingType.includes('IP') && !batch.trainingType.includes('Pre') ? styles.typeIP :
            batch.trainingType.includes('AP') && !batch.trainingType.includes('Pre') ? styles.typeAP :
            batch.trainingType.includes('MIP') ? styles.typeMIP :
            batch.trainingType.includes('Capsule') ? styles.typeCapsule :
            batch.trainingType.includes('Refresher') ? styles.typeRefresher :
            batch.trainingType.includes('Pre-AP') ? styles.typePreAP : ''
          }`}>
            {batch.trainingType}
          </span>
        </div>

        <div className={styles.colDate}>
          <div className={styles.dateCell}>
            <Calendar size={14} className={styles.dateIcon} />
            <span className={styles.batchDate}>
              {batch.startDate ? new Date(batch.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No Date'}
            </span>
          </div>
        </div>

        <div className={styles.colTrainer}>
          {batch.trainer && (() => {
            const trainerObj = masterTrainers.find((t: any) => 
              t.id?.toUpperCase() === batch.trainer?.toUpperCase() || 
              t.name?.toLowerCase() === batch.trainer?.toLowerCase()
            ) || { id: batch.trainer, name: batch.trainer };
            return (
              <div className={styles.trainerCell}>
                <TrainerAvatar
                  trainer={trainerObj}
                  size={42}
                  showName={false}
                  className={styles.heroicAvatar}
                />
                <div className={styles.trainerMeta}>
                  <div className={styles.trainerName}>{trainerObj.name}</div>
                </div>
              </div>
            );
          })()}
        </div>

        <div className={styles.colKpi}>
          <div className={styles.metricBlock}>
            <div className={styles.metricValue}>{m.total}</div>
            <div className={styles.metricLabel}>Attendees</div>
          </div>
        </div>
      </div>

      <div className={`${styles.tableContainer} ${open ? styles.tableContainerOpen : ''}`}>
        <div className={styles.tableWrapper}>
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
                {['Emp ID', 'Name', 'Designation', 'HQ', 'State'].map(h => {
                  const headerClass = h === 'Emp ID' ? styles.thEmpId : h === 'Name' ? styles.thName : '';
                  return <th key={h} className={`${styles.th} ${headerClass}`}>{h}</th>;
                })}
                {templateColumns.map(h => (
                  <th key={h} className={`${styles.th} ${styles.thScore}`}>{h}</th>
                ))}
                <th className={styles.th}>Attendance</th>
                <th className={styles.th}>Status</th>
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
                    templateColumns={templateColumns}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

// ─── Main Page ─────────────────────────────────────────────────────────────────

export const TrainingDataPage: React.FC<Props> = ({ employees, attendance, scores }) => {
  const { teams: masterTeams, trainers: masterTrainers } = useMasterData();
  const user = getCurrentUser();
  const isSuperAdmin = user.role === 'super_admin' || (user.role as string) === 'SUPERADMIN';

  const { notificationRecords, drafts } = usePlanningFlow();
  const { batches: allBatches } = useTrainingData(employees, attendance, notificationRecords, drafts, scores);

  const [showVoided, setShowVoided] = useState(false);
  const [filterTeam, setFilterTeam] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  const teamOptions = useMemo(() => [...new Set(allBatches.map(b => b.teamId).filter(Boolean))], [allBatches]);
  const monthOptions = useMemo(() =>
    [...new Set(allBatches.map(b => b.startDate?.substring(0, 7)).filter(Boolean))].sort().reverse(),
    [allBatches]
  );

  const filtered = useMemo(() =>
    allBatches.filter(b => {
      if (!showVoided && b.isVoided) return false;
      if (filterTeam && b.teamId !== filterTeam) return false;
      if (filterMonth && b.startDate?.substring(0, 7) !== filterMonth) return false;
      return true;
    }).map(b => {
      if (showVoided) return b;
      return {
        ...b,
        candidates: b.candidates.filter(c => !c.isVoided)
      };
    }).filter(b => b.candidates.length > 0 || (showVoided && b.isVoided)),
    [allBatches, filterTeam, filterMonth, showVoided]
  );

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

  const { summary } = useMemo(() => {
    const cs = buildChangeSet(editBuffer, allBatches);
    const keys = Object.keys(cs);
    const tImpacted = new Set(keys.map(k => k.split('::')[0])).size;

    let attChanges = 0;
    let scoreChanges = 0;
    let voidChanges = 0;
    (Object.values(cs) as any[]).forEach(c => {
      if (c.attendance !== undefined) attChanges++;
      if (c.score !== undefined) scoreChanges++;
      if (c.isVoided !== undefined) voidChanges++;
    });

    return {
      summary: {
        rows: keys.length,
        trainings: tImpacted,
        fields: attChanges + scoreChanges + voidChanges,
      }
    };
  }, [editBuffer, allBatches]);

  const handleSave = async () => {
    if (Object.keys(editBuffer).length === 0) return;
    if (summary.rows > 100) {
      if (!window.confirm(`LARGE UPDATE WARNING: You are about to update ${summary.rows} records. Proceed?`)) return;
    }
    setSaving(true);
    const result = await saveChanges(allBatches);
    setSaving(false);
    if (result.success) {
      alert('Changes saved successfully!');
      window.location.reload();
    } else {
      alert(`Save failed: ${result.error}`);
    }
  };

  const handleUndo = async () => {
    if (!window.confirm('Revert the last save? This cannot be undone.')) return;
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
    masterTrainers.find(t => t.id === id)?.name || (id || '-');

  const resolveTrainerAvatar = (trainerId: string) => {
    const trainer = masterTrainers.find(t => t.id === trainerId);
    if (!trainer || !trainer.avatarUrl) return null;
    if (trainer.avatarUrl.startsWith('http')) return trainer.avatarUrl;
    const base = API_BASE.replace('/api', '');
    return `${base}${trainer.avatarUrl}`;
  };

  const resolveTeam = (id?: string, fb?: string) =>
    masterTeams.find(t => t.id === id)?.teamName || (fb || id || '-');

  const hasFilters = !!(filterTeam || filterMonth);

  if (allBatches.length === 0) {
    return (
      <div className={`animate-fade-in ${styles.page}`}>
        <h1 className={styles.title}>Training Data</h1>
        <p className={styles.subtitle}>Unified view of all uploaded attendance and planned training batches.</p>
        <div className={styles.emptyState}>
          <TrendingUp size={40} className={styles.emptyIcon} />
          <div className={styles.emptyTitle}>No data available for selected filters</div>
          <div className={styles.emptyText}>
            Please adjust the Global Filters (Training Type, Trainer, Fiscal Year) to view records.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Training Data</h1>
          <p className={styles.subtitle}>Unified view · {allBatches.length} batch{allBatches.length !== 1 ? 'es' : ''} total</p>
        </div>
        {isSuperAdmin && (
          <div className={styles.pageActions}>
            {!isEditMode && (
              <button className={styles.btnUndo} onClick={handleUndo}>
                <RotateCcw size={14} /> Undo Last Save
              </button>
            )}
            <div className={styles.modeToggle}>
              <button className={`${styles.modeBtn} ${!isEditMode ? styles.modeBtnActive : ''}`} onClick={toggleEditMode}>
                <Eye size={14} /> View
              </button>
              <button className={`${styles.modeBtn} ${isEditMode ? styles.modeBtnActive : ''}`} onClick={toggleEditMode}>
                <Edit2 size={14} /> Edit
              </button>
            </div>
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
              <div className={styles.summaryLabel}>Fields Changed</div>
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
            <button className={`${styles.btnSaveLarge} ${saving ? styles.btnSaving : ''}`} onClick={handleSave} disabled={saving}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save All Changes'}
            </button>
            <button className={styles.btnDiscardSmall} onClick={resetBuffer} disabled={saving}>Discard All</button>
          </div>
        </div>
      )}

      <div className={styles.stickyToolbar}>
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <Filter size={14} className={styles.filterIcon} />
            <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} className={styles.select}>
              <option value="">All Teams</option>
              {teamOptions.map(id => <option key={id} value={id}>{resolveTeam(id)}</option>)}
            </select>
            <div className={styles.filterDivider} />
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className={styles.select}>
              <option value="">All Months</option>
              {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            {hasFilters && (
              <button onClick={() => { setFilterTeam(''); setFilterMonth(''); }} className={styles.clearBtn}>
                Clear
              </button>
            )}
          </div>
          <div className={styles.spacer} />
          <label className={styles.voidControl}>
            <input type="checkbox" checked={showVoided} onChange={e => setShowVoided(e.target.checked)} />
            <span>Include Voided</span>
          </label>
        </div>

        <div className={styles.selectionBar}>
          <input
            type="checkbox" className={styles.checkbox} checked={isAllSelected}
            ref={el => { if (el) el.indeterminate = isSomeSelected; }}
            onChange={selectAll} disabled={!isEditMode}
          />
          <span className={styles.selectionCount}>
            {selectedIds.size > 0 ? <strong>{selectedIds.size} rows selected</strong> : <span>Select all filtered (<strong className={styles.countAccent}>{allFilteredCandidateKeys.length}</strong>)</span>}
          </span>
          {selectedIds.size > 0 && (
            <div className={styles.bulkActions}>
              <button className={styles.bulkBtn} onClick={() => applyBulkEdit('attendance', 'present')}><CheckCircle size={14} /> Mark Present</button>
              <button className={styles.bulkBtn} onClick={() => applyBulkEdit('attendance', 'absent')}><XCircle size={14} /> Mark Absent</button>
              <button className={styles.bulkBtn} onClick={() => {
                const score = prompt('Enter score for selected rows (0-100):');
                if (score !== null && score !== '') applyBulkEdit('score', score);
              }}><TrendingUp size={14} /> Update Score</button>
            </div>
          )}
          {selectedIds.size > 0 && <button className={styles.clearSelectionBtn} onClick={clearSelection}>Clear Selection</button>}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.noResults}>No data available for selected filters</div>
      ) : (
        filtered.map(batch => (
          <BatchCard
            key={batch.id} batch={batch} employees={employees} resolveTrainer={resolveTrainer}
            resolveTrainerAvatar={resolveTrainerAvatar} resolveTeam={resolveTeam}
            onUpdate={(empId, update) => updateCell(batch.id, empId, update)}
            selectedIds={selectedIds} editBuffer={editBuffer} onToggleRow={selectRow}
            onToggleBatch={selectBatch} isEditMode={isEditMode}
          />
        ))
      )}
    </div>
  );
};
