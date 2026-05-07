import React, { useState, useMemo, useEffect, Fragment, memo, useCallback } from 'react';
import { motion } from 'framer-motion';

import {
  Table, Calendar, GraduationCap, AlertTriangle, ChevronRight, ChevronDown,
  Trophy, Zap, ShieldCheck, CheckCircle2, ChartNetwork, Download, Filter, X, ListOrdered, BarChart3, TrendingUp, AlertCircle, Users, Bug, Search as SearchIcon
} from 'lucide-react';

import { Employee } from '../../types/employee';
import { Attendance, TrainingScore, TrainingNomination, Demographics, TrainingType } from '../../types/attendance';
import { ViewByOption, GroupedData, ReportFilter } from '../../types/reports';
import { exportToCSV, groupData, rankGroups } from '../../core/engines/reportEngine';
import { FISCAL_YEARS, getCurrentFYString, getFiscalYears, formatMonthLabel } from '../../core/utils/fiscalYear';
import { scheduleIdle } from '../../core/utils/stagedComputation';
import { KPIBox } from '../../shared/components/ui/KPIBox';
import { DataTable } from '../../shared/components/ui/DataTable';
import { TimeSeriesTable } from '../../features/dashboard/components/TimeSeriesTable';
import { TrainerTable } from '../../features/dashboard/components/TrainerTable';
import { DrilldownPanel } from '../../features/dashboard/components/DrilldownPanel';

import TrainerAvatar from '../../shared/components/ui/TrainerAvatar';
import { ErrorPanel } from '../../shared/components/ui/ErrorPanel';
import { GlobalFilters, getActiveFilterCount, INITIAL_FILTERS } from '../../core/context/filterContext';

import { APPerformanceMatrix } from './components/APPerformanceMatrix';
import { MIPAttendanceMatrix, MIPPerformanceMatrix } from '../../features/dashboard/components/MIPDualMatrix';
import { RefresherAttendanceMatrix, RefresherPerformanceMatrix } from '../../features/dashboard/components/RefresherDualMatrix';
import { CapsuleAttendanceMatrix, CapsulePerformanceMatrix } from '../../features/dashboard/components/CapsuleDualMatrix';
import { flagScore, flagClass, flagLabel } from '../../core/utils/scoreNormalizer';
import { useFilterOptions } from '../../shared/hooks/computationHooks';
import { useMasterData } from '../../core/context/MasterDataContext';
import { usePerformanceData } from './hooks/usePerformanceData';
import { ProgressBar } from '../../shared/components/ui/ProgressBar';

const ALL_TRAINING_TYPES = ['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'PRE_AP'];


const FY_OPTIONS = getFiscalYears(2015);

interface ReportsAnalyticsProps {
  employees: Employee[];
  attendance: Attendance[];
  scores: TrainingScore[];
  nominations: TrainingNomination[];
  demographics: Demographics[];
  pageMode?: 'overview' | 'performance-insights';
  onNavigate?: (view: any) => void;
}

type SubView = 'grouped' | 'timeseries' | 'trainer' | 'drilldown' | 'gap' | 'ip_matrix' | 'ip_cluster_rank' | 'ip_team_rank' | 'ap_performance' | 'mip_attendance' | 'mip_performance' | 'refresher_attendance' | 'refresher_performance' | 'capsule_attendance' | 'capsule_performance';

import { useGlobalFilters } from '../../core/context/GlobalFilterContext';

const ReportsAnalyticsComponent: React.FC<ReportsAnalyticsProps> = ({
  employees = [], attendance = [], scores = [], nominations = [], demographics = [], pageMode = 'overview', onNavigate
}) => {
  const { filters: globalFilters, setFilters } = useGlobalFilters();
  const { 
    trainers: masterTrainers, 
    teams: masterTeams, 
    clusters: masterClusters, 
    eligibilityRules: rules,
    activeError,
    patchRecord,
    finalData
  } = useMasterData();

  const rawAttendance = finalData.trainingData;

  const [pageFilters, setPageFilters] = useState<GlobalFilters>(INITIAL_FILTERS);
  const activeFilterCount = getActiveFilterCount(pageFilters);

  const [tabState, setTabState] = useState<string>('IP');
  const tab = globalFilters.trainingType !== 'ALL' ? globalFilters.trainingType : tabState;

  const [viewBy, setViewBy] = useState<ViewByOption>('Team');
  const [subView, setSubView] = useState<SubView>('ip_matrix');
  const [expanded, setExpanded] = useState(new Set<string>());

  const [tsMode, setTsMode] = useState<'score' | 'count'>('score');

  const [filter, setFilter] = useState<ReportFilter>({
    monthFrom: '', monthTo: '', teams: [], clusters: [], trainer: ''
  });

  const [kpiStage, setKpiStage] = useState<'loading' | 'ready'>('loading');
  const [groupedStage, setGroupedStage] = useState<'loading' | 'ready'>('loading');
  const [timeseriesStage, setTimeseriesStage] = useState<'loading' | 'ready'>('loading');
  const [trainerStage, setTrainerStage] = useState<'loading' | 'ready'>('loading');
  const [drilldownStage, setDrilldownStage] = useState<'loading' | 'ready'>('loading');

  const [lazyMatrices, setLazyMatrices] = useState<Set<string>>(new Set());
  const [matrixStage, setMatrixStage] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    const matrixKey = `matrix_${tab}_${subView}`;
    setLazyMatrices(prev => {
      if (!prev.has(matrixKey)) {
        const next = new Set(prev);
        next.add(matrixKey);
        return next;
      }
      return prev;
    });
  }, [tab, subView]);

  const renderPerformanceCell = (data: any, keyVal: string, tabType: string = 'IP') => {
    if (!data || (tabType === 'IP' ? data.total === 0 : data.count === 0)) return <td key={keyVal} className="td-empty">—</td>;

    if (tabType === 'IP') {
      return (
        <td key={keyVal} className="td-center" title={`>90%: ${data.elite}\n75–90%: ${data.high}\n50–75%: ${data.medium}\n<50%: ${data.low}`}>
          <div className="performance-cell-container">
            <span className="performance-elite">{data.elite}</span>
            <span className="performance-sep">/</span>
            <span className="performance-high">{data.high}</span>
            <span className="performance-sep">/</span>
            <span className="performance-med">{data.medium}</span>
            <span className="performance-sep">/</span>
            <span className="performance-low">{data.low}</span>
          </div>
        </td>
      );
    }

    if (tabType === 'AP') {
      return (
        <td key={keyVal} className="td-center">
          <div className="flex flex-col items-center gap-0.5">
            <div className={`text-xs-bold ${flagClass(flagScore(data.avgKnowledge))}`} style={{ background: 'transparent', padding: 0 }}>K: {Math.round(data.avgKnowledge)}</div>
            <div className={`text-xs-bold ${flagClass(flagScore(data.avgBSE))}`} style={{ background: 'transparent', padding: 0 }}>B: {Math.round(data.avgBSE)}</div>
          </div>
        </td>
      );
    }

    if (tabType === 'MIP') {
      return (
        <td key={keyVal} className="td-center">
          <div className="flex flex-col items-center gap-0.5">
            <div className={`text-xs-bold ${flagClass(flagScore(data.avgScience))}`} style={{ background: 'transparent', padding: 0 }}>Sci: {Math.round(data.avgScience)}</div>
            <div className={`text-xs-bold ${flagClass(flagScore(data.avgSkill))}`} style={{ background: 'transparent', padding: 0 }}>Skl: {Math.round(data.avgSkill)}</div>
          </div>
        </td>
      );
    }

    return <td key={keyVal} />;
  };

  const getPercent = (part: number, total: number) => {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  };

  const renderSummaryPercent = (part: number, total: number, threshold?: number, colorClass?: string) => {
    if (!total) return <td className="td-empty">—</td>;
    const pct = Math.round((part / total) * 100);
    const finalClass = (threshold && pct >= threshold) ? `td-center ${colorClass}` : 'td-center';
    return <td className={finalClass}>{pct}%</td>;
  };

  const selectedFY = globalFilters.fiscalYear;

  useEffect(() => {
    if (tab === 'IP') {
      if (!['ip_matrix', 'gap', 'timeseries', 'trainer', 'ip_team_rank'].includes(subView)) {
        setSubView('ip_matrix');
      }
    } else if (tab === 'AP') {
      if (!['ap_performance', 'gap', 'timeseries', 'trainer', 'drilldown'].includes(subView)) {
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

  // Moved after usePerformanceData to use rawUnified source of truth
  // const { allTeams, allTrainers } = useFilterOptions(employees, attendance, tab, masterTeams, masterTrainers);
  // const allClusters = useMemo(() => masterClusters.map(c => c.name), [masterClusters]);

  const handleGlobalApply = useCallback((f: GlobalFilters) => {
    setPageFilters(f);
    setFilter(prev => ({
      ...prev,
      clusters: f.cluster ? [f.cluster] : [],
      teams: f.team ? [f.team] : [],
      trainer: f.trainer,
      monthFrom: f.month,
      monthTo: f.month
    }));
  }, []);

  const handleGlobalClear = useCallback(() => {
    setPageFilters(INITIAL_FILTERS);
    setFilter({ monthFrom: '', monthTo: '', teams: [], clusters: [], trainer: '' });
  }, []);

  const {
    months: MONTHS = [],
    unified = [],
    rawUnified = [],
    apAttData: apData = null,
    mipAttData: mipAttendanceData = null,
    refresherAttData = null,
    capsuleAttData = null,
    apPerfData = null,
    mipPerfData = null,
    refresherPerfData = null,
    capsulePerfData = null,
    eligibilityResults = [],
    gapMetrics = { details: [] },
    groups = [],
    ranked = [],
    trainerStats = [],
    drilldownNodes = [],
    timeSeries = [],
    ipData = null,
    ipRankData = null,
    executiveKPIs = null,
    apExecutiveKPIs = null,
    mipExecutiveKPIs = null,
    refresherKPI = null,
    capsuleKPI = null,
    overviewSummary = []
  } = usePerformanceData({
    tab, selectedFY, filter, viewBy, tsMode, pageMode,
    employees, attendance, scores, nominations
  });

  console.log("TABLE DATA:", rawUnified?.length);
  const { allClusters, allTeams, allTrainers } = useFilterOptions(rawUnified || [], attendance || [], tab, masterTrainers, pageFilters.clusters || []);
  const gapDetails = gapMetrics?.details || [];

  const toggleExpand = useCallback((k: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      const exists = next.has(k);
      if (exists) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
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
  }, [unified, tab]);

  useEffect(() => {
    setKpiStage('loading');
    setGroupedStage('loading');
    setTimeseriesStage('loading');
    setTrainerStage('loading');
    setDrilldownStage('loading');
    setMatrixStage('loading');

    if (!unified || unified.length === 0) return;

    const cleanups: Array<(() => void) | undefined> = [];

    const cleanup0 = scheduleIdle(
      () => ({}),
      () => setKpiStage('ready'),
      1, true
    );
    if (cleanup0) cleanups.push(cleanup0);

    const cleanup1 = scheduleIdle(
      () => (subView === 'grouped' && ranked.length > 0 ? { ranked } : {}),
      () => setGroupedStage('ready'),
      20, true
    );
    if (cleanup1) cleanups.push(cleanup1);

    const cleanup2 = scheduleIdle(
      () => (subView === 'timeseries' && timeSeries.length > 0 ? { timeSeries } : {}),
      () => setTimeseriesStage('ready'),
      40, true
    );
    if (cleanup2) cleanups.push(cleanup2);

    const cleanup3 = scheduleIdle(
      () => (subView === 'trainer' && trainerStats.length > 0 ? { trainerStats } : {}),
      () => setTrainerStage('ready'),
      60, true
    );
    if (cleanup3) cleanups.push(cleanup3);

    const cleanup4 = scheduleIdle(
      () => (subView === 'drilldown' && drilldownNodes.length > 0 ? { drilldownNodes } : {}),
      () => setDrilldownStage('ready'),
      80, true
    );
    if (cleanup4) cleanups.push(cleanup4);

    const matrixKey = `matrix_${tab}_${subView}`;
    if (lazyMatrices.has(matrixKey)) {
      const cleanup5 = scheduleIdle(
        () => ({}),
        () => setMatrixStage('ready'),
        100, true
      );
      if (cleanup5) cleanups.push(cleanup5);
    }

    return () => {
      cleanups.forEach(c => {
        if (typeof c === 'function') {
          try {
            c();
          } catch (e) {
            console.error('Cleanup error:', e);
          }
        }
      });
    };
  }, [
    // Stable primitives instead of object arrays
    unified?.length || 0,
    tab,
    subView,
    lazyMatrices?.size || 0,
    ranked?.length || 0,
    drilldownNodes?.length || 0,
    timeSeries?.length || 0,
    trainerStats?.length || 0,
    gapMetrics?.details?.length || 0
  ]);

  const KPISkeletons = () => (
    <div className="dashboard-grid mb-24">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass-panel skeleton-box" />
      ))}
    </div>
  );

  const TableSkeleton = () => (
    <div className="glass-panel skeleton-container">
      <div className="skeleton-header" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );

  const MatrixSkeleton = () => (
    <div className="glass-panel skeleton-container skeleton-scroll">
      <div className="skeleton-matrix-box" />
    </div>
  );

  if (pageMode === 'overview') {
    const TYPE_CONFIG: Record<string, { accent: string; label: string }> = {
      IP:        { accent: '#3B82F6', label: 'Induction Program' },
      AP:        { accent: '#10B981', label: 'Advanced Program' },
      MIP:       { accent: '#F59E0B', label: 'Management Induction' },
      Refresher: { accent: '#8B5CF6', label: 'Refresher Training' },
      Capsule:   { accent: '#06B6D4', label: 'Capsule Training' },
      'Pre-AP':  { accent: '#6366F1', label: 'Pre-Advanced Program' },
    };

    const totalBatches    = overviewSummary.reduce((acc: number, curr: any) => acc + curr.batches, 0);
    const totalCandidates = overviewSummary.reduce((acc: number, curr: any) => acc + curr.candidates, 0);

    return (
      <div className="ov-page animate-fade-in">

        {/* ── PAGE HEADER ─────────────────────────────────── */}
        <div className="ov-header">
          <div>
            <h1 className="ov-heading">Executive Training Summary</h1>
            <p className="ov-subheading">High-level training volume and coverage overview</p>
          </div>
        </div>

        {/* ── TOTAL IMPACT STRIP ──────────────────────────── */}
        <div className="ov-section-label">ORGANIZATION IMPACT</div>
        <div className="ov-impact-strip">
          <div className="ov-impact-block ov-impact-blue">
            <div className="ov-impact-value">{totalBatches}</div>
            <div className="ov-impact-label">Total Training Batches</div>
          </div>
          <div className="ov-impact-divider" />
          <div className="ov-impact-block ov-impact-emerald">
            <div className="ov-impact-value">{totalCandidates}</div>
            <div className="ov-impact-label">Total Candidates Attended</div>
          </div>
        </div>

        {/* ── TRAINING TYPE CARDS ─────────────────────────── */}
        <div className="ov-grid">
          {overviewSummary.map((item: any, idx: number) => {
            const cfg = TYPE_CONFIG[item.type] || { accent: '#94A3B8', label: item.type };
            return (
              <motion.div
                key={item.type}
                className="ov-card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.04 }}
                style={{ '--card-accent': cfg.accent } as React.CSSProperties}
              >
                {/* Left accent bar */}
                <div className="ov-card-accent" />

                {/* Card body */}
                <div className="ov-card-body">
                  {/* Top row */}
                  <div className="ov-card-top">
                    <div>
                      <div className="ov-card-type">{item.type}</div>
                      <div className="ov-card-label">{cfg.label}</div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="ov-card-metrics">
                    <div className="ov-metric">
                      <div className="ov-metric-value">{item.batches}</div>
                      <div className="ov-metric-label">Batches</div>
                    </div>
                    <div className="ov-metric-divider" />
                    <div className="ov-metric">
                      <div className="ov-metric-value">{item.candidates}</div>
                      <div className="ov-metric-label">Candidates</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Page Identity */}
      <div className="mb-24">
        <h1 className="text-2xl font-bold m-0">
          {pageMode === 'performance-insights' ? 'Performance Insights' : 'Overview'}
        </h1>
        <p className="text-subtitle">
          {pageMode === 'performance-insights'
            ? 'Detailed training performance analysis and rankings'
            : 'Training performance snapshot and trends'}
        </p>
      </div>

      {/* Controls Header */}
      <div className="header mb-20">
        <div className="flex"></div>
        <div className="flex-center gap-2">
          {/* Executive View Switcher */}
          <div className="flex-center gap-1 bg-glass-dark p-1 rounded-lg">
            {/* 1. TABLE VIEW (All Types) */}
            <button 
              className={`btn btn-sm ${
                (subView === 'ip_matrix' || subView === 'ap_performance' || subView === 'mip_performance' || subView === 'grouped' || subView === 'refresher_performance' || subView === 'capsule_performance') 
                ? 'btn-primary' : 'btn-secondary'
              }`}
              onClick={() => {
                if (tab === 'IP') setSubView('ip_matrix');
                else if (tab === 'AP') setSubView('ap_performance');
                else if (tab === 'MIP') setSubView('mip_performance');
                else if (tab === 'Refresher') setSubView('refresher_performance');
                else if (tab === 'Capsule') setSubView('capsule_performance');
                else setSubView('grouped');
              }}
              title="Matrix Table View"
            >
              <Table size={14} className="mr-1" /> Table
            </button>

            {/* 2. RANK VIEW (IP Only) */}
            {tab === 'IP' && (
              <button 
                className={`btn btn-sm ${subView === 'ip_team_rank' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSubView('ip_team_rank')}
                title="Performance Ranking"
              >
                <Trophy size={14} className="mr-1" /> Rank
              </button>
            )}

            {/* 3. CHART VIEW (IP, AP, MIP) */}
            {['IP', 'AP', 'MIP'].includes(tab) && (
              <button 
                className="btn btn-sm btn-secondary"
                onClick={() => onNavigate?.('performance-charts')}
                title="Visual Analytics"
              >
                <BarChart3 size={14} className="mr-1" /> Chart
              </button>
            )}

            {/* Special Case: Attendance Funnels for Refresher/Capsule */}
            {(tab === 'Refresher' || tab === 'Capsule') && (
              <button 
                className={`btn btn-sm ${
                  (subView === 'refresher_attendance' || subView === 'capsule_attendance') 
                  ? 'btn-primary' : 'btn-secondary'
                }`}
                onClick={() => {
                  if (tab === 'Refresher') setSubView('refresher_attendance');
                  else setSubView('capsule_attendance');
                }}
                title="Attendance Funnel"
              >
                <Users size={14} className="mr-1" /> Attendance
              </button>
            )}
          </div>

          <div className="v-divider mx-1" />
          <button className="btn btn-secondary" onClick={handleExport} title="Export CSV"><Download size={16} /></button>
        </div>
      </div>

      {/* View By Switcher removed as per request */}


      {/* KPI Cards */}
      {kpiStage === 'loading' ? (
        <KPISkeletons />
      ) : (


        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <div className="dashboard-grid mb-24">
            {subView === 'gap' ? (
              <Fragment>
                <KPIBox title="Eligible Cohort" value={gapMetrics.eligibleCount} icon={ShieldCheck} />
                <KPIBox title="Trained Volume" value={gapMetrics.trainedCount} color="var(--success)" icon={CheckCircle2} />
                <KPIBox title="Training Gap" value={gapMetrics.gapCount} color="var(--danger)" icon={AlertTriangle} subValue={`${((gapMetrics.gapCount / (gapMetrics.eligibleCount || 1)) * 100).toFixed(1)}% untrained`} />
              </Fragment>
            ) : (
              <Fragment>
                {tab === 'IP' && executiveKPIs && (
                  <Fragment>
                    {/* CARD 1: ELITE CANDIDATES */}
                    <div className="glass-panel" style={{ padding: '16px', background: 'var(--indigo-light, rgba(99, 102, 241, 0.04))', borderLeft: '4px solid #6366f1' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                        Elite Candidates
                      </div>
                      <div style={{ fontSize: '32px', fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>
                        {executiveKPIs.eliteCount.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '10px' }}>
                        <span style={{ fontWeight: 700, color: '#6366f1' }}>{executiveKPIs.eliteRatio.toFixed(1)}%</span> of Total Candidates
                      </div>
                    </div>

                    {/* CARD 2: LOW CANDIDATES */}
                    <div className="glass-panel" style={{ padding: '16px', background: 'var(--amber-light, rgba(245, 158, 11, 0.04))', borderLeft: '4px solid #f59e0b' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                        Low Candidates
                      </div>
                      <div style={{ fontSize: '32px', fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>
                        {executiveKPIs.lowCount.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '10px' }}>
                        <span style={{ fontWeight: 700, color: '#f59e0b' }}>{executiveKPIs.lowRatio.toFixed(1)}%</span> of Total Candidates
                      </div>
                    </div>

                    {/* CARD 3: ELITE DISTRIBUTION */}
                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                        Elite Distribution
                      </div>
                      <div className="flex gap-1" style={{ background: 'rgba(0,0,0,0.05)', padding: '2px', borderRadius: '6px' }}>
                        <div style={{ flex: 1, background: '#fff', padding: '8px 12px', borderRadius: '4px' }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Highest Elite</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', margin: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={executiveKPIs.highestElite.name}>
                            {executiveKPIs.highestElite.name}
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#6366f1' }}>{executiveKPIs.highestElite.elitePct.toFixed(1)}%</div>
                        </div>
                        <div style={{ flex: 1, background: '#fff', padding: '8px 12px', borderRadius: '4px', textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Lowest Elite</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', margin: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={executiveKPIs.lowestElite.name}>
                            {executiveKPIs.lowestElite.name}
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#6366f1' }}>{executiveKPIs.lowestElite.elitePct.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>

                    {/* CARD 4: LOW DISTRIBUTION */}
                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                        Low Distribution
                      </div>
                      <div className="flex gap-1" style={{ background: 'rgba(0,0,0,0.05)', padding: '2px', borderRadius: '6px' }}>
                        <div style={{ flex: 1, background: '#fff', padding: '8px 12px', borderRadius: '4px' }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Lowest Low</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', margin: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={executiveKPIs.lowestLow.name}>
                            {executiveKPIs.lowestLow.name}
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#f59e0b' }}>{executiveKPIs.lowestLow.lowPct.toFixed(1)}%</div>
                        </div>
                        <div style={{ flex: 1, background: '#fff', padding: '8px 12px', borderRadius: '4px', textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Highest Low</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', margin: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={executiveKPIs.highestLow.name}>
                            {executiveKPIs.highestLow.name}
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#f59e0b' }}>{executiveKPIs.highestLow.lowPct.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>
                  </Fragment>
                )}
                {tab === 'AP' && apExecutiveKPIs && (
                  <Fragment>
                    {/* CARD 1: TRAINING VOLUME */}
                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                        Training Volume
                      </div>
                      <div className="flex gap-1" style={{ background: 'rgba(0,0,0,0.05)', padding: '2px', borderRadius: '6px' }}>
                        <div style={{ flex: 1, background: '#fff', padding: '8px 12px', borderRadius: '4px' }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Highest Batches</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', margin: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={apExecutiveKPIs.highestBatches.name}>
                            {apExecutiveKPIs.highestBatches.name}
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#6366f1' }}>
                            {apExecutiveKPIs.highestBatches.batches} <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Batches</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{apExecutiveKPIs.highestBatches.candidates} Candidates</div>
                        </div>
                        <div style={{ flex: 1, background: '#fff', padding: '8px 12px', borderRadius: '4px', textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Highest Candidates</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', margin: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={apExecutiveKPIs.highestCandidates.name}>
                            {apExecutiveKPIs.highestCandidates.name}
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#6366f1' }}>
                            {apExecutiveKPIs.highestCandidates.candidates} <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Candidates</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{apExecutiveKPIs.highestCandidates.batches} Batches</div>
                        </div>
                      </div>
                    </div>

                    {/* CARD 2: TEST SCORE DISTRIBUTION */}
                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                        Test Score Distribution
                      </div>
                      <div className="flex gap-1" style={{ background: 'rgba(0,0,0,0.05)', padding: '2px', borderRadius: '6px' }}>
                        <div style={{ flex: 1, background: '#fff', padding: '8px 12px', borderRadius: '4px' }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Highest Test Score</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', margin: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={apExecutiveKPIs.highestTest.name}>
                            {apExecutiveKPIs.highestTest.name}
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#6366f1' }}>{apExecutiveKPIs.highestTest.score.toFixed(1)}%</div>
                        </div>
                        <div style={{ flex: 1, background: '#fff', padding: '8px 12px', borderRadius: '4px', textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Lowest Test Score</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', margin: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={apExecutiveKPIs.lowestTest.name}>
                            {apExecutiveKPIs.lowestTest.name}
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#6366f1' }}>{apExecutiveKPIs.lowestTest.score.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>

                    {/* CARD 3: BSE SCORE DISTRIBUTION */}
                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                        BSE Score Distribution
                      </div>
                      <div className="flex gap-1" style={{ background: 'rgba(0,0,0,0.05)', padding: '2px', borderRadius: '6px' }}>
                        <div style={{ flex: 1, background: '#fff', padding: '8px 12px', borderRadius: '4px' }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Highest BSE Score</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', margin: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={apExecutiveKPIs.highestBSE.name}>
                            {apExecutiveKPIs.highestBSE.name}
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#6366f1' }}>{apExecutiveKPIs.highestBSE.score.toFixed(1)}%</div>
                        </div>
                        <div style={{ flex: 1, background: '#fff', padding: '8px 12px', borderRadius: '4px', textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Lowest BSE Score</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', margin: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={apExecutiveKPIs.lowestBSE.name}>
                            {apExecutiveKPIs.lowestBSE.name}
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#6366f1' }}>{apExecutiveKPIs.lowestBSE.score.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>
                  </Fragment>
                )}

                {tab === 'MIP' && mipExecutiveKPIs && (
                  <Fragment>
                    {/* CARD 1: HIGHEST PARTICIPATION */}
                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                        Highest Team Participation
                      </div>
                      <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{mipExecutiveKPIs.highestTeam.name}</div>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#6366f1', margin: '4px 0' }}>{mipExecutiveKPIs.highestTeam.total} <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>Candidates</span></div>
                        
                        <div style={{ marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Bifurcation</div>
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between" style={{ fontSize: '11px', color: '#475569' }}>
                              <span>DM:</span>
                              <span style={{ fontWeight: 700 }}>{mipExecutiveKPIs.highestTeam.bifurcation.dm}</span>
                            </div>
                            <div className="flex justify-between" style={{ fontSize: '11px', color: '#475569' }}>
                              <span>RSM:</span>
                              <span style={{ fontWeight: 700 }}>{mipExecutiveKPIs.highestTeam.bifurcation.rsm}</span>
                            </div>
                            <div className="flex justify-between" style={{ fontSize: '11px', color: '#475569' }}>
                              <span>DSM:</span>
                              <span style={{ fontWeight: 700 }}>{mipExecutiveKPIs.highestTeam.bifurcation.dsm}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CARD 2: LOWEST PARTICIPATION */}
                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                        Lowest Team Participation
                      </div>
                      <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{mipExecutiveKPIs.lowestTeam.name}</div>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b', margin: '4px 0' }}>{mipExecutiveKPIs.lowestTeam.total} <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>Candidates</span></div>
                        
                        <div style={{ marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Bifurcation</div>
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between" style={{ fontSize: '11px', color: '#475569' }}>
                              <span>DM:</span>
                              <span style={{ fontWeight: 700 }}>{mipExecutiveKPIs.lowestTeam.bifurcation.dm}</span>
                            </div>
                            <div className="flex justify-between" style={{ fontSize: '11px', color: '#475569' }}>
                              <span>RSM:</span>
                              <span style={{ fontWeight: 700 }}>{mipExecutiveKPIs.lowestTeam.bifurcation.rsm}</span>
                            </div>
                            <div className="flex justify-between" style={{ fontSize: '11px', color: '#475569' }}>
                              <span>DSM:</span>
                              <span style={{ fontWeight: 700 }}>{mipExecutiveKPIs.lowestTeam.bifurcation.dsm}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CARD 3: TOTAL MANAGERS ATTENDED */}
                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                        Total Managers Attended
                      </div>
                      <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#8b5cf6', margin: '4px 0' }}>{mipExecutiveKPIs.totalManagers.total} <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>Managers</span></div>
                        
                        <div style={{ marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Bifurcation</div>
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between" style={{ fontSize: '11px', color: '#475569' }}>
                              <span>DM:</span>
                              <span style={{ fontWeight: 700 }}>{mipExecutiveKPIs.totalManagers.bifurcation.dm}</span>
                            </div>
                            <div className="flex justify-between" style={{ fontSize: '11px', color: '#475569' }}>
                              <span>RSM:</span>
                              <span style={{ fontWeight: 700 }}>{mipExecutiveKPIs.totalManagers.bifurcation.rsm}</span>
                            </div>
                            <div className="flex justify-between" style={{ fontSize: '11px', color: '#475569' }}>
                              <span>DSM:</span>
                              <span style={{ fontWeight: 700 }}>{mipExecutiveKPIs.totalManagers.bifurcation.dsm}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
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
                    <KPIBox title="Avg Science" value={(refresherPerfData.globalKPIs.avgScience || 0).toFixed(1)} color="var(--success)" badge={refresherPerfData.globalKPIs.avgScience > 0 ? <span className={`badge ${flagClass(flagScore(refresherPerfData.globalKPIs.avgScience))}`}>Sci</span> : undefined} />
                    <KPIBox title="Avg Skill" value={(refresherPerfData.globalKPIs.avgSkill || 0).toFixed(1)} color="var(--warning)" badge={refresherPerfData.globalKPIs.avgSkill > 0 ? <span className={`badge ${flagClass(flagScore(refresherPerfData.globalKPIs.avgSkill))}`}>Skl</span> : undefined} />
                    <KPIBox title="High Performers" value={`${(refresherPerfData.globalKPIs.highPerformersPct || 0).toFixed(1)}%`} color="var(--accent-primary)" icon={Trophy} />
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
                    <KPIBox title="Avg Score" value={(capsulePerfData.globalKPIs.avgScore || 0).toFixed(1)} color="var(--success)" badge={capsulePerfData.globalKPIs.avgScore > 0 ? <span className={`badge ${flagClass(flagScore(capsulePerfData.globalKPIs.avgScore))}`}>Score</span> : undefined} />
                    <KPIBox title="High Performers" value={`${(capsulePerfData.globalKPIs.highPerformersPct || 0).toFixed(1)}%`} color="var(--accent-primary)" icon={Trophy} />
                  </Fragment>
                )}

              </Fragment>
            )}
          </div>
        </motion.div>
      )}


      {/* Insight Strip removed as per request */}


      {/* Top / Bottom 3 */}
      {subView === 'grouped' && tab !== 'IP' && tab !== 'AP' && tab !== 'MIP' && ranked.length > 3 && (
        <div className="grid-2 mb-24">
          <div className="glass-panel p-20 rank-card-success">
            <div className="flex-center mb-4 text-success-bold uppercase"><Trophy size={18} className="mr-2" />Top Performance</div>
            {ranked.slice(0, 3).map(g => <div key={g.key} className="rank-item">#{g.rank} <strong>{g.key}</strong> — {g.metric.toFixed(1)}</div>)}
          </div>
          <div className="glass-panel p-20 rank-card-danger">
            <div className="flex-center mb-4 text-danger-bold uppercase"><AlertTriangle size={18} className="mr-2" />Needs Attention</div>
            {ranked.slice(-3).reverse().map(g => <div key={g.key} className="rank-item">#{g.rank} <strong>{g.key}</strong> — {g.metric.toFixed(1)}</div>)}
          </div>
        </div>
      )}

      {/* --- MATRIX ENGINE --- */}
      {((subView === 'ip_matrix' && tab === 'IP') || 
        (subView === 'ap_performance' && tab === 'AP') || 
        (subView === 'mip_performance' && tab === 'MIP')) && (
        (tab === 'IP' ? ipData : (tab === 'AP' ? apPerfData : mipPerfData)) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="glass-panel overflow-hidden mb-24">
              <div className="card-header">
                <h3 className="text-lg m-0">Cluster → Team → Month Matrix Engine</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th className="w-40"></th>
                      <th>Cluster / Team</th>
                      <th className="td-center">Total</th>
                      {tab === 'IP' && (
                        <Fragment>
                          <th className="td-center">Elite %</th>
                          <th className="td-center">High %</th>
                          <th className="td-center">Medium %</th>
                          <th className="td-center">Low %</th>
                        </Fragment>
                      )}
                      {tab === 'AP' && (
                        <Fragment>
                          <th className="td-center">Average Test Score</th>
                          <th className="td-center">Average BSE Score</th>
                        </Fragment>
                      )}
                      {tab === 'MIP' && (
                        <Fragment>
                          <th className="td-center">Avg Science Score</th>
                          <th className="td-center">Avg Skill Score</th>
                        </Fragment>
                      )}
                      {MONTHS.map(mo => <th key={mo} className="td-center min-w-90">{formatMonthLabel(mo)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      tab === 'IP' ? ipData.clusterMonthMap : 
                      tab === 'AP' ? apPerfData.clusterMap : 
                      mipPerfData.clusterMap
                    ).map(([cluster, cData]: [string, any]) => (
                      <Fragment key={cluster}>
                        <tr className="row-group-header">
                          <td onClick={() => toggleExpand(cluster)} className="cursor-pointer">
                            {expanded.has(cluster) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </td>
                          <td className="font-bold">{cluster}</td>
                          <td className="td-center">{cData.total}</td>
                          
                          {tab === 'IP' && (
                            <Fragment>
                              {renderSummaryPercent(cData.elite, cData.total, 10, 'text-success-bold')}
                              {renderSummaryPercent(cData.high, cData.total, 30, 'text-success-bold')}
                              {renderSummaryPercent(cData.medium, cData.total)}
                              {renderSummaryPercent(cData.low, cData.total, 30, 'text-danger-bold')}
                            </Fragment>
                          )}
                          {tab === 'AP' && (
                            <Fragment>
                              <td className="td-center font-bold">{(cData.avgKnowledge || 0).toFixed(1)}%</td>
                              <td className="td-center font-bold">{(cData.avgBSE || 0).toFixed(1)}%</td>
                            </Fragment>
                          )}
                          {tab === 'MIP' && (
                            <Fragment>
                              <td className="td-center font-bold">{(cData.avgScience || 0).toFixed(1)}%</td>
                              <td className="td-center font-bold">{(cData.avgSkill || 0).toFixed(1)}%</td>
                            </Fragment>
                          )}

                          {MONTHS.map(mo => renderPerformanceCell(cData.months[mo], `${cluster}_${mo}`, tab))}
                        </tr>
                        {expanded.has(cluster) && Object.entries(
                          (tab === 'IP' ? ipData.teamMonthMap[cluster] : 
                           (tab === 'AP' ? apPerfData.clusterMap[cluster].teams : 
                            mipPerfData.clusterMap[cluster].teams)) || {}
                        ).map(([team, tData]: [string, any]) => (
                          <tr key={team} className="row-child">
                            <td />
                            <td className="pl-24">{team}</td>
                            <td className="td-center">{tData.total}</td>
                            
                            {tab === 'IP' && (
                              <Fragment>
                                {renderSummaryPercent(tData.elite, tData.total)}
                                {renderSummaryPercent(tData.high, tData.total)}
                                {renderSummaryPercent(tData.medium, tData.total)}
                                {renderSummaryPercent(tData.low, tData.total)}
                              </Fragment>
                            )}
                            {tab === 'AP' && (
                              <Fragment>
                                <td className="td-center font-bold">{(tData.avgKnowledge || 0).toFixed(1)}%</td>
                                <td className="td-center font-bold">{(tData.avgBSE || 0).toFixed(1)}%</td>
                              </Fragment>
                            )}
                            {tab === 'MIP' && (
                              <Fragment>
                                <td className="td-center font-bold">{(tData.avgScience || 0).toFixed(1)}%</td>
                                <td className="td-center font-bold">{(tData.avgSkill || 0).toFixed(1)}%</td>
                              </Fragment>
                            )}

                            {MONTHS.map(mo => renderPerformanceCell(tData.months[mo], `${team}_${mo}`, tab))}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )
      )}

      {subView === 'ip_team_rank' && ipRankData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <div className="glass-panel overflow-hidden">
            <div className="card-header flex-between">
              <h3 className="text-lg m-0">IP Team Competition Ranking Matrix</h3>
              <div className="text-xs text-muted italic">Sorted by Cluster → Overall Rank (Most Recent Month)</div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="w-10">#</th>
                    <th>Team</th>
                    <th>Cluster</th>
                    {MONTHS.map(mo => (
                      <th key={mo} className="td-center min-w-100">{formatMonthLabel(mo)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                   {Object.entries(ipRankData.teams)
                    .sort(([, a]: [string, any], [, b]: [string, any]) => a.cluster.localeCompare(b.cluster))
                    .map(([team, tData]: [string, any], idx) => (
                      <tr key={team}>
                        <td className="text-muted">{idx + 1}</td>
                        <td className="font-bold">{team}</td>
                        <td><span className="badge badge-secondary">{tData.cluster}</span></td>
                        {MONTHS.map(mo => {
                          const mData = tData.months[mo];
                          if (!mData) return <td key={mo} className="td-center text-muted">—</td>;
                          const isTop = mData.rank <= 3;
                          const isBottom = mData.rank > 0 && mData.rank >= 15;
                          
                          return (
                            <td key={mo} className="td-center">
                              <div className="flex flex-col items-center">
                                <div className={`text-lg font-black ${isTop ? 'text-success-bold' : isBottom ? 'text-danger-bold' : ''}`}>
                                  #{mData.rank}
                                </div>
                                <div className="text-xs-bold opacity-60">
                                  {mData.score.toFixed(0)} pts
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* --- UNIVERSAL REPORTING VIEWS --- */}
      {subView === 'grouped' && tab !== 'IP' && tab !== 'AP' && tab !== 'MIP' && (
        <div className="glass-panel overflow-hidden">
          <div className="card-header flex-between">
            <h3 className="text-lg m-0">{tab === 'AP' || tab === 'MIP' || tab === 'Refresher' || tab === 'Capsule' ? 'Attendance Funnel' : 'Performance Rankings'}</h3>
            <span className="text-xs text-muted">Click headers to sort</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  {viewBy === 'Cluster' && <th className="w-40"></th>}
                  <th>Rank</th>
                  <th>{viewBy}</th>
                  <th className="td-center">Count</th>
                  <th className="td-center">Score</th>
                  <th className="td-center">Performance</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((g: any, idx) => {
                  const isExpanded = expanded.has(g.key);
                  
                  // Compute sub-groups if expanded
                  let subGroups: any[] = [];
                  if (viewBy === 'Cluster' && isExpanded) {
                    const teams = groupData(g.records, 'Team', g.nominations, employees);
                    subGroups = rankGroups(teams, tab);
                  }

                  return (
                    <Fragment key={g.key}>
                      <tr className={idx < 3 ? 'row-highlight-success' : ''}>
                        {viewBy === 'Cluster' && (
                          <td onClick={() => toggleExpand(g.key)} className="cursor-pointer">
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </td>
                        )}
                        <td>#{g.rank}</td>
                        <td className="font-bold">{g.key}</td>
                        <td className="td-center font-mono">{g.total}</td>
                        <td className="td-center font-bold">{g.metric.toFixed(1)}</td>
                        <td>
                          <ProgressBar width={g.metric} colorClass={flagClass(flagScore(g.metric))} />
                        </td>
                      </tr>
                      
                      {viewBy === 'Cluster' && isExpanded && subGroups.map((sg: any) => (
                        <tr key={sg.key} className="row-child">
                          <td />
                          <td className="text-muted td-center">—</td>
                          <td className="pl-24 text-muted">{sg.key}</td>
                          <td className="td-center font-mono">{sg.total}</td>
                          <td className="td-center font-bold">{sg.metric.toFixed(1)}</td>
                          <td>
                            <ProgressBar width={sg.metric} colorClass={flagClass(flagScore(sg.metric))} />
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
                {ranked.length === 0 && (
                  <tr><td colSpan={viewBy === 'Cluster' ? 6 : 5} className="td-center py-40 text-muted">No data for this selection</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}



    </div>
  );
};

export const ReportsAnalytics = memo(ReportsAnalyticsComponent);
