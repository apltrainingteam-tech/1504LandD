import React, { useState, useMemo, useEffect, Fragment, memo, useCallback } from 'react';
import { motion } from 'framer-motion';

import {
  Table, Calendar, GraduationCap, AlertTriangle, ChevronRight, ChevronDown,
  Trophy, Zap, ShieldCheck, CheckCircle2, ChartNetwork, Download, Filter, X, ListOrdered, BarChart3, TrendingUp, AlertCircle, Users, Bug, Search as SearchIcon,
  Activity, Star, Layers, Briefcase, BookOpen, Award
} from 'lucide-react';

import { Employee } from '../../types/employee';
import { Attendance, TrainingScore, TrainingNomination, Demographics, TrainingType } from '../../types/attendance';
import { ViewByOption, GroupedData, ReportFilter } from '../../types/reports';
import { exportToCSV, groupData, rankGroups } from '../../core/engines/reportEngine';
import { FISCAL_YEARS, getCurrentFYString, getFiscalYears, formatMonthLabel } from '../../core/utils/fiscalYear';
import { scheduleIdle } from '../../core/utils/stagedComputation';
import { KPIBox, KPISplitCard } from '../../shared/components/ui/KPIBox';
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
import { CLUSTER_ORDER, sortClusters, formatDisplayText } from '../../core/engines/normalizationEngine';
import { PerformanceCharts } from './PerformanceCharts';
import { TOE } from './TOE';
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

type SubView = 'grouped' | 'timeseries' | 'trainer' | 'drilldown' | 'gap' | 'ip_matrix' | 'ip_cluster_rank' | 'ip_team_rank' | 'ap_performance' | 'mip_attendance' | 'mip_performance' | 'refresher_attendance' | 'refresher_performance' | 'capsule_attendance' | 'capsule_performance' | 'performance_charts';

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
          <div className="performance-cell-container tabular-nums">
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
          <div className="flex flex-col items-center gap-0.5 tabular-nums" style={{ minWidth: '80px' }}>
            <div className="metric-row">
              <span className="metric-label">K</span>
              <span className={`metric-value ${flagClass(flagScore(data.avgKnowledge))}`}>{Math.round(data.avgKnowledge)}%</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">B</span>
              <span className={`metric-value ${flagClass(flagScore(data.avgBSE))}`}>{Math.round(data.avgBSE)}%</span>
            </div>
          </div>
        </td>
      );
    }

    if (tabType === 'MIP') {
      return (
        <td key={keyVal} className="td-center">
          <div className="flex flex-col items-center gap-0.5 tabular-nums" style={{ minWidth: '80px' }}>
            <div className="metric-row">
              <span className="metric-label">Sci</span>
              <span className={`metric-value ${flagClass(flagScore(data.avgScience))}`}>{Math.round(data.avgScience)}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Skl</span>
              <span className={`metric-value ${flagClass(flagScore(data.avgSkill))}`}>{Math.round(data.avgSkill)}</span>
            </div>
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
      if (!['ip_matrix', 'ip_team_rank', 'performance_charts'].includes(subView)) {
        setSubView('ip_matrix');
      }
    } else if (tab === 'AP') {
      if (!['ap_performance', 'performance_charts', 'gap', 'timeseries', 'trainer', 'drilldown'].includes(subView)) {
        setSubView('ap_performance');
      }
    } else if (tab === 'MIP') {
      if (!['mip_attendance', 'mip_performance', 'performance_charts', 'timeseries', 'trainer', 'drilldown', 'gap'].includes(subView)) {
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
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.04 }}
              >
                <KPIBox 
                  title={item.type} 
                  value={item.batches} 
                  subValue={`${item.candidates} Candidates`} 
                  badge={<span style={{fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase'}}>{cfg.label}</span>}
                />
              </motion.div>
            );
          })}
        </div>

      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ paddingTop: '24px' }}>
      {/* Header Row: Title + Controls */}
      <div className="performance-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative', zIndex: 5, overflow: 'visible', marginBottom: '64px' }}>
        <div>
          <h1 className="text-2xl font-bold m-0" style={{ color: '#1e293b' }}>
            {pageMode === 'performance-insights' ? 'Performance Insights' : 'Overview'}
          </h1>
          <p className="text-subtitle m-0" style={{ marginTop: '4px' }}>
            {pageMode === 'performance-insights'
              ? 'Detailed training performance analysis and rankings'
              : 'Training performance snapshot and trends'}
          </p>
        </div>

        <div className="flex-center gap-4">
          {/* Segmented View Switcher */}
          <div className="flex gap-1 bg-glass-dark p-1 rounded-full border border-white/5" style={{ overflow: 'visible' }}>
            {/* 1. TABLE VIEW */}
            <button 
              className={`flex-center gap-2 rounded-full text-xs font-bold transition-all ${
                (subView === 'ip_matrix' || subView === 'ap_performance' || subView === 'mip_performance' || subView === 'grouped' || subView === 'refresher_performance' || subView === 'capsule_performance') 
                ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-white'
              }`}
              onClick={() => {
                if (tab === 'IP') setSubView('ip_matrix');
                else if (tab === 'AP') setSubView('ap_performance');
                else if (tab === 'MIP') setSubView('mip_performance');
                else if (tab === 'Refresher') setSubView('refresher_performance');
                else if (tab === 'Capsule') setSubView('capsule_performance');
                else setSubView('grouped');
              }}
              style={{ border: 'none', padding: '6px 16px', minWidth: '80px' }}
            >
              <Table size={14} /> Table
            </button>

            {/* 2. RANK VIEW (IP Only) */}
            {tab === 'IP' && (
              <button 
                className={`flex-center gap-2 rounded-full text-xs font-bold transition-all ${
                  subView === 'ip_team_rank' ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-white'
                }`}
                onClick={() => setSubView('ip_team_rank')}
                style={{ border: 'none', padding: '6px 16px', minWidth: '80px' }}
              >
                <Trophy size={14} /> Rank
              </button>
            )}

            {/* 3. CHART VIEW (IP, AP, MIP) */}
            {['IP', 'AP', 'MIP'].includes(tab) && (
              <button 
                className={`flex-center gap-2 rounded-full text-xs font-bold transition-all ${
                  subView === 'performance_charts' ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-white'
                }`}
                onClick={() => setSubView('performance_charts')}
                style={{ border: 'none', padding: '6px 16px', minWidth: '80px' }}
              >
                <BarChart3 size={14} /> Chart
              </button>
            )}

            {/* Attendance Funnel (Refresher/Capsule) */}
            {(tab === 'Refresher' || tab === 'Capsule') && (
              <button 
                className={`flex-center gap-2 rounded-full text-xs font-bold transition-all ${
                  (subView === 'refresher_attendance' || subView === 'capsule_attendance') 
                  ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-white'
                }`}
                onClick={() => {
                  if (tab === 'Refresher') setSubView('refresher_attendance');
                  else setSubView('capsule_attendance');
                }}
                style={{ border: 'none', padding: '6px 16px', minWidth: '100px' }}
              >
                <Users size={14} /> Attendance
              </button>
            )}
          </div>

          <button 
            className="flex-center" 
            style={{ 
              height: '32px', 
              width: '32px', 
              padding: 0, 
              borderRadius: '50%', 
              border: 'none', 
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }} 
            onMouseOver={(e) => e.currentTarget.style.color = '#6366f1'}
            onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
            onClick={handleExport} 
            title="Export CSV"
          >
            <Download size={16} />
          </button>
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
          <div className="performance-cards-grid dashboard-grid gap-8 mb-12 items-stretch" style={{ position: 'relative', zIndex: 1, height: 'auto' }}>
            {subView === 'gap' ? (
              <Fragment>
                <KPIBox title="Eligible Cohort" value={gapMetrics.eligibleCount} icon={ShieldCheck} />
                <KPISplitCard 
                  title="Training Progress"
                  leftLabel="Trained"
                  leftValue={gapMetrics.trainedCount}
                  leftSubValue={<span style={{ color: 'var(--success)', fontWeight: 600 }}>{((gapMetrics.trainedCount / (gapMetrics.eligibleCount || 1)) * 100).toFixed(1)}%</span>}
                  rightLabel="Gap"
                  rightValue={gapMetrics.gapCount}
                  rightSubValue={<span style={{ color: 'var(--danger)', fontWeight: 600 }}>{((gapMetrics.gapCount / (gapMetrics.eligibleCount || 1)) * 100).toFixed(1)}%</span>}
                  icon={Activity}
                />
              </Fragment>
            ) : (
              <Fragment>
                {tab === 'IP' && executiveKPIs && (
                  <Fragment>
                    <KPIBox 
                      title="Elite Candidates" 
                      value={executiveKPIs.eliteCount.toLocaleString()} 
                      subValue={<><span style={{ fontWeight: 600, color: '#4F8EF7' }}>{executiveKPIs.eliteRatio.toFixed(1)}%</span> of Total</>} 
                      icon={Star}
                    />
                    <KPIBox 
                      title="Low Candidates" 
                      value={executiveKPIs.lowCount.toLocaleString()} 
                      subValue={<><span style={{ fontWeight: 600, color: '#F59E0B' }}>{executiveKPIs.lowRatio.toFixed(1)}%</span> of Total</>} 
                      icon={AlertCircle}
                    />
                    <KPISplitCard 
                      title="Elite Performance Distribution"
                      leftLabel={formatDisplayText("Highest Elite")}
                      leftValue={`${executiveKPIs.highestElite.elitePct.toFixed(1)}%`}
                      leftSubValue={formatDisplayText(executiveKPIs.highestElite.name)}
                      rightLabel={formatDisplayText("Lowest Elite")}
                      rightValue={`${executiveKPIs.lowestElite.elitePct.toFixed(1)}%`}
                      rightSubValue={formatDisplayText(executiveKPIs.lowestElite.name)}
                      icon={Layers}
                    />
                    <KPISplitCard 
                      title="Low Performance Distribution"
                      leftLabel={formatDisplayText("Lowest Low")}
                      leftValue={`${executiveKPIs.lowestLow.lowPct.toFixed(1)}%`}
                      leftSubValue={formatDisplayText(executiveKPIs.lowestLow.name)}
                      rightLabel={formatDisplayText("Highest Low")}
                      rightValue={`${executiveKPIs.highestLow.lowPct.toFixed(1)}%`}
                      rightSubValue={formatDisplayText(executiveKPIs.highestLow.name)}
                      icon={Layers}
                    />
                  </Fragment>
                )}

                {tab === 'AP' && apExecutiveKPIs && (
                  <Fragment>
                    <KPISplitCard 
                      title="Training Volume Distribution"
                      leftLabel={formatDisplayText("Highest Batches")}
                      leftValue={apExecutiveKPIs.highestBatches.batches}
                      leftSubValue={formatDisplayText(apExecutiveKPIs.highestBatches.name)}
                      rightLabel={formatDisplayText("Highest Candidates")}
                      rightValue={apExecutiveKPIs.highestCandidates.candidates}
                      rightSubValue={formatDisplayText(apExecutiveKPIs.highestCandidates.name)}
                      icon={BookOpen}
                    />
                    <KPISplitCard 
                      title="Test Score Distribution"
                      leftLabel={formatDisplayText("Highest Score")}
                      leftValue={`${apExecutiveKPIs.highestTest.score.toFixed(1)}%`}
                      leftSubValue={formatDisplayText(apExecutiveKPIs.highestTest.name)}
                      rightLabel={formatDisplayText("Lowest Score")}
                      rightValue={`${apExecutiveKPIs.lowestTest.score.toFixed(1)}%`}
                      rightSubValue={formatDisplayText(apExecutiveKPIs.lowestTest.name)}
                      icon={GraduationCap}
                    />
                    <KPISplitCard 
                      title="BSE Score Distribution"
                      leftLabel={formatDisplayText("Highest Score")}
                      leftValue={`${apExecutiveKPIs.highestBSE.score.toFixed(1)}%`}
                      leftSubValue={formatDisplayText(apExecutiveKPIs.highestBSE.name)}
                      rightLabel={formatDisplayText("Lowest Score")}
                      rightValue={`${apExecutiveKPIs.lowestBSE.score.toFixed(1)}%`}
                      rightSubValue={formatDisplayText(apExecutiveKPIs.lowestBSE.name)}
                      icon={Activity}
                    />
                  </Fragment>
                )}

                {tab === 'MIP' && mipExecutiveKPIs && (
                  <Fragment>
                    <KPISplitCard 
                      title="Participation Distribution"
                      leftLabel={formatDisplayText("Highest Team")}
                      leftValue={
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                          <span style={{ fontSize: '48px', fontWeight: 600, color: '#0F172A' }}>{mipExecutiveKPIs.highestTeam.total}</span>
                          <span style={{ fontSize: '26px', fontWeight: 500, color: '#64748B' }}>{formatDisplayText(mipExecutiveKPIs.highestTeam.name)}</span>
                        </div>
                      }
                      leftSubValue={
                        <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, letterSpacing: '0.02em' }}>
                          DM: {mipExecutiveKPIs.highestTeam.bifurcation.dm} | RSM: {mipExecutiveKPIs.highestTeam.bifurcation.rsm} | DSM: {mipExecutiveKPIs.highestTeam.bifurcation.dsm}
                        </div>
                      }
                      rightLabel={formatDisplayText("Lowest Team")}
                      rightValue={
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                          <span style={{ fontSize: '48px', fontWeight: 600, color: '#0F172A' }}>{mipExecutiveKPIs.lowestTeam.total}</span>
                          <span style={{ fontSize: '26px', fontWeight: 500, color: '#64748B' }}>{formatDisplayText(mipExecutiveKPIs.lowestTeam.name)}</span>
                        </div>
                      }
                      rightSubValue={
                        <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, letterSpacing: '0.02em' }}>
                          DM: {mipExecutiveKPIs.lowestTeam.bifurcation.dm} | RSM: {mipExecutiveKPIs.lowestTeam.bifurcation.rsm} | DSM: {mipExecutiveKPIs.lowestTeam.bifurcation.dsm}
                        </div>
                      }
                      icon={Users}
                    />
                    <KPIBox 
                      title="Total Managers Attended" 
                      value={mipExecutiveKPIs.totalManagers.total} 
                      subValue="Total Combined"
                      badge={<span style={{fontSize: '11px', color: '#64748B', fontWeight: 600}}>DM: {mipExecutiveKPIs.totalManagers.bifurcation.dm} | RSM: {mipExecutiveKPIs.totalManagers.bifurcation.rsm} | DSM: {mipExecutiveKPIs.totalManagers.bifurcation.dsm}</span>}
                      icon={Briefcase}
                    />
                  </Fragment>
                )}

                {tab === 'Refresher' && subView === 'refresher_attendance' && refresherAttData && (
                  <Fragment>
                    <KPISplitCard 
                      title="Attendance Funnel"
                      leftLabel="Notified"
                      leftValue={refresherAttData.globalKPIs.totalNotified}
                      rightLabel="Attended"
                      rightValue={refresherAttData.globalKPIs.totalAttended}
                      icon={Zap}
                    />
                    <KPIBox title="Attendance %" value={`${refresherAttData.globalKPIs.attendancePercent.toFixed(1)}%`} color="var(--accent-primary)" icon={CheckCircle2} />
                  </Fragment>
                )}
                {tab === 'Refresher' && subView === 'refresher_performance' && refresherPerfData && (
                  <Fragment>
                    <KPIBox title="Total Attended" value={refresherPerfData.globalKPIs.totalAttended} icon={Zap} />
                    <KPISplitCard 
                      title="Average Performance"
                      leftLabel="Science"
                      leftValue={(refresherPerfData.globalKPIs.avgScience || 0).toFixed(1)}
                      leftSubValue={refresherPerfData.globalKPIs.avgScience > 0 ? <span className={`badge ${flagClass(flagScore(refresherPerfData.globalKPIs.avgScience))}`}>Rating</span> : undefined}
                      rightLabel="Skill"
                      rightValue={(refresherPerfData.globalKPIs.avgSkill || 0).toFixed(1)}
                      rightSubValue={refresherPerfData.globalKPIs.avgSkill > 0 ? <span className={`badge ${flagClass(flagScore(refresherPerfData.globalKPIs.avgSkill))}`}>Rating</span> : undefined}
                      icon={Award}
                    />
                    <KPIBox title="High Performers" value={`${(refresherPerfData.globalKPIs.highPerformersPct || 0).toFixed(1)}%`} color="var(--accent-primary)" icon={Trophy} />
                  </Fragment>
                )}
                {tab === 'Capsule' && subView === 'capsule_attendance' && capsuleAttData && (
                  <Fragment>
                    <KPISplitCard 
                      title="Attendance Funnel"
                      leftLabel="Notified"
                      leftValue={capsuleAttData.globalKPIs.totalNotified}
                      rightLabel="Attended"
                      rightValue={capsuleAttData.globalKPIs.totalAttended}
                      icon={Zap}
                    />
                    <KPIBox title="Attendance %" value={`${capsuleAttData.globalKPIs.attendancePercent.toFixed(1)}%`} color="var(--accent-primary)" icon={CheckCircle2} />
                  </Fragment>
                )}
                {tab === 'Capsule' && subView === 'capsule_performance' && capsulePerfData && (
                  <Fragment>
                    <KPISplitCard 
                      title="Performance Summary"
                      leftLabel="Total Attended"
                      leftValue={capsulePerfData.globalKPIs.totalAttended}
                      rightLabel="Avg Score"
                      rightValue={(capsulePerfData.globalKPIs.avgScore || 0).toFixed(1)}
                      rightSubValue={capsulePerfData.globalKPIs.avgScore > 0 ? <span className={`badge ${flagClass(flagScore(capsulePerfData.globalKPIs.avgScore))}`}>Score</span> : undefined}
                      icon={GraduationCap}
                    />
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
        <div className="grid-2 mb-12">
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
                    {(() => {
                      const clusterDataMap = tab === 'IP' ? ipData.clusterMonthMap : tab === 'AP' ? apPerfData.clusterMap : mipPerfData.clusterMap;
                      return sortClusters(Object.keys(clusterDataMap)).map(cluster => ({ cluster, cData: clusterDataMap[cluster] }));
                    })().map(({ cluster, cData }) => (
                      <Fragment key={cluster}>
                        <tr className="row-group-header">
                          <td onClick={() => toggleExpand(cluster)} className="cursor-pointer">
                            {expanded.has(cluster) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </td>
                          <td className="font-bold">{formatDisplayText(cluster)}</td>
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
              <h3 className="text-lg m-0">{formatDisplayText('IP Team Competition Ranking Matrix')}</h3>
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
                    .sort(([, a]: [string, any], [, b]: [string, any]) => {
                      const orderMap = new Map(CLUSTER_ORDER.map((c, i) => [c.toLowerCase(), i]));
                      const idxA = orderMap.get(a.cluster.toLowerCase()) ?? 999;
                      const idxB = orderMap.get(b.cluster.toLowerCase()) ?? 999;
                      return idxA - idxB || a.cluster.localeCompare(b.cluster);
                    })
                    .map(([team, tData]: [string, any], idx) => (
                      <tr key={team}>
                        <td className="text-muted">{idx + 1}</td>
                        <td className="font-bold">{formatDisplayText(team)}</td>
                        <td><span className="badge badge-secondary">{formatDisplayText(tData.cluster)}</span></td>
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
                {(() => {
                  if (viewBy !== 'Cluster') return ranked;
                  const names = ranked.map((r: any) => r.key);
                  const sortedNames = sortClusters(names);
                  return sortedNames.map(name => ranked.find((r: any) => r.key === name)!).filter(Boolean);
                })().map((g: any, idx) => {
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
                        <td className="font-bold">{formatDisplayText(g.key)}</td>
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
                          <td className="pl-24 text-muted">{formatDisplayText(sg.key)}</td>
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



      {subView === 'performance_charts' && (
        <PerformanceCharts 
          employees={employees}
          attendance={attendance}
          scores={scores}
          nominations={nominations}
          demographics={demographics}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
};

export const ReportsAnalytics = memo(ReportsAnalyticsComponent);
