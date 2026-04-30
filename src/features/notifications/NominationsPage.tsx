import React, { useState, useMemo, useEffect } from 'react';
import { CheckCircle, Lock, AlertTriangle, Filter, Users } from 'lucide-react';
import { usePlanningFlow } from '../../core/context/PlanningFlowContext';
import { Employee } from '../../types/employee';
import { TrainingNomination, Attendance, NominationDraft } from '../../types/attendance';
import { parseAnyDate } from '../../core/utils/dateParser';
import { useNominationsData } from './hooks/useNominationsData';
import styles from './NominationsPage.module.css';

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
  attendance: Attendance[];
}

type FilterMode = 'all' | 'first' | 'repeat';

const getDesClass = (des: string) => {
  if (des === 'MR') return styles.desMR;
  if (des === 'FLM') return styles.desFLM;
  if (des === 'SLM') return styles.desSLM;
  if (des.includes('MANAGER')) return styles.desSRM;
  return styles.desOther;
};

const normDes = (d?: string) => (d || '').toUpperCase().split('(')[0].trim() || 'Other';
const fmtDate = (s?: string) => !s ? '' : new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

const DesBadge: React.FC<{ des: string }> = ({ des }) => {
  return (
    <span className={`${styles.desBadge} ${getDesClass(des)}`}>
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

export const NominationsPage: React.FC<Props> = ({ employees, nominations, attendance }) => {
  const { getDrafts, updateDraft, selectionSession } = usePlanningFlow();

  const sessionTeamIds = selectionSession?.teamIds ?? [];
  const sessionType    = selectionSession?.trainingType;

  const [activeTeamId, setActiveTeamId]   = useState<string>(sessionTeamIds[0] ?? '');
  const { teamEmps } = useNominationsData(employees, attendance, nominations, sessionType, activeTeamId, sessionTeamIds);

  const [filterMode, setFilterMode]       = useState<FilterMode>('all');

  const teamDrafts = useMemo(() => getDrafts({ teamIds: sessionTeamIds }), [getDrafts, sessionTeamIds]);
  const draft: NominationDraft | undefined = useMemo(
    () => teamDrafts.find((d: NominationDraft) => d.teamId === (activeTeamId || sessionTeamIds[0])),
    [teamDrafts, activeTeamId, sessionTeamIds]
  );

  const noticeMap = useMemo(() => buildNoticeHistory(nominations, sessionType), [nominations, sessionType]);

  const filteredEmps = useMemo(() => {
    let list: Employee[];
    switch (filterMode) {
      case 'first':  list = teamEmps.filter(e => (noticeMap.get(String(e.employeeId))?.length ?? 0) === 0); break;
      case 'repeat': list = teamEmps.filter(e => (noticeMap.get(String(e.employeeId))?.length ?? 0) >= 2); break;
      default:       list = [...teamEmps];
    }
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

  const included = draft?.candidates.length ?? 0;
  const repeatCount = filteredEmps.filter(e => (noticeMap.get(String(e.employeeId))?.length ?? 0) >= 2).length;

  if (sessionTeamIds.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Users size={40} className={styles.emptyIcon} />
        <div className={styles.emptyTitle}>No active planning session</div>
        <div className={styles.emptyText}>Select teams in <strong>Training Requirement</strong> and create plans on the <strong>Calendar</strong>.</div>
      </div>
    );
  }

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      {/* Page heading */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Nominations</h1>
          <p className={styles.pageSubtitle}>
            Select candidates, review history, and approve the nomination list.
          </p>
        </div>
        {selectionSession && (
          <span className={styles.sessionBadge}>
            ● {selectionSession.trainingType} · {selectionSession.teams.join(', ')}
          </span>
        )}
      </div>

      {/* Team tabs */}
      {sessionTeamIds.length > 1 && (
        <div className={styles.teamTabs}>
          {sessionTeamIds.map((tid: string) => {
            const d = teamDrafts.find((x: NominationDraft) => x.teamId === tid);
            const tName = d?.team || tid;
            const done = d && d.status !== 'DRAFT';
            const active = (activeTeamId || sessionTeamIds[0]) === tid;
            return (
              <button key={tid} onClick={() => setActiveTeamId(tid)} className={`${styles.teamTab} ${active ? styles.teamTabActive : styles.teamTabInactive}`}>
                {tName}{done && <CheckCircle size={12} color="var(--success)" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filterChips}>
          <Filter size={13} color="var(--text-secondary)" />
          {([
            { key: 'all',    label: `All (${teamEmps.length})`, class: styles.filterChipAll },
            { key: 'first',  label: `First Time (${teamEmps.filter(e=>(noticeMap.get(String(e.employeeId))?.length??0)===0).length})`, class: styles.filterChipFirst },
            { key: 'repeat', label: `Repeat 2+ (${repeatCount})`, class: styles.filterChipRepeat },
          ] as { key: FilterMode; label: string; class: string }[]).map(f => {
            const active = filterMode === f.key;
            return (
              <button 
                key={f.key} 
                onClick={() => setFilterMode(f.key)} 
                className={`${styles.filterChip} ${active ? f.class : styles.filterChipInactive}`} 
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className={styles.toolbarRight}>
          {draft && (
            <span className={`${styles.statusPill} ${draft.status === 'DRAFT' ? styles.statusDraft : styles.statusApproved}`}>
              {draft.status === 'DRAFT' ? <AlertTriangle size={11} /> : <CheckCircle size={11} />}
              {draft.status}
            </span>
          )}
          <span className={styles.countText}>
            Selected: <strong className={styles.countHighlight}>{included}</strong>/40
          </span>
        </div>
      </div>

      {/* TABLE */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              {!isLocked && <th className={styles.thCheckbox} />}
              <th className={styles.th}>Emp ID</th>
              <th className={styles.th}>Name</th>
              <th className={styles.th}>Designation</th>
              <th className={styles.th}>HQ</th>
              <th className={styles.th}>State</th>
              <th className={`${styles.th} ${styles.thAccent}`}>Tenure</th>
              {[1,2,3,4,5].map(n => (
                <th key={n} className={`${styles.th} ${n >= 3 ? styles.thDanger : ''}`}>
                  Notice {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEmps.length === 0 ? (
              <tr><td colSpan={isLocked ? 11 : 12} className={styles.emptyCell}>No employees match this filter.</td></tr>
            ) : filteredEmps.map((emp, i) => {
              const eid     = String(emp.employeeId);
              const isIn    = draft?.candidates.includes(eid) ?? false;
              const history = noticeMap.get(eid) ?? [];
              const isRepeat = history.length >= 2;
              const isHighRepeat = history.length >= 3;

              let rowClass = `${styles.tr} ${i % 2 !== 0 ? styles.trAlt : ''}`;
              if (isHighRepeat) rowClass += ` ${styles.trRepeat}`;
              else if (isIn) {
                rowClass += i % 2 === 0 ? ` ${styles.trSelectedEven}` : ` ${styles.trSelectedOdd}`;
              }
              rowClass += isLocked ? ` ${styles.trLocked}` : ` ${styles.trNotLocked}`;
              rowClass += (!draft || isIn) ? ` ${styles.trIncluded}` : ` ${styles.trExcluded}`;

              return (
                <tr
                  key={emp.employeeId}
                  onClick={() => !isLocked && toggleEmp(eid, !isIn)}
                  className={rowClass}
                >
                  {!isLocked && (
                    <td className={styles.tdCheckbox}>
                      <input type="checkbox" checked={isIn} onChange={() => toggleEmp(eid, !isIn)} onClick={e => e.stopPropagation()} className={styles.checkboxInput} title="Select Candidate" aria-label="Select Candidate" />
                    </td>
                  )}
                  <td className={styles.tdEmpId}>{emp.employeeId}</td>
                  <td className={`${styles.tdName} ${isIn ? styles.tdNameBold : styles.tdNameNormal}`}>
                    {emp.name}
                    {isHighRepeat && <span title="3+ nominations" className={styles.repeatBadgeHigh}>N{history.length}</span>}
                    {isRepeat && !isHighRepeat && <span title="Repeat nomination" className={styles.repeatBadgeMed}>N{history.length}</span>}
                  </td>
                  <td className={styles.tdDefault}><DesBadge des={normDes(emp.designation)} /></td>
                  <td className={styles.tdDefault}>{emp.hq || '—'}</td>
                  <td className={styles.tdDefault}>{emp.state || '—'}</td>
                  <td className={styles.tdDefault}>
                    <span className={styles.tenureBadge} title={emp.doj || ''}>
                      {calcTenure(emp.doj)}
                    </span>
                  </td>
                  {[0,1,2,3,4].map(idx => (
                    <td key={idx} className={`${styles.tdNotice} ${idx >= 2 ? styles.tdNoticeDanger : styles.tdNoticeNormal}`}>
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
        <div className={styles.actionBar}>
          {isLocked ? (
            <div className={styles.lockedInfo}>
              <Lock size={13} />
              {draft.status === 'APPROVED' && `Approved by ${draft.approvedBy || 'Sales Head'}${draft.approvedAt ? ' on ' + fmtDate(draft.approvedAt) : ''}`}
              {draft.status === 'SENT' && 'Sent'}
              {draft.status === 'NOTIFIED' && 'Notified'}
              {draft.status === 'COMPLETED' && 'Completed'}
              {draft.status === 'CANCELLED' && 'Cancelled'}
            </div>
          ) : (
            <>
              <button className="btn btn-secondary">Save Draft</button>
              <button
                onClick={handleApprove}
                disabled={included === 0}
                className={`${styles.approveBtn} ${included === 0 ? styles.approveBtnDisabled : styles.approveBtnEnabled}`}
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






