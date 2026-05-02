import { useMemo, useEffect } from 'react';
import { useDebugStore } from '../../../core/debug/debugStore';
import { buildUnifiedDataset, applyFilters } from '../../../core/engines/reportEngine';
import { normalizeTrainingType } from '../../../core/engines/normalizationEngine';
import { getEligibleEmployees } from '../../../core/engines/eligibilityEngine';
import { getFiscalMonths, isWithinFY } from '../../../core/utils/fiscalYear';
import { buildEmployeeTimelines, filterTimelines } from '../../../core/engines/apEngine';
import { 
  useGapMetrics, 
  useGroupedData, 
  useRankedGroups, 
  useTrainerStats, 
  useDrilldownNodes, 
  useMonthsFromData, 
  useTimeSeries 
} from '../../../shared/hooks/computationHooks';

import { Employee } from '../../../types/employee';
import { Attendance, TrainingScore, TrainingNomination, EligibilityRule, TrainingType } from '../../../types/attendance';
import { ReportFilter, ViewByOption } from '../../../types/reports';
import { PerformanceDataset } from '../../../core/contracts/performance.contract';
import { globalComputationCaches } from '../../../core/utils/computationCache';
import { logStep } from '../../../core/debug/pipelineTracer';
import { saveSnapshot } from '../../../core/debug/snapshotStore';
import { saveSession } from '../../../core/debug/debugSession';
import { useMasterData } from '../../../core/context/MasterDataContext';


// Domain Hooks
import { useIPData } from './useIPData';
import { useAPData } from './useAPData';
import { useMIPData } from './useMIPData';
import { useRefresherData } from './useRefresherData';
import { useCapsuleData } from './useCapsuleData';

export interface UsePerformanceDataProps {
  tab: string;
  selectedFY: string;
  filter: ReportFilter;
  viewBy?: ViewByOption;
  tsMode?: 'score' | 'count';
  pageMode?: string;
  employees?: Employee[];
  attendance?: Attendance[];
  scores?: TrainingScore[];
  nominations?: TrainingNomination[];
}

/**
 * usePerformanceData
 * 
 * THE CORE ORCHESTRATION HOOK for the Performance Analytics Dashboard.
 * 
 * RESPONSIBILITIES:
 * 1. Normalize raw data streams (Employees, Attendance, Scores, Nominations)
 * 2. Build a unified "UnifiedRecord" dataset
 * 3. Orchestrate domain-specific hooks (IP, AP, MIP, etc.)
 * 4. Perform global analytics computations (Gap, TimeSeries, Grouping)
 * 
 * ⚠️ ARCHITECTURAL GUARDRAILS:
 * - DO NOT add domain-specific logic here. Add it to sub-hooks or engines.
 * - ALWAYS return a structure compliant with PerformanceDataset contract.
 * - USE useMemo for all heavy derived state.
 */
import { useGlobalFilters } from '../../../core/context/GlobalFilterContext';

export const usePerformanceData = ({
  tab: tabProp, selectedFY: fyProp, filter: filterProp, viewBy = 'Team', tsMode = 'score', pageMode,
  employees: propsEmps, attendance: propsAtt, scores: propsScs, nominations: propsNoms
}: UsePerformanceDataProps): PerformanceDataset & { resolutionLevel: 'Global' | 'Cluster' | 'Team' } => {
  const { filters: globalFilters } = useGlobalFilters();
  const { 
    finalData, 
    teams: masterTeams, 
    trainers: masterTrainers, 
    eligibilityRules: rules 
  } = useMasterData();

  // Use global filters as priority, but allow props to override
  const tab = globalFilters.trainingType !== 'ALL' ? globalFilters.trainingType : tabProp;
  const selectedFY = globalFilters.fiscalYear;
  const filter = useMemo(() => ({
    ...filterProp,
    trainer: globalFilters.trainer !== 'ALL' ? globalFilters.trainer : filterProp.trainer,
    teams: globalFilters.team ? [globalFilters.team] : (filterProp.teams || []),
    clusters: globalFilters.cluster ? [globalFilters.cluster] : (filterProp.clusters || [])
  }), [filterProp, globalFilters.trainer, globalFilters.team, globalFilters.cluster]);

  const employees = propsEmps || finalData.employeeData;
  const attendance = propsAtt || finalData.trainingData;
  const nominations = propsNoms || finalData.nominationData;
  const scores = propsScs || attendance; 

  console.log("=== PERFORMANCE PIPELINE START ===");
  console.log("DATA SOURCE OBJECT:", attendance);
  console.log("RAW trainingData COUNT:", attendance?.length);
  console.log("SAMPLE RAW RECORD:", attendance?.[0]);

  if (!attendance || attendance.length === 0) {
    console.error("❌ NO DATA REACHING PERFORMANCE LAYER");
  }

  const isEngineDebugActive = useDebugStore(state => state.enabled);
  const isActiveNomination = (n: TrainingNomination) =>
    (n as any).isCancelled !== true &&
    (n as any).isVoided !== true &&
    (n as any).finalStatus !== 'VOID';

  const resolutionLevel = useMemo(() => {
    const hasTeam = !!globalFilters.team;
    const hasCluster = !!globalFilters.cluster;
    
    if (hasTeam) return 'Team';
    if (hasCluster) return 'Cluster'; // Viewing teams within a cluster
    return 'Global'; // Viewing clusters
  }, [globalFilters.team, globalFilters.cluster]);

  const effectiveViewBy = useMemo(() => {
    if (resolutionLevel === 'Global') return 'Cluster' as ViewByOption;
    return 'Team' as ViewByOption;
  }, [resolutionLevel]);

  if (isEngineDebugActive) {
    return {
      MONTHS: [],
      activeNT: tab,
      rawUnified: [],
      unified: [],
      ipData: null,
      ipRankData: null,
      rawTimelines: new Map(),
      filteredTimelines: new Map(),
      apAttData: null,
      mipAttData: null,
      refresherAttData: null,
      capsuleAttData: null,
      apPerfData: null,
      mipPerfData: null,
      refresherPerfData: null,
      capsulePerfData: null,
      eligibilityResults: [],
      gapMetrics: null,
      groups: [],
      ranked: [],
      trainerStats: null,
      drilldownNodes: [],
      months: [],
      timeSeries: [],
      tabNoms: [],
      ipKPI: null,
      apKPI: null,
      mipKPI: null,
      refresherKPI: null,
      capsuleKPI: null,
      preApKPI: null,
      isDebugMode: true,
      resolutionLevel: 'Global'
    };
  }

  useEffect(() => {
    saveSession({ employees, attendance, scores, nominations, rules, masterTeams, tab, selectedFY, filter });
  }, [employees, attendance, scores, nominations, rules, masterTeams, tab, selectedFY, filter]);


  const MONTHS = useMemo(() => {
    const months = getFiscalMonths(selectedFY);
    console.log(`[PIPELINE] FISCAL RANGE (${selectedFY}):`, months);
    return months;
  }, [selectedFY]);
  
  const activeNT = useMemo(() => {
    const nt = normalizeTrainingType(tab);
    console.log(`[PIPELINE] ACTIVE TRAINING TYPE: "${tab}" -> normalized: "${nt}"`);
    return nt;
  }, [tab]);

  // Data Normalization (Heavy - Cached internally)
  const normalizedAttendance = useMemo(() => {
    return logStep("Attendance Normalization", () => {
      const result = attendance.map(a => {
        // Generate a robust monthKey (YYYY-MM)
        // If a.month already exists (legacy), use it. 
        // Otherwise, extract from attendanceDate or notificationDate.
        const rawDate = a.attendanceDate || a.notificationDate || a.date || '';
        let monthKey = a.month || '';

        if (!monthKey && rawDate) {
          // If rawDate is YYYY-MM-DD, take first 7 chars
          if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
            monthKey = rawDate.substring(0, 7);
          } else {
            // Try parsing if it's some other format (should already be normalized by upload)
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            }
          }
        }
        
        return { ...a, month: monthKey };
      });
      console.log("NORMALIZED COUNT:", result?.length);
      saveSnapshot("normalizedAttendance", result);
      return result;
    });
  }, [attendance]);


  const rawUnified = useMemo(() => {
    return logStep("Unified Dataset Construction", () => {
      // We use a simple hash of input lengths to decide if we should re-compute
      const inputHash = [employees.length, attendance.length, scores.length, nominations.length, rules.length].join('|');
      const cacheKey = `${globalFilters.trainingType}_${globalFilters.trainer}_${globalFilters.fiscalYear}_${inputHash}`;
      
      const result = globalComputationCaches.grouping.compute([cacheKey, activeNT], () => {
        const att = normalizedAttendance.filter(a => normalizeTrainingType(a.trainingType) === activeNT);
        console.log(`AFTER TYPE FILTER (${activeNT}):`, att?.length);

        const scs = scores.filter(s => normalizeTrainingType(s.trainingType) === activeNT);
        const noms = nominations
          .filter(isActiveNomination)
          .map(n => {
            let m = n.month || n.notificationDate || '';
            if (m && !/^\d{4}-\d{2}$/.test(m)) m = m.substring(0, 7);
            return { ...n, month: m };
          })
          .filter(n => normalizeTrainingType(n.trainingType) === activeNT);
          
        const rule = rules.find(r => normalizeTrainingType(r.trainingType) === activeNT);
        const eligResults = getEligibleEmployees(tab as TrainingType, rule, employees, attendance, nominations);
        
        return buildUnifiedDataset(employees, att, scs, noms, eligResults, masterTeams);
      });
      console.log("RAW UNIFIED COUNT:", result?.length);
      saveSnapshot("rawUnified", result);
      return result;
    });
  }, [activeNT, normalizedAttendance, scores, nominations, employees, masterTeams, rules, tab, attendance, globalFilters]);


  const unified = useMemo(() => {
    return logStep("Filter Application", () => {
      let ds = applyFilters(rawUnified, filter, masterTeams);
      console.log("AFTER CORE FILTERS:", ds?.length);

      const coreTabs = ['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'PRE_AP'];
      const normalizedCoreTabs = coreTabs.map(t => normalizeTrainingType(t));

      if (normalizedCoreTabs.includes(activeNT)) {
        ds = ds.filter(r => {
          const d = r.attendance.attendanceDate || r.attendance.date || r.attendance.month || '';
          const isMatch = isWithinFY(d, selectedFY);
          if (!isMatch && ds.length < 100) {
            console.warn(`[DATE MISMATCH] Record date "${d}" not in fiscal range for ${selectedFY}`);
          }
          return isMatch;
        });
        console.log("AFTER DATE FILTER:", ds?.length);
      }
      
      console.log("FINAL INPUT TO AGG:", ds?.length);
      if (ds?.length > 0) {
        console.log("SAMPLE FINAL RECORD:", ds[0]);
      } else {
        console.warn("⚠️ AGGREGATION INPUT IS EMPTY - Check if data exists for FY", selectedFY);
      }

      saveSnapshot("filteredUnified", ds);
      return ds;
    });
  }, [rawUnified, filter, tab, activeNT, MONTHS, masterTeams, selectedFY]);


  // Domain Orchestration
  const tabNoms = useMemo(
    () => nominations.filter(n => isActiveNomination(n) && normalizeTrainingType(n.trainingType) === activeNT),
    [nominations, activeNT]
  );

  // -- Universal Event Timelines --
  const rawTimelines = useMemo(() => {
    if (['AP', 'MIP', 'Refresher', 'Capsule', 'Pre_AP'].includes(activeNT)) {
      const normalizedNoms = nominations
        .filter(isActiveNomination)
        .map(n => {
          let m = n.month || n.notificationDate || '';
          if (m && !/^\d{4}-\d{2}$/.test(m)) m = m.substring(0, 7);
          return { ...n, month: m };
        })
        .filter(n => normalizeTrainingType(n.trainingType) === activeNT);
        
      return buildEmployeeTimelines(
        normalizedAttendance.filter(a => normalizeTrainingType(a.trainingType) === activeNT),
        normalizedNoms,
        masterTeams, activeNT,
        scores.filter(s => normalizeTrainingType(s.trainingType) === activeNT)
      );
    }
    return new Map();
  }, [normalizedAttendance, nominations, scores, activeNT, masterTeams]);

  const filteredTimelines = useMemo(() => {
    if (!['AP', 'MIP', 'Refresher', 'Capsule', 'Pre_AP'].includes(activeNT)) return new Map();
    return filterTimelines(rawTimelines, { trainer: filter.trainer, validMonths: MONTHS });
  }, [rawTimelines, activeNT, filter.trainer, MONTHS]);

  // Compose Sub-Domain Logic
  const { ipData, ipRankData, ipKPI } = useIPData(unified, MONTHS, activeNT);
  const { apAttData, apPerfData, apKPI, preApKPI } = useAPData(filteredTimelines, MONTHS, activeNT, unified, tabNoms);
  const { mipAttData, mipPerfData, mipKPI } = useMIPData(filteredTimelines, MONTHS, activeNT, unified);
  const { refresherAttData, refresherPerfData, refresherKPI } = useRefresherData(filteredTimelines, MONTHS, activeNT, unified);
  const { capsuleAttData, capsulePerfData, capsuleKPI } = useCapsuleData(filteredTimelines, MONTHS, activeNT, unified);

  // Eligibility & Gap
  const eligibilityResults = useMemo(() => {
    const rule = rules.find(r => normalizeTrainingType(r.trainingType) === activeNT);
    return getEligibleEmployees(activeNT as TrainingType, rule, employees, attendance, nominations);
  }, [activeNT, rules, employees, attendance, nominations]);
  
  const gapMetrics = useGapMetrics(tab, eligibilityResults, attendance);

  // Analytics Computation
  const groups = useGroupedData(unified, effectiveViewBy, tabNoms, employees, masterTeams);
  const ranked = useRankedGroups(groups, tab);
  const trainerStats = useTrainerStats(unified, masterTrainers || []);
  const drilldownNodes = useDrilldownNodes(unified, tab);
  
  const months = useMonthsFromData(unified);
  const timeSeries = useTimeSeries(groups, months, tab, tsMode);

  return {
    MONTHS,
    activeNT,
    rawUnified,
    unified,
    ipData,
    ipRankData,
    rawTimelines,
    filteredTimelines,
    apAttData,
    mipAttData,
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
    months,
    timeSeries,
    tabNoms,
    // KPIs
    ipKPI,
    apKPI,
    mipKPI,
    refresherKPI,
    capsuleKPI,
    preApKPI,
    resolutionLevel
  };
};
