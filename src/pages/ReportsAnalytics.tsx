import React, { useState, useMemo, useEffect, Fragment } from 'react';
import {
  Table, Calendar, GraduationCap, AlertTriangle, ChevronRight, ChevronDown,
  Trophy, Zap, ShieldCheck, CheckCircle2, ChartNetwork, Download, Filter, X
} from 'lucide-react';
import { Employee } from '../types/employee';
import { Attendance, TrainingScore, TrainingNomination, Demographics, TrainingType, EligibilityRule } from '../types/attendance';
import { ViewByOption, GroupedData, ReportFilter } from '../types/reports';
import {
  buildUnifiedDataset, groupData, rankGroups,
  calcIP, calcAP, calcMIP, calcRefresher, calcCapsule, calcPreAP, calcGeneric,
  buildTimeSeries, calcTrainerStats, buildDrilldown,
  getGapData, getPrimaryMetric, applyFilters, exportToCSV
} from '../services/reportService';
import { getEligibleEmployees, EligibilityResult } from '../services/eligibilityService';
import { getCollection } from '../services/firestoreService';
import { KPIBox } from '../components/KPIBox';
import { DataTable } from '../components/DataTable';
import { TimeSeriesTable } from '../components/TimeSeriesTable';
import { TrainerTable } from '../components/TrainerTable';
import { DrilldownPanel } from '../components/DrilldownPanel';
import { flagScore, flagClass, flagLabel } from '../utils/scoreNormalizer';

const ALL_TRAINING_TYPES = ['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'Pre_AP'];

interface ReportsAnalyticsProps {
  employees: Employee[];
  attendance: Attendance[];
  scores: TrainingScore[];
  nominations: TrainingNomination[];
  demographics: Demographics[];
}

type SubView = 'grouped' | 'timeseries' | 'trainer' | 'drilldown' | 'gap';

export const ReportsAnalytics: React.FC<ReportsAnalyticsProps> = ({
  employees, attendance, scores, nominations, demographics
}) => {
  const [tab, setTab] = useState<string>('IP');
  const [viewBy, setViewBy] = useState<ViewByOption>('Team');
  const [subView, setSubView] = useState<SubView>('grouped');
  const [expanded, setExpanded] = useState(new Set<string>());
  const [rules, setRules] = useState<EligibilityRule[]>([]);
  const [tsMode, setTsMode] = useState<'score' | 'count'>('score');
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [filter, setFilter] = useState<ReportFilter>({
    monthFrom: '', monthTo: '', teams: [], clusters: [], trainer: ''
  });

  useEffect(() => {
    getCollection('eligibility_rules').then(data => setRules(data as EligibilityRule[]));
  }, []);

  // Dynamic options for filter dropdowns
  const allTeams = useMemo(() => [...new Set(employees.map(e => e.team).filter(Boolean))].sort(), [employees]);
  const allClusters = useMemo(() => [...new Set(employees.map(e => e.state).filter(Boolean))].sort(), [employees]);
  const allTrainers = useMemo(() => [...new Set(attendance.map(a => a.trainerId).filter(Boolean))].sort(), [attendance]);

  // Build filtered base dataset for current tab
  const rawUnified = useMemo(() => {
    const att = attendance.filter(a => a.trainingType === tab);
    const scs = scores.filter(s => s.trainingType === tab);
    const noms = nominations.filter(n => n.trainingType === tab);
    const rule = rules.find(r => r.trainingType === tab);
    const eligResults = getEligibleEmployees(tab as TrainingType, rule, employees, attendance, nominations);
    return buildUnifiedDataset(employees, att, scs, noms, eligResults);
  }, [tab, attendance, scores, nominations, employees, rules]);

  const unified = useMemo(() => applyFilters(rawUnified, filter), [rawUnified, filter]);

  const eligibilityResults = useMemo(() => {
    const rule = rules.find(r => r.trainingType === tab);
    return getEligibleEmployees(tab as TrainingType, rule, employees, attendance, nominations);
  }, [tab, rules, employees, attendance, nominations]);

  const tabNoms = useMemo(() => nominations.filter(n => n.trainingType === tab), [nominations, tab]);

  const gapMetrics = useMemo(() => getGapData(tab, eligibilityResults, attendance), [tab, eligibilityResults, attendance]);
  const groups = useMemo(() => groupData(unified, viewBy, tabNoms, employees), [unified, viewBy, tabNoms, employees]);
  const ranked = useMemo(() => rankGroups(groups, tab), [groups, tab]);
  const trainerStats = useMemo(() => calcTrainerStats(unified), [unified]);
  const drilldownNodes = useMemo(() => buildDrilldown(unified, tab), [unified, tab]);

  // Dynamic months from the filtered dataset
  const months = useMemo(() => {
    const mSet = new Set<string>();
    unified.forEach(r => {
      const m = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7);
      if (m) mSet.add(m);
    });
    return [...mSet].sort();
  }, [unified]);

  const timeSeries = useMemo(() => buildTimeSeries(groups, months, tab, tsMode), [groups, months, tab, tsMode]);

  // KPI computations
  const gIP = useMemo(() => calcIP(unified), [unified]);
  const gAP = useMemo(() => calcAP(unified, tabNoms), [unified, tabNoms]);
  const gMIP = useMemo(() => calcMIP(unified), [unified]);
  const gRef = useMemo(() => calcRefresher(unified), [unified]);
  const gCap = useMemo(() => calcCapsule(unified), [unified]);
  const gPreAP = useMemo(() => calcPreAP(unified, tabNoms), [unified, tabNoms]);

  const toggleExpand = (k: string) => {
    const next = new Set(expanded);
    next.has(k) ? next.delete(k) : next.add(k);
    setExpanded(next);
  };

  const hasActiveFilter = filter.monthFrom || filter.monthTo || filter.teams.length > 0 || filter.clusters.length > 0 || filter.trainer;

  const handleExport = () => {
    const rows = unified.map(r => ({
      EmployeeId: r.employee.employeeId,
      Name: r.employee.name,
      Team: r.employee.team,
      State: r.employee.state,
      Designation: r.employee.designation,
      TrainingType: r.attendance.trainingType,
      Date: r.attendance.attendanceDate,
      Status: r.attendance.attendanceStatus,
      Trainer: r.attendance.trainerId || '',
      Month: r.attendance.month || '',
      ...r.score?.scores
    }));
    exportToCSV(rows, `${tab}_report_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const headers = [
    '#', '', viewBy,
    ...(tab === 'IP' ? ['Total', 'High', 'Med', 'Low', 'Weighted', 'Flag'] : []),
    ...(tab === 'AP' ? ['Notified', 'Attended', 'Conv%', 'Composite', 'Defaulters', 'Flag'] : []),
    ...(tab === 'MIP' ? ['Count', 'Avg Sci', 'Avg Skl', 'Flag'] : []),
    ...(['Refresher', 'GTG', 'HO', 'RTM'].includes(tab) ? ['Count', 'Avg Score', 'Flag'] : []),
    ...(['Capsule', 'Pre_AP'].includes(tab) ? ['Count', 'Avg Score', 'Flag'] : []),
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '24px' }}>Intelligence Engine</h2>
          <p className="text-muted">High-fidelity training analytics and rankings</p>
        </div>
        <div className="flex-center" style={{ gap: '8px' }}>
          <button className={`btn ${subView === 'grouped' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('grouped')} title="Rankings"><Table size={16} /></button>
          <button className={`btn ${subView === 'timeseries' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('timeseries')} title="Time Series"><Calendar size={16} /></button>
          <button className={`btn ${subView === 'trainer' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('trainer')} title="Trainer Analytics"><GraduationCap size={16} /></button>
          <button className={`btn ${subView === 'drilldown' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('drilldown')} title="Drill-Down"><ChartNetwork size={16} /></button>
          <button className={`btn ${subView === 'gap' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('gap')} title="Gap Analysis" style={{ color: subView === 'gap' ? '#fff' : 'var(--danger)' }}><AlertTriangle size={16} /></button>
          <div style={{ width: '1px', height: '28px', background: 'var(--border-color)', margin: '0 4px' }} />
          <button className={`btn btn-secondary ${hasActiveFilter ? 'active' : ''}`} onClick={() => setShowFilters(f => !f)} title="Filters" style={{ position: 'relative' }}>
            <Filter size={16} />
            {hasActiveFilter && <span style={{ position: 'absolute', top: '4px', right: '4px', width: '8px', height: '8px', background: 'var(--accent-primary)', borderRadius: '50%' }} />}
          </button>
          <button className="btn btn-secondary" onClick={handleExport} title="Export CSV"><Download size={16} /></button>
        </div>
      </div>

      {/* Training Type Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {ALL_TRAINING_TYPES.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: '13px', padding: '6px 16px' }}>{t}</button>
        ))}
      </div>

      {/* View By + Filter Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: '8px', padding: '3px' }}>
          {(['Team', 'Cluster', 'Month'] as ViewByOption[]).map(v => (
            <button key={v} onClick={() => setViewBy(v)} style={{ padding: '5px 14px', borderRadius: '6px', background: viewBy === v ? 'var(--accent-primary)' : 'transparent', color: viewBy === v ? '#fff' : 'var(--text-secondary)', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>{v}</button>
          ))}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>From Month</label>
            <input type="month" className="form-input" value={filter.monthFrom} onChange={e => setFilter(f => ({ ...f, monthFrom: e.target.value }))} style={{ width: '150px' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>To Month</label>
            <input type="month" className="form-input" value={filter.monthTo} onChange={e => setFilter(f => ({ ...f, monthTo: e.target.value }))} style={{ width: '150px' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Trainer</label>
            <select className="form-input" value={filter.trainer} onChange={e => setFilter(f => ({ ...f, trainer: e.target.value }))} style={{ width: '180px' }}>
              <option value="">All Trainers</option>
              {allTrainers.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary" onClick={() => setFilter({ monthFrom: '', monthTo: '', teams: [], clusters: [], trainer: '' })} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <X size={14} /> Clear Filters
          </button>
          {hasActiveFilter && <span className="badge badge-primary" style={{ alignSelf: 'center' }}>Filters Active — {unified.length} records</span>}
        </div>
      )}

      {/* KPI Cards */}
      <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
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
                <KPIBox title="Defaulters (≥3 strikes)" value={gAP.defaulterCount} color="var(--danger)" icon={AlertTriangle} />
              </Fragment>
            )}
            {tab === 'MIP' && (
              <Fragment>
                <KPIBox title="Attendance" value={gMIP.count} icon={Zap} />
                <KPIBox title="Avg Science" value={gMIP.avgSci.toFixed(2)} color="var(--accent-primary)" badge={<span className={`badge ${flagClass(flagScore(gMIP.avgSci))}`}>Sci</span>} />
                <KPIBox title="Avg Skill" value={gMIP.avgSkl.toFixed(2)} color="var(--accent-secondary)" badge={<span className={`badge ${flagClass(flagScore(gMIP.avgSkl))}`}>Skl</span>} />
              </Fragment>
            )}
            {tab === 'Refresher' && (
              <Fragment>
                <KPIBox title="Attendance" value={gRef.count} icon={Zap} />
                <KPIBox title="Avg Knowledge" value={gRef.avgs['Knowledge']?.toFixed(2) ?? '—'} color="var(--accent-primary)" />
                <KPIBox title="Overall Avg" value={gRef.overallAvg.toFixed(2)} color="var(--warning)" badge={<span className={`badge ${flagClass(flagScore(gRef.overallAvg))}`}>{flagLabel(flagScore(gRef.overallAvg))}</span>} />
              </Fragment>
            )}
            {tab === 'Capsule' && (
              <Fragment>
                <KPIBox title="Attendance" value={gCap.count} icon={Zap} />
                <KPIBox title="Avg Score" value={gCap.avgScore.toFixed(2)} color="var(--accent-primary)" badge={<span className={`badge ${flagClass(flagScore(gCap.avgScore))}`}>{flagLabel(flagScore(gCap.avgScore))}</span>} />
              </Fragment>
            )}
            {tab === 'Pre_AP' && (
              <Fragment>
                <KPIBox title="Nominated" value={gPreAP.notified} icon={Zap} />
                <KPIBox title="Attended" value={gPreAP.attended} color="var(--success)" icon={CheckCircle2} />
                <KPIBox title="Conversion %" value={`${gPreAP.conversion.toFixed(1)}%`} color="var(--accent-primary)" />
              </Fragment>
            )}
          </Fragment>
        )}
      </div>

      {/* Top / Bottom 3 */}
      {subView === 'grouped' && ranked.length > 3 && (
        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '24px' }}>
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

      {/* GROUPED RANKINGS */}
      {subView === 'grouped' && (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
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
                      return <Fragment>
                        <td>{m.total}</td><td>{m.high}</td><td>{m.medium}</td><td>{m.low}</td>
                        <td style={{ fontWeight: 700, color: 'var(--warning)' }}>{m.weighted.toFixed(2)}</td>
                        <td><span className={`badge ${flagClass(flagScore(m.weighted))}`}>{flagLabel(flagScore(m.weighted))}</span></td>
                      </Fragment>;
                    })()}
                    {tab === 'AP' && (() => {
                      const m = calcAP(g.records, g.nominations);
                      return <Fragment>
                        <td>{m.notified}</td><td>{m.attended}</td><td>{m.conversion.toFixed(1)}%</td>
                        <td style={{ fontWeight: 700 }}>{m.composite.toFixed(2)}</td>
                        <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{m.defaulterCount}</td>
                        <td><span className={`badge ${flagClass(flagScore(m.composite))}`}>{flagLabel(flagScore(m.composite))}</span></td>
                      </Fragment>;
                    })()}
                    {tab === 'MIP' && (() => {
                      const m = calcMIP(g.records);
                      const avg = (m.avgSci + m.avgSkl) / 2;
                      return <Fragment>
                        <td>{m.count}</td><td>{m.avgSci.toFixed(2)}</td>
                        <td style={{ fontWeight: 700 }}>{m.avgSkl.toFixed(2)}</td>
                        <td><span className={`badge ${flagClass(flagScore(avg))}`}>{flagLabel(flagScore(avg))}</span></td>
                      </Fragment>;
                    })()}
                    {['Refresher', 'Capsule', 'Pre_AP', 'GTG', 'HO', 'RTM'].includes(tab) && (() => {
                      const m = calcGeneric(g.records);
                      return <Fragment>
                        <td>{m.count}</td>
                        <td style={{ fontWeight: 700 }}>{m.avgScore > 0 ? m.avgScore.toFixed(2) : '—'}</td>
                        <td><span className={`badge ${flagClass(flagScore(m.avgScore))}`}>{flagLabel(flagScore(m.avgScore))}</span></td>
                      </Fragment>;
                    })()}
                  </tr>
                  {isOpen && g.records.map((r, ri) => (
                    <tr key={ri} style={{ background: 'rgba(255,255,255,0.02)', fontSize: '12px' }}>
                      <td /><td />
                      <td colSpan={headers.length - 2} className="text-muted">
                        <strong>{r.employee.name}</strong> ({r.employee.employeeId}) · {r.attendance.attendanceDate} · {r.attendance.attendanceStatus}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </DataTable>
        </div>
      )}

      {/* TIME SERIES */}
      {subView === 'timeseries' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>Month-by-Month Trend — {tab}</h3>
          <TimeSeriesTable rows={timeSeries} months={months} mode={tsMode} onModeToggle={() => setTsMode(m => m === 'score' ? 'count' : 'score')} />
        </div>
      )}

      {/* TRAINER ANALYTICS */}
      {subView === 'trainer' && (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: 0 }}>Trainer Performance Analytics — {tab}</h3>
          </div>
          <TrainerTable stats={trainerStats} />
        </div>
      )}

      {/* DRILL-DOWN */}
      {subView === 'drilldown' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>Drill-Down: Cluster → Team → Employee</h3>
          <DrilldownPanel nodes={drilldownNodes} tab={tab} />
        </div>
      )}

      {/* GAP ANALYSIS */}
      {subView === 'gap' && (
        <div className="mt-8">
          <h3 className="mb-4">Gap Analysis: Eligible but Not Trained</h3>
          <DataTable headers={['Employee ID', 'Name', 'Team', 'State', 'Status', 'Reason']}>
            {eligibilityResults.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>No eligibility data. Configure rules in Demographics.</td></tr>
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
    </div>
  );
};
