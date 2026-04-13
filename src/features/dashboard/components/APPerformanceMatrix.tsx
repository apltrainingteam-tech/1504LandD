import React, { useState, Fragment } from 'react';
import { ChevronRight, ChevronDown, CheckCircle2, Zap, Trophy, AlertTriangle, AlertCircle, TrendingUp, Search, X } from 'lucide-react';
import { APPerformanceAggregates, APCandidatePerformance, getDrilldownList } from '../../../services/apPerformanceService';
import { EmployeeEventTimeline } from '../../../services/apIntelligenceService';

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

const getBgColor = (val: number | null, type: 'knowledge' | 'bse') => {
  if (val === null) return 'transparent';
  const thresholds = SCORE_THRESHOLDS[type];
  if (val >= thresholds.green) return 'rgba(16, 185, 129, 0.1)';
  if (val >= thresholds.yellow) return 'rgba(245, 158, 11, 0.1)';
  return 'rgba(239, 68, 68, 0.1)';
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
  const records = getDrilldownList(timelines, { cluster, team, month });
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
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ width: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Performance Drill-down</h3>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {cluster} ➔ {team} ➔ {month}
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onClose}><X size={18} /></button>
        </div>
        
        <div style={{ padding: '16px 20px', display: 'flex', gap: '16px', background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Total Candidates</span>
            <span style={{ fontSize: '18px', fontWeight: 700 }}>{totalAttendees}</span>
          </div>
          <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Avg Knowledge</span>
            <span style={{ fontSize: '18px', fontWeight: 700, className: getColorClass(avgK, 'knowledge') }}>{avgK ? avgK.toFixed(1) : '—'}</span>
          </div>
          <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Avg BSE</span>
            <span style={{ fontSize: '18px', fontWeight: 700, className: getColorClass(avgBse, 'bse') }}>{avgBse ? avgBse.toFixed(1) : '—'}</span>
          </div>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', gap: '8px' }}>
          <button className={`btn ${sortField === 'knowledge' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSortField('knowledge')} style={{ fontSize: '12px', padding: '4px 12px' }}>Sort by Knowledge</button>
          <button className={`btn ${sortField === 'bse' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSortField('bse')} style={{ fontSize: '12px', padding: '4px 12px' }}>Sort by BSE</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px 20px 20px' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '30px' }}></th>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Trainer</th>
                <th>Date</th>
                <th style={{ textAlign: 'center' }}>Knowledge</th>
                <th style={{ textAlign: 'center' }}>BSE</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.map((r, i) => {
                const isExpanded = expandedRow === r.employeeId + i;
                return (
                  <Fragment key={r.employeeId + i}>
                    <tr onClick={() => setExpandedRow(isExpanded ? null : r.employeeId + i)} style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}>
                      <td>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.employeeId}</td>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td>{r.trainer}</td>
                      <td>{r.attendanceDate}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }} className={getColorClass(r.knowledge, 'knowledge')}>{r.knowledge !== null ? r.knowledge : '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }} className={getColorClass(r.bse, 'bse')}>{r.bse !== null ? r.bse.toFixed(1) : '—'}</td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <div style={{ padding: '16px 40px', background: 'rgba(0,0,0,0.3)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                            {['Grasping', 'Detailing', 'Situation Handling', 'English', 'Local Language', 'Involvement', 'Effort', 'Confidence'].map(k => {
                              // map key to object property
                              let key = k.toLowerCase().replace(' ', '');
                              if (k === 'Situation Handling') key = 'situationHandling';
                              if (k === 'Local Language') key = 'localLanguage';
                              const rawVal = (r as any)[key];
                              return (
                                <div key={k} className="glass-panel" style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{k}</span>
                                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{rawVal !== null ? rawVal : '—'}</span>
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
              {sortedRecords.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>No candidates found.</td></tr>}
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

  const formatMonthLabel = (month: string) => {
    const m = month.split('-')[1];
    const MONTH_LABELS: Record<string, string> = {
      '04': 'Apr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug', '09': 'Sep',
      '10': 'Oct', '11': 'Nov', '12': 'Dec', '01': 'Jan', '02': 'Feb', '03': 'Mar'
    };
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
                  <tr onClick={() => toggleExpand(clusterName)} style={{ cursor: 'pointer', background: 'rgba(99,102,241,0.04)' }}>
                    <td>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                    <td style={{ fontWeight: 700 }}>{clusterName}</td>
                    {fyMonths.map(mo => {
                      const cell = clusterData.months[mo];
                      if (!cell || cell.count === 0) return <td key={mo} style={{ textAlign: 'center', opacity: 0.3 }}>—</td>;
                      
                      return (
                        <td key={mo} style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>
                              <span className={getColorClass(cell.avgKnowledge, 'knowledge')}>K: {cell.avgKnowledge ? Math.round(cell.avgKnowledge) : '—'}</span>
                              <span style={{ margin: '0 4px', color: 'var(--border-color)' }}>|</span>
                              <span className={getColorClass(cell.avgBSE, 'bse')}>BSE: {cell.avgBSE ? cell.avgBSE.toFixed(1) : '—'}</span>
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
                              <div className="glass-panel" style={{ padding: '6px', background: getBgColor(cell.avgKnowledge, 'knowledge'), display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600 }}>
                                  <span className={getColorClass(cell.avgKnowledge, 'knowledge')}>K: {cell.avgKnowledge ? Math.round(cell.avgKnowledge) : '—'}</span>
                                  <span style={{ margin: '0 4px', color: 'var(--border-color)' }}>|</span>
                                  <span className={getColorClass(cell.avgBSE, 'bse')}>BSE: {cell.avgBSE ? cell.avgBSE.toFixed(1) : '—'}</span>
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
              <tr><td colSpan={fyMonths.length + 2} style={{ textAlign: 'center', padding: '30px' }}>No performance data available for this criteria.</td></tr>
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
