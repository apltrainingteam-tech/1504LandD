import React, { useState, Fragment, memo, useCallback } from 'react';
import { ChevronRight, ChevronDown, X } from 'lucide-react';
import { formatMonthLabel } from '../../../core/utils/fiscalYear';
import { RefresherAttendanceAggregates, getRefresherDrilldownList } from '../../../core/engines/refresherEngine';
import { RefresherPerformanceAggregates, RefresherCandidatePerformance } from '../../../core/engines/refresherEngine';
import { EmployeeEventTimeline } from '../../../core/engines/apEngine';
import styles from './RefresherDualMatrix.module.css';

const getScoreColor = (val: number | null) => {
  if (val === null) return '';
  if (val >= 80) return 'text-success';
  if (val >= 60) return 'text-warning';
  return 'text-danger';
};

const getScoreBgClass = (val: number | null) => {
  if (val === null) return styles.bgTransparent;
  if (val >= 80) return styles.bgSuccess;
  if (val >= 60) return styles.bgWarning;
  return styles.bgDanger;
};

const getAttBgClass = (pct: number) => {
  if (pct >= 80) return styles.bgSuccess;
  if (pct < 50) return styles.bgDanger;
  return styles.bgTransparent;
};

// --- REFRESHER ATTENDANCE DRILLDOWN ---
const RefresherAttendanceDrilldown: React.FC<{ cluster: string, team: string, month: string, timelines: Map<string, EmployeeEventTimeline>, onClose: () => void }> = ({ cluster, team, month, timelines, onClose }) => {
  const records = getRefresherDrilldownList(timelines, { cluster, team, month });
  return (
    <div className={styles.backdrop}>
      <div className={`glass-panel ${styles.modal}`}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>Attendance Drill-down (Refresher)</h3>
            <div className={styles.modalSubtitle}>
              {cluster} ➔ {team} ➔ {month}
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onClose} title="Close drill-down"><X size={18} /></button>
        </div>
        <div className={styles.modalBody}>
          <table className={`data-table ${styles.fullWidthTable}`}>
            <thead>
              <tr>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Team</th>
                <th>Trainer</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.employeeId + i}>
                  <td className={styles.tdEmpId}>{r.employeeId}</td>
                  <td className={styles.tdName}>{r.name}</td>
                  <td>{r.team}</td>
                  <td>{r.trainer}</td>
                  <td>{r.attendanceDate}</td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan={5} className={styles.tdCenter}>No candidates found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- REFRESHER PERFORMANCE DRILLDOWN ---
const RefresherPerformanceDrilldown: React.FC<{ cluster: string, team: string, month: string, timelines: Map<string, EmployeeEventTimeline>, onClose: () => void }> = ({ cluster, team, month, timelines, onClose }) => {
  const records = getRefresherDrilldownList(timelines, { cluster, team, month });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string, idx: number) => {
    const key = `${id}_${idx}`;
    const next = new Set(expandedRows);
    next.has(key) ? next.delete(key) : next.add(key);
    setExpandedRows(next);
  };

  return (
    <div className={styles.backdrop}>
      <div className={`glass-panel ${styles.modal} ${styles.modalLarge}`}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>Performance Drill-down (Refresher)</h3>
            <div className={styles.modalSubtitle}>
              {cluster} ➔ {team} ➔ {month}
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onClose} title="Close drill-down"><X size={18} /></button>
        </div>
        <div className={styles.modalBody}>
          <table className={`data-table ${styles.fullWidthTable}`}>
            <thead>
              <tr>
                <th className={styles.thSmall}></th>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Trainer</th>
                <th>Date</th>
                <th className={styles.tdCenter}>Science</th>
                <th className={styles.tdCenter}>Skill</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => {
                const isExpanded = expandedRows.has(`${r.employeeId}_${i}`);
                return (
                  <Fragment key={r.employeeId + i}>
                    <tr onClick={() => toggleRow(r.employeeId, i)} className={styles.rowClickable}>
                      <td>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                      <td className={styles.tdEmpId}>{r.employeeId}</td>
                      <td className={styles.tdName}>{r.name}</td>
                      <td>{r.trainer}</td>
                      <td>{r.attendanceDate}</td>
                      <td className={`${styles.tdCenterBold} ${getScoreColor(r.science)}`}>{r.science !== null ? Math.round(r.science) : '—'}</td>
                      <td className={`${styles.tdCenterBold} ${getScoreColor(r.skill)}`}>{r.skill !== null ? Math.round(r.skill) : '—'}</td>
                    </tr>
                    {isExpanded && (
                      <tr className={styles.expandedRow}>
                        <td />
                        <td colSpan={6} className={styles.tdExpanded}>
                          <div className={styles.grid3}>
                            <div className={`glass-panel ${styles.scoreCard}`}>
                              <div className={styles.scoreLabel}>Knowledge</div>
                              <div className={`${styles.tdName} ${getScoreColor(r.knowledge)}`}>{r.knowledge ?? '—'}</div>
                            </div>
                            <div className={`glass-panel ${styles.scoreCard}`}>
                              <div className={styles.scoreLabel}>Situation Handling</div>
                              <div className={`${styles.tdName} ${getScoreColor(r.situationHandling)}`}>{r.situationHandling ?? '—'}</div>
                            </div>
                            <div className={`glass-panel ${styles.scoreCard}`}>
                              <div className={styles.scoreLabel}>Presentation</div>
                              <div className={`${styles.tdName} ${getScoreColor(r.presentation)}`}>{r.presentation ?? '—'}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {records.length === 0 && <tr><td colSpan={7} className={styles.tdCenter}>No candidates found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- EXPORTED MATRICES ---

export const RefresherAttendanceMatrix: React.FC<{ data: RefresherAttendanceAggregates, fyMonths: string[], timelines: Map<string, EmployeeEventTimeline> }> = memo(({ data, fyMonths, timelines }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drillTarget, setDrillTarget] = useState<{ cluster: string, team: string, month: string } | null>(null);

  const toggleExpand = useCallback((k: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }, []);

  return (
    <Fragment>
      <div className={`glass-panel ${styles.matrixWrapper}`}>
        <table className={`data-table ${styles.fullMinTable}`}>
          <thead>
            <tr>
              <th className={styles.thExpand}></th>
              <th className={styles.thCluster}>Cluster / Team</th>
              <th className={styles.thCenter}>Total Notified</th>
              <th className={styles.thCenter}>Total Attended</th>
              {fyMonths.map(mo => <th key={mo} className={styles.thMonth}>{formatMonthLabel(mo)}</th>)}
            </tr>
          </thead>
          <tbody>
            {Object.keys(data.clusterMonthMap).sort().map(clusterName => {
              const clusterData = data.clusterMonthMap[clusterName];
              const isOpen = expanded.has(clusterName);

              return (
                <Fragment key={clusterName}>
                  <tr onClick={() => toggleExpand(clusterName)} className={styles.clusterRow}>
                    <td>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                    <td className={styles.clusterName}>{clusterName}</td>
                    <td className={styles.tdCenterBold}>{clusterData.totalNotified}</td>
                    <td className={`${styles.tdCenterBold} ${styles.valStrong}`}>{clusterData.totalAttended}</td>
                    {fyMonths.map(mo => {
                      const cell = clusterData.months[mo];
                      if (!cell || (!cell.notified && !cell.attended)) return <td key={mo} className={styles.cellEmpty}>—</td>;
                      const pct = cell.notified > 0 ? Math.round((cell.attended / cell.notified) * 100) : 0;
                      return (
                        <td key={mo} className={styles.cellActive}>
                          <span className={`${styles.tdCenterBold} ${styles.valStrong}`}>{cell.attended}</span>
                          <span className={styles.valMuted}>/</span>
                          <span className={styles.tdCenterBold}>{cell.notified}</span>
                          <div className={styles.valPct}>({pct}%)</div>
                        </td>
                      );
                    })}
                  </tr>
                  
                  {isOpen && Object.keys(clusterData.teams).sort().map(teamName => {
                    const teamData = clusterData.teams[teamName];
                    return (
                      <tr key={teamName}>
                        <td></td>
                        <td className={styles.teamNameCell}>↳ {teamName}</td>
                        <td className={styles.tdCenter}>{teamData.totalNotified}</td>
                        <td className={`${styles.tdCenter} ${styles.valStrong}`}>{teamData.totalAttended}</td>
                        {fyMonths.map(mo => {
                          const cell = teamData.months[mo];
                          if (!cell || (!cell.notified && !cell.attended)) return <td key={mo} className={styles.cellEmpty}>—</td>;
                          const pct = cell.notified > 0 ? Math.round((cell.attended / cell.notified) * 100) : 0;
                          return (
                            <td key={mo} className={styles.cellInteractive} onClick={() => setDrillTarget({ cluster: clusterName, team: teamName, month: mo })}>
                              <div className={`glass-panel ${styles.drillCard} ${getAttBgClass(pct)}`}>
                                <span className={`${styles.tdCenterBold} ${styles.valStrong}`}>{cell.attended}</span>
                                <span className={styles.valMuted}>/</span>
                                <span className={styles.tdCenterBold}>{cell.notified}</span>
                                <div className={styles.valPct}>({pct}%)</div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {drillTarget && <RefresherAttendanceDrilldown cluster={drillTarget.cluster} team={drillTarget.team} month={drillTarget.month} timelines={timelines} onClose={() => setDrillTarget(null)} />}
    </Fragment>
  );
});

export const RefresherPerformanceMatrix: React.FC<{ data: RefresherPerformanceAggregates, fyMonths: string[], timelines: Map<string, EmployeeEventTimeline> }> = memo(({ data, fyMonths, timelines }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drillTarget, setDrillTarget] = useState<{ cluster: string, team: string, month: string } | null>(null);

  const toggleExpand = useCallback((k: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }, []);

  return (
    <Fragment>
      <div className={`glass-panel ${styles.matrixWrapper}`}>
        <table className={`data-table ${styles.fullMinTable}`}>
          <thead>
            <tr>
              <th className={styles.thExpand}></th>
              <th className={styles.thCluster}>Cluster / Team</th>
              {fyMonths.map(mo => <th key={mo} className={styles.thMonth}>{formatMonthLabel(mo)}</th>)}
            </tr>
          </thead>
          <tbody>
            {Object.keys(data.clusterMap).sort().map(clusterName => {
              const clusterData = data.clusterMap[clusterName];
              const isOpen = expanded.has(clusterName);

              return (
                <Fragment key={clusterName}>
                  <tr onClick={() => toggleExpand(clusterName)} className={styles.clusterRow}>
                    <td>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                    <td className={styles.clusterName}>{clusterName}</td>
                    {fyMonths.map(mo => {
                      const cell = clusterData.months[mo];
                      if (!cell || cell.count === 0) return <td key={mo} className={styles.cellEmpty}>—</td>;
                      return (
                        <td key={mo} className={styles.cellActive}>
                          <div className={styles.scoreRow}>
                            <div className={`${styles.scoreValue} ${getScoreColor(cell.avgScience)}`}>
                              Sci: {Math.round(cell.avgScience)}
                              <span className={styles.valMuted}>|</span>
                              Skl: {Math.round(cell.avgSkill)}
                            </div>
                            <div className={styles.scoreSub}>N={cell.count}</div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  
                  {isOpen && Object.keys(clusterData.teams).sort().map(teamName => {
                    const teamData = clusterData.teams[teamName];
                    return (
                      <tr key={teamName}>
                        <td></td>
                        <td className={styles.teamNameCell}>↳ {teamName}</td>
                        {fyMonths.map(mo => {
                          const cell = teamData.months[mo];
                          if (!cell || cell.count === 0) return <td key={mo} className={styles.cellEmpty}>—</td>;
                          const avg = (cell.avgScience + cell.avgSkill) / 2;
                          return (
                            <td key={mo} className={styles.cellInteractive} onClick={() => setDrillTarget({ cluster: clusterName, team: teamName, month: mo })}>
                              <div className={`glass-panel ${styles.drillCard} ${getScoreBgClass(avg)}`}>
                                <div className={`${styles.drillCardScore} ${getScoreColor(cell.avgScience)}`}>
                                  Sci: {Math.round(cell.avgScience)}
                                  <span className={styles.valMuted}>|</span>
                                  Skl: {Math.round(cell.avgSkill)}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {drillTarget && <RefresherPerformanceDrilldown cluster={drillTarget.cluster} team={drillTarget.team} month={drillTarget.month} timelines={timelines} onClose={() => setDrillTarget(null)} />}
    </Fragment>
  );
});
