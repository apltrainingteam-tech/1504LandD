import { useMemo, useEffect } from 'react';
import { useDebugStore } from '../../../core/debug/debugStore';
import { buildUnifiedDataset, applyFilters, normalizeTrainingType } from '../../../core/engines/reportEngine';
import { getEligibleEmployees } from '../../../core/engines/eligibilityEngine';
import { getFiscalMonths } from '../../../core/utils/fiscalYear';
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


// Domain Hooks
import { useIPData } from './useIPData';
import { useAPData } from './useAPData';
import { useMIPData } from './useMIPData';
import { useRefresherData } from './useRefresherData';
import { useCapsuleData } from './useCapsuleData';

export interface UsePerformanceDataProps {
  employees: Employee[];
  attendance: Attendance[];
  scores: TrainingScore[];
  nominations: TrainingNomination[];
  rules: EligibilityRule[];
  masterTeams: any[];
  masterTrainers?: any[];
  tab: string;
  selectedFY: string;
  filter: ReportFilter;
  viewBy?: ViewByOption;
  tsMode?: 'score' | 'count';
  pageMode?: string;
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
export const usePerformanceData = ({
  employees, attendance, scores, nominations, rules, masterTeams, masterTrainers,
  tab, selectedFY, filter, viewBy = 'Team', tsMode = 'score', pageMode
}: UsePerformanceDataProps): PerformanceDataset & { resolutionLevel: 'Global' | 'Cluster' | 'Team' } => {
  const isEngineDebugActive = useDebugStore(state => state.enabled);
  const isActiveNomination = (n: TrainingNomination) =>
    (n as any).isCancelled !== true &&
    (n as any).isVoided !== true &&
    (n as any).finalStatus !== 'VOID';

  const resolutionLevel = useMemo(() => {
    const hasTeam = filter.teams.length > 0;
    const hasCluster = filter.clusters.length > 0;
    
    if (hasTeam) return 'Team';
    if (hasCluster) return 'Cluster'; // Viewing teams within a cluster
    return 'Global'; // Viewing clusters
  }, [filter.teams, filter.clusters]);

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


  const MONTHS = useMemo(() => getFiscalMonths(selectedFY), [selectedFY]);
  const activeNT = useMemo(() => normalizeTrainingType(tab), [tab]);

  // Data Normalization (Heavy - Cached internally)
  const normalizedAttendance = useMemo(() => {
    return logStep("Attendance Normalization", () => {
      const result = attendance.map(a => {
        let m = a.month || a.attendanceDate || '';
        if (m && !/^\d{4}-\d{2}$/.test(m)) m = m.substring(0, 7);
        return { ...a, month: m };
      });
      saveSnapshot("normalizedAttendance", result);
      return result;
    });
  }, [attendance]);


  const rawUnified = useMemo(() => {
    return logStep("Unified Dataset Construction", () => {
      // We use a simple hash of input lengths to decide if we should re-compute
      const inputHash = [employees.length, attendance.length, scores.length, nominations.length, rules.length].join('|');
      
      const result = globalComputationCaches.grouping.compute([inputHash, activeNT], () => {
        const att = normalizedAttendance.filter(a => normalizeTrainingType(a.trainingType) === activeNT);
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
      saveSnapshot("rawUnified", result);
      return result;
    });
  }, [activeNT, normalizedAttendance, scores, nominations, employees, masterTeams, rules, tab, attendance]);


  const unified = useMemo(() => {
    return logStep("Filter Application", () => {
      let ds = applyFilters(rawUnified, filter, masterTeams);
      if (['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'PRE_AP'].includes(tab)) {
        ds = ds.filter(r => {
          const m = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7);
          return MONTHS.includes(m);
        });
      }
      saveSnapshot("filteredUnified", ds);
      return ds;
    });
  }, [rawUnified, filter, tab, MONTHS, masterTeams]);


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
