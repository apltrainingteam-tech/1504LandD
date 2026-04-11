import React, { useState, useMemo, useEffect, Fragment } from 'react';
import { 
  Table, 
  Calendar, 
  GraduationCap, 
  AlertTriangle, 
  ChevronRight, 
  ChevronDown, 
  Trophy, 
  Zap,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { Employee } from '../types/employee';
import { Attendance, TrainingScore, TrainingNomination, Demographics, TrainingType, EligibilityRule } from '../types/attendance';
import { ViewByOption, GroupedData } from '../types/reports';
import { 
  buildUnifiedDataset, 
  groupData, 
  rankGroups, 
  calcIP, 
  calcAP, 
  calcMIP,
  getGapData,
  getPrimaryMetric 
} from '../services/reportService';
import { getEligibleEmployees, EligibilityResult } from '../services/eligibilityService';
import { getCollection } from '../services/firestoreService';
import { Filters } from '../components/Filters';
import { KPIBox } from '../components/KPIBox';
import { flagScore, flagClass, flagLabel } from '../utils/scoreNormalizer';
import { DataTable } from '../components/DataTable';

interface ReportsAnalyticsProps {
  employees: Employee[];
  attendance: Attendance[];
  scores: TrainingScore[];
  nominations: TrainingNomination[];
  demographics: Demographics[];
}

export const ReportsAnalytics: React.FC<ReportsAnalyticsProps> = ({ 
  employees, attendance, scores, nominations, demographics 
}) => {
  const [tab, setTab] = useState<TrainingType | any>('IP');
  const [viewBy, setViewBy] = useState<ViewByOption | any>('Team');
  const [subView, setSubView] = useState<'grouped' | 'timeseries' | 'trainer' | 'gap'>('grouped');
  const [expanded, setExpanded] = useState(new Set<string>());
  const [rules, setRules] = useState<EligibilityRule[]>([]);

  useEffect(() => {
    getCollection('eligibility_rules').then(data => setRules(data as EligibilityRule[]));
  }, []);

  const eligibilityResults = useMemo(() => {
    const rule = rules.find(r => r.trainingType === tab);
    return getEligibleEmployees(tab, rule, employees, attendance, nominations);
  }, [tab, rules, employees, attendance, nominations]);

  const gapMetrics = useMemo(() => {
    return getGapData(tab, eligibilityResults, attendance);
  }, [tab, eligibilityResults, attendance]);

  const unified = useMemo(() => {
    const att = attendance.filter(a => a.trainingType === tab);
    const scs = scores.filter(s => s.trainingType === tab);
    const noms = nominations.filter(n => n.trainingType === tab);
    return buildUnifiedDataset(employees, att, scs, noms, eligibilityResults);
  }, [employees, attendance, scores, nominations, tab, eligibilityResults]);

  const groups = useMemo(() => {
    const noms = nominations.filter(n => n.trainingType === tab);
    return groupData(unified, viewBy as ViewByOption, noms, employees);
  }, [unified, viewBy, nominations, employees, tab]);

  const ranked = useMemo(() => rankGroups(groups, tab), [groups, tab]);

  const gIP = useMemo(() => calcIP(unified), [unified]);
  const gAP = useMemo(() => calcAP(unified, nominations.filter(n => n.trainingType === tab)), [unified, nominations, tab]);
  const gMIP = useMemo(() => calcMIP(unified), [unified]);

  const toggleExpand = (k: string) => {
    const next = new Set(expanded);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setExpanded(next);
  };

  const headers = [
    '#', '', viewBy, 
    ...(tab === 'IP' ? ['Total', 'High', 'Med', 'Low', 'Weighted', 'Flag'] : []),
    ...(tab === 'AP' ? ['Notified', 'Attended', 'Conv%', 'Composite', 'Flag'] : []),
    ...(tab === 'MIP' ? ['Count', 'Avg Sci', 'Avg Skl', 'Flag'] : [])
  ];

  return (
    <div className="animate-fade-in">
      <div className="header">
        <div>
          <h2 style={{ fontSize: '24px' }}>Intelligence Engine</h2>
          <p className="text-muted">High-fidelity training analytics and rankings</p>
        </div>
        <div className="flex-center">
          <button className={`btn ${subView === 'grouped' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('grouped')} title="Standardized Reports"><Table size={16} /></button>
          <button className={`btn ${subView === 'timeseries' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('timeseries')} title="Trend Analysis"><Calendar size={16} /></button>
          <button className={`btn ${subView === 'trainer' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('trainer')} title="Trainer Performance"><GraduationCap size={16} /></button>
          <button className={`btn ${subView === 'gap' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('gap')} title="Training Gaps" style={{ color: subView === 'gap' ? '#fff' : 'var(--danger)', borderColor: subView === 'gap' ? 'var(--danger)' : '' }}><AlertTriangle size={16} /></button>
        </div>
      </div>

      <Filters 
        options={['IP', 'AP', 'MIP', 'Capsule', 'Pre_AP']} 
        activeOption={tab} 
        onChange={setTab}
        viewByOptions={['Month', 'Cluster', 'Team']}
        activeViewBy={viewBy}
        onViewByChange={setViewBy}
      />

      <div className="dashboard-grid">
        {subView === 'gap' ? (
          <Fragment>
            <KPIBox title="Eligible Cohort" value={gapMetrics.eligibleCount} icon={ShieldCheck} />
            <KPIBox title="Trained Volume" value={gapMetrics.trainedCount} color="var(--success)" icon={CheckCircle2} />
            <KPIBox title="Training Gap" value={gapMetrics.gapCount} color="var(--danger)" icon={AlertTriangle} subValue={`${((gapMetrics.gapCount / (gapMetrics.eligibleCount || 1)) * 100).toFixed(1)}% untrained`} />
          </Fragment>
        ) : (
          <Fragment>
            {tab === 'IP' && (
              <Fragment>
                <KPIBox title="Total Scored" value={gIP.total} icon={Zap} />
                <KPIBox title="Grade Distribution" value={`${gIP.high} / ${gIP.medium} / ${gIP.low}`} subValue="High / Med / Low" />
                <KPIBox title="Weighted Average" value={gIP.weighted.toFixed(2)} color="var(--warning)" badge={<span className={`badge ${flagClass(flagScore(gIP.weighted))}`}>{flagLabel(flagScore(gIP.weighted))}</span>} />
              </Fragment>
            )}
            {tab === 'AP' && (
              <Fragment>
                <KPIBox title="Conversion Path" value={`${gAP.attended} / ${gAP.notified}`} subValue="Attended / Notified" />
                <KPIBox title="Conversion %" value={`${gAP.conversion.toFixed(1)}%`} icon={Zap} />
                <KPIBox title="Composite Score" value={gAP.composite.toFixed(2)} color="var(--success)" badge={<span className={`badge ${flagClass(flagScore(gAP.composite))}`}>{flagLabel(flagScore(gAP.composite))}</span>} />
              </Fragment>
            )}
            {['MIP', 'Capsule', 'Pre_AP'].includes(tab) && (
              <Fragment>
                <KPIBox title="Attendance" value={gMIP.count} icon={Zap} />
                <KPIBox title="Avg Science" value={gMIP.avgSci.toFixed(2)} color="var(--accent-primary)" badge={<span className={`badge ${flagClass(flagScore(gMIP.avgSci))}`}>Sci</span>} />
                <KPIBox title="Avg Skill" value={gMIP.avgSkl.toFixed(2)} color="var(--accent-secondary)" badge={<span className={`badge ${flagClass(flagScore(gMIP.avgSkl))}`}>Skl</span>} />
              </Fragment>
            )}
          </Fragment>
        )}
      </div>

      {subView === 'grouped' && (
        <Fragment>
          {ranked.length > 1 && (
            <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid var(--success)' }}>
                <div className="flex-center mb-4" style={{ color: 'var(--success)' }}><Trophy size={18} /><span style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>Top Performance</span></div>
                {ranked.slice(0, 3).map(g => <div key={g.key} style={{ fontSize: '14px', marginBottom: '8px' }}>#{g.rank} <strong>{g.key}</strong> — {g.metric.toFixed(1)}</div>)}
              </div>
              <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid var(--danger)' }}>
                <div className="flex-center mb-4" style={{ color: 'var(--danger)' }}><AlertTriangle size={18} /><span style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>Needs Attention</span></div>
                {ranked.slice(-3).reverse().map(g => <div key={g.key} style={{ fontSize: '14px', marginBottom: '8px' }}>#{g.rank} <strong>{g.key}</strong> — {g.metric.toFixed(1)}</div>)}
              </div>
            </div>
          )}

          <div className="mt-8">
            <DataTable headers={headers}>
              {ranked.map(g => {
                const isOpen = expanded.has(g.key);
                return (
                  <Fragment key={g.key}>
                    <tr onClick={() => toggleExpand(g.key)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{g.rank}</td>
                      <td>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                      <td style={{ fontWeight: 600 }}>{g.key}</td>
                      {tab === 'IP' && (() => {
                        const m = calcIP(g.records);
                        return (
                          <Fragment>
                            <td>{m.total}</td><td>{m.high}</td><td>{m.medium}</td><td>{m.low}</td>
                            <td style={{ fontWeight: 700, color: 'var(--warning)' }}>{m.weighted.toFixed(2)}</td>
                            <td><span className={`badge ${flagClass(flagScore(m.weighted))}`}>{flagLabel(flagScore(m.weighted))}</span></td>
                          </Fragment>
                        );
                      })()}
                      {tab === 'AP' && (() => {
                        const m = calcAP(g.records, g.nominations);
                        return (
                          <Fragment>
                            <td>{m.notified}</td><td>{m.attended}</td><td>{m.conversion.toFixed(1)}%</td>
                            <td style={{ fontWeight: 700 }}>{m.composite.toFixed(2)}</td>
                            <td><span className={`badge ${flagClass(flagScore(m.composite))}`}>{flagLabel(flagScore(m.composite))}</span></td>
                          </Fragment>
                        );
                      })()}
                      {['MIP', 'Capsule', 'Pre_AP'].includes(tab) && (() => {
                        const m = calcMIP(g.records);
                        const avg = (m.avgSci + m.avgSkl) / 2;
                        return (
                          <Fragment>
                            <td>{m.count}</td><td>{m.avgSci.toFixed(2)}</td>
                            <td style={{ fontWeight: 700 }}>{m.avgSkl.toFixed(2)}</td>
                            <td><span className={`badge ${flagClass(flagScore(avg))}`}>{flagLabel(flagScore(avg))}</span></td>
                          </Fragment>
                        );
                      })()}
                    </tr>
                    {isOpen && g.records.map((r, ri) => (
                      <tr key={ri} style={{ background: 'rgba(255,255,255,0.02)', fontSize: '12px' }}>
                        <td></td><td></td>
                        <td colSpan={headers.length - 2} className="text-muted">
                          <strong>{r.employee.name}</strong> ({r.employee.employeeId}) · {r.attendance.attendanceDate} · Status: {r.attendance.attendanceStatus}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </DataTable>
          </div>
        </Fragment>
      )}

      {subView === 'gap' && (
        <div className="mt-8">
          <h3 className="mb-4">Gap Analysis: Eligible but Not Trained</h3>
          <DataTable headers={['Employee ID', 'Name', 'Team', 'Cluster', 'Status', 'Reason (if ineligible)']}>
            {eligibilityResults.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>No eligibility data found. Configure rules in Demographics.</td></tr>
            ) : eligibilityResults.map((er, i) => {
              const hasAttended = attendance.some(a => a.employeeId === er.employeeId && a.trainingType === tab && a.attendanceStatus === 'Present');
              if (hasAttended || !er.eligibilityStatus) return null;
              
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{er.employeeId}</td>
                  <td>{er.name}</td>
                  <td>{er.team}</td>
                  <td>{er.cluster}</td>
                  <td><span className="badge badge-danger">Untrained Gap</span></td>
                  <td className="text-muted" style={{ fontSize: '11px' }}>{er.reasonIfNotEligible || '—'}</td>
                </tr>
              );
            })}
          </DataTable>
        </div>
      )}

      {(subView === 'timeseries' || subView === 'trainer') && (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
          <AlertTriangle size={48} color="var(--warning)" style={{ marginBottom: '16px' }} />
          <h3>Module Under Migration</h3>
          <p className="text-muted">High-fidelity {subView} visualization engine is being ported to the React architecture.</p>
        </div>
      )}
    </div>
  );
};
