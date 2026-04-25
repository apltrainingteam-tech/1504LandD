import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, Cell
} from 'recharts';
import { 
  BarChart3, TrendingUp, Users, Target, ChevronRight, ChevronDown, Filter, 
  Maximize2, LayoutGrid, ListOrdered, Download, Table, Trophy, GraduationCap, AlertTriangle, ChartNetwork, Calendar, Zap
} from 'lucide-react';
import { Employee } from '../../types/employee';
import { Attendance, TrainingScore, TrainingNomination, Demographics } from '../../types/attendance';
import { 
  buildUnifiedDataset, applyFilters, normalizeTrainingType,
  getPrimaryMetricRaw
} from '../../services/reportService';
import { 
  getFiscalMonths, getCurrentFY, 
  buildIPAggregates
} from '../../services/ipIntelligenceService';
import { buildEmployeeTimelines, filterTimelines } from '../../services/apIntelligenceService';
import { getAPPerformanceAggregates } from '../../services/apPerformanceService';
import { getMIPPerformanceAggregates } from '../../services/mipPerformanceService';
import { getRefresherPerformanceAggregates } from '../../services/refresherPerformanceService';
import { getCapsulePerformanceAggregates } from '../../services/capsulePerformanceService';
import { getFiscalYears } from '../../utils/fiscalYear';
import { useMasterData } from '../../context/MasterDataContext';
import { GlobalFilterPanel } from '../../components/GlobalFilterPanel';
import { GlobalFilters, getActiveFilterCount } from '../../context/filterContext';
import { 
  useMonthsFromData, useFilterOptions
} from '../../utils/computationHooks';

// --- MANDATORY INTERFACES (SINGLE SOURCE OF TRUTH) ---

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
    Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
    Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12'
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
  const [selectedFY, setSelectedFY] = useState<string>(getCurrentFY());
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [pageFilters, setPageFilters] = useState<GlobalFilters>({ cluster: '', team: '', trainer: '', month: '' });
  const [showGlobalFilters, setShowGlobalFilters] = useState(false);
  const activeFilterCount = getActiveFilterCount(pageFilters);

  const MONTHS = useMemo(() => getFiscalMonths(selectedFY), [selectedFY]);

  // --- CORE DATA LAYER (FROM TABLE ENGINES) ---
  
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
    return pageFilters.month ? ds : ds.filter(r => MONTHS.includes(normalizeMonthStr(r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7))));
  }, [rawUnified, pageFilters, MONTHS, masterTeams, tab]);

  // --- MATRIX TRANSFORMATION (SINGLE SOURCE OF TRUTH) ---
  
  const matrixData: MatrixCluster[] = useMemo(() => {
    // 1. Fetch data from active engine
    let engineData: any = null;
    if (tab === 'IP') {
      engineData = buildIPAggregates(unified);
    } else if (['AP', 'MIP', 'Refresher', 'Capsule'].includes(tab)) {
      const timelines = buildEmployeeTimelines(
        attendance.filter(a => normalizeTrainingType(a.trainingType) === normalizeTrainingType(tab)),
        nominations.filter(n => normalizeTrainingType(n.trainingType) === normalizeTrainingType(tab)),
        masterTeams, tab,
        scores.filter(s => normalizeTrainingType(s.trainingType) === normalizeTrainingType(tab))
      );
      const filtered = filterTimelines(timelines, { trainer: pageFilters.trainer, validMonths: MONTHS });
      if (tab === 'AP') engineData = getAPPerformanceAggregates(filtered, MONTHS);
      else if (tab === 'MIP') engineData = getMIPPerformanceAggregates(filtered, MONTHS);
      else if (tab === 'Refresher') engineData = getRefresherPerformanceAggregates(filtered, MONTHS);
      else if (tab === 'Capsule') engineData = getCapsulePerformanceAggregates(filtered, MONTHS);
    }

    if (!engineData) return [];

    const clusterMap = engineData.clusterMonthMap || engineData.clusterMap || {};
    const teamMonthMap = engineData.teamMonthMap || {};

    // 2. Transform engine output to standard Matrix format
    return Object.entries(clusterMap).map(([clusterName, clusterData]: [string, any]) => {
      const teams: MatrixTeam[] = [];
      
      // Handle both IP and AP/MIP structures
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
  }, [unified, tab, MONTHS, attendance, nominations, scores, masterTeams, pageFilters.trainer]);

  // --- KPI DERIVATION (FROM MATRIX ONLY) ---
  
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
      total,
      high: avgHigh,
      medium: avgMed,
      low: avgLow,
      score: avgScore,
      best: sorted[0]?.name || '—',
      worst: sorted[sorted.length - 1]?.name || '—'
    };
  }, [matrixData]);

  // --- CHART TRANSFORMATIONS ---

  const distributionData = useMemo(() => {
    return MONTHS.map(m => {
      const label = m.split('-')[1];
      const buckets = { elite: 0, high: 0, medium: 0, low: 0, total: 0 };
      matrixData.forEach(c => {
        c.teams.forEach(t => {
          const mon = t.monthly[m];
          if (mon) {
            buckets.elite += mon.elite || 0;
            buckets.high += mon.high || 0;
            buckets.medium += mon.medium || 0;
            buckets.low += mon.low || 0;
            buckets.total += mon.total || (mon.elite + mon.high + mon.medium + mon.low);
          }
        });
      });
      const tot = buckets.total || 1;
      return {
        label,
        Elite: (buckets.elite / tot) * 100,
        High: (buckets.high / tot) * 100,
        Medium: (buckets.medium / tot) * 100,
        Low: (buckets.low / tot) * 100
      };
    });
  }, [matrixData, MONTHS]);

  const rankingData = useMemo(() => {
    return matrixData.flatMap(c => c.teams)
      .sort((a, b) => b.weighted_score - a.weighted_score)
      .slice(0, 15)
      .map(t => ({ name: t.name, score: Math.round(t.weighted_score * 100) / 100 }));
  }, [matrixData]);

  const trendData = useMemo(() => {
    const data = MONTHS.map(m => {
      const row: any = { label: m.split('-')[1] };
      matrixData.forEach(c => {
        let clusterTotal = 0;
        let clusterBuckets = { e: 0, h: 0, m: 0, l: 0 };
        c.teams.forEach(t => {
          const mon = t.monthly[m];
          if (mon) {
            clusterBuckets.e += mon.elite || 0;
            clusterBuckets.h += mon.high || 0;
            clusterBuckets.m += mon.medium || 0;
            clusterBuckets.l += mon.low || 0;
            clusterTotal += mon.total || (mon.elite + mon.high + mon.medium + mon.low);
          }
        });
        if (clusterTotal > 0) {
          row[c.cluster] = Math.round(((clusterBuckets.e * 98) + (clusterBuckets.h * 85) + (clusterBuckets.m * 65) + (clusterBuckets.l * 35)) / clusterTotal * 100) / 100;
        }
      });
      return row;
    });
    return { data, clusters: matrixData.map(c => c.cluster) };
  }, [matrixData, MONTHS]);

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
      {/* 1. HEADER (REPLICA) */}
      <div className="mb-24">
        <h1 className="text-2xl font-bold m-0">Performance Insights</h1>
        <p className="text-subtitle">Detailed training performance analysis and rankings</p>
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
                <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-tables')} title="Matrix View"><Table size={16} /></button>
                <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-tables')} title="Team Rank Matrix"><Trophy size={16} /></button>
                <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-tables')} title="Time Series"><Calendar size={16} /></button>
                <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-tables')} title="Trainer Analytics"><GraduationCap size={16} /></button>
              </>
            ) : tab === 'MIP' ? (
              <>
                <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-tables')} title="Attendance Funnel"><Table size={16} /></button>
                <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-tables')} title="Performance Analytics"><TrendingUp size={16} /></button>
              </>
            ) : tab === 'Refresher' ? (
              <>
                <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-tables')} title="Attendance Matrix"><Table size={16} /></button>
                <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-tables')} title="Performance Analytics"><TrendingUp size={16} /></button>
              </>
            ) : tab === 'Capsule' ? (
              <>
                <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-tables')} title="Attendance Matrix"><Table size={16} /></button>
                <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-tables')} title="Performance Analytics"><TrendingUp size={16} /></button>
              </>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-tables')} title={tab === 'AP' ? "Attendance Funnel" : "Rankings"}><Table size={16} /></button>
                {tab === 'AP' && (
                  <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-tables')} title="Performance Analytics"><TrendingUp size={16} /></button>
                )}
                <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-tables')} title="Time Series"><Calendar size={16} /></button>
                <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-tables')} title="Drill-Down"><ChartNetwork size={16} /></button>
              </>
            )}
            <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-tables')} title="Gap Analysis"><AlertTriangle size={16} /></button>
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
          <button className="btn btn-secondary" title="Download Report"><Download size={16} /></button>
        </div>
      </div>

      <div className="tab-row">
        {ALL_TRAINING_TYPES.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`btn btn-tab ${tab === t ? 'btn-primary' : 'btn-secondary'}`}>{t}</button>
        ))}
      </div>

      {/* 2. KPI DERIVATION (MATCHING REQUIRMENTS) */}
      <div className="grid grid-cols-12 gap-6 mb-24">
        <div className="col-span-12 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <KPICard title="TOTAL CANDIDATES" value={kpis.total} icon={<Users size={20} />} colorType="primary" />
          <KPICard title="HIGH %" value={`${kpis.high.toFixed(1)}%`} icon={<TrendingUp size={20} />} colorType="success" />
          <KPICard title="MEDIUM %" value={`${kpis.medium.toFixed(1)}%`} icon={<Target size={20} />} colorType="warning" />
          <KPICard title="LOW %" value={`${kpis.low.toFixed(1)}%`} icon={<AlertTriangle size={20} />} colorType="accent" />
          <KPICard title="WEIGHTED T SCORE" value={kpis.score.toFixed(2)} icon={<Zap size={20} />} colorType="primary" />
          <KPICard title="BEST TEAM" value={kpis.best} icon={<Trophy size={20} />} colorType="success" />
          <KPICard title="WORST TEAM" value={kpis.worst} icon={<AlertTriangle size={20} />} colorType="accent" />
        </div>
      </div>

      {/* 3. CHART MODULES (TRANSFORMED FROM MATRIX) */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* A. Performance Distribution (Stacked Bar) */}
        <div className="col-span-12 lg:col-span-7 glass-panel p-6 chart-box-min">
          <h3 className="font-bold flex-center gap-2 mb-6">
            <BarChart3 size={18} className="text-primary" />
            Performance Distribution Matrix
          </h3>
          <div className="w-full chart-container-main">
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

        {/* B. Team Ranking (Horizontal Bar) */}
        <div className="col-span-12 lg:col-span-5 glass-panel p-6 chart-box-min">
          <h3 className="font-bold flex-center gap-2 mb-6">
            <ListOrdered size={18} className="text-warning" />
            Top 15 Team Rankings
          </h3>
          <div className="w-full chart-container-main">
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

        {/* C. Trend Chart (Line Chart) */}
        <div className="col-span-12 glass-panel p-6 chart-box-min">
          <h3 className="font-bold flex-center gap-2 mb-6">
            <TrendingUp size={18} className="text-accent-primary" />
            Month-by-Month Trend — Cluster Analytics
          </h3>
          <div className="w-full chart-container-main">
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

        {/* D. Cluster Dashboard (Expandable Matrix Engine) */}
        <div className="col-span-12 glass-panel overflow-hidden border-primary/20">
          <div className="p-6 border-b border-white/5 bg-white/[0.02] flex-between">
            <h3 className="font-bold flex-center gap-2 text-xl">
              <LayoutGrid size={22} className="text-primary" />
              Regional Cluster Dashboard
            </h3>
            <span className="text-xs text-muted font-medium bg-white/5 px-3 py-1 rounded-full">Source: Matrix Engine</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 text-xs font-bold text-muted uppercase tracking-wider">
                  <th className="px-6 py-4 w-12"></th><th className="px-6 py-4">Cluster</th><th className="px-6 py-4">Volume</th><th className="px-6 py-4">Elite %</th><th className="px-6 py-4">Avg Score</th><th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {matrixData.map((cluster) => {
                  const clusterTotal = cluster.teams.reduce((sum, t) => sum + t.total, 0);
                  const clusterElite = cluster.teams.reduce((sum, t) => sum + (t.elite_pct * t.total / 100), 0);
                  const clusterScore = cluster.teams.reduce((sum, t) => sum + t.weighted_score, 0) / cluster.teams.length;
                  return (
                    <React.Fragment key={cluster.cluster}>
                      <tr className={`hover:bg-white/[0.03] transition-colors cursor-pointer ${expandedClusters.has(cluster.cluster) ? 'bg-white/[0.02]' : ''}`} onClick={() => toggleCluster(cluster.cluster)}>
                        <td className="px-6 py-4">{expandedClusters.has(cluster.cluster) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</td>
                        <td className="px-6 py-4"><div className="font-bold text-lg">{cluster.cluster}</div><div className="text-xs text-muted">{cluster.teams.length} teams</div></td>
                        <td className="px-6 py-4"><div className="text-lg font-medium">{clusterTotal}</div><div className="text-xs text-muted">Candidates</div></td>
                        <td className="px-6 py-4"><div className="text-lg font-bold text-success">{(clusterElite / clusterTotal * 100).toFixed(1)}%</div></td>
                        <td className="px-6 py-4"><div className="text-lg font-bold text-primary">{clusterScore.toFixed(2)}</div></td>
                        <td className="px-6 py-4 text-right"><button className="p-2 hover:bg-white/10 rounded-full transition-colors text-primary" title={`Explore ${cluster.cluster}`}><Maximize2 size={16} /></button></td>
                      </tr>
                      <AnimatePresence>
                        {expandedClusters.has(cluster.cluster) && (
                          <motion.tr initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                            <td colSpan={6} className="p-0">
                              <div className="bg-white/[0.04] rounded-xl p-6 mx-6 mb-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {cluster.teams.map((team) => (
                                  <div key={team.name} className="glass-panel p-4 border-white/5 flex-between hover:border-primary/30 transition-all group cursor-pointer" onClick={(e) => { e.stopPropagation(); onNavigate?.('performance-tables'); }}>
                                    <div><div className="text-sm font-bold group-hover:text-primary transition-colors">{team.name}</div><div className="text-xs text-muted">{team.total} records</div></div>
                                    <div className="text-right">
                                      <div className={`text-lg font-bold ${team.weighted_score >= 80 ? 'text-success' : team.weighted_score >= 60 ? 'text-warning' : 'text-danger'}`}>{team.weighted_score.toFixed(1)}</div>
                                      <div className="text-[10px] text-muted uppercase">W-Score</div>
                                    </div>
                                  </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
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
