import React, { useState, useMemo, useEffect, Fragment } from 'react';
import {
  Table, Calendar, GraduationCap, AlertTriangle, ChevronRight, ChevronDown,
  Trophy, Zap, ShieldCheck, CheckCircle2, ChartNetwork, Download, Filter, X, ListOrdered, BarChart3, TrendingUp, AlertCircle
} from 'lucide-react';
import { Employee } from '../../types/employee';
import { Attendance, TrainingScore, TrainingNomination, Demographics, TrainingType, EligibilityRule } from '../../types/attendance';
import { ViewByOption, GroupedData, ReportFilter } from '../../types/reports';
import {
  buildUnifiedDataset, groupData, rankGroups,
  calcIP, calcAP, calcMIP, calcRefresher, calcCapsule, calcPreAP, calcGeneric,
  buildTimeSeries, calcTrainerStats, buildDrilldown,
  getGapData, getPrimaryMetric, applyFilters, exportToCSV
} from '../../services/reportService';
import { buildIPAggregates, FISCAL_YEARS, getFiscalMonths, getCurrentFY, buildIPMonthlyTeamRanks } from '../../services/ipIntelligenceService';
import { buildEmployeeTimelines, buildAPMonthlyMatrix, filterTimelines } from '../../services/apIntelligenceService';
import { getAPPerformanceAggregates } from '../../services/apPerformanceService';
import { buildMIPAttendanceMatrix } from '../../services/mipAttendanceService';
import { getMIPPerformanceAggregates } from '../../services/mipPerformanceService';
import { buildRefresherAttendanceMatrix } from '../../services/refresherAttendanceService';
import { getRefresherPerformanceAggregates } from '../../services/refresherPerformanceService';
import { buildCapsuleAttendanceMatrix } from '../../services/capsuleAttendanceService';
import { getCapsulePerformanceAggregates } from '../../services/capsulePerformanceService';
import { getEligibleEmployees, EligibilityResult } from '../../services/eligibilityService';

import { getCollection } from '../../services/firestoreService';
import { KPIBox } from '../../components/KPIBox';
import { DataTable } from '../../components/DataTable';
import { TimeSeriesTable } from '../../components/TimeSeriesTable';
import { TrainerTable } from '../../components/TrainerTable';
import { DrilldownPanel } from '../../components/DrilldownPanel';
import { APPerformanceMatrix } from '../../components/APPerformanceMatrix';
import { MIPAttendanceMatrix, MIPPerformanceMatrix } from '../../components/MIPDualMatrix';
import { RefresherAttendanceMatrix, RefresherPerformanceMatrix } from '../../components/RefresherDualMatrix';
import { CapsuleAttendanceMatrix, CapsulePerformanceMatrix } from '../../components/CapsuleDualMatrix';
import { flagScore, flagClass, flagLabel } from '../../utils/scoreNormalizer';
import { normalizeText } from '../../utils/textNormalizer';

const ALL_TRAINING_TYPES = ['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'Pre_AP'];

const FY_OPTIONS = Array.from({ length: 21 }, (_, i) => {
  const start = 2020 + i;
  return `${start}-${(start + 1).toString().slice(2)}`;
});

interface ReportsAnalyticsProps {
  employees: Employee[];
  attendance: Attendance[];
  scores: TrainingScore[];
  nominations: TrainingNomination[];
  demographics: Demographics[];
}

type SubView = 'grouped' | 'timeseries' | 'trainer' | 'drilldown' | 'gap' | 'ip_matrix' | 'ip_cluster_rank' | 'ip_team_rank' | 'ap_performance' | 'mip_attendance' | 'mip_performance' | 'refresher_attendance' | 'refresher_performance' | 'capsule_attendance' | 'capsule_performance';

export const ReportsAnalytics: React.FC<ReportsAnalyticsProps> = ({
  employees, attendance, scores, nominations, demographics
}) => {
  const [tab, setTab] = useState<string>('IP');
  const [viewBy, setViewBy] = useState<ViewByOption>('Team');
  const [subView, setSubView] = useState<SubView>('ip_matrix');
  const [expanded, setExpanded] = useState(new Set<string>());
  const [rules, setRules] = useState<EligibilityRule[]>([]);
  const [clusterMapping, setClusterMapping] = useState<Record<string, string>>({});
  const [selectedFYs, setSelectedFYs] = useState<Record<string, string>>(() => {
    const maxMonths: Record<string, string> = {};

    const updateMax = (typeFallback: string, dateStr: string) => {
      const type = (typeFallback || '').toUpperCase();
      const m = (dateStr || '').substring(0, 7);
      if (m && (!maxMonths[type] || m > maxMonths[type])) {
        maxMonths[type] = m;
      }
    };

    nominations.forEach(n => updateMax(n.trainingType, n.notificationDate || ''));
    attendance.forEach(a => updateMax(a.trainingType, a.month || a.attendanceDate || ''));

    const getFYForType = (typeKey: string) => {
      const maxMonth = maxMonths[typeKey.toUpperCase()];
      if (!maxMonth) return getCurrentFY();
      const [yearStr, monthStr] = maxMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      if (!isNaN(year) && !isNaN(month)) {
        const startYear = month >= 4 ? year : year - 1;
        return `${startYear}-${(startYear + 1).toString().slice(2)}`;
      }
      return getCurrentFY();
    };

    return {
      IP: getFYForType('IP'),
      AP: getFYForType('AP'),
      MIP: getFYForType('MIP'),
      Refresher: getFYForType('Refresher'),
      Capsule: getFYForType('Capsule'),
      Pre_AP: getFYForType('Pre_AP')
    };
  });
  const [showFilters, setShowFilters] = useState(false);
  const [tsMode, setTsMode] = useState<'score' | 'count'>('score');

  // Filter state
  const [filter, setFilter] = useState<ReportFilter>({
    monthFrom: '', monthTo: '', teams: [], clusters: [], trainer: ''
  });

  useEffect(() => {
    getCollection('eligibility_rules').then(data => setRules(data as EligibilityRule[]));
    getCollection('team_cluster_mapping').then(data => {
      const map: Record<string, string> = {};
      (data as any[]).forEach(d => {
        if (d.team && d.cluster) {
          map[normalizeText(d.team)] = normalizeText(d.cluster);
        }
      });
      setClusterMapping(map);
    });
  }, []);

  // --- BUCKET HELPERS ---
  const formatCell = (data: any) => {
    if (!data || data.total === 0) return '-';
    return `${data.high}/${data.medium}/${data.low}`;
  };

  const getPercent = (part: number, total: number) => {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  };

  const formatMonthLabel = (month: string) => {
    const m = month.split('-')[1];
    const MONTH_LABELS: Record<string, string> = {
      '04': 'Apr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug', '09': 'Sep',
      '10': 'Oct', '11': 'Nov', '12': 'Dec', '01': 'Jan', '02': 'Feb', '03': 'Mar'
    };
    return MONTH_LABELS[m] || month;
  };

  const selectedFY = selectedFYs[tab];
  const MONTHS = useMemo(() => getFiscalMonths(selectedFY), [selectedFY]);

  // Force default view on tab change
  useEffect(() => {
    if (tab === 'IP') {
      if (!['ip_matrix', 'gap', 'timeseries', 'trainer', 'ip_team_rank'].includes(subView)) {
        setSubView('ip_matrix');
      }
    } else if (tab === 'AP') {
      if (!['ap_performance', 'grouped', 'gap', 'timeseries', 'trainer', 'drilldown'].includes(subView)) {
        setSubView('ap_performance');
      }
    } else if (tab === 'MIP') {
      if (!['mip_attendance', 'mip_performance', 'timeseries', 'trainer', 'drilldown', 'gap'].includes(subView)) {
        setSubView('mip_performance');
      }
    } else if (tab === 'Refresher') {
      if (!['refresher_attendance', 'refresher_performance', 'timeseries', 'trainer', 'drilldown', 'gap'].includes(subView)) {
        setSubView('refresher_attendance');
      }
    } else if (tab === 'Capsule') {
      if (!['capsule_attendance', 'capsule_performance', 'timeseries', 'trainer', 'drilldown', 'gap'].includes(subView)) {
        setSubView('capsule_attendance');
      }
    } else {
      if (['ip_matrix', 'ap_performance', 'mip_attendance', 'mip_performance', 'refresher_attendance', 'refresher_performance', 'capsule_attendance', 'capsule_performance'].includes(subView)) {
        setSubView('grouped');
      }
    }
  }, [tab, subView]);

  // Dynamic options for filter dropdowns
  const allTeams = useMemo(() => [...new Set(employees.map(e => e.team).filter(Boolean))].sort(), [employees]);
  const allClusters = useMemo(() => [...new Set(employees.map(e => clusterMapping[e.team] || e.state).filter(Boolean))].sort(), [employees, clusterMapping]);
  const allTrainers = useMemo(() => [...new Set(attendance.map(a => a.trainerId).filter(Boolean))].sort(), [attendance]);

  const normalizeType = (value?: string) => (value || '').toUpperCase();

  // Build filtered base dataset for current tab
  const rawUnified = useMemo(() => {
    const att = attendance.filter(a => normalizeType(a.trainingType) === tab);
    const scs = scores.filter(s => normalizeType(s.trainingType) === tab);
    const noms = nominations.filter(n => normalizeType(n.trainingType) === tab);
    const rule = rules.find(r => normalizeType(r.trainingType) === tab);
    const eligResults = getEligibleEmployees(tab as TrainingType, rule, employees, attendance, nominations);
    return buildUnifiedDataset(employees, att, scs, noms, eligResults).map(r => {
      if (r.employee) {
        r.employee = { ...r.employee, state: clusterMapping[r.employee.team] || r.employee.state };
      }
      return r;
    });
  }, [tab, attendance, scores, nominations, employees, rules, clusterMapping]);

  const unified = useMemo(() => {
    let ds = applyFilters(rawUnified, filter);
    // Apply Fiscal Year filter (MONTHS) to unified dataset for relevant training types
    if (['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'Pre_AP'].includes(tab)) {
      ds = ds.filter(r => {
        const m = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7);
        return MONTHS.includes(m);
      });
    }
    return ds;
  }, [rawUnified, filter, tab, MONTHS]);

  // -- IP Engine --
  const ipData = useMemo(() => {
    // Filter records to only include those within the selected Fiscal Year months
    const filteredRecords = unified.filter(r => {
      const m = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7);
      return MONTHS.includes(m);
    });
    return buildIPAggregates(filteredRecords);
  }, [unified, MONTHS]);

  const ipRankData = useMemo(() => {
    // Pass MONTHS directly — engine applies FY filter internally
    return buildIPMonthlyTeamRanks(unified, MONTHS);
  }, [unified, MONTHS]);

  // -- Universal Event Timelines (AP, MIP, Refresher, Capsule) --
  const rawTimelines = useMemo(() => {
    if (tab === 'AP' || tab === 'MIP' || tab === 'Refresher' || tab === 'Capsule') {
      return buildEmployeeTimelines(
        attendance.filter(a => a.trainingType === tab),
        nominations.filter(n => n.trainingType === tab),
        tab,
        scores.filter(s => s.trainingType === tab)
      );
    }
    return new Map();
  }, [attendance, nominations, scores, tab]);

  const filteredTimelines = useMemo(() => {
    if (tab !== 'AP' && tab !== 'MIP' && tab !== 'Refresher' && tab !== 'Capsule') return new Map();
    return filterTimelines(rawTimelines, { trainer: filter.trainer, validMonths: MONTHS });
  }, [rawTimelines, tab, filter.trainer, MONTHS]);

  // -- AP Engine --
  const apData = useMemo(() => {
    if (tab !== 'AP') return null;
    return buildAPMonthlyMatrix(filteredTimelines, MONTHS);
  }, [tab, filteredTimelines, MONTHS]);

  const apPerfData = useMemo(() => {
    if (tab !== 'AP') return null;
    return getAPPerformanceAggregates(filteredTimelines, MONTHS);
  }, [tab, filteredTimelines, MONTHS]);


  // -- MIP Engine --
  const mipAttendanceData = useMemo(() => {
    if (tab !== 'MIP') return null;
    return buildMIPAttendanceMatrix(filteredTimelines, MONTHS);
  }, [tab, filteredTimelines, MONTHS]);

  const mipPerfData = useMemo(() => {
    if (tab !== 'MIP') return null;
    return getMIPPerformanceAggregates(filteredTimelines, MONTHS);
  }, [tab, filteredTimelines, MONTHS]);

  // -- Refresher Engine --
  const refresherAttData = useMemo(() => {
    if (tab !== 'Refresher') return null;
    return buildRefresherAttendanceMatrix(filteredTimelines, MONTHS);
  }, [tab, filteredTimelines, MONTHS]);

  const refresherPerfData = useMemo(() => {
    if (tab !== 'Refresher') return null;
    return getRefresherPerformanceAggregates(filteredTimelines, MONTHS);
  }, [tab, filteredTimelines, MONTHS]);

  // -- Capsule Engine --
  const capsuleAttData = useMemo(() => {
    if (tab !== 'Capsule') return null;
    return buildCapsuleAttendanceMatrix(filteredTimelines, MONTHS);
  }, [tab, filteredTimelines, MONTHS]);

  const capsulePerfData = useMemo(() => {
    if (tab !== 'Capsule') return null;
    return getCapsulePerformanceAggregates(filteredTimelines, MONTHS);
  }, [tab, filteredTimelines, MONTHS]);

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

  // KPI computations (Legacy)
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

  const genericHeaders = [
    '#', '', viewBy,
    ...(tab === 'AP' ? ['Notified', 'Attended', 'Att%', 'Composite', 'Defaulters', 'Flag'] : []),
    ...(tab === 'MIP' ? ['Count', 'Avg Sci', 'Avg Skl', 'Flag'] : []),
    ...(tab === 'IP' ? ['Count', 'Avg T Score / %', 'Flag'] : []),
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
          {tab === 'IP' ? (
            <Fragment>
              <button className={`btn ${subView === 'ip_matrix' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('ip_matrix')} title="Matrix View"><Table size={16} /></button>
              <button className={`btn ${subView === 'ip_team_rank' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('ip_team_rank')} title="Team Rank Matrix"><Trophy size={16} /></button>
              <button className={`btn ${subView === 'timeseries' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('timeseries')} title="Time Series"><Calendar size={16} /></button>

              <button className={`btn ${subView === 'trainer' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('trainer')} title="Trainer Analytics"><GraduationCap size={16} /></button>
            </Fragment>
          ) : tab === 'MIP' ? (
            <Fragment>
              <button className={`btn ${subView === 'mip_attendance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('mip_attendance')} title="Attendance Funnel"><Table size={16} /></button>
              <button className={`btn ${subView === 'mip_performance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('mip_performance')} title="Performance Analytics"><TrendingUp size={16} /></button>
            </Fragment>
          ) : tab === 'Refresher' ? (
            <Fragment>
              <button className={`btn ${subView === 'refresher_attendance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('refresher_attendance')} title="Attendance Matrix"><Table size={16} /></button>
              <button className={`btn ${subView === 'refresher_performance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('refresher_performance')} title="Performance Analytics"><TrendingUp size={16} /></button>
            </Fragment>
          ) : tab === 'Capsule' ? (
            <Fragment>
              <button className={`btn ${subView === 'capsule_attendance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('capsule_attendance')} title="Attendance Matrix"><Table size={16} /></button>
              <button className={`btn ${subView === 'capsule_performance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('capsule_performance')} title="Performance Analytics"><TrendingUp size={16} /></button>
            </Fragment>
          ) : (
            <Fragment>
              <button className={`btn ${subView === 'grouped' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('grouped')} title={tab === 'AP' ? "Attendance Funnel" : "Rankings"}><Table size={16} /></button>
              {tab === 'AP' && (
                <button className={`btn ${subView === 'ap_performance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('ap_performance')} title="Performance Analytics"><TrendingUp size={16} /></button>
              )}
              <button className={`btn ${subView === 'timeseries' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('timeseries')} title="Time Series"><Calendar size={16} /></button>
              {tab !== 'AP' && (
                <button className={`btn ${subView === 'trainer' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('trainer')} title="Trainer Analytics"><GraduationCap size={16} /></button>
              )}
              <button className={`btn ${subView === 'drilldown' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('drilldown')} title="Drill-Down"><ChartNetwork size={16} /></button>
            </Fragment>
          )}
          <button className={`btn ${subView === 'gap' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('gap')} title="Gap Analysis" style={{ color: subView === 'gap' ? '#fff' : 'var(--danger)' }}><AlertTriangle size={16} /></button>
          <div style={{ width: '1px', height: '28px', background: 'var(--border-color)', margin: '0 4px' }} />
          
          {(['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'Pre_AP'].includes(tab)) && (
            <div className="fy-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>FISCAL YEAR</label>
              <select 
                className="form-select glass-panel" 
                value={selectedFYs[tab]} 
                onChange={(e) =>
                  setSelectedFYs(prev => ({
                    ...prev,
                    [tab]: e.target.value
                  }))
                }
                style={{ padding: '6px 12px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'transparent' }}
              >
                {FY_OPTIONS.map(fy => (
                  <option key={fy} value={fy}>{fy}</option>
                ))}
              </select>
            </div>
          )}

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
        {(['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'Pre_AP'].every(t => tab !== t)) && (
          <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: '8px', padding: '3px' }}>
            {(['Team', 'Cluster', 'Month'] as ViewByOption[]).map(v => (
              <button key={v} onClick={() => setViewBy(v)} style={{ padding: '5px 14px', borderRadius: '6px', background: viewBy === v ? 'var(--accent-primary)' : 'transparent', color: viewBy === v ? '#fff' : 'var(--text-secondary)', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>{v}</button>
            ))}
          </div>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {(['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'Pre_AP'].every(t => tab !== t)) && (
            <Fragment>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>From Month</label>
                <input type="month" className="form-input" value={filter.monthFrom} onChange={e => setFilter(f => ({ ...f, monthFrom: e.target.value }))} style={{ width: '150px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>To Month</label>
                <input type="month" className="form-input" value={filter.monthTo} onChange={e => setFilter(f => ({ ...f, monthTo: e.target.value }))} style={{ width: '150px' }} />
              </div>
            </Fragment>
          )}
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
          {(['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'Pre_AP'].every(t => tab !== t)) && hasActiveFilter && <span className="badge badge-primary" style={{ alignSelf: 'center', marginLeft: 'auto' }}>Filters Active — {unified.length} records</span>}
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
                <KPIBox title="Total Candidates" value={ipData.globalKPIs.totalCandidates} icon={Zap} />
                <KPIBox title="High %" value={`${ipData.globalKPIs.highPct.toFixed(1)}%`} color="var(--success)" />
                <KPIBox title="Medium %" value={`${ipData.globalKPIs.medPct.toFixed(1)}%`} color="var(--warning)" />
                <KPIBox title="Low %" value={`${ipData.globalKPIs.lowPct.toFixed(1)}%`} color="var(--danger)" />
                <KPIBox title="Weighted T Score / %" value={ipData.globalKPIs.weightedScore.toFixed(2)} color="var(--accent-primary)" badge={<span className={`badge ${flagClass(flagScore(ipData.globalKPIs.weightedScore))}`}>{flagLabel(flagScore(ipData.globalKPIs.weightedScore))}</span>} />
                <KPIBox title="Best Team" value={ipData.globalKPIs.bestTeam} icon={Trophy} color="var(--success)" />
                <KPIBox title="Worst Team" value={ipData.globalKPIs.worstTeam} icon={AlertTriangle} color="var(--danger)" />
              </Fragment>
            )}
            {tab === 'AP' && subView === 'grouped' && apData && (
              <Fragment>
                <KPIBox title="Total Notified (FY)" value={apData.globalKPIs.totalEmployeesNotified} icon={Zap} />
                <KPIBox title="Total Attended (FY)" value={apData.globalKPIs.totalEmployeesAttended} color="var(--success)" icon={CheckCircle2} />
                <KPIBox title="Attendance %" value={`${apData.globalKPIs.attendancePercent.toFixed(1)}%`} color="var(--accent-primary)" />
                <KPIBox title="Composite Score" value={apData.globalKPIs.compositeScore.toFixed(2)} color="var(--success)" badge={apData.globalKPIs.compositeScore > 0 ? <span className={`badge ${flagClass(flagScore(apData.globalKPIs.compositeScore))}`}>{flagLabel(flagScore(apData.globalKPIs.compositeScore))}</span> : undefined} />
                <KPIBox title="Defaulters (≥3 strikes)" value={apData.globalKPIs.defaulters} color="var(--danger)" icon={AlertTriangle} />
              </Fragment>
            )}
            {tab === 'AP' && subView === 'ap_performance' && apPerfData && (
              <Fragment>
                <KPIBox title="Total Attended" value={apPerfData.globalKPIs.totalAttended} icon={Zap} />
                <KPIBox title="Total Candidates" value={apPerfData.globalKPIs.uniqueCandidates} color="var(--accent-primary)" />
                <KPIBox title="Avg Knowledge" value={apPerfData.globalKPIs.avgKnowledge.toFixed(1)} color="var(--success)" badge={apPerfData.globalKPIs.avgKnowledge > 0 ? <span className={`badge ${flagClass(flagScore(apPerfData.globalKPIs.avgKnowledge))}`}>K</span> : undefined} />
                <KPIBox title="Avg BSE" value={apPerfData.globalKPIs.avgBSE.toFixed(1)} color="var(--warning)" badge={apPerfData.globalKPIs.avgBSE > 0 ? <span className={`badge ${flagClass(flagScore(apPerfData.globalKPIs.avgBSE))}`}>B</span> : undefined} />
                <KPIBox title="Weakest Parameter" value={apPerfData.globalKPIs.lowestParameter} color="var(--danger)" icon={AlertCircle} />
              </Fragment>
            )}
            {tab === 'MIP' && subView === 'mip_attendance' && mipAttendanceData && (
              <Fragment>
                <KPIBox title="Total Notified (FY)" value={mipAttendanceData.globalKPIs.totalNotified} icon={Zap} />
                <KPIBox title="Total Attended (FY)" value={mipAttendanceData.globalKPIs.totalAttended} color="var(--success)" icon={CheckCircle2} />
                <KPIBox title="Attendance %" value={`${mipAttendanceData.globalKPIs.attendancePercent.toFixed(1)}%`} color="var(--accent-primary)" />
              </Fragment>
            )}
            {tab === 'MIP' && subView === 'mip_performance' && mipPerfData && (
              <Fragment>
                <KPIBox title="Total Attended" value={mipPerfData.globalKPIs.totalAttended} icon={Zap} />
                <KPIBox title="Avg Science" value={mipPerfData.globalKPIs.avgScience.toFixed(1)} color="var(--success)" badge={mipPerfData.globalKPIs.avgScience > 0 ? <span className={`badge ${flagClass(flagScore(mipPerfData.globalKPIs.avgScience))}`}>Sci</span> : undefined} />
                <KPIBox title="Avg Skill" value={mipPerfData.globalKPIs.avgSkill.toFixed(1)} color="var(--warning)" badge={mipPerfData.globalKPIs.avgSkill > 0 ? <span className={`badge ${flagClass(flagScore(mipPerfData.globalKPIs.avgSkill))}`}>Skl</span> : undefined} />
                <KPIBox title="High Performers" value={`${mipPerfData.globalKPIs.highPerformersPct.toFixed(1)}%`} color="var(--accent-primary)" icon={Trophy} />
              </Fragment>
            )}
            {tab === 'Refresher' && subView === 'refresher_attendance' && refresherAttData && (
              <Fragment>
                <KPIBox title="Total Notified (FY)" value={refresherAttData.globalKPIs.totalNotified} icon={Zap} />
                <KPIBox title="Total Attended (FY)" value={refresherAttData.globalKPIs.totalAttended} color="var(--success)" icon={CheckCircle2} />
                <KPIBox title="Attendance %" value={`${refresherAttData.globalKPIs.attendancePercent.toFixed(1)}%`} color="var(--accent-primary)" />
              </Fragment>
            )}
            {tab === 'Refresher' && subView === 'refresher_performance' && refresherPerfData && (
              <Fragment>
                <KPIBox title="Total Attended" value={refresherPerfData.globalKPIs.totalAttended} icon={Zap} />
                <KPIBox title="Avg Science" value={refresherPerfData.globalKPIs.avgScience.toFixed(1)} color="var(--success)" badge={refresherPerfData.globalKPIs.avgScience > 0 ? <span className={`badge ${flagClass(flagScore(refresherPerfData.globalKPIs.avgScience))}`}>Sci</span> : undefined} />
                <KPIBox title="Avg Skill" value={refresherPerfData.globalKPIs.avgSkill.toFixed(1)} color="var(--warning)" badge={refresherPerfData.globalKPIs.avgSkill > 0 ? <span className={`badge ${flagClass(flagScore(refresherPerfData.globalKPIs.avgSkill))}`}>Skl</span> : undefined} />
                <KPIBox title="High Performers" value={`${refresherPerfData.globalKPIs.highPerformersPct.toFixed(1)}%`} color="var(--accent-primary)" icon={Trophy} />
              </Fragment>
            )}
            {tab === 'Capsule' && subView === 'capsule_attendance' && capsuleAttData && (
              <Fragment>
                <KPIBox title="Total Notified (FY)" value={capsuleAttData.globalKPIs.totalNotified} icon={Zap} />
                <KPIBox title="Total Attended (FY)" value={capsuleAttData.globalKPIs.totalAttended} color="var(--success)" icon={CheckCircle2} />
                <KPIBox title="Attendance %" value={`${capsuleAttData.globalKPIs.attendancePercent.toFixed(1)}%`} color="var(--accent-primary)" />
              </Fragment>
            )}
            {tab === 'Capsule' && subView === 'capsule_performance' && capsulePerfData && (
              <Fragment>
                <KPIBox title="Total Attended" value={capsulePerfData.globalKPIs.totalAttended} icon={Zap} />
                <KPIBox title="Avg Score" value={capsulePerfData.globalKPIs.avgScore.toFixed(1)} color="var(--success)" badge={capsulePerfData.globalKPIs.avgScore > 0 ? <span className={`badge ${flagClass(flagScore(capsulePerfData.globalKPIs.avgScore))}`}>Score</span> : undefined} />
                <KPIBox title="High Performers" value={`${capsulePerfData.globalKPIs.highPerformersPct.toFixed(1)}%`} color="var(--accent-primary)" icon={Trophy} />
              </Fragment>
            )}
            {tab === 'Pre_AP' && (
              <Fragment>
                <KPIBox title="Nominated" value={gPreAP.notified} icon={Zap} />
                <KPIBox title="Attended" value={gPreAP.attended} color="var(--success)" icon={CheckCircle2} />
                <KPIBox title="Attendance %" value={`${gPreAP.attendance.toFixed(1)}%`} color="var(--accent-primary)" />
              </Fragment>
            )}
          </Fragment>
        )}
      </div>

      {/* Top / Bottom 3 */}
      {subView === 'grouped' && tab !== 'IP' && tab !== 'AP' && ranked.length > 3 && (
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

      {/* --- IP SPECIFIC VIEWS --- */}
      {subView === 'ip_matrix' && (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Cluster → Team → Month Matrix Engine</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>Cluster / Team</th>
                  <th style={{ textAlign: 'center' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>High %</th>
                  <th style={{ textAlign: 'center' }}>Med %</th>
                  <th style={{ textAlign: 'center' }}>Low %</th>
                  {MONTHS.map(mo => <th key={mo} style={{ textAlign: 'center', minWidth: '60px' }}>{formatMonthLabel(mo)}</th>)}
                </tr>
              </thead>
              <tbody>
                {Object.keys(ipData.clusterMonthMap).map(clusterName => {
                  const clusterData = ipData.clusterMonthMap[clusterName];
                  const isOpen = expanded.has(clusterName);
                  const hPct = getPercent(clusterData.high, clusterData.total);
                  const mPct = getPercent(clusterData.medium, clusterData.total);
                  const lPct = getPercent(clusterData.low, clusterData.total);

                  const getRowStyle = (hp: number, lp: number) => {
                    if (hp > 70) return { background: 'rgba(16, 185, 129, 0.1)' };
                    if (lp > 30) return { background: 'rgba(239, 68, 68, 0.1)' };
                    return {};
                  };

                  return (
                    <Fragment key={clusterName}>
                      <tr onClick={() => toggleExpand(clusterName)} style={{ cursor: 'pointer', ...getRowStyle(hPct, lPct) }}>
                        <td>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                        <td style={{ fontWeight: 700 }}>{clusterName}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{clusterData.total}</td>
                        <td style={{ textAlign: 'center' }} className={hPct > 70 ? 'text-success' : ''}>{hPct}%</td>
                        <td style={{ textAlign: 'center' }} className={mPct > 50 ? 'text-warning' : ''}>{mPct}%</td>
                        <td style={{ textAlign: 'center' }} className={lPct > 30 ? 'text-danger' : ''}>{lPct}%</td>
                        {MONTHS.map(mo => {
                          const cell = clusterData.months[mo];
                          const txt = formatCell(cell);
                          let cellStyle = { textAlign: 'center', fontWeight: 600 } as any;
                          if (cell && cell.total > 0) {
                            if (cell.low > cell.high) cellStyle.color = 'var(--danger)';
                            else if (cell.high > cell.low) cellStyle.color = 'var(--success)';
                          }
                          return <td key={mo} style={cellStyle}>{txt}</td>;
                        })}
                      </tr>

                      {isOpen && Object.keys(ipData.teamMonthMap[clusterName] || {}).map(teamName => {
                        const teamData = ipData.teamMonthMap[clusterName][teamName];
                        const thPct = getPercent(teamData.high, teamData.total);
                        const tmPct = getPercent(teamData.medium, teamData.total);
                        const tlPct = getPercent(teamData.low, teamData.total);

                        return (
                          <tr key={teamName} style={{ ...getRowStyle(thPct, tlPct), fontSize: '13px' }}>
                            <td></td>
                            <td style={{ paddingLeft: '24px' }}>↳ {teamName}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{teamData.total}</td>
                            <td style={{ textAlign: 'center' }} className={thPct > 70 ? 'text-success' : ''}>{thPct}%</td>
                            <td style={{ textAlign: 'center' }} className={tmPct > 50 ? 'text-warning' : ''}>{tmPct}%</td>
                            <td style={{ textAlign: 'center' }} className={tlPct > 30 ? 'text-danger' : ''}>{tlPct}%</td>
                            {MONTHS.map(mo => {
                              const cell = teamData.months[mo];
                              const txt = formatCell(cell);
                              let cellStyle = { textAlign: 'center' } as any;
                              if (cell && cell.total > 0) {
                                if (cell.low > cell.high) cellStyle.color = 'var(--danger)';
                                else if (cell.high > cell.low) cellStyle.color = 'var(--success)';
                              }
                              return <td key={mo} style={cellStyle}>{txt}</td>;
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
        </div>
      )}

      {/* --- AP EVENT FUNNEL MATRIX --- */}
      {subView === 'grouped' && tab === 'AP' && apData && (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>AP Notified vs Attended Matrix</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', minWidth: '1000px' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th style={{ minWidth: '160px' }}>Cluster / Team</th>
                  <th style={{ textAlign: 'center' }}>Total Notified</th>
                  <th style={{ textAlign: 'center' }}>Total Attended</th>
                  {MONTHS.map(mo => <th key={mo} style={{ textAlign: 'center', minWidth: '90px' }}>{formatMonthLabel(mo)}</th>)}
                </tr>
              </thead>
              <tbody>
                {Object.keys(apData.clusterMonthMap).sort().map(clusterName => {
                  const clusterData = apData.clusterMonthMap[clusterName];
                  const isOpen = expanded.has(clusterName);

                  return (
                    <Fragment key={clusterName}>
                      <tr onClick={() => toggleExpand(clusterName)} style={{ cursor: 'pointer', background: 'rgba(99,102,241,0.04)' }}>
                        <td>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                        <td style={{ fontWeight: 700 }}>{clusterName}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{clusterData.totalNotified}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--success)' }}>{clusterData.totalAttended}</td>
                        {MONTHS.map(mo => {
                          const cell = clusterData.months[mo];
                          if (!cell || (!cell.notified && !cell.attended)) return <td key={mo} style={{ textAlign: 'center', opacity: 0.3 }}>—</td>;
                          const pct = cell.notified > 0 ? Math.round((cell.attended / cell.notified) * 100) : 0;
                          const isWarning = cell.attended > cell.notified;
                          const isPerfect = pct === 100 && cell.notified > 0;
                          
                          return (
                            <td key={mo} style={{ textAlign: 'center', background: isWarning ? 'rgba(239, 68, 68, 0.1)' : isPerfect ? 'rgba(16, 185, 129, 0.1)' : 'transparent' }}>
                              <div style={{ fontWeight: 600, color: isWarning ? 'var(--danger)' : 'inherit' }}>{cell.attended} / {cell.notified}</div>
                              {cell.notified > 0 && <div style={{ fontSize: '10px', opacity: 0.7 }}>({pct}%)</div>}
                            </td>
                          );
                        })}
                      </tr>

                      {isOpen && Object.keys(apData.teamMonthMap[clusterName] || {}).sort().map(teamName => {
                        const teamData = apData.teamMonthMap[clusterName][teamName];
                        return (
                          <tr key={teamName} style={{ fontSize: '13px' }}>
                            <td></td>
                            <td style={{ paddingLeft: '24px' }}>↳ {teamName}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{teamData.totalNotified}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--success)' }}>{teamData.totalAttended}</td>
                            {MONTHS.map(mo => {
                              const cell = teamData.months[mo];
                              if (!cell || (!cell.notified && !cell.attended)) return <td key={mo} style={{ textAlign: 'center', opacity: 0.3 }}>—</td>;
                              const pct = cell.notified > 0 ? Math.round((cell.attended / cell.notified) * 100) : 0;
                              const isWarning = cell.attended > cell.notified;
                              const isPerfect = pct === 100 && cell.notified > 0;
                              
                              return (
                                <td key={mo} style={{ textAlign: 'center', background: isWarning ? 'rgba(239, 68, 68, 0.1)' : isPerfect ? 'rgba(16, 185, 129, 0.1)' : 'transparent' }}>
                                  <div style={{ fontWeight: 600, color: isWarning ? 'var(--danger)' : 'inherit' }}>{cell.attended} / {cell.notified}</div>
                                  {cell.notified > 0 && <div style={{ fontSize: '10px', opacity: 0.7 }}>({pct}%)</div>}
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
        </div>
      )}

      {/* --- AP PERFORMANCE MATRIX --- */}
      {subView === 'ap_performance' && tab === 'AP' && apPerfData && (
        <APPerformanceMatrix 
          data={apPerfData} 
          fyMonths={MONTHS} 
          timelines={filteredTimelines} 
        />
      )}

      {/* --- MIP MATRICES --- */}
      {subView === 'mip_attendance' && tab === 'MIP' && mipAttendanceData && (
        <MIPAttendanceMatrix data={mipAttendanceData} fyMonths={MONTHS} timelines={filteredTimelines} />
      )}
      {subView === 'mip_performance' && tab === 'MIP' && mipPerfData && (
        <MIPPerformanceMatrix data={mipPerfData} fyMonths={MONTHS} timelines={filteredTimelines} />
      )}

      {/* --- REFRESHER MATRICES --- */}
      {subView === 'refresher_attendance' && tab === 'Refresher' && refresherAttData && (
        <RefresherAttendanceMatrix data={refresherAttData} fyMonths={MONTHS} timelines={filteredTimelines} />
      )}
      {subView === 'refresher_performance' && tab === 'Refresher' && refresherPerfData && (
        <RefresherPerformanceMatrix data={refresherPerfData} fyMonths={MONTHS} timelines={filteredTimelines} />
      )}

      {/* --- CAPSULE MATRICES --- */}
      {subView === 'capsule_attendance' && tab === 'Capsule' && capsuleAttData && (
        <CapsuleAttendanceMatrix data={capsuleAttData} fyMonths={MONTHS} timelines={filteredTimelines} />
      )}
      {subView === 'capsule_performance' && tab === 'Capsule' && capsulePerfData && (
        <CapsulePerformanceMatrix data={capsulePerfData} fyMonths={MONTHS} timelines={filteredTimelines} />
      )}

      {/* GROUPED RANKINGS FOR OTHER TABS */}
      {subView === 'grouped' && tab !== 'IP' && tab !== 'AP' && tab !== 'MIP' && tab !== 'Refresher' && tab !== 'Capsule' && (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <DataTable headers={genericHeaders}>
            {ranked.map(g => {
              const isOpen = expanded.has(g.key);
              return (
                <Fragment key={g.key}>
                  <tr onClick={() => toggleExpand(g.key)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{g.rank}</td>
                    <td>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                    <td style={{ fontWeight: 600 }}>{g.key}</td>
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
                      <td colSpan={genericHeaders.length - 2} className="text-muted">
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

      {/* --- IP TEAM RANK MATRIX --- */}
      {subView === 'ip_team_rank' && (() => {
        // ── Derive cluster→teams structure from ipRankData ──
        const clusterTeams: Record<string, string[]> = {};
        Object.entries(ipRankData.teams).forEach(([team, entry]) => {
          if (!clusterTeams[entry.cluster]) clusterTeams[entry.cluster] = [];
          clusterTeams[entry.cluster].push(team);
        });
        Object.values(clusterTeams).forEach(teams => teams.sort());

        // Re-usable cell renderer
        const renderRankCell = (monthData: any, useClusterRank: boolean, mo: string, maxRankInGroup: number) => {
          if (!monthData) return <td key={mo} style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)', padding: '10px 6px' }}>—</td>;

          const displayRank = useClusterRank ? monthData.clusterRank : monthData.rank;
          const isTop1 = displayRank === 1;
          const isTop3 = displayRank <= 3;
          const isBottom = displayRank === maxRankInGroup && maxRankInGroup > 3;

          const cellStyle: any = {
            textAlign: 'center',
            borderLeft: '1px solid rgba(255,255,255,0.05)',
            padding: '10px 6px',
            cursor: 'default',
            transition: 'background 0.15s',
            ...(isTop1 ? { background: 'rgba(16, 185, 129, 0.18)', color: 'var(--success)', fontWeight: 800 }
              : isTop3 ? { background: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)', fontWeight: 700 }
                : isBottom ? { background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', fontWeight: 600 }
                  : {})
          };

          return (
            <td key={mo} style={cellStyle}
              title={`Cluster Rank: ${monthData.clusterRank}\nOverall Rank: ${monthData.rank}\nScore: ${monthData.score}`}
            >
              <div style={{ fontSize: '14px' }}>#{displayRank}</div>
              <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '1px' }}>({monthData.score})</div>
            </td>
          );
        };

        return (
          <div className="glass-panel animate-fade-in" style={{ overflow: 'hidden', borderTop: '4px solid var(--accent-primary)' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>IP Team Rankings</h3>
                <p className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>Formula: (95·A + 82.5·B + 62.5·C − 25·D) / Total · Competition Ranking · FY {selectedFY}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="badge badge-info" style={{ fontWeight: 700 }}>FY {selectedFY}</span>
              </div>
            </div>

            {/* ── TABLE 1: CLUSTER-WISE DRILL-DOWN ── */}
            <div style={{ padding: '14px 20px 6px', borderBottom: '1px solid var(--border-color)', background: 'rgba(99,102,241,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <Trophy size={16} color="var(--accent-primary)" />
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--accent-primary)' }}>TABLE 1 — Cluster-wise Ranking</span>
                <span className="text-muted" style={{ fontSize: '11px' }}>Rank is within cluster only</span>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.1)' }}>
                    <th style={{ width: '28px', padding: '10px 8px' }}></th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', minWidth: '180px' }}>Cluster / Team</th>
                    {MONTHS.map(mo => (
                      <th key={mo} style={{ textAlign: 'center', minWidth: '90px', borderLeft: '1px solid rgba(255,255,255,0.05)', fontSize: '12px' }}>{formatMonthLabel(mo)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(clusterTeams).sort().map(cluster => {
                    const isOpen = expanded.has(`rank_${cluster}`);
                    const teams = clusterTeams[cluster];
                    return (
                      <Fragment key={cluster}>
                        {/* Cluster header row */}
                        <tr
                          onClick={() => toggleExpand(`rank_${cluster}`)}
                          style={{ cursor: 'pointer', background: 'rgba(99,102,241,0.06)', borderBottom: '1px solid var(--border-color)' }}
                        >
                          <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </td>
                          <td style={{ fontWeight: 700, padding: '10px 14px', letterSpacing: '0.3px' }}>{cluster}</td>
                          {MONTHS.map(mo => {
                            // Find best performing team in this cluster for this month
                            let bestScore = -Infinity;
                            let summary = '—';
                            teams.forEach(t => {
                              const d = ipRankData.teams[t]?.months[mo];
                              if (d && d.score > bestScore) {
                                bestScore = d.score;
                                summary = `Top: ${t} (${d.score})`;
                              }
                            });
                            return (
                              <td key={mo} style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)', fontSize: '9px', color: 'var(--text-secondary)', padding: '10px 4px', lineHeight: 1.2 }}>
                                {summary}
                              </td>
                            );
                          })}
                        </tr>
                        {/* Expanded: team rows with CLUSTER rank */}
                        {isOpen && teams.map(teamName => {
                          const entry = ipRankData.teams[teamName];
                          return (
                            <tr key={teamName} style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)', fontSize: '13px' }}>
                              <td></td>
                              <td style={{ paddingLeft: '28px', padding: '10px 14px 10px 28px', fontWeight: 500 }}>↳ {teamName}</td>
                              {MONTHS.map(mo => {
                                // Find max cluster rank for this month to detect "Bottom"
                                const maxClusterRank = Math.max(...teams.map(t => ipRankData.teams[t]?.months[mo]?.clusterRank || 0));
                                return renderRankCell(entry.months[mo], true, mo, maxClusterRank);
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

            {/* ── TABLE 2: OVERALL NATIONAL RANKING ── */}
            <div style={{ padding: '14px 20px 6px', borderTop: '2px solid var(--border-color)', background: 'rgba(16,185,129,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <BarChart3 size={16} color="var(--success)" />
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--success)' }}>TABLE 2 — Overall National Ranking</span>
                <span className="text-muted" style={{ fontSize: '11px' }}>Rank across all teams</span>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.1)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 20px', minWidth: '160px' }}>Team</th>
                    <th style={{ textAlign: 'left', minWidth: '120px' }}>Cluster</th>
                    {MONTHS.map(mo => (
                      <th key={mo} style={{ textAlign: 'center', minWidth: '90px', borderLeft: '1px solid rgba(255,255,255,0.05)', fontSize: '12px' }}>{formatMonthLabel(mo)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(ipRankData.teams).sort().map(teamName => {
                    const entry = ipRankData.teams[teamName];
                    const allTeamsCount = Object.keys(ipRankData.teams).length;
                    return (
                      <tr key={teamName} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 20px', fontWeight: 600 }}>{teamName}</td>
                        <td><span className="badge badge-secondary" style={{ fontSize: '11px' }}>{entry.cluster}</span></td>
                        {MONTHS.map(mo => {
                          // Find max overall rank for this month to detect "Bottom"
                          const maxOverallRank = Math.max(...Object.values(ipRankData.teams).map(t => t.months[mo]?.rank || 0));
                          return renderRankCell(entry.months[mo], false, mo, maxOverallRank);
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}


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
          <TrainerTable stats={trainerStats} tab={tab} />
        </div>
      )}

      {/* DRILL-DOWN */}
      {subView === 'drilldown' && tab !== 'IP' && tab !== 'MIP' && tab !== 'Refresher' && tab !== 'Capsule' && (
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
