import React, { useState, Fragment } from 'react';
import { ChevronRight, ChevronDown, X } from 'lucide-react';
import { formatMonthLabel } from '../../../core/utils/fiscalYear';
import { APPerformanceAggregates, APCandidatePerformance, getAPDrilldownList } from '../../../core/engines/apEngine';
import { EmployeeEventTimeline } from '../../../core/engines/apEngine';
import { sortClusters } from '../../../core/engines/normalizationEngine';
import styles from './APPerformanceMatrix.module.css';

const SCORE_THRESHOLDS = {
  knowledge: { green: 80, yellow: 60 },
  bse: { green: 85, yellow: 70 }
};

const getColorClass = (val: number | null, type: 'knowledge' | 'bse') => {
  if (val === null) return '';
  const thresholds = SCORE_THRESHOLDS[type];
  if (val >= thresholds.green) return 'text-success';
  if (val >= thresholds.yellow) return 'text-warning';
  return 'text-danger';
};

const getBgClass = (val: number | null, type: 'knowledge' | 'bse') => {
  if (val === null) return styles.drillCardTransparent;
  const thresholds = SCORE_THRESHOLDS[type];
  if (val >= thresholds.green) return styles.drillCardSuccess;
  if (val >= thresholds.yellow) return styles.drillCardWarning;
  return styles.drillCardDanger;
};

// DRILLDOWN MODAL
interface APDrilldownModalProps {
  cluster: string;
  team: string;
  month: string;
  timelines: Map<string, EmployeeEventTimeline>;
  onClose: () => void;
}

const APDrilldownModal: React.FC<APDrilldownModalProps> = ({ cluster, team, month, timelines, onClose }) => {
  const records = getAPDrilldownList(timelines, { cluster, team, month });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'knowledge' | 'bse'>('knowledge');

  const sortedRecords = [...records].sort((a, b) => {
    const aVal = a[sortField] ?? -1;
    const bVal = b[sortField] ?? -1;
    return bVal - aVal;
  });

  const totalAttendees = records.length;
  const avgK = totalAttendees > 0 ? records.reduce((s, r) => s + (r.knowledge || 0), 0) / records.filter(r => r.knowledge !== null).length : 0;
  const avgBse = totalAttendees > 0 ? records.reduce((s, r) => s + (r.bse || 0), 0) / records.filter(r => r.bse !== null).length : 0;

  return (
    <div className={styles.backdrop}>
      <div className={`glass-panel ${styles.modal}`}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>Performance Drill-down</h3>
            <div className={styles.modalSubtitle}>
              {cluster} ➔ {team} ➔ {month}
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onClose} title="Close Drilldown" aria-label="Close Drilldown"><X size={18} /></button>
        </div>

        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Total Candidates</span>
            <span className={`${styles.statValue} tabular-nums`}>{totalAttendees}</span>
          </div>
          <div className={styles.divider}></div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Avg Knowledge</span>
            <span className={`${styles.statValue} ${getColorClass(avgK, 'knowledge')} tabular-nums`}>{avgK ? avgK.toFixed(1) : '—'}</span>
          </div>
          <div className={styles.divider}></div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Avg BSE</span>
            <span className={`${styles.statValue} ${getColorClass(avgBse, 'bse')} tabular-nums`}>{avgBse ? avgBse.toFixed(1) : '—'}</span>
          </div>
        </div>

        <div className={styles.sortBar}>
          <button className={`btn ${sortField === 'knowledge' ? 'btn-primary' : 'btn-secondary'} ${styles.sortBtn}`} onClick={() => setSortField('knowledge')}>Sort by Knowledge</button>
          <button className={`btn ${sortField === 'bse' ? 'btn-primary' : 'btn-secondary'} ${styles.sortBtn}`} onClick={() => setSortField('bse')}>Sort by BSE</button>
        </div>

        <div className={styles.tableBody}>
          <table className={`data-table ${styles.fullWidthTable}`}>
            <thead>
              <tr>
                <th className={styles.indexColHeader}></th>
                <th className={styles.thCenter}>Rank</th>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Trainer</th>
                <th>Date</th>
                <th className={styles.thCenter}>Knowledge</th>
                <th className={styles.thCenter}>BSE</th>
                <th className={styles.thCenter}>Signal</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.map((r, i) => {
                const isExpanded = expandedRow === r.employeeId + i;
                const rank = i + 1;
                const avgScore =
                  r.knowledge !== null && r.bse !== null
                    ? Math.round((r.knowledge + r.bse) / 2)
                    : r.knowledge !== null
                    ? Math.round(r.knowledge)
                    : r.bse !== null
                    ? Math.round(r.bse)
                    : 0;
                return (
                  <Fragment key={r.employeeId + i}>
                    <tr onClick={() => setExpandedRow(isExpanded ? null : r.employeeId + i)} className={styles.drilldownRow}>
                      <td>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                      <td className={styles.tdCenter}>
                        <span className={styles.rankPill}>#{rank}</span>
                      </td>
                      <td className={styles.tdEmpId}>{r.employeeId}</td>
                      <td className={styles.tdBold}>{r.name}</td>
                      <td>{r.trainer}</td>
                      <td>{r.attendanceDate}</td>
                      <td className={`${styles.tdCenter} ${getColorClass(r.knowledge, 'knowledge')}`}>{r.knowledge !== null ? r.knowledge : '—'}</td>
                      <td className={`${styles.tdCenter} ${getColorClass(r.bse, 'bse')}`}>{r.bse !== null ? r.bse.toFixed(1) : '—'}</td>
                      <td className={styles.tdSignal}>
                        <div className="perf-bar" aria-hidden="true">
                          <div className="perf-bar-fill" style={{ width: `${Math.max(0, Math.min(100, avgScore))}%`, background: 'var(--accent-primary)' }} />
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} className={styles.expandTd}>
                          <div className={styles.expandContent}>
                            {['Grasping', 'Detailing', 'Situation Handling', 'English', 'Local Language', 'Involvement', 'Effort', 'Confidence'].map(k => {
                              let key = k.toLowerCase().replace(' ', '');
                              if (k === 'Situation Handling') key = 'situationHandling';
                              if (k === 'Local Language') key = 'localLanguage';
                              const rawVal = (r as any)[key];
                              return (
                                <div key={k} className={`glass-panel ${styles.subScoreCard}`}>
                                  <span className={styles.subScoreLabel}>{k}</span>
                                  <span className={styles.subScoreValue}>{rawVal !== null ? rawVal : '—'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {sortedRecords.length === 0 && <tr><td colSpan={9} className={styles.noDataCell}>No candidates found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// MAIN MATRIX
export interface APPerformanceMatrixProps {
  data: APPerformanceAggregates;
  fyMonths: string[];
  timelines: Map<string, EmployeeEventTimeline>;
}

export const APPerformanceMatrix: React.FC<APPerformanceMatrixProps> = ({ data, fyMonths, timelines }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drillTarget, setDrillTarget] = useState<{ cluster: string, team: string, month: string } | null>(null);

  const toggleExpand = (k: string) => {
    const next = new Set(expanded);
    next.has(k) ? next.delete(k) : next.add(k);
    setExpanded(next);
  };


  return (
    <Fragment>
      <div className={`glass-panel ${styles.matrixWrapper}`}>
        <table className={`data-table ${styles.fullMinTable}`}>
          <thead>
            <tr>
              <th className={styles.expandColHeader}></th>
              <th className={styles.teamColHeader}>Cluster / Team</th>
              {fyMonths.map(mo => <th key={mo} className={styles.monthColHeader}>{formatMonthLabel(mo)}</th>)}
            </tr>
          </thead>
          <tbody>
            {sortClusters(Object.keys(data.clusterMap)).map(clusterName => {
              const clusterData = data.clusterMap[clusterName];
              const isOpen = expanded.has(clusterName);

              return (
                <Fragment key={clusterName}>
                  <tr onClick={() => toggleExpand(clusterName)} className={styles.clusterRow}>
                    <td>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                    <td className={styles.clusterName}>{clusterName}</td>
                    {fyMonths.map(mo => {
                      const cell = clusterData.months[mo];
                      if (!cell || cell.count === 0) return <td key={mo} className={styles.emptyMonthCell}>—</td>;

                      return (
                        <td key={mo} className={styles.monthCell}>
                          <div className={`${styles.monthCellInner} tabular-nums`}>
                            <div className="metric-row">
                              <span className="metric-label">K</span>
                              <span className={`metric-value ${getColorClass(cell.avgKnowledge, 'knowledge')}`}>{cell.avgKnowledge ? Math.round(cell.avgKnowledge) : '—'}%</span>
                            </div>
                            <div className="metric-row">
                              <span className="metric-label">BSE</span>
                              <span className={`metric-value ${getColorClass(cell.avgBSE, 'bse')}`}>{cell.avgBSE ? cell.avgBSE.toFixed(1) : '—'}</span>
                            </div>
                            <div className={styles.countBadge}>N={cell.count}</div>
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
                          if (!cell || cell.count === 0) return <td key={mo} className={styles.emptyMonthCell}>—</td>;

                          return (
                            <td key={mo} className={styles.drillCell} onClick={() => setDrillTarget({ cluster: clusterName, team: teamName, month: mo })}>
                              <div className={`glass-panel ${styles.drillCard} ${getBgClass(cell.avgKnowledge, 'knowledge')} tabular-nums`}>
                                <div className="metric-row">
                                  <span className="metric-label">K</span>
                                  <span className={`metric-value ${getColorClass(cell.avgKnowledge, 'knowledge')}`}>{cell.avgKnowledge ? Math.round(cell.avgKnowledge) : '—'}%</span>
                                </div>
                                <div className="metric-row">
                                  <span className="metric-label">BSE</span>
                                  <span className={`metric-value ${getColorClass(cell.avgBSE, 'bse')}`}>{cell.avgBSE ? cell.avgBSE.toFixed(1) : '—'}</span>
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
            {Object.keys(data.clusterMap).length === 0 && (
              <tr><td colSpan={fyMonths.length + 2} className={styles.matrixEmptyCell}>No performance data available for this criteria.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {drillTarget && (
        <APDrilldownModal
          cluster={drillTarget.cluster}
          team={drillTarget.team}
          month={drillTarget.month}
          timelines={timelines}
          onClose={() => setDrillTarget(null)}
        />
      )}
    </Fragment>
  );
};

