import React, { useState, Fragment, memo, useCallback } from 'react';
import { ChevronRight, ChevronDown, X } from 'lucide-react';
import { CapsuleAttendanceAggregates, getCapsuleAttendanceDrilldown, CapsuleCandidateAttendance } from '../services/capsuleAttendanceService';
import { CapsulePerformanceAggregates, getCapsulePerformanceDrilldown, CapsuleCandidatePerformance } from '../services/capsulePerformanceService';
import { EmployeeEventTimeline } from '../services/apIntelligenceService';

const getScoreColor = (val: number | null) => {
  if (val === null) return '';
  if (val >= 80) return 'text-success';
  if (val >= 60) return 'text-warning';
  return 'text-danger';
};

const getScoreBg = (val: number | null) => {
  if (val === null) return 'transparent';
  if (val >= 80) return 'rgba(16, 185, 129, 0.1)';
  if (val >= 60) return 'rgba(245, 158, 11, 0.1)';
  return 'rgba(239, 68, 68, 0.1)';
};

// --- CAPSULE ATTENDANCE DRILLDOWN ---
const CapsuleAttendanceDrilldown: React.FC<{ cluster: string, team: string, month: string, timelines: Map<string, EmployeeEventTimeline>, onClose: () => void }> = ({ cluster, team, month, timelines, onClose }) => {
  const records = getCapsuleAttendanceDrilldown(timelines, { cluster, team, month });
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ width: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Attendance Drill-down (Capsule)</h3>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {cluster} ➔ {team} ➔ {month}
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>
          <table className="data-table" style={{ width: '100%' }}>
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
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.employeeId}</td>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td>{r.team}</td>
                  <td>{r.trainer}</td>
                  <td>{r.date}</td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>No candidates found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- CAPSULE PERFORMANCE DRILLDOWN ---
const CapsulePerformanceDrilldown: React.FC<{ cluster: string, team: string, month: string, timelines: Map<string, EmployeeEventTimeline>, onClose: () => void }> = ({ cluster, team, month, timelines, onClose }) => {
  const records = getCapsulePerformanceDrilldown(timelines, { cluster, team, month });
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ width: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Performance Drill-down (Capsule)</h3>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {cluster} ➔ {team} ➔ {month}
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Trainer</th>
                <th>Date</th>
                <th style={{ textAlign: 'center' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.employeeId + i}>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.employeeId}</td>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td>{r.trainer}</td>
                  <td>{r.attendanceDate}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }} className={getScoreColor(r.score)}>{r.score !== null ? Math.round(r.score) : '—'}</td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>No candidates found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- EXPORTED MATRICES ---

export const CapsuleAttendanceMatrix: React.FC<{ data: CapsuleAttendanceAggregates, fyMonths: string[], timelines: Map<string, EmployeeEventTimeline> }> = ({ data, fyMonths, timelines }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drillTarget, setDrillTarget] = useState<{ cluster: string, team: string, month: string } | null>(null);

  const toggleExpand = (k: string) => {
    const next = new Set(expanded);
    next.has(k) ? next.delete(k) : next.add(k);
    setExpanded(next);
  };

  const formatMonthLabel = (month: string) => {
    const m = month.split('-')[1];
    const MONTH_LABELS: Record<string, string> = { '04': 'Apr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec', '01': 'Jan', '02': 'Feb', '03': 'Mar' };
    return MONTH_LABELS[m] || month;
  };

  return (
    <Fragment>
      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ width: '100%', minWidth: '1000px' }}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th style={{ minWidth: '160px' }}>Cluster / Team</th>
              <th style={{ textAlign: 'center' }}>Total Notified</th>
              <th style={{ textAlign: 'center' }}>Total Attended</th>
              {fyMonths.map(mo => <th key={mo} style={{ textAlign: 'center', minWidth: '110px' }}>{formatMonthLabel(mo)}</th>)}
            </tr>
          </thead>
          <tbody>
            {Object.keys(data.clusterMonthMap).sort().map(clusterName => {
              const clusterData = data.clusterMonthMap[clusterName];
              const isOpen = expanded.has(clusterName);

              return (
                <Fragment key={clusterName}>
                  <tr onClick={() => toggleExpand(clusterName)} style={{ cursor: 'pointer', background: 'rgba(34,45,104,0.04)' }}>
                    <td>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                    <td style={{ fontWeight: 700 }}>{clusterName}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{clusterData.totalNotified}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--success)' }}>{clusterData.totalAttended}</td>
                    {fyMonths.map(mo => {
                      const cell = clusterData.months[mo];
                      if (!cell || (!cell.notified && !cell.attended)) return <td key={mo} style={{ textAlign: 'center', opacity: 0.3 }}>—</td>;
                      const pct = cell.notified > 0 ? Math.round((cell.attended / cell.notified) * 100) : 0;
                      return (
                        <td key={mo} style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 600, color: 'var(--success)' }}>{cell.attended}</span>
                          <span style={{ color: 'var(--text-secondary)', margin: '0 4px' }}>/</span>
                          <span style={{ fontWeight: 600 }}>{cell.notified}</span>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>({pct}%)</div>
                        </td>
                      );
                    })}
                  </tr>
                  
                  {isOpen && Object.keys(clusterData.teams).sort().map(teamName => {
                    const teamData = clusterData.teams[teamName];
                    return (
                      <tr key={teamName}>
                        <td></td>
                        <td style={{ paddingLeft: '24px', fontSize: '13px' }}>↳ {teamName}</td>
                        <td style={{ textAlign: 'center' }}>{teamData.totalNotified}</td>
                        <td style={{ textAlign: 'center', color: 'var(--success)' }}>{teamData.totalAttended}</td>
                        {fyMonths.map(mo => {
                          const cell = teamData.months[mo];
                          if (!cell || (!cell.notified && !cell.attended)) return <td key={mo} style={{ textAlign: 'center', opacity: 0.3 }}>—</td>;
                          const pct = cell.notified > 0 ? Math.round((cell.attended / cell.notified) * 100) : 0;
                          return (
                            <td key={mo} style={{ textAlign: 'center', padding: '4px', cursor: 'pointer' }} onClick={() => setDrillTarget({ cluster: clusterName, team: teamName, month: mo })}>
                              <div className="glass-panel" style={{ padding: '6px', background: pct >= 80 ? 'rgba(16, 185, 129, 0.1)' : pct < 50 ? 'rgba(239, 68, 68, 0.1)' : 'transparent', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontWeight: 600, color: 'var(--success)' }}>{cell.attended}</span>
                                <span style={{ color: 'var(--text-secondary)', margin: '0 4px' }}>/</span>
                                <span style={{ fontWeight: 600 }}>{cell.notified}</span>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>({pct}%)</div>
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
      {drillTarget && <CapsuleAttendanceDrilldown cluster={drillTarget.cluster} team={drillTarget.team} month={drillTarget.month} timelines={timelines} onClose={() => setDrillTarget(null)} />}
    </Fragment>
  );
};

export const CapsulePerformanceMatrix: React.FC<{ data: CapsulePerformanceAggregates, fyMonths: string[], timelines: Map<string, EmployeeEventTimeline> }> = ({ data, fyMonths, timelines }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drillTarget, setDrillTarget] = useState<{ cluster: string, team: string, month: string } | null>(null);

  const toggleExpand = (k: string) => {
    const next = new Set(expanded);
    next.has(k) ? next.delete(k) : next.add(k);
    setExpanded(next);
  };

  const formatMonthLabel = (month: string) => {
    const m = month.split('-')[1];
    const MONTH_LABELS: Record<string, string> = { '04': 'Apr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec', '01': 'Jan', '02': 'Feb', '03': 'Mar' };
    return MONTH_LABELS[m] || month;
  };

  return (
    <Fragment>
      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ width: '100%', minWidth: '1000px' }}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th style={{ minWidth: '160px' }}>Cluster / Team</th>
              {fyMonths.map(mo => <th key={mo} style={{ textAlign: 'center', minWidth: '110px' }}>{formatMonthLabel(mo)}</th>)}
            </tr>
          </thead>
          <tbody>
            {Object.keys(data.clusterMap).sort().map(clusterName => {
              const clusterData = data.clusterMap[clusterName];
              const isOpen = expanded.has(clusterName);

              return (
                <Fragment key={clusterName}>
                  <tr onClick={() => toggleExpand(clusterName)} style={{ cursor: 'pointer', background: 'rgba(34,45,104,0.04)' }}>
                    <td>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                    <td style={{ fontWeight: 700 }}>{clusterName}</td>
                    {fyMonths.map(mo => {
                      const cell = clusterData.months[mo];
                      if (!cell || cell.count === 0) return <td key={mo} style={{ textAlign: 'center', opacity: 0.3 }}>—</td>;
                      return (
                        <td key={mo} style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600 }} className={getScoreColor(cell.avgScore)}>
                              Score: {Math.round(cell.avgScore)}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>N={cell.count}</div>
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
                        <td style={{ paddingLeft: '24px', fontSize: '13px' }}>↳ {teamName}</td>
                        {fyMonths.map(mo => {
                          const cell = teamData.months[mo];
                          if (!cell || cell.count === 0) return <td key={mo} style={{ textAlign: 'center', opacity: 0.3 }}>—</td>;
                          return (
                            <td key={mo} style={{ textAlign: 'center', padding: '4px', cursor: 'pointer' }} onClick={() => setDrillTarget({ cluster: clusterName, team: teamName, month: mo })}>
                              <div className="glass-panel" style={{ padding: '6px', background: getScoreBg(cell.avgScore), display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600 }} className={getScoreColor(cell.avgScore)}>
                                  Score: {Math.round(cell.avgScore)}
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
      {drillTarget && <CapsulePerformanceDrilldown cluster={drillTarget.cluster} team={drillTarget.team} month={drillTarget.month} timelines={timelines} onClose={() => setDrillTarget(null)} />}
    </Fragment>
  );
};


