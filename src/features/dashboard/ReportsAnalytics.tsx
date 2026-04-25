import React, { useState, useMemo, useEffect, Fragment, memo, useCallback } from 'react';
import { motion } from 'framer-motion';
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
  getGapData, getPrimaryMetric, applyFilters, exportToCSV, normalizeTrainingType
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
import { getFiscalYears } from '../../utils/fiscalYear';

import { getCollection } from '../../services/apiClient';
import { scheduleIdle, StagedComputationManager } from '../../utils/stagedComputation';
import { KPIBox } from '../../components/KPIBox';
import { DataTable } from '../../components/DataTable';
import { TimeSeriesTable } from '../../components/TimeSeriesTable';
import { TrainerTable } from '../../components/TrainerTable';
import { DrilldownPanel } from '../../components/DrilldownPanel';
import { InsightStrip } from '../../components/InsightStrip';
import { GlobalFilterPanel } from '../../components/GlobalFilterPanel';
import { GlobalFilters, getActiveFilterCount } from '../../context/filterContext';
import { APPerformanceMatrix } from '../../components/APPerformanceMatrix';
import { MIPAttendanceMatrix, MIPPerformanceMatrix } from '../../components/MIPDualMatrix';
import { RefresherAttendanceMatrix, RefresherPerformanceMatrix } from '../../components/RefresherDualMatrix';
import { CapsuleAttendanceMatrix, CapsulePerformanceMatrix } from '../../components/CapsuleDualMatrix';
import { flagScore, flagClass, flagLabel } from '../../utils/scoreNormalizer';
import { normalizeText } from '../../utils/textNormalizer';
import { useGroupedData, useRankedGroups, useTrainerStats, useDrilldownNodes, useTimeSeries, useGapMetrics, useMonthsFromData, useFilterOptions } from '../../utils/computationHooks';
import { useMasterData } from '../../context/MasterDataContext';

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

const ReportsAnalyticsComponent: React.FC<ReportsAnalyticsProps> = ({
  employees, attendance, scores, nominations, demographics, pageMode = 'overview', onNavigate
}) => {
  const { trainers: masterTrainers, teams: masterTeams, clusters: masterClusters } = useMasterData();

  // Page-scoped global filter UI state (filters apply only to this page)
  const [pageFilters, setPageFilters] = useState<GlobalFilters>({ cluster: '', team: '', trainer: '', month: '' });
  const activeFilterCount = getActiveFilterCount(pageFilters);
  const [showGlobalFilters, setShowGlobalFilters] = useState(false);

  const [tab, setTab] = useState<string>('IP');
  const [viewBy, setViewBy] = useState<ViewByOption>('Team');
  const [subView, setSubView] = useState<SubView>('ip_matrix');
  const [expanded, setExpanded] = useState(new Set<string>());
  const [rules, setRules] = useState<EligibilityRule[]>([]);
  const [selectedFYs, setSelectedFYs] = useState<Record<string, string>>({
    IP: getCurrentFY(),
    AP: getCurrentFY(),
    MIP: getCurrentFY(),
    Refresher: getCurrentFY(),
    Capsule: getCurrentFY(),
    PRE_AP: getCurrentFY()
  });
  const [tsMode, setTsMode] = useState<'score' | 'count'>('score');

  // Helper to compute default FYs from data
  const computeDefaultFYs = useCallback(() => {
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

    const res: Record<string, string> = {};
    const types = ['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'PRE_AP'];
    types.forEach(t => {
      const maxMonth = maxMonths[t];
      if (!maxMonth) {
        res[t] = getCurrentFY();
      } else {
        const [yearStr, monthStr] = maxMonth.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const startYear = month >= 4 ? year : year - 1;
        res[t] = `${startYear}-${(startYear + 1).toString().slice(2)}`;
      }
    });
    return res;
  }, [attendance, nominations]);

  // Sync FY with data on load
  useEffect(() => {
    if (attendance.length > 0 || nominations.length > 0) {
      setSelectedFYs(prev => {
        const defaults = computeDefaultFYs();
        // Only update if current tab's FY is the default and differs from what data suggests
        // or if we have no state yet (which isn't possible given initial state)
        // Simplest: just update all if they were purely default-init
        return { ...prev, ...defaults };
      });
    }
  }, [attendance, nominations, computeDefaultFYs]);

  // Filter state
  const [filter, setFilter] = useState<ReportFilter>({
    monthFrom: '', monthTo: '', teams: [], clusters: [], trainer: ''
  });

  // ─── STAGED RENDERING STATE ───
  // Progressive rendering: KPI → Grouped → TimeSeries → Trainer → Drilldown → Matrices (lazy by tab)
  const [kpiStage, setKpiStage] = useState<'loading' | 'ready'>('loading');
  const [kpiCache, setKpiCache] = useState<any>(null);
  
  // Staggered table loading: grouped → timeseries → trainer → drilldown
  const [groupedStage, setGroupedStage] = useState<'loading' | 'ready'>('loading');
  const [timeseriesStage, setTimeseriesStage] = useState<'loading' | 'ready'>('loading');
  const [trainerStage, setTrainerStage] = useState<'loading' | 'ready'>('loading');
  const [drilldownStage, setDrilldownStage] = useState<'loading' | 'ready'>('loading');
  
  // Lazy matrix loading: only load when tab is active
  const [lazyMatrices, setLazyMatrices] = useState<Set<string>>(new Set());
  const [matrixStage, setMatrixStage] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    getCollection('eligibility_rules').then(data => setRules(data as EligibilityRule[]));
  }, []);

  // ─── LAZY LOAD MATRIX TRACKING ───
  // Only load matrix computation for currently active tab
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

  // --- BUCKET HELPERS ---
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

  const formatMonthLabel = useCallback((month: string) => {
    const m = month.split('-')[1];
    const MONTH_LABELS: Record<string, string> = {
      '04': 'Apr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug', '09': 'Sep',
      '10': 'Oct', '11': 'Nov', '12': 'Dec', '01': 'Jan', '02': 'Feb', '03': 'Mar'
    };
    return MONTH_LABELS[m] || month;
  }, []);

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

  // Dynamic options for filter dropdowns
  const { allTeams, allTrainers } = useFilterOptions(employees, attendance, tab, masterTeams, masterTrainers);
  const allClusters = useMemo(() => masterClusters.map(c => c.name), [masterClusters]);

  const normalizeType = (value?: string) => normalizeTrainingType(value || '');

  // Build filtered base dataset for current tab
  const rawUnified = useMemo(() => {
    const normalizedTab = normalizeType(tab);
    const att = attendance.filter(a => normalizeType(a.trainingType) === normalizedTab);
    const scs = scores.filter(s => normalizeType(s.trainingType) === normalizedTab);
    const noms = nominations.filter(n => normalizeType(n.trainingType) === normalizedTab);
    const rule = rules.find(r => normalizeType(r.trainingType) === normalizedTab);
    
    const eligResults = getEligibleEmployees(tab as TrainingType, rule, employees, attendance, nominations);
    const unifiedRes = buildUnifiedDataset(employees, att, scs, noms, eligResults, masterTeams);

    console.log(`📊 [REPORTS-UI] Unified Dataset Size: ${unifiedRes.length}`);
    return unifiedRes;
  }, [tab, attendance, scores, nominations, employees, rules, pageMode]);

  const unified = useMemo(() => {
    let ds = applyFilters(rawUnified, filter, masterTeams);
    // Apply Fiscal Year filter (MONTHS) to unified dataset for relevant training types
    if (['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'PRE_AP'].includes(tab)) {
      ds = ds.filter(r => {
        const m = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7);
        return MONTHS.includes(m);
      });
    }
    
    console.log(`📊 [REPORTS-UI] Training Types Found:`, [...new Set(rawUnified.map(r => r.attendance.trainingType))]);
    console.log(`📊 [REPORTS-UI] Active Tab: ${tab}, Final Filtered Count: ${ds.length}`);
    
    return ds;
  }, [rawUnified, filter, tab, MONTHS, masterTeams]);

  // -- IP Engine --
  const ipData = useMemo(() => {
    // Filter records to only include those within the selected Fiscal Year months
    const filteredRecords = unified.filter(r => {
      const m = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7);
      return MONTHS.includes(m);
    });
    return buildIPAggregates(filteredRecords);
  }, [unified, MONTHS]);

  // --- Handlers for page-scoped GlobalFilterPanel ---
  const handleGlobalApply = useCallback((f: GlobalFilters) => {
    setPageFilters(f);
    // Map GlobalFilters to existing ReportFilter shape
    setFilter({
      monthFrom: f.month || '',
      monthTo: f.month || '',
      teams: f.team ? [f.team] : [],
      clusters: f.cluster ? [f.cluster] : [],
      trainer: f.trainer || ''
    });
  }, []);

  const handleGlobalClear = useCallback(() => {
    const cleared: GlobalFilters = { cluster: '', team: '', trainer: '', month: '' };
    setPageFilters(cleared);
    setFilter({ monthFrom: '', monthTo: '', teams: [], clusters: [], trainer: '' });
  }, []);

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
        masterTeams,
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

  const gapMetrics = useGapMetrics(tab, eligibilityResults, attendance);
  const groups = useGroupedData(unified, viewBy, tabNoms, employees, masterTeams);
  const ranked = useRankedGroups(groups, tab);
  const trainerStats = useTrainerStats(unified);
  const drilldownNodes = useDrilldownNodes(unified, tab);

  // Dynamic months from the filtered dataset
  const months = useMonthsFromData(unified);

  const timeSeries = useTimeSeries(groups, months, tab, tsMode);

  // KPI computations (Legacy)
  const gIP = useMemo(() => calcIP(unified), [unified]);
  const gAP = useMemo(() => calcAP(unified, tabNoms), [unified, tabNoms]);
  const gMIP = useMemo(() => calcMIP(unified), [unified]);
  const gRef = useMemo(() => calcRefresher(unified), [unified]);
  const gCap = useMemo(() => calcCapsule(unified), [unified]);
  const gPreAP = useMemo(() => calcPreAP(unified, tabNoms), [unified, tabNoms]);

  // ─── STAGED COMPUTATION EFFECT ───
  // Progressive rendering pipeline with requestIdleCallback:
  // KPI (immediate) → Grouped → TimeSeries → Trainer → Drilldown → Matrices (lazy by tab)
  useEffect(() => {
    // Reset stages on dependency change
    setKpiStage('loading');
    setGroupedStage('loading');
    setTimeseriesStage('loading');
    setTrainerStage('loading');
    setDrilldownStage('loading');
    setMatrixStage('loading');

    if (!unified || unified.length === 0) return;

    const cleanups: Array<() => void> = [];

    // STAGE 0: KPI Computation (immediate, runs now)
    // Fast operations - compute immediately for instant feedback
    const cleanup0 = scheduleIdle(
      () => {
        const kpiData: Record<string, any> = {};
        if (tab === 'IP' && gIP) kpiData.ipData = gIP;
        if (tab === 'AP' && gAP) kpiData.apData = gAP;
        if (tab === 'AP' && subView === 'ap_performance' && apPerfData) kpiData.apPerfData = apPerfData;
        if (tab === 'MIP' && subView === 'mip_attendance' && mipAttendanceData) kpiData.mipAttendanceData = mipAttendanceData;
        if (tab === 'MIP' && subView === 'mip_performance' && mipPerfData) kpiData.mipPerfData = mipPerfData;
        if (tab === 'Refresher' && subView === 'refresher_attendance' && refresherAttData) kpiData.refresherAttData = refresherAttData;
        if (tab === 'Refresher' && subView === 'refresher_performance' && refresherPerfData) kpiData.refresherPerfData = refresherPerfData;
        if (tab === 'Capsule' && subView === 'capsule_attendance' && capsuleAttData) kpiData.capsuleAttData = capsuleAttData;
        if (tab === 'Capsule' && subView === 'capsule_performance' && capsulePerfData) kpiData.capsulePerfData = capsulePerfData;
        if (subView === 'gap') kpiData.gapMetrics = gapMetrics;
        return kpiData;
      },
      () => setKpiStage('ready'),
      1,  // fallback delay: 1ms
      true  // use requestIdleCallback
    );
    cleanups.push(cleanup0);

    // STAGE 1: Grouped Ranking Table (staggered, ~20ms)
    // First table to load after KPI renders
    const cleanup1 = scheduleIdle(
      () => {
        if (subView === 'grouped' && ranked.length > 0) {
          return { ranked };
        }
        return {};
      },
      () => setGroupedStage('ready'),
      20,  // fallback delay: 20ms
      true  // use requestIdleCallback
    );
    cleanups.push(cleanup1);

    // STAGE 2: Time Series Table (staggered, ~40ms)
    // Load time series after grouped renders
    const cleanup2 = scheduleIdle(
      () => {
        if (subView === 'timeseries' && timeSeries.length > 0) {
          return { timeSeries };
        }
        return {};
      },
      () => setTimeseriesStage('ready'),
      40,  // fallback delay: 40ms
      true  // use requestIdleCallback
    );
    cleanups.push(cleanup2);

    // STAGE 3: Trainer Stats Table (staggered, ~60ms)
    // Load trainer stats after time series renders
    const cleanup3 = scheduleIdle(
      () => {
        if (subView === 'trainer' && trainerStats.length > 0) {
          return { trainerStats };
        }
        return {};
      },
      () => setTrainerStage('ready'),
      60,  // fallback delay: 60ms
      true  // use requestIdleCallback
    );
    cleanups.push(cleanup3);

    // STAGE 4: Drilldown Panel (staggered, ~80ms)
    // Load drilldown after trainer stats renders
    const cleanup4 = scheduleIdle(
      () => {
        if (subView === 'drilldown' && drilldownNodes.length > 0) {
          return { drilldownNodes };
        }
        return {};
      },
      () => setDrilldownStage('ready'),
      80,  // fallback delay: 80ms
      true  // use requestIdleCallback
    );
    cleanups.push(cleanup4);

    // STAGE 5: Lazy Matrix Computation (only if matrix is in lazy set)
    // Heavy matrix rendering data - lowest priority, only for active tab
    const matrixKey = `matrix_${tab}_${subView}`;
    if (lazyMatrices.has(matrixKey)) {
      const cleanup5 = scheduleIdle(
        () => {
          const matrixData: Record<string, any> = {};
          if (tab === 'IP' && subView === 'ip_matrix' && ipData) matrixData.ipMatrix = ipData;
          if (tab === 'IP' && subView === 'ip_team_rank' && ipRankData) matrixData.ipRankData = ipRankData;
          if (tab === 'AP' && subView === 'ap_performance' && apPerfData) matrixData.apMatrix = apPerfData;
          if (tab === 'MIP' && subView === 'mip_attendance' && mipAttendanceData) matrixData.mipAttMatrix = mipAttendanceData;
          if (tab === 'MIP' && subView === 'mip_performance' && mipPerfData) matrixData.mipPerfMatrix = mipPerfData;
          if (tab === 'Refresher' && subView === 'refresher_attendance' && refresherAttData) matrixData.refAttMatrix = refresherAttData;
          if (tab === 'Refresher' && subView === 'refresher_performance' && refresherPerfData) matrixData.refPerfMatrix = refresherPerfData;
          if (tab === 'Capsule' && subView === 'capsule_attendance' && capsuleAttData) matrixData.capAttMatrix = capsuleAttData;
          if (tab === 'Capsule' && subView === 'capsule_performance' && capsulePerfData) matrixData.capPerfMatrix = capsulePerfData;
          return matrixData;
        },
        () => setMatrixStage('ready'),
        100,  // fallback delay: 100ms
        true  // use requestIdleCallback
      );
      cleanups.push(cleanup5);
    }

    // Master cleanup
    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [
    unified, tab, subView, lazyMatrices,
    gIP, gAP, apPerfData, mipAttendanceData, mipPerfData,
    refresherAttData, refresherPerfData, capsuleAttData, capsulePerfData,
    ipData, ipRankData, gapMetrics, ranked, drilldownNodes, timeSeries, trainerStats
  ]);

  const toggleExpand = useCallback((k: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }, []);

  // (old inline filters removed) keep legacy `filter` state intact but inline UI was replaced by GlobalFilterPanel

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

  const genericHeaders = [
    '#', '', viewBy,
    ...(tab === 'AP' ? ['Notified', 'Attended', 'Att%', 'Composite', 'Defaulters', 'Flag'] : []),
    ...(tab === 'MIP' ? ['Count', 'Avg Sci', 'Avg Skl', 'Flag'] : []),
    ...(tab === 'IP' ? ['Count', 'Avg T Score / %', 'Flag'] : []),
    ...(['Refresher', 'GTG', 'HO', 'RTM'].includes(tab) ? ['Count', 'Avg Score', 'Flag'] : []),
    ...(['Capsule', 'Pre_AP'].includes(tab) ? ['Count', 'Avg Score', 'Flag'] : []),
  ];

  // ─── SKELETON RENDERERS ───
  // Show while respective stage is loading
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
          
          {(['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'Pre_AP'].includes(tab)) && (
            <div className="fy-selector flex-center gap-2 mr-2">
              <label className="text-xs-bold text-muted uppercase">FISCAL YEAR</label>
              <select 
                className="form-select glass-panel fy-select" 
                value={selectedFYs[tab]} 
                title="Select Fiscal Year"
                aria-label="Select Fiscal Year"
                onChange={(e) =>
                  setSelectedFYs(prev => ({
                    ...prev,
                    [tab]: e.target.value
                  }))
                }
              >
                {FY_OPTIONS.map(fy => (
                  <option key={fy} value={fy}>{fy}</option>
                ))}
              </select>
            </div>
          )}

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

      {/* Training Type Tabs */}
      <div className="tab-row">
        {ALL_TRAINING_TYPES.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`btn btn-tab ${tab === t ? 'btn-primary' : 'btn-secondary'}`}>{t}</button>
        ))}
      </div>

      {/* View By Switcher */}
      <div className="flex gap-12 mb-16 items-center flex-wrap">
        <label className="text-xs-bold text-muted uppercase">View Data By:</label>
        <div className="flex bg-card-panel p-3 border-radius-8">
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

      {/* KPI Cards - Progressive Rendering Stage 0 (KPI) */}
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
        </motion.div>
      )}

      {/* Insight Strip */}
      {pageMode !== 'performance-insights' && tab === 'IP' && (
        <InsightStrip
          text="Performance stable; Revance declining; 120 candidates pending training."
          variant="primary"
          icon="trending"
        />
      )}
      {pageMode === 'performance-insights' && (
        <InsightStrip
          text="Iluma leading consistently; Derma shows volatility in last 3 months."
          variant="primary"
          icon="check"
        />
      )}

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

      {/* --- IP SPECIFIC VIEWS - Progressive Rendering Stage 5 (Lazy Matrix) --- */}
      {subView === 'ip_matrix' && (
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
                    {Object.keys(ipData.clusterMonthMap).map(clusterName => {
                      const clusterData = ipData.clusterMonthMap[clusterName];
                      const isOpen = expanded.has(clusterName);
                      const ePct = getPercent(clusterData.elite, clusterData.total);
                      const lPct = getPercent(clusterData.low, clusterData.total);

                      return (
                        <Fragment key={clusterName}>
                          <tr onClick={() => toggleExpand(clusterName)} className={`cursor-pointer ${ePct > 70 ? 'bg-success-faint' : lPct > 30 ? 'bg-danger-faint' : ''}`}>
                            <td>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                            <td className="font-bold">{clusterName}</td>
                            <td className="td-center font-semibold">{clusterData.total}</td>
                            {renderSummaryPercent(clusterData.elite, clusterData.total, 50, 'text-success')}
                            {renderSummaryPercent(clusterData.high, clusterData.total, 50, 'text-success')}
                            {renderSummaryPercent(clusterData.medium, clusterData.total, 40, 'text-warning')}
                            {renderSummaryPercent(clusterData.low, clusterData.total, 30, 'text-danger')}
                            {MONTHS.map(mo => renderPerformanceCell(clusterData.months[mo], mo))}
                          </tr>

                          {isOpen && Object.keys(ipData.teamMonthMap[clusterName] || {}).map(teamName => {
                            const teamData = ipData.teamMonthMap[clusterName][teamName];
                            const ethPct = getPercent(teamData.elite, teamData.total);
                            const tlhPct = getPercent(teamData.low, teamData.total);

                            return (
                              <tr key={teamName} className={`${ethPct > 70 ? 'bg-success-faint' : tlhPct > 30 ? 'bg-danger-faint' : ''} text-xs`}>
                                <td></td>
                                <td className="pl-24">↳ {teamName}</td>
                                <td className="td-center font-semibold">{teamData.total}</td>
                                {renderSummaryPercent(teamData.elite, teamData.total, 50, 'text-success')}
                                {renderSummaryPercent(teamData.high, teamData.total, 50, 'text-success')}
                                {renderSummaryPercent(teamData.medium, teamData.total, 40, 'text-warning')}
                                {renderSummaryPercent(teamData.low, teamData.total, 30, 'text-danger')}
                                {MONTHS.map(mo => renderPerformanceCell(teamData.months[mo], mo))}
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
          </motion.div>
        )
      )}

      {/* --- AP EVENT FUNNEL MATRIX - Progressive Rendering Stage 1 (Grouped) --- */}
      {subView === 'grouped' && tab === 'AP' && (
        groupedStage === 'loading' ? (
          <TableSkeleton />
        ) : apData ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="glass-panel overflow-hidden">
              <div className="card-header">
                <h3 className="text-lg m-0">AP Notified vs Attended Matrix</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table w-full min-w-1000">
                  <thead>
                    <tr>
                      <th className="w-40"></th>
                      <th className="min-w-160">Cluster / Team</th>
                      <th className="td-center">Total Notified</th>
                      <th className="td-center">Total Attended</th>
                      {MONTHS.map(mo => <th key={mo} className="td-center min-w-90">{formatMonthLabel(mo)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(apData.clusterMonthMap).sort().map(clusterName => {
                      const clusterData = apData.clusterMonthMap[clusterName];
                      const isOpen = expanded.has(clusterName);

                      return (
                        <Fragment key={clusterName}>
                          <tr onClick={() => toggleExpand(clusterName)} className="cursor-pointer tr-cluster">
                            <td>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                            <td className="font-bold">{clusterName}</td>
                            <td className="td-center font-semibold">{clusterData.totalNotified}</td>
                            <td className="td-center font-semibold text-success">{clusterData.totalAttended}</td>
                            {MONTHS.map(mo => {
                              const cell = clusterData.months[mo];
                              if (!cell || (!cell.notified && !cell.attended)) return <td key={mo} className="td-center text-muted-30">—</td>;
                              const pct = cell.notified > 0 ? Math.round((cell.attended / cell.notified) * 100) : 0;
                              const isWarning = cell.attended > cell.notified;
                              const isPerfect = pct === 100 && cell.notified > 0;
                              
                              return (
                                <td key={mo} className={`td-center ${isWarning ? 'bg-warning-light' : isPerfect ? 'bg-success-light' : ''}`}>
                                  <div className={`font-semibold ${isWarning ? 'text-danger' : ''}`}>{cell.attended} / {cell.notified}</div>
                                  {cell.notified > 0 && <div className="text-xxs text-muted-70">({pct}%)</div>}
                                </td>
                              );
                            })}
                          </tr>

                          {isOpen && Object.keys(apData.teamMonthMap[clusterName] || {}).sort().map(teamName => {
                            const teamData = apData.teamMonthMap[clusterName][teamName];
                            return (
                              <tr key={teamName} className="text-xs">
                                <td></td>
                                <td className="pl-24">↳ {teamName}</td>
                                <td className="td-center font-semibold">{teamData.totalNotified}</td>
                                <td className="td-center font-semibold text-success">{teamData.totalAttended}</td>
                                {MONTHS.map(mo => {
                                  const cell = teamData.months[mo];
                                  if (!cell || (!cell.notified && !cell.attended)) return <td key={mo} className="td-center text-muted-30">—</td>;
                                  const pct = cell.notified > 0 ? Math.round((cell.attended / cell.notified) * 100) : 0;
                                  const isWarning = cell.attended > cell.notified;
                                  const isPerfect = pct === 100 && cell.notified > 0;
                                  
                                  return (
                                    <td key={mo} className={`td-center ${isWarning ? 'bg-warning-light' : isPerfect ? 'bg-success-light' : ''}`}>
                                      <div className={`font-semibold ${isWarning ? 'text-danger' : ''}`}>{cell.attended} / {cell.notified}</div>
                                      {cell.notified > 0 && <div className="text-xxs text-muted-70">({pct}%)</div>}
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
          </motion.div>
        ) : null
      )}

      {/* --- AP PERFORMANCE MATRIX - Progressive Rendering Stage 3 --- */}
      {subView === 'ap_performance' && tab === 'AP' && (
        matrixStage === 'loading' ? (
          <MatrixSkeleton />
        ) : apPerfData ? (
          <APPerformanceMatrix 
            data={apPerfData} 
            fyMonths={MONTHS} 
            timelines={filteredTimelines} 
          />
        ) : null
      )}

      {/* --- MIP MATRICES - Progressive Rendering Stage 3 --- */}
      {subView === 'mip_attendance' && tab === 'MIP' && (
        matrixStage === 'loading' ? (
          <MatrixSkeleton />
        ) : mipAttendanceData ? (
          <MIPAttendanceMatrix data={mipAttendanceData} fyMonths={MONTHS} timelines={filteredTimelines} />
        ) : null
      )}
      {subView === 'mip_performance' && tab === 'MIP' && (
        matrixStage === 'loading' ? (
          <MatrixSkeleton />
        ) : mipPerfData ? (
          <MIPPerformanceMatrix data={mipPerfData} fyMonths={MONTHS} timelines={filteredTimelines} />
        ) : null
      )}

      {/* --- REFRESHER MATRICES - Progressive Rendering Stage 3 --- */}
      {subView === 'refresher_attendance' && tab === 'Refresher' && (
        matrixStage === 'loading' ? (
          <MatrixSkeleton />
        ) : refresherAttData ? (
          <RefresherAttendanceMatrix data={refresherAttData} fyMonths={MONTHS} timelines={filteredTimelines} />
        ) : null
      )}
      {subView === 'refresher_performance' && tab === 'Refresher' && (
        matrixStage === 'loading' ? (
          <MatrixSkeleton />
        ) : refresherPerfData ? (
          <RefresherPerformanceMatrix data={refresherPerfData} fyMonths={MONTHS} timelines={filteredTimelines} />
        ) : null
      )}

      {/* --- CAPSULE MATRICES - Progressive Rendering Stage 3 --- */}
      {subView === 'capsule_attendance' && tab === 'Capsule' && (
        matrixStage === 'loading' ? (
          <MatrixSkeleton />
        ) : capsuleAttData ? (
          <CapsuleAttendanceMatrix data={capsuleAttData} fyMonths={MONTHS} timelines={filteredTimelines} />
        ) : null
      )}
      {subView === 'capsule_performance' && tab === 'Capsule' && (
        matrixStage === 'loading' ? (
          <MatrixSkeleton />
        ) : capsulePerfData ? (
          <CapsulePerformanceMatrix data={capsulePerfData} fyMonths={MONTHS} timelines={filteredTimelines} />
        ) : null
      )}

      {/* GROUPED RANKINGS FOR OTHER TABS - Progressive Rendering Stage 1 (Grouped) */}
      {subView === 'grouped' && tab !== 'IP' && tab !== 'AP' && tab !== 'MIP' && tab !== 'Refresher' && tab !== 'Capsule' && (
        groupedStage === 'loading' ? (
          <TableSkeleton />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="glass-panel overflow-hidden">
              <DataTable headers={genericHeaders}>
                {ranked.map(g => {
                  const isOpen = expanded.has(g.key);
                  return (
                    <Fragment key={g.key}>
                      <tr onClick={() => toggleExpand(g.key)} className="cursor-pointer">
                        <td className="font-bold text-accent">{g.rank}</td>
                        <td>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                        <td className="font-semibold">{g.key}</td>
                        {tab === 'MIP' && (() => {
                          const m = calcMIP(g.records);
                          const avg = (m.avgSci + m.avgSkl) / 2;
                          return <Fragment>
                            <td>{m.count}</td><td>{m.avgSci.toFixed(2)}</td>
                            <td className="font-bold">{m.avgSkl.toFixed(2)}</td>
                            <td><span className={`badge ${flagClass(flagScore(avg))}`}>{flagLabel(flagScore(avg))}</span></td>
                          </Fragment>;
                        })()}
                        {['Refresher', 'Capsule', 'Pre_AP', 'GTG', 'HO', 'RTM'].includes(tab) && (() => {
                          const m = calcGeneric(g.records);
                          return <Fragment>
                            <td>{m.count}</td>
                            <td className="font-bold">{m.avgScore > 0 ? m.avgScore.toFixed(2) : '—'}</td>
                            <td><span className={`badge ${flagClass(flagScore(m.avgScore))}`}>{flagLabel(flagScore(m.avgScore))}</span></td>
                          </Fragment>;
                        })()}
                      </tr>
                      {isOpen && g.records.map((r, ri) => (
                        <tr key={ri} className="bg-muted-light text-xs-muted">
                          <td /><td />
                          <td colSpan={genericHeaders.length - 2}>
                            <strong>{r.employee.name}</strong> ({r.employee.employeeId}) · {r.attendance.attendanceDate} · {r.attendance.attendanceStatus}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </DataTable>
            </div>
          </motion.div>
        )
      )}

      {/* --- IP TEAM RANK MATRIX --- */}
      {subView === 'ip_team_rank' && (
        matrixStage === 'loading' ? (
          <MatrixSkeleton />
        ) : (() => {
        // ── Derive cluster→teams structure from ipRankData ──
        const clusterTeams: Record<string, string[]> = {};
        Object.entries(ipRankData.teams).forEach(([team, entry]) => {
          if (!clusterTeams[entry.cluster]) clusterTeams[entry.cluster] = [];
          clusterTeams[entry.cluster].push(team);
        });
        Object.values(clusterTeams).forEach(teams => teams.sort());

        // Re-usable cell renderer
        const renderRankCell = (monthData: any, useClusterRank: boolean, mo: string, maxRankInGroup: number) => {
          if (!monthData) return <td key={mo} className="td-center border-l-muted text-muted">—</td>;

          const displayRank = useClusterRank ? monthData.clusterRank : monthData.rank;
          const isTop1 = displayRank === 1;
          const isTop3 = displayRank <= 3;
          const isBottom = displayRank === maxRankInGroup && maxRankInGroup > 3;

          return (
            <td key={mo} className={`td-center border-l-muted p-10-6 ${isTop1 ? 'bg-success-faint text-success font-extrabold' : isTop3 ? 'bg-warning-faint text-warning font-bold' : isBottom ? 'bg-danger-faint text-danger font-semibold' : ''}`}
              title={`Cluster Rank: ${monthData.clusterRank}\nOverall Rank: ${monthData.rank}\nScore: ${monthData.score}`}
            >
              <div className="text-sm">#{displayRank}</div>
              <div className="text-xxs opacity-60 mt-1">({monthData.score})</div>
            </td>
          );
        };

        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="glass-panel overflow-hidden border-t-accent">
              <div className="card-header bg-muted-light flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-bold m-0">IP Team Rankings</h3>
                  <p className="text-muted text-xs mt-1">Formula: (95·Elite + 82.5·High + 62.5·Med − 25·Low) · National Total Points · FY {selectedFY}</p>
                </div>
                <span className="badge badge-info font-bold">FY {selectedFY}</span>
              </div>

              <div className="p-14-20-6 border-b bg-accent-faint">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy size={16} className="text-accent" />
                  <span className="text-base font-bold text-accent">TABLE 1 — Cluster-wise Ranking</span>
                  <span className="text-muted text-xxs">Rank is within cluster only</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr className="bg-dark-10">
                      <th className="w-28 p-10-8"></th>
                      <th className="text-left p-10-14 min-w-180">Cluster / Team</th>
                      {MONTHS.map(mo => (
                        <th key={mo} className="td-center min-w-90 border-l-muted text-xs">{formatMonthLabel(mo)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(clusterTeams).sort().map(cluster => {
                      const isOpen = expanded.has(`rank_${cluster}`);
                      const teams = clusterTeams[cluster];
                      return (
                        <Fragment key={cluster}>
                          <tr 
                            onClick={() => toggleExpand(`rank_${cluster}`)} 
                            className="cursor-pointer tr-accent-faint border-b"
                          >
                            <td className="td-center p-10-8">
                              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </td>
                            <td className="font-bold p-10-14 tracking-wide">{cluster}</td>
                            {MONTHS.map(mo => {
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
                                <td key={mo} className="td-center border-l-muted text-xxs text-muted p-10-4 lh-12">
                                  {summary}
                                </td>
                              );
                            })}
                          </tr>
                          {isOpen && teams.map(teamName => {
                            const entry = ipRankData.teams[teamName];
                            return (
                              <tr key={teamName} className="border-b bg-white-01 text-xs">
                                <td />
                                <td className="pl-28 p-10-14 font-semibold">↳ {teamName}</td>
                                {MONTHS.map(mo => {
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

              <div className="p-14-20-6 border-t-2 tr-success-faint">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 size={16} className="text-success" />
                  <span className="text-base font-bold text-success">TABLE 2 — Overall National Ranking</span>
                  <span className="text-muted text-xxs">Rank across all teams</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table w-full border-collapse">
                  <thead>
                    <tr className="bg-dark-10">
                      <th className="text-left p-10-20 min-w-160">Team</th>
                      <th className="text-left min-w-120">Cluster</th>
                      {MONTHS.map(mo => (
                        <th key={mo} className="td-center min-w-90 border-l-muted text-xs">{formatMonthLabel(mo)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(ipRankData.teams).sort().map(teamName => {
                      const entry = ipRankData.teams[teamName];
                      return (
                        <tr key={teamName} className="border-b">
                          <td className="p-10-20 font-semibold">{teamName}</td>
                          <td><span className="badge badge-secondary text-xxs">{entry.cluster}</span></td>
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
          </motion.div>
        );
      })()
      )}

      {/* TIME SERIES - Progressive Rendering Stage 2 (TimeSeriesTable) */}
      {subView === 'timeseries' && (
        timeseriesStage === 'loading' ? (
          <TableSkeleton />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="glass-panel p-24">
              <h3 className="mb-16">Month-by-Month Trend — {tab}</h3>
              <TimeSeriesTable rows={timeSeries} months={months} mode={tsMode} onModeToggle={() => setTsMode(m => m === 'score' ? 'count' : 'score')} />
            </div>
          </motion.div>
        )
      )}

      {/* TRAINER ANALYTICS - Progressive Rendering Stage 3 (Trainer) */}
      {subView === 'trainer' && (
        trainerStage === 'loading' ? (
          <TableSkeleton />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="glass-panel overflow-hidden">
              <div className="p-20 border-b">
                <h3 className="m-0">Trainer Performance Analytics — {tab}</h3>
              </div>
              <TrainerTable stats={trainerStats} tab={tab} />
            </div>
          </motion.div>
        )
      )}

      {/* DRILL-DOWN - Progressive Rendering Stage 4 (Drilldown) */}
      {subView === 'drilldown' && tab !== 'IP' && tab !== 'MIP' && tab !== 'Refresher' && tab !== 'Capsule' && (
        drilldownStage === 'loading' ? (
          <TableSkeleton />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="glass-panel p-24">
              <h3 className="mb-16">Drill-Down: Cluster → Team → Employee</h3>
              <DrilldownPanel nodes={drilldownNodes} tab={tab} />
            </div>
          </motion.div>
        )
      )}

      {/* GAP ANALYSIS - Progressive Rendering Stage 1 (KPI stage, since gapMetrics computed in KPI stage) */}
      {subView === 'gap' && (
        kpiStage === 'loading' ? (
          <KPISkeletons />
        ) : (
          <div className="mt-8">
            <h3 className="mb-4">Gap Analysis: Eligible but Not Trained</h3>
            <DataTable headers={['Employee ID', 'Name', 'Team', 'State', 'Status', 'Reason']}>
              {eligibilityResults.length === 0 ? (
                <tr><td colSpan={6} className="td-center p-48 text-muted">No eligibility data. Configure rules in Demographics.</td></tr>
              ) : eligibilityResults.map((er, i) => {
                const hasAttended = attendance.some(a => a.employeeId === er.employeeId && a.trainingType === tab && a.attendanceStatus === 'Present');
                if (hasAttended || !er.eligibilityStatus) return null;
                return (
                  <tr key={i}>
                    <td className="font-semibold">{er.employeeId}</td>
                    <td>{er.name}</td>
                    <td>{er.team}</td>
                    <td>{er.cluster}</td>
                    <td><span className="badge badge-danger">Untrained Gap</span></td>
                    <td className="text-muted text-xs">{er.reasonIfNotEligible || '—'}</td>
                  </tr>
                );
              })}
            </DataTable>
          </div>
        )
      )}

      <GlobalFilterPanel
        isOpen={showGlobalFilters}
        onClose={() => setShowGlobalFilters(false)}
        onApply={handleGlobalApply}
        initialFilters={pageFilters}
        clusterOptions={allClusters}
        teamOptions={allTeams}
        trainerOptions={allTrainers}
        monthOptions={months}
        onClearAll={handleGlobalClear}
      />
    </div>
  );
};

export const ReportsAnalytics = memo(ReportsAnalyticsComponent);


