import React, { useState, useMemo, useEffect, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Cell, PieChart, Pie, ScatterChart, Scatter, ZAxis, ComposedChart
} from 'recharts';
import {
  BarChart3, TrendingUp, Users, Target, ChevronRight, ChevronDown, Filter,
  Maximize2, LayoutGrid, ListOrdered, Download, Table, Trophy, GraduationCap, AlertTriangle, ChartNetwork, Calendar, Zap, ShieldCheck, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Employee } from '../../types/employee';
import { Attendance, TrainingScore, TrainingNomination, Demographics, TrainingType, EligibilityRule } from '../../types/attendance';
import {
  buildUnifiedDataset, applyFilters, normalizeTrainingType, exportToCSV
} from '../../services/reportService';
import {
  getFiscalMonths, getCurrentFY,
  buildIPAggregates, buildIPMonthlyTeamRanks
} from '../../services/ipIntelligenceService';
import { buildEmployeeTimelines, buildAPMonthlyMatrix, filterTimelines } from '../../services/apIntelligenceService';
import { getAPPerformanceAggregates } from '../../services/apPerformanceService';
import { buildMIPAttendanceMatrix } from '../../services/mipAttendanceService';
import { getMIPPerformanceAggregates } from '../../services/mipPerformanceService';
import { buildRefresherAttendanceMatrix } from '../../services/refresherAttendanceService';
import { getRefresherPerformanceAggregates } from '../../services/refresherPerformanceService';
import { buildCapsuleAttendanceMatrix } from '../../services/capsuleAttendanceService';
import { getCapsulePerformanceAggregates } from '../../services/capsulePerformanceService';
import { getEligibleEmployees } from '../../services/eligibilityService';
import { getFiscalYears } from '../../utils/fiscalYear';
import { useMasterData } from '../../context/MasterDataContext';
import { GlobalFilterPanel } from '../../components/GlobalFilterPanel';
import { GlobalFilters, getActiveFilterCount } from '../../context/filterContext';
import { getCollection } from '../../services/apiClient';
import {
  useMonthsFromData, useFilterOptions, useGroupedData, useTrainerStats, useTimeSeries, useGapMetrics
} from '../../utils/computationHooks';

// --- MANDATORY INTERFACES ---
interface MatrixTeam {
  name: string;
  total: number;
  elite_pct: number;
  high_pct: number;
  medium_pct: number;
  low_pct: number;
  weighted_score: number;
  monthly: Record<string, { elite: number, high: number, medium: number, low: number, total: number }>;
}

interface MatrixCluster {
  cluster: string;
  teams: MatrixTeam[];
}

interface PerformanceChartsProps {
  employees: Employee[];
  attendance: Attendance[];
  scores: TrainingScore[];
  nominations: TrainingNomination[];
  demographics: Demographics[];
  onNavigate?: (view: any) => void;
}

const ALL_TRAINING_TYPES = ['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'PRE_AP'];
const FY_OPTIONS = getFiscalYears(2015);

const normalizeMonthStr = (m: string): string => {
  if (!m) return '';
  if (/^\d{4}-\d{2}/.test(m)) return m.substring(0, 7);
  const monthNames: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
  };
  const match = m.match(/^([A-Za-z]{3})[-\s](\d{4})$/);
  if (match) return `${match[2]}-${monthNames[match[1]] || '00'}`;
  const slashMatch = m.match(/^(\d{2})\/(\d{4})$/);
  if (slashMatch) return `${slashMatch[2]}-${slashMatch[1]}`;
  const [y, mm] = m.split('-');
  if (y && mm) return `${y}-${mm.padStart(2, '0')}`;
  return m.substring(0, 7);
};

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  employees, attendance, scores, nominations, demographics, onNavigate
}) => {
  const { teams: masterTeams, clusters: masterClusters, trainers: masterTrainers } = useMasterData();
  const [tab, setTab] = useState<string>('IP');
  const [subView, setSubView] = useState<string>('ip_matrix');
  const [selectedFY, setSelectedFY] = useState<string>(getCurrentFY());
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [pageFilters, setPageFilters] = useState<GlobalFilters>({ cluster: '', team: '', trainer: '', month: '' });
  const [showGlobalFilters, setShowGlobalFilters] = useState(false);
  const activeFilterCount = getActiveFilterCount(pageFilters);
  const [rules, setRules] = useState<EligibilityRule[]>([]);
  const [tsMode, setTsMode] = useState<'score' | 'count'>('score');

  useEffect(() => {
    getCollection('eligibility_rules').then(data => setRules(data as EligibilityRule[]));
  }, []);

  const MONTHS = useMemo(() => getFiscalMonths(selectedFY), [selectedFY]);

  useEffect(() => {
    if (tab === 'IP') {
      if (!['ip_matrix', 'ip_team_rank', 'timeseries', 'trainer', 'gap'].includes(subView)) setSubView('ip_matrix');
    } else if (tab === 'AP') {
      if (!['ap_attendance', 'ap_performance', 'timeseries', 'trainer', 'drilldown', 'gap'].includes(subView)) setSubView('ap_attendance');
    } else if (tab === 'MIP') {
      if (!['mip_attendance', 'mip_performance', 'timeseries', 'trainer', 'drilldown', 'gap'].includes(subView)) setSubView('mip_performance');
    } else if (tab === 'Refresher') {
      if (!['refresher_attendance', 'refresher_performance', 'timeseries', 'trainer', 'drilldown', 'gap'].includes(subView)) setSubView('refresher_attendance');
    } else if (tab === 'Capsule') {
      if (!['capsule_attendance', 'capsule_performance', 'timeseries', 'trainer', 'drilldown', 'gap'].includes(subView)) setSubView('capsule_attendance');
    } else {
      setSubView('gap');
    }
  }, [tab]);

  const rawUnified = useMemo(() => {
    const normalizedTab = normalizeTrainingType(tab);
    const att = attendance.filter(a => normalizeTrainingType(a.trainingType) === normalizedTab);
    const scs = scores.filter(s => normalizeTrainingType(s.trainingType) === normalizedTab);
    const noms = nominations.filter(n => normalizeTrainingType(n.trainingType) === normalizedTab);
    return buildUnifiedDataset(employees, att, scs, noms, [], masterTeams);
  }, [tab, attendance, scores, nominations, employees, masterTeams]);

  const unified = useMemo(() => {
    const filter = {
      monthFrom: pageFilters.month || '', monthTo: pageFilters.month || '',
      teams: pageFilters.team ? [pageFilters.team] : [],
      clusters: pageFilters.cluster ? [pageFilters.cluster] : [],
      trainer: pageFilters.trainer || ''
    };
    let ds = applyFilters(rawUnified, filter, masterTeams);
    return ds.filter(r => MONTHS.includes(normalizeMonthStr(r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7))));
  }, [rawUnified, pageFilters, MONTHS, masterTeams]);

  // Engines
  const ipData = useMemo(() => buildIPAggregates(unified), [unified]);
  const ipRankData = useMemo(() => buildIPMonthlyTeamRanks(unified, MONTHS), [unified, MONTHS]);

  const rawTimelines = useMemo(() => {
    if (['AP', 'MIP', 'Refresher', 'Capsule'].includes(tab)) {
      return buildEmployeeTimelines(
        attendance.filter(a => a.trainingType === tab),
        nominations.filter(n => n.trainingType === tab),
        masterTeams, tab,
        scores.filter(s => s.trainingType === tab)
      );
    }
    return new Map();
  }, [attendance, nominations, scores, tab, masterTeams]);

  const filteredTimelines = useMemo(() => {
    return filterTimelines(rawTimelines, { trainer: pageFilters.trainer, validMonths: MONTHS });
  }, [rawTimelines, pageFilters.trainer, MONTHS]);

  // Attendance Data
  const apAttData = useMemo(() => tab === 'AP' ? buildAPMonthlyMatrix(filteredTimelines, MONTHS) : null, [tab, filteredTimelines, MONTHS]);
  const mipAttData = useMemo(() => tab === 'MIP' ? buildMIPAttendanceMatrix(filteredTimelines, MONTHS) : null, [tab, filteredTimelines, MONTHS]);
  const refAttData = useMemo(() => tab === 'Refresher' ? buildRefresherAttendanceMatrix(filteredTimelines, MONTHS) : null, [tab, filteredTimelines, MONTHS]);
  const capAttData = useMemo(() => tab === 'Capsule' ? buildCapsuleAttendanceMatrix(filteredTimelines, MONTHS) : null, [tab, filteredTimelines, MONTHS]);
  
  // Performance Data
  const apPerfData = useMemo(() => tab === 'AP' ? getAPPerformanceAggregates(filteredTimelines, MONTHS) : null, [tab, filteredTimelines, MONTHS]);
  const mipPerfData = useMemo(() => tab === 'MIP' ? getMIPPerformanceAggregates(filteredTimelines, MONTHS) : null, [tab, filteredTimelines, MONTHS]);
  const refPerfData = useMemo(() => tab === 'Refresher' ? getRefresherPerformanceAggregates(filteredTimelines, MONTHS) : null, [tab, filteredTimelines, MONTHS]);
  const capPerfData = useMemo(() => tab === 'Capsule' ? getCapsulePerformanceAggregates(filteredTimelines, MONTHS) : null, [tab, filteredTimelines, MONTHS]);

  // Gap Analysis
  const eligibilityResults = useMemo(() => {
    const rule = rules.find(r => r.trainingType === tab);
    return getEligibleEmployees(tab as TrainingType, rule, employees, attendance, nominations);
  }, [tab, rules, employees, attendance, nominations]);
  const gapMetrics = useGapMetrics(tab, eligibilityResults, attendance);

  // Time Series & Trainer
  const tabNoms = useMemo(() => nominations.filter(n => n.trainingType === tab), [nominations, tab]);
  const groups = useGroupedData(unified, 'Month', tabNoms, employees, masterTeams);
  const dataMonths = useMonthsFromData(unified);
  const timeSeries = useTimeSeries(groups, dataMonths, tab, tsMode);
  const trainerStats = useTrainerStats(unified);

  const activeAttData = tab === 'AP' ? apAttData : tab === 'MIP' ? mipAttData : tab === 'Refresher' ? refAttData : capAttData;
  const activePerfData = tab === 'AP' ? apPerfData : tab === 'MIP' ? mipPerfData : tab === 'Refresher' ? refPerfData : capPerfData;

  // --- MATRIX TRANSFORMATION (IP Performance / Standard) ---
  const matrixData: MatrixCluster[] = useMemo(() => {
    let clusterMap = {};
    let teamMonthMap: Record<string, any> = {};
    if (tab === 'IP') {
      clusterMap = ipData.clusterMonthMap;
      teamMonthMap = ipData.teamMonthMap;
    } else if (activePerfData) {
      clusterMap = (activePerfData as any).clusterMap || (activePerfData as any).clusterMonthMap || {};
      teamMonthMap = (activePerfData as any).teamMonthMap || {};
    }

    return Object.entries(clusterMap).map(([clusterName, clusterData]: [string, any]) => {
      const teams: MatrixTeam[] = [];
      const teamSources = clusterData.teams ? Object.entries(clusterData.teams) : Object.entries(teamMonthMap[clusterName] || {});

      teamSources.forEach(([teamName, teamData]: [string, any]) => {
        const total = teamData.total || 0;
        teams.push({
          name: teamName,
          total: total,
          elite_pct: total > 0 ? (teamData.elite / total) * 100 : 0,
          high_pct: total > 0 ? (teamData.high / total) * 100 : 0,
          medium_pct: total > 0 ? (teamData.medium / total) * 100 : 0,
          low_pct: total > 0 ? (teamData.low / total) * 100 : 0,
          weighted_score: ((teamData.elite * 98) + (teamData.high * 85) + (teamData.medium * 65) + (teamData.low * 35)) / (total || 1),
          monthly: teamData.months || {}
        });
      });

      return {
        cluster: clusterName,
        teams: teams.sort((a, b) => b.weighted_score - a.weighted_score)
      };
    }).sort((a, b) => {
      const aAvg = a.teams.reduce((sum, t) => sum + t.weighted_score, 0) / (a.teams.length || 1);
      const bAvg = b.teams.reduce((sum, t) => sum + t.weighted_score, 0) / (b.teams.length || 1);
      return bAvg - aAvg;
    });
  }, [tab, ipData, activePerfData]);

  const kpis = useMemo(() => {
    const allTeams = matrixData.flatMap(c => c.teams);
    if (allTeams.length === 0) return { total: 0, high: 0, medium: 0, low: 0, score: 0, best: '—', worst: '—' };
    const total = allTeams.reduce((sum, t) => sum + t.total, 0);
    const avgHigh = allTeams.reduce((sum, t) => sum + t.high_pct, 0) / allTeams.length;
    const avgMed = allTeams.reduce((sum, t) => sum + t.medium_pct, 0) / allTeams.length;
    const avgLow = allTeams.reduce((sum, t) => sum + t.low_pct, 0) / allTeams.length;
    const avgScore = allTeams.reduce((sum, t) => sum + t.weighted_score, 0) / allTeams.length;
    const sorted = [...allTeams].sort((a, b) => b.weighted_score - a.weighted_score);
    return {
      total, high: avgHigh, medium: avgMed, low: avgLow, score: avgScore, best: sorted[0]?.name || '—', worst: sorted[sorted.length - 1]?.name || '—'
    };
  }, [matrixData]);

  // --- CHARTS DATA ---
  const distributionData = useMemo(() => {
    return MONTHS.map(m => {
      const label = m.split('-')[1];
      const buckets = { elite: 0, high: 0, medium: 0, low: 0, total: 0 };
      matrixData.forEach(c => c.teams.forEach(t => {
        const mon = t.monthly[m];
        if (mon) {
          buckets.elite += mon.elite || 0; buckets.high += mon.high || 0;
          buckets.medium += mon.medium || 0; buckets.low += mon.low || 0;
          buckets.total += mon.total || (mon.elite + mon.high + mon.medium + mon.low);
        }
      }));
      const tot = buckets.total || 1;
      return { label, Elite: (buckets.elite / tot) * 100, High: (buckets.high / tot) * 100, Medium: (buckets.medium / tot) * 100, Low: (buckets.low / tot) * 100 };
    });
  }, [matrixData, MONTHS]);

  const rankingData = useMemo(() => {
    return matrixData.flatMap(c => c.teams).sort((a, b) => b.weighted_score - a.weighted_score).slice(0, 15)
      .map(t => ({ name: t.name, score: Math.round(t.weighted_score * 100) / 100 }));
  }, [matrixData]);

  const trendData = useMemo(() => {
    const data = MONTHS.map(m => {
      const row: any = { label: m.split('-')[1] };
      matrixData.forEach(c => {
        let clusterTotal = 0, clusterBuckets = { e: 0, h: 0, m: 0, l: 0 };
        c.teams.forEach(t => {
          const mon = t.monthly[m];
          if (mon) {
            clusterBuckets.e += mon.elite || 0; clusterBuckets.h += mon.high || 0;
            clusterBuckets.m += mon.medium || 0; clusterBuckets.l += mon.low || 0;
            clusterTotal += mon.total || (mon.elite + mon.high + mon.medium + mon.low);
          }
        });
        if (clusterTotal > 0) row[c.cluster] = Math.round(((clusterBuckets.e * 98) + (clusterBuckets.h * 85) + (clusterBuckets.m * 65) + (clusterBuckets.l * 35)) / clusterTotal * 100) / 100;
      });
      return row;
    });
    return { data, clusters: matrixData.map(c => c.cluster) };
  }, [matrixData, MONTHS]);

  // Attendance Funnel Charts
  const attFunnelData = useMemo(() => {
    if (!activeAttData) return [];
    return MONTHS.map(m => {
      let notified = 0, attended = 0;
      Object.values(activeAttData.clusterMonthMap).forEach((c: any) => {
        if (c.months[m]) {
          notified += c.months[m].notified || 0;
          attended += c.months[m].attended || 0;
        }
      });
      return { label: m.split('-')[1], Notified: notified, Attended: attended };
    });
  }, [activeAttData, MONTHS]);

  const attClusterData = useMemo(() => {
    if (!activeAttData) return [];
    return Object.entries(activeAttData.clusterMonthMap).map(([name, data]: [string, any]) => ({
      name,
      Notified: data.totalNotified,
      Attended: data.totalAttended,
      Pct: data.totalNotified ? Math.round((data.totalAttended / data.totalNotified) * 100) : 0
    })).sort((a, b) => b.Pct - a.Pct);
  }, [activeAttData]);

  // Gap Analysis Charts
  const gapClusterData = useMemo(() => {
    const byCluster: Record<string, { trained: number, gap: number }> = {};
    eligibilityResults.forEach(er => {
      if (!er.eligibilityStatus) return;
      const c = er.cluster || 'Unknown';
      if (!byCluster[c]) byCluster[c] = { trained: 0, gap: 0 };
      const hasAttended = attendance.some(a => a.employeeId === er.employeeId && a.trainingType === tab && a.attendanceStatus === 'Present');
      if (hasAttended) byCluster[c].trained++;
      else byCluster[c].gap++;
    });
    return Object.entries(byCluster).map(([name, d]) => ({ name, Trained: d.trained, Gap: d.gap })).sort((a, b) => b.Gap - a.Gap);
  }, [eligibilityResults, attendance, tab]);

  const gapPieData = [
    { name: 'Trained', value: gapMetrics.trainedCount, fill: '#22c55e' },
    { name: 'Gap', value: gapMetrics.gapCount, fill: '#ef4444' }
  ];

  // Time Series Charts
  const tsChartData = useMemo(() => {
    return timeSeries.map(r => {
      const row: any = { label: r.label };
      Object.keys(r.cells).forEach(k => { row[k] = r.cells[k]; });
      return row;
    });
  }, [timeSeries]);
  const tsKeys = useMemo(() => {
    const keys = new Set<string>();
    timeSeries.forEach(r => Object.keys(r.cells).forEach(k => keys.add(k)));
    return Array.from(keys);
  }, [timeSeries]);

  // Trainer Charts
  const trainerScatterData = useMemo(() => {
    return trainerStats.map(t => ({
      name: t.trainerId,
      volume: t.trainingsConducted,
      score: t.avgScore,
    })).sort((a, b) => b.volume - a.volume).slice(0, 30);
  }, [trainerStats]);

  const toggleCluster = (clusterName: string) => {
    setExpandedClusters(prev => {
      const next = new Set(prev);
      if (next.has(clusterName)) next.delete(clusterName);
      else next.add(clusterName);
      return next;
    });
  };

  const { allTeams, allTrainers } = useFilterOptions(employees, attendance, tab, masterTeams, masterTrainers);
  const allClusters = useMemo(() => masterClusters.map(c => c.name), [masterClusters]);
  const monthsOptions = useMonthsFromData(rawUnified);

  return (
    <div className="performance-charts animate-fade-in">
      <div className="mb-24">
        <h1 className="text-2xl font-bold m-0">Performance Insights</h1>
        <p className="text-subtitle">Interactive graphs and charts mapped to reports</p>
      </div>

      <div className="header mb-20">
        <div className="flex"></div>
        <div className="flex-center gap-2">
          <div className="flex-center gap-2 mr-2">
            <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-tables')} title="Switch to Tables"><Table size={16} /></button>
            <button className="btn btn-primary" title="Charts View"><BarChart3 size={16} /></button>
            <div className="v-divider mx-1" />
          </div>

          <div className="flex-center gap-2">
            {tab === 'IP' ? (
              <>
                <button className={`btn ${subView === 'ip_matrix' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('ip_matrix')} title="Matrix View"><Table size={16} /></button>
                <button className={`btn ${subView === 'ip_team_rank' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('ip_team_rank')} title="Team Rank Matrix"><Trophy size={16} /></button>
                <button className={`btn ${subView === 'timeseries' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('timeseries')} title="Time Series"><Calendar size={16} /></button>
                <button className={`btn ${subView === 'trainer' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('trainer')} title="Trainer Analytics"><GraduationCap size={16} /></button>
              </>
            ) : tab === 'MIP' ? (
              <>
                <button className={`btn ${subView === 'mip_attendance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('mip_attendance')} title="Attendance Funnel"><Table size={16} /></button>
                <button className={`btn ${subView === 'mip_performance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('mip_performance')} title="Performance Analytics"><TrendingUp size={16} /></button>
                <button className={`btn ${subView === 'timeseries' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('timeseries')} title="Time Series"><Calendar size={16} /></button>
              </>
            ) : tab === 'Refresher' ? (
              <>
                <button className={`btn ${subView === 'refresher_attendance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('refresher_attendance')} title="Attendance Matrix"><Table size={16} /></button>
                <button className={`btn ${subView === 'refresher_performance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('refresher_performance')} title="Performance Analytics"><TrendingUp size={16} /></button>
                <button className={`btn ${subView === 'timeseries' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('timeseries')} title="Time Series"><Calendar size={16} /></button>
              </>
            ) : tab === 'Capsule' ? (
              <>
                <button className={`btn ${subView === 'capsule_attendance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('capsule_attendance')} title="Attendance Matrix"><Table size={16} /></button>
                <button className={`btn ${subView === 'capsule_performance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('capsule_performance')} title="Performance Analytics"><TrendingUp size={16} /></button>
                <button className={`btn ${subView === 'timeseries' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('timeseries')} title="Time Series"><Calendar size={16} /></button>
              </>
            ) : (
              <>
                <button className={`btn ${subView === 'ap_attendance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('ap_attendance')} title="Attendance Funnel"><Table size={16} /></button>
                <button className={`btn ${subView === 'ap_performance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('ap_performance')} title="Performance Analytics"><TrendingUp size={16} /></button>
                <button className={`btn ${subView === 'timeseries' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('timeseries')} title="Time Series"><Calendar size={16} /></button>
                <button className={`btn ${subView === 'trainer' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('trainer')} title="Trainer Analytics"><GraduationCap size={16} /></button>
              </>
            )}
            <button className={`btn ${subView === 'gap' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('gap')} title="Gap Analysis"><AlertTriangle size={16} /></button>
          </div>

          <div className="v-divider mx-1" />
          <div className="fy-selector flex-center gap-2 mr-2">
            <label className="text-xs-bold text-muted uppercase">FISCAL YEAR</label>
            <select value={selectedFY} onChange={(e) => setSelectedFY(e.target.value)} className="form-select glass-panel fy-select" title="Select Fiscal Year">
              {FY_OPTIONS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
            </select>
          </div>
          <button className={`btn btn-secondary btn-filter ${activeFilterCount > 0 ? 'active' : ''}`} onClick={() => setShowGlobalFilters(true)} title="Open Global Filters">
            <Filter size={16} />
            {activeFilterCount > 0 && <span className="text-xs-bold min-w-16">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      <div className="tab-row">
        {ALL_TRAINING_TYPES.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`btn btn-tab ${tab === t ? 'btn-primary' : 'btn-secondary'}`}>{t}</button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* === IP MATRIX VIEW === */}
        {(subView === 'ip_matrix' || subView === 'ap_performance' || subView === 'mip_performance' || subView === 'refresher_performance' || subView === 'capsule_performance') && (
          <>
            <div className="col-span-12 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-2">
              <KPICard title="TOTAL CANDIDATES" value={kpis.total} icon={<Users size={20} />} colorType="primary" />
              <KPICard title="HIGH %" value={`${kpis.high.toFixed(1)}%`} icon={<TrendingUp size={20} />} colorType="success" />
              <KPICard title="MEDIUM %" value={`${kpis.medium.toFixed(1)}%`} icon={<Target size={20} />} colorType="warning" />
              <KPICard title="LOW %" value={`${kpis.low.toFixed(1)}%`} icon={<AlertTriangle size={20} />} colorType="accent" />
              <KPICard title="AVG SCORE" value={kpis.score.toFixed(2)} icon={<Zap size={20} />} colorType="primary" />
              <KPICard title="BEST TEAM" value={kpis.best} icon={<Trophy size={20} />} colorType="success" />
              <KPICard title="WORST TEAM" value={kpis.worst} icon={<AlertTriangle size={20} />} colorType="accent" />
            </div>

            <div className="col-span-12 lg:col-span-7 glass-panel p-6 chart-box-min">
              <h3 className="font-bold flex-center gap-2 mb-6"><BarChart3 size={18} className="text-primary" /> Performance Distribution Matrix</h3>
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} unit="%" />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }} formatter={(val: number) => `${val.toFixed(1)}%`} />
                    <Bar dataKey="Elite" stackId="a" fill="#22c55e" /><Bar dataKey="High" stackId="a" fill="#3b82f6" /><Bar dataKey="Medium" stackId="a" fill="#f59e0b" /><Bar dataKey="Low" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-5 glass-panel p-6 chart-box-min">
              <h3 className="font-bold flex-center gap-2 mb-6"><ListOrdered size={18} className="text-warning" /> Top 15 Team Rankings</h3>
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={rankingData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" hide /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-primary)', fontSize: 10, fontWeight: 500 }} width={100} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }} formatter={(val: number) => `${val.toFixed(2)}`} />
                    <Bar dataKey="score" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={16}>
                      {rankingData.map((entry, index) => <Cell key={`cell-${index}`} fill={index < 3 ? 'var(--success)' : 'var(--primary)'} opacity={1 - (index * 0.04)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col-span-12 glass-panel p-6 chart-box-min">
              <h3 className="font-bold flex-center gap-2 mb-6"><TrendingUp size={18} className="text-accent-primary" /> Month-by-Month Trend — Cluster Analytics</h3>
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData.data} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }} formatter={(val: number) => [`${val.toFixed(2)}`, 'Score']} /><Legend iconType="circle" />
                    {trendData.clusters.map((cluster, i) => (
                      <Line key={cluster} type="monotone" dataKey={cluster} stroke={['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'][i % 7]} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'var(--bg-card)' }} activeDot={{ r: 6, strokeWidth: 0 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* === ATTENDANCE VIEWS === */}
        {['ap_attendance', 'mip_attendance', 'refresher_attendance', 'capsule_attendance'].includes(subView) && activeAttData && (
          <>
            <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
              <KPICard title="TOTAL NOTIFIED" value={(activeAttData.globalKPIs as any).totalNotified ?? (activeAttData.globalKPIs as any).totalEmployeesNotified} icon={<Zap size={20} />} colorType="primary" />
              <KPICard title="TOTAL ATTENDED" value={(activeAttData.globalKPIs as any).totalAttended ?? (activeAttData.globalKPIs as any).totalEmployeesAttended} icon={<CheckCircle2 size={20} />} colorType="success" />
              <KPICard title="ATTENDANCE %" value={`${activeAttData.globalKPIs.attendancePercent.toFixed(1)}%`} icon={<Target size={20} />} colorType="accent" />
            </div>

            <div className="col-span-12 lg:col-span-8 glass-panel p-6 chart-box-min">
              <h3 className="font-bold flex-center gap-2 mb-6"><BarChart3 size={18} className="text-primary" /> Notified vs Attended Over Time</h3>
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={attFunnelData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                    <Legend />
                    <Bar dataKey="Notified" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Attended" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4 glass-panel p-6 chart-box-min">
              <h3 className="font-bold flex-center gap-2 mb-6"><Target size={18} className="text-success" /> Attendance % by Cluster</h3>
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={attClusterData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-primary)', fontSize: 10 }} width={100} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }} formatter={(val: number) => `${val}%`} />
                    <Bar dataKey="Pct" fill="var(--success)" radius={[0, 4, 4, 0]} barSize={16}>
                      {attClusterData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.Pct >= 90 ? '#22c55e' : entry.Pct >= 70 ? '#f59e0b' : '#ef4444'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* === GAP ANALYSIS === */}
        {subView === 'gap' && (
          <>
            <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
              <KPICard title="ELIGIBLE COHORT" value={gapMetrics.eligibleCount} icon={<Users size={20} />} colorType="primary" />
              <KPICard title="TRAINED" value={gapMetrics.trainedCount} icon={<CheckCircle2 size={20} />} colorType="success" />
              <KPICard title="GAP" value={gapMetrics.gapCount} icon={<AlertTriangle size={20} />} colorType="accent" />
            </div>

            <div className="col-span-12 lg:col-span-4 glass-panel p-6 chart-box-min">
              <h3 className="font-bold flex-center gap-2 mb-6"><ChartNetwork size={18} className="text-primary" /> Overall Training Gap</h3>
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={gapPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                      {gapPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-8 glass-panel p-6 chart-box-min">
              <h3 className="font-bold flex-center gap-2 mb-6"><BarChart3 size={18} className="text-danger" /> Training Gap by Cluster</h3>
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gapClusterData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                    <Legend />
                    <Bar dataKey="Trained" stackId="a" fill="#22c55e" />
                    <Bar dataKey="Gap" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* === TIME SERIES === */}
        {subView === 'timeseries' && (
          <div className="col-span-12 glass-panel p-6 chart-box-min">
            <div className="flex-between mb-6">
              <h3 className="font-bold flex-center gap-2 m-0"><Calendar size={18} className="text-primary" /> Performance Trends Over Time</h3>
              <button className="btn btn-secondary text-xs" onClick={() => setTsMode(m => m === 'score' ? 'count' : 'score')}>
                Toggle to {tsMode === 'score' ? 'Volume' : 'Score'}
              </button>
            </div>
            <div className="w-full h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tsChartData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} domain={tsMode === 'score' ? [0, 100] : ['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                  <Legend iconType="circle" />
                  {tsKeys.map((key, i) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'][i % 7]} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* === TRAINER ANALYTICS === */}
        {subView === 'trainer' && (
          <div className="col-span-12 glass-panel p-6 chart-box-min">
            <h3 className="font-bold flex-center gap-2 mb-6"><GraduationCap size={18} className="text-primary" /> Trainer Volume vs Score Scatter</h3>
            <div className="w-full h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" dataKey="volume" name="Volume" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                  <YAxis type="number" dataKey="score" name="Avg Score" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                  <ZAxis type="category" dataKey="name" name="Trainer" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                  <Scatter name="Trainers" data={trainerScatterData} fill="#8b5cf6">
                    {trainerScatterData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.score >= 80 ? '#22c55e' : entry.score >= 60 ? '#f59e0b' : '#ef4444'} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <GlobalFilterPanel
        isOpen={showGlobalFilters} onClose={() => setShowGlobalFilters(false)}
        onApply={(f) => setPageFilters(f)} initialFilters={pageFilters}
        clusterOptions={allClusters} teamOptions={allTeams} trainerOptions={allTrainers} monthOptions={monthsOptions}
        onClearAll={() => setPageFilters({ cluster: '', team: '', trainer: '', month: '' })}
      />
    </div>
  );
};

const KPICard = ({ title, value, icon, colorType }: { title: string, value: string | number, icon: React.ReactNode, colorType: 'primary' | 'success' | 'warning' | 'accent' }) => (
  <div className="glass-panel p-5 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300 h-full">
    <div className="flex-between relative z-10">
      <div><p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">{title}</p><h4 className="text-xl font-bold">{value}</h4></div>
      <div className={`p-2.5 rounded-xl transition-all duration-300 group-hover:rotate-12 kpi-icon-${colorType}`}>{icon}</div>
    </div>
    <div className={`absolute -bottom-4 -right-4 w-24 h-24 blur-2xl opacity-10 rounded-full kpi-glow-${colorType}`} />
  </div>
);
