import React, { useState, useMemo, useEffect, Fragment, memo, useCallback } from 'react';
import { motion } from 'framer-motion';

import {
  Table, Calendar, GraduationCap, AlertTriangle, ChevronRight, ChevronDown,
  Trophy, Zap, ShieldCheck, CheckCircle2, ChartNetwork, Download, Filter, X, ListOrdered, BarChart3, TrendingUp, AlertCircle, Users, Bug, Search as SearchIcon
} from 'lucide-react';

import { Employee } from '../../types/employee';
import { Attendance, TrainingScore, TrainingNomination, Demographics, TrainingType } from '../../types/attendance';
import { ViewByOption, GroupedData, ReportFilter } from '../../types/reports';
import { exportToCSV } from '../../core/engines/reportEngine';
import { FISCAL_YEARS, getCurrentFYString, getFiscalYears, formatMonthLabel } from '../../core/utils/fiscalYear';
import { scheduleIdle } from '../../core/utils/stagedComputation';
import { KPIBox } from '../../shared/components/ui/KPIBox';
import { DataTable } from '../../shared/components/ui/DataTable';
import { TimeSeriesTable } from '../../features/dashboard/components/TimeSeriesTable';
import { TrainerTable } from '../../features/dashboard/components/TrainerTable';
import { DrilldownPanel } from '../../features/dashboard/components/DrilldownPanel';
import { InsightStrip } from '../../features/dashboard/components/InsightStrip';
import { GlobalFilterPanel } from '../../shared/components/ui/GlobalFilterPanel';
import TrainerAvatar from '../../shared/components/ui/TrainerAvatar';
import { ErrorPanel } from '../../shared/components/ui/ErrorPanel';
import { GlobalFilters, getActiveFilterCount } from '../../core/context/filterContext';

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
const VIEW_BY_OPTIONS: ViewByOption[] = ['Team', 'Cluster', 'Month'];

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
  employees, attendance, scores, nominations, demographics, pageMode = 'overview', onNavigate
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

  const [pageFilters, setPageFilters] = useState<GlobalFilters>({ 
    cluster: '', team: '', trainer: '', month: '',
    clusters: [], teams: [], trainers: [], trainerTypes: []
  });
  const activeFilterCount = getActiveFilterCount(pageFilters);
  const [showGlobalFilters, setShowGlobalFilters] = useState(false);

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

  const renderPerformanceCell = (data: any, keyVal: string) => {
    if (!data || data.total === 0) return <td key={keyVal} className="td-empty">—</td>;
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
      if (!['ap_performance', 'grouped', 'gap', 'timeseries', 'trainer', 'drilldown'].includes(subView)) {
        setSubView('grouped');
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
    setShowGlobalFilters(false);
  }, []);

  const handleGlobalClear = useCallback(() => {
    setPageFilters({ 
      cluster: '', team: '', trainer: '', month: '',
      clusters: [], teams: [], trainers: [], trainerTypes: []
    });
    setFilter({ monthFrom: '', monthTo: '', teams: [], clusters: [], trainer: '' });
  }, []);

  const {
    months: MONTHS,
    unified,
    rawUnified,
    apAttData: apData,
    mipAttData: mipAttendanceData,
    refresherAttData,
    capsuleAttData,
    apPerfData,
    mipPerfData,
    refresherPerfData,
    capsulePerfData,
    eligibilityResults,
    gapMetrics,
    groups,
    ranked,
    trainerStats,
    drilldownNodes,
    timeSeries,
    ipData,
    ipRankData,
    ipKPI,
    apKPI,
    mipKPI,
    refresherKPI,
    capsuleKPI,
    preApKPI
  } = usePerformanceData({
    tab, selectedFY, filter, viewBy, tsMode, pageMode,
    employees, attendance, scores, nominations
  });

  console.log("TABLE DATA:", rawUnified?.length);
  const { allClusters, allTeams, allTrainers } = useFilterOptions(rawUnified, attendance, tab, masterTrainers, pageFilters.clusters);

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

    const cleanups: Array<() => void> = [];

    const cleanup0 = scheduleIdle(
      () => ({}),
      () => setKpiStage('ready'),
      1, true
    );
    cleanups.push(cleanup0);

    const cleanup1 = scheduleIdle(
      () => (subView === 'grouped' && ranked.length > 0 ? { ranked } : {}),
      () => setGroupedStage('ready'),
      20, true
    );
    cleanups.push(cleanup1);

    const cleanup2 = scheduleIdle(
      () => (subView === 'timeseries' && timeSeries.length > 0 ? { timeSeries } : {}),
      () => setTimeseriesStage('ready'),
      40, true
    );
    cleanups.push(cleanup2);

    const cleanup3 = scheduleIdle(
      () => (subView === 'trainer' && trainerStats.length > 0 ? { trainerStats } : {}),
      () => setTrainerStage('ready'),
      60, true
    );
    cleanups.push(cleanup3);

    const cleanup4 = scheduleIdle(
      () => (subView === 'drilldown' && drilldownNodes.length > 0 ? { drilldownNodes } : {}),
      () => setDrilldownStage('ready'),
      80, true
    );
    cleanups.push(cleanup4);

    const matrixKey = `matrix_${tab}_${subView}`;
    if (lazyMatrices.has(matrixKey)) {
      const cleanup5 = scheduleIdle(
        () => ({}),
        () => setMatrixStage('ready'),
        100, true
      );
      cleanups.push(cleanup5);
    }

    return () => cleanups.forEach(c => c());
  }, [unified, tab, subView, lazyMatrices, ipKPI, apKPI, apPerfData, mipAttendanceData, mipPerfData, refresherAttData, refresherPerfData, capsuleAttData, capsulePerfData, gapMetrics, ranked, drilldownNodes, timeSeries, trainerStats]);

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
          {pageMode === 'performance-insights' && (
            <div className="flex-center gap-2 mr-2">
              <button className="btn btn-primary" title="Tables View"><Table size={16} /></button>
              <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-charts')} title="Switch to Charts"><BarChart3 size={16} /></button>
              <div className="v-divider mx-1" />
            </div>
          )}
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
          <button className={`btn ${subView === 'gap' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubView('gap')} title="Gap Analysis"><AlertTriangle size={16} /></button>
          <div className="v-divider mx-1" />


          <button
            className={`btn btn-secondary btn-filter ${activeFilterCount > 0 ? 'active' : ''}`}
            onClick={() => setShowGlobalFilters(true)}
            title="Open Filters"
          >
            <Filter size={16} />
            {activeFilterCount > 0 && <span className="text-xs-bold min-w-16">{activeFilterCount}</span>}
          </button>
          <button className="btn btn-secondary" onClick={handleExport} title="Export CSV"><Download size={16} /></button>
        </div>
      </div>

      {/* View By Switcher */}
      <div className="flex gap-12 mb-16 items-center flex-wrap">
        <span id="label-view-by" className="text-xs-bold text-muted uppercase">View Data By:</span>
        <div 
          role="group" 
          aria-labelledby="label-view-by" 
          className="flex bg-card-panel p-3 border-radius-8"
        >
          {VIEW_BY_OPTIONS.map(v => (
            <button
              key={v}
              onClick={() => setViewBy(v)}
              className={`btn-toggle ${viewBy === v ? 'active' : ''}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

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
                {tab === 'IP' && ipKPI && (
                  <Fragment>
                    <KPIBox title="Total Candidates" value={ipKPI.total} icon={Zap} />
                    <KPIBox title="High %" value={`${ipKPI.highPct.toFixed(1)}%`} color="var(--success)" />
                    <KPIBox title="Medium %" value={`${(ipKPI.medium / (ipKPI.total || 1) * 100).toFixed(1)}%`} color="var(--warning)" />
                    <KPIBox title="Low %" value={`${(ipKPI.low / (ipKPI.total || 1) * 100).toFixed(1)}%`} color="var(--danger)" />
                    <KPIBox title="Weighted T Score / %" value={ipKPI.weighted.toFixed(2)} color="var(--accent-primary)" badge={<span className={`badge ${flagClass(flagScore(ipKPI.weighted))}`}>{flagLabel(flagScore(ipKPI.weighted))}</span>} />
                  </Fragment>
                )}
                {tab === 'AP' && subView === 'grouped' && apKPI && (
                  <Fragment>
                    <KPIBox title="Total Notified (FY)" value={apKPI.notified} icon={Zap} />
                    <KPIBox title="Total Attended (FY)" value={apKPI.attended} color="var(--success)" icon={CheckCircle2} />
                    <KPIBox title="Attendance %" value={`${apKPI.attendance.toFixed(1)}%`} color="var(--accent-primary)" />
                    <KPIBox title="Composite Score" value={apKPI.composite.toFixed(2)} color="var(--success)" badge={apKPI.composite > 0 ? <span className={`badge ${flagClass(flagScore(apKPI.composite))}`}>{flagLabel(flagScore(apKPI.composite))}</span> : undefined} />
                    <KPIBox title="Defaulters (≥3 strikes)" value={apKPI.defaulterCount} color="var(--danger)" icon={AlertTriangle} />
                  </Fragment>
                )}
                {tab === 'AP' && subView === 'ap_performance' && apPerfData && (
                  <Fragment>
                    <KPIBox title="Total Attended" value={apPerfData.globalKPIs.totalAttended} icon={Zap} />
                    <KPIBox title="Total Candidates" value={apPerfData.globalKPIs.uniqueCandidates} color="var(--accent-primary)" />
                    <KPIBox title="Avg Knowledge" value={(apPerfData.globalKPIs.avgKnowledge || 0).toFixed(1)} color="var(--success)" badge={apPerfData.globalKPIs.avgKnowledge > 0 ? <span className={`badge ${flagClass(flagScore(apPerfData.globalKPIs.avgKnowledge))}`}>K</span> : undefined} />
                    <KPIBox title="Avg BSE" value={(apPerfData.globalKPIs.avgBSE || 0).toFixed(1)} color="var(--warning)" badge={apPerfData.globalKPIs.avgBSE > 0 ? <span className={`badge ${flagClass(flagScore(apPerfData.globalKPIs.avgBSE))}`}>B</span> : undefined} />
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
                    <KPIBox title="Avg Science" value={(mipPerfData.globalKPIs.avgScience || 0).toFixed(1)} color="var(--success)" badge={mipPerfData.globalKPIs.avgScience > 0 ? <span className={`badge ${flagClass(flagScore(mipPerfData.globalKPIs.avgScience))}`}>Sci</span> : undefined} />
                    <KPIBox title="Avg Skill" value={(mipPerfData.globalKPIs.avgSkill || 0).toFixed(1)} color="var(--warning)" badge={mipPerfData.globalKPIs.avgSkill > 0 ? <span className={`badge ${flagClass(flagScore(mipPerfData.globalKPIs.avgSkill))}`}>Skl</span> : undefined} />
                    <KPIBox title="High Performers" value={`${(mipPerfData.globalKPIs.highPerformersPct || 0).toFixed(1)}%`} color="var(--accent-primary)" icon={Trophy} />
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
                {tab === 'Pre_AP' && preApKPI && (
                  <Fragment>
                    <KPIBox title="Nominated" value={preApKPI.notified} icon={Zap} />
                    <KPIBox title="Attended" value={preApKPI.attended} color="var(--success)" icon={CheckCircle2} />
                    <KPIBox title="Attendance %" value={`${preApKPI.attendance.toFixed(1)}%`} color="var(--accent-primary)" />
                  </Fragment>
                )}
              </Fragment>
            )}
          </div>
        </motion.div>
      )}


      {/* Insight Strip */}
      <Fragment>
          {tab === 'IP' ? (
            <InsightStrip
              text="Performance stable; Revance declining; 120 candidates pending training."
              variant="primary"
              icon="trending"
            />
          ) : pageMode === 'performance-insights' ? (
            <InsightStrip
              text="Iluma leading consistently; Derma shows volatility in last 3 months."
              variant="primary"
              icon="trending"
            />
          ) : (
            <InsightStrip
              text={`${tab} Training Cycle: Data suggests increasing coverage. 45 personnel scheduled.`}
              variant="primary"
              icon="none"
            />
          )}
      </Fragment>

      {/* Top / Bottom 3 */}
      {subView === 'grouped' && tab !== 'IP' && tab !== 'AP' && ranked.length > 3 && (
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

      {/* --- NORMAL MODE SUBVIEWS --- */}
      <Fragment>

      {subView === 'ip_matrix' && ipData && (
        matrixStage === 'loading' ? (
          <MatrixSkeleton />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="glass-panel overflow-hidden">
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
                      <th className="td-center">Elite %</th>
                      <th className="td-center">High %</th>
                      <th className="td-center">Medium %</th>
                      <th className="td-center">Low %</th>
                      {MONTHS.map(mo => <th key={mo} className="td-center min-w-90">{formatMonthLabel(mo)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(ipData.clusterMonthMap).map(([cluster, cData]: [string, any]) => (
                      <Fragment key={cluster}>
                        <tr className="row-group-header">
                          <td onClick={() => toggleExpand(cluster)} className="cursor-pointer">
                            {expanded.has(cluster) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </td>
                          <td className="font-bold">{cluster}</td>
                          <td className="td-center">{cData.total}</td>
                          {renderSummaryPercent(cData.elite, cData.total, 10, 'text-success-bold')}
                          {renderSummaryPercent(cData.high, cData.total, 30, 'text-success-bold')}
                          {renderSummaryPercent(cData.medium, cData.total)}
                          {renderSummaryPercent(cData.low, cData.total, 30, 'text-danger-bold')}
                          {MONTHS.map(mo => renderPerformanceCell(cData.months[mo], `${cluster}_${mo}`))}
                        </tr>
                        {expanded.has(cluster) && Object.entries(ipData.teamMonthMap[cluster] || {}).map(([team, tData]: [string, any]) => (
                          <tr key={team} className="row-child">
                            <td />
                            <td className="pl-24">{team}</td>
                            <td className="td-center">{tData.total}</td>
                            {renderSummaryPercent(tData.elite, tData.total)}
                            {renderSummaryPercent(tData.high, tData.total)}
                            {renderSummaryPercent(tData.medium, tData.total)}
                            {renderSummaryPercent(tData.low, tData.total)}
                            {MONTHS.map(mo => renderPerformanceCell(tData.months[mo], `${team}_${mo}`))}
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
      {subView === 'grouped' && tab !== 'IP' && (
        <div className="glass-panel overflow-hidden">
          <div className="card-header flex-between">
            <h3 className="text-lg m-0">{tab === 'AP' || tab === 'MIP' || tab === 'Refresher' || tab === 'Capsule' ? 'Attendance Funnel' : 'Performance Rankings'}</h3>
            <span className="text-xs text-muted">Click headers to sort</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>{viewBy}</th>
                  <th className="td-center">Count</th>
                  <th className="td-center">Score</th>
                  <th className="td-center">Performance</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((g: any, idx) => (
                  <tr key={g.key} className={idx < 3 ? 'row-highlight-success' : ''}>
                    <td>#{g.rank}</td>
                    <td className="font-bold">{g.key}</td>
                    <td className="td-center font-mono">{g.total}</td>
                    <td className="td-center font-bold">{g.metric.toFixed(1)}</td>
                    <td>
                      <ProgressBar width={g.metric} colorClass={flagClass(flagScore(g.metric))} />
                    </td>
                  </tr>
                ))}
                {ranked.length === 0 && (
                  <tr><td colSpan={5} className="td-center py-40 text-muted">No data for this selection</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subView === 'timeseries' && (
        <div className="glass-panel p-20">
          <div className="card-header mb-20"><h3 className="text-lg m-0">Longitudinal Performance Trends</h3></div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time Period</th>
                  {Object.keys(timeSeries[0]?.cells || {}).map(k => <th key={k} className="td-center">{k}</th>)}
                </tr>
              </thead>
              <tbody>
                {timeSeries.map((r: any) => (
                  <tr key={r.label}>
                    <td className="font-bold">{r.label}</td>
                    {Object.entries(r.cells).map(([k, v]: [string, any]) => (
                      <td key={k} className="td-center">
                        <span className={`badge ${flagClass(flagScore(v))}`}>{v.toFixed(1)}</span>
                      </td>
                    ))}
                  </tr>
                ))}
                {timeSeries.length === 0 && (
                  <tr><td colSpan={5} className="td-center py-40 text-muted">No time series data found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subView === 'trainer' && (
        <div className="glass-panel p-20">
          <div className="card-header mb-20"><h3 className="text-lg m-0">Trainer Performance Index</h3></div>
          <DataTable headers={['Trainer', 'Sessions', 'Avg Score', 'Index']}>
            {trainerStats.map((t: any) => (
              <tr key={t.trainerId}>
                <td className="font-bold">
                  <TrainerAvatar 
                    trainer={{
                      id: t.trainerId,
                      name: t.trainerId,
                      avatarUrl: t.avatarUrl
                    }}
                    size={28}
                    showName={true}
                  />
                </td>
                <td className="font-mono">{t.trainingsConducted}</td>
                <td className="font-bold">{t.avgScore.toFixed(1)}</td>
                <td>
                  <ProgressBar width={t.avgScore} colorClass="bg-primary" />
                </td>
              </tr>
            ))}
            {trainerStats.length === 0 && (
              <tr><td colSpan={4} className="td-center py-40 text-muted">No trainer data found</td></tr>
            )}
          </DataTable>
        </div>
      )}

      {subView === 'gap' && (
        <div className="glass-panel p-20">
          <div className="card-header mb-20"><h3 className="text-lg m-0">Training Gap Analysis</h3></div>
          <div className="grid-3 mb-24">
            <KPIBox title="Eligible Personnel" value={gapMetrics.eligibleCount} icon={Users} />
            <KPIBox title="Trained Personnel" value={gapMetrics.trainedCount} color="var(--success)" icon={CheckCircle2} />
            <KPIBox title="Coverage %" value={`${gapMetrics.coveragePercent.toFixed(1)}%`} color="var(--accent-primary)" />
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="td-center">Eligible</th>
                  <th className="td-center">Trained</th>
                  <th className="td-center">Gap</th>
                  <th className="td-center">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {gapMetrics.details.map((d: any) => (
                  <tr key={d.name}>
                    <td className="font-bold">{d.name}</td>
                    <td className="td-center">{d.eligible}</td>
                    <td className="td-center">{d.trained}</td>
                    <td className="td-center text-danger-bold">{d.gap}</td>
                    <td className="td-center">
                      <span className={`badge ${d.coverage >= 80 ? 'badge-success' : d.coverage >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                        {d.coverage.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {gapMetrics.details.length === 0 && (
                  <tr><td colSpan={5} className="td-center py-40 text-muted">No gap analysis data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subView === 'drilldown' && (
        <div className="glass-panel p-20">
          <div className="card-header mb-20"><h3 className="text-lg m-0">Hierarchical Drill-Down</h3></div>
          <div className="text-muted italic mb-20">Interactive cluster/team path analysis currently in visual beta.</div>
          <DataTable headers={['Hierarchy Node', 'Parent', 'Metric', 'Status']}>
            {drilldownNodes.slice(0, 50).map((node: any) => (
              <tr key={node.id}>
                <td className="font-bold">{node.label}</td>
                <td className="text-muted">{node.parentId || '—'}</td>
                <td className="font-mono">{node.value.toFixed(1)}</td>
                <td><span className={`badge ${flagClass(flagScore(node.value))}`}>Stable</span></td>
              </tr>
            ))}
            {drilldownNodes.length === 0 && (
              <tr><td colSpan={4} className="td-center py-40 text-muted">No hierarchy data available</td></tr>
            )}
          </DataTable>
        </div>
      )}

      {(subView === 'ap_performance' || subView === 'mip_performance') && (
        <div className="glass-panel p-20">
          <div className="card-header mb-20"><h3 className="text-lg m-0">{tab} Performance Analytics</h3></div>
          <div className="grid-3 mb-24">
            <KPIBox 
              title="Avg Assessment" 
              value={(tab === 'AP' 
                ? (apPerfData ? (apPerfData.globalKPIs.avgKnowledge + apPerfData.globalKPIs.avgBSE) / 2 : 0)
                : tab === 'MIP'
                ? (mipPerfData ? (mipPerfData.globalKPIs.avgScience + mipPerfData.globalKPIs.avgSkill) / 2 : 0)
                : 0)?.toFixed(1)} 
              icon={Zap} 
            />
            <KPIBox title="High Performers" value={`${(tab === 'AP' ? apPerfData?.globalKPIs.highPerformersPct : tab === 'MIP' ? mipPerfData?.globalKPIs.highPerformersPct : 0)?.toFixed(1)}%`} color="var(--success)" icon={Trophy} />
            <KPIBox title="Total Assessed" value={tab === 'AP' ? apPerfData?.globalKPIs.totalAttended : tab === 'MIP' ? mipPerfData?.globalKPIs.totalAttended : 0} color="var(--accent-primary)" />
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{viewBy}</th>
                  <th className="td-center">Participants</th>
                  <th className="td-center">Avg Score</th>
                  <th className="td-center">Performance Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries((tab === 'AP' ? apPerfData?.groupMap : tab === 'MIP' ? mipPerfData?.groupMap : {}) || {}).map(([key, data]: any) => (
                  <tr key={key}>
                    <td className="font-bold">{key}</td>
                    <td className="td-center">{data.total}</td>
                    <td className="td-center font-bold">{data.avg.toFixed(1)}</td>
                    <td>
                      <ProgressBar width={data.avg} colorClass={flagClass(flagScore(data.avg))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </Fragment>

      <GlobalFilterPanel
        isOpen={showGlobalFilters}
        onClose={() => setShowGlobalFilters(false)}
        onApply={handleGlobalApply}
        initialFilters={pageFilters}
        clusterOptions={allClusters}
        teamOptions={allTeams}
        trainerOptions={allTrainers as any}
        monthOptions={MONTHS}
        onClearAll={handleGlobalClear}
      />
    </div>
  );
};

export const ReportsAnalytics = memo(ReportsAnalyticsComponent);
