import React, { useMemo } from 'react';
import { CheckCircle, AlertCircle, TrendingDown, RotateCcw } from 'lucide-react';
import { usePlanningFlow } from '../../core/context/PlanningFlowContext';
import { Employee } from '../../types/employee';
import { Attendance } from '../../types/attendance';
import styles from './ExecutionPage.module.css';

interface Props {
  employees: Employee[];
  attendance: Attendance[];
}

const fmtDate = (s?: string) => !s ? '—' : new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const ATTENDANCE_STATUS: Record<string, { label: string; className: string }> = {
  present: { label: 'Present', className: styles.statusPresent },
  absent:  { label: 'Absent',  className: styles.statusAbsent },
  pending: { label: 'Pending', className: styles.statusPending },
};

export const ExecutionPage: React.FC<Props> = ({ employees, attendance }) => {
  const { getDrafts, selectionSession } = usePlanningFlow();
  const sessionTeamIds = selectionSession?.teamIds ?? [];

  const executionDrafts = useMemo(
    () => getDrafts({ teamIds: sessionTeamIds.length > 0 ? sessionTeamIds : undefined })
            .filter(d => d.status === 'SENT' || d.status === 'COMPLETED'),
    [getDrafts, sessionTeamIds]
  );

  const rows = useMemo(() => {
    return executionDrafts.flatMap(draft => {
      return draft.candidates.map(empId => {
        const emp = employees.find(e => String(e.employeeId) === empId);
        const attRecord = attendance.find(a =>
          a.employeeId === empId &&
          a.trainingType?.toUpperCase() === draft.trainingType?.toUpperCase() &&
          (draft.startDate ? a.attendanceDate >= (draft.startDate.substring(0, 10)) : true)
        );
        const rawStatus = attRecord?.attendanceStatus?.toLowerCase() || 'pending';
        const statusKey = rawStatus.includes('present') ? 'present' : rawStatus.includes('absent') ? 'absent' : 'pending';
        return {
          draftId: draft.id, trainingType: draft.trainingType, planDate: draft.startDate,
          empId, name: emp?.name || '—', team: emp?.team || draft.team || '—',
          designation: emp?.designation || '—', attendanceStatus: statusKey,
        };
      });
    });
  }, [executionDrafts, employees, attendance]);

  const total   = rows.length;
  const present = rows.filter(r => r.attendanceStatus === 'present').length;
  const absent  = rows.filter(r => r.attendanceStatus === 'absent').length;
  const pending = rows.filter(r => r.attendanceStatus === 'pending').length;
  const attPct  = total > 0 ? Math.round((present / total) * 100) : 0;
  const dropPct = total > 0 ? Math.round((absent / total) * 100) : 0;

  if (executionDrafts.length === 0) {
    return (
      <div className={styles.emptyState}>
        <TrendingDown size={36} className={styles.emptyIcon} />
        <div className={styles.emptyTitle}>No plans in execution phase</div>
        <div className={styles.emptyText}>Plans move here after the Notification email is sent (status → SENT).</div>
      </div>
    );
  }

  const METRICS = [
    { label: 'Total Planned', value: total,       className: styles.metricValuePrimary },
    { label: 'Attendance %',  value: `${attPct}%`, className: styles.metricValueSuccess },
    { label: 'Drop-off %',    value: `${dropPct}%`, className: styles.metricValueDanger },
    { label: 'Repeat Needed', value: absent,       className: styles.metricValueWarning },
    { label: 'Pending',       value: pending,      className: styles.metricValueMuted },
  ];

  return (
    <div>
      {/* Metrics strip */}
      <div className={styles.metricsStrip}>
        {METRICS.map(k => (
          <div key={k.label} className={styles.metricCard}>
            <div className={`${styles.metricValue} ${k.className}`}>{k.value}</div>
            <div className={styles.metricLabel}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              {['Emp ID', 'Name', 'Team', 'Training', 'Planned Date', 'Attendance', 'Status'].map(h => (
                <th key={h} className={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const s = ATTENDANCE_STATUS[row.attendanceStatus] ?? ATTENDANCE_STATUS.pending;
              return (
                <tr key={`${row.draftId}-${row.empId}`} className={`${styles.tr} ${i % 2 !== 0 ? styles.trAlt : ''}`}>
                  <td className={styles.tdEmpId}>{row.empId}</td>
                  <td className={styles.tdName}>{row.name}</td>
                  <td className={styles.tdSmall}>{row.team}</td>
                  <td className={styles.tdDefault}>
                    <span className={styles.trainingTypeBadge}>{row.trainingType}</span>
                  </td>
                  <td className={styles.tdSmall}>{fmtDate(row.planDate)}</td>
                  <td className={styles.tdDefault}>
                    <span className={`${styles.statusPill} ${s.className}`}>
                      {s.label}
                    </span>
                  </td>
                  <td className={styles.tdSmall}>
                    {row.attendanceStatus === 'absent' && (
                      <span className={styles.reNominatePill}>
                        <RotateCcw size={11} />Re-nominate
                      </span>
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



