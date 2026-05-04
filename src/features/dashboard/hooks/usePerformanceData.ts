import { useMemo, useEffect } from 'react';
import { useDebugStore } from '../../../core/debug/debugStore';
import { buildUnifiedDataset, applyFilters } from '../../../core/engines/reportEngine';
import { normalizeTrainingType } from '../../../core/engines/normalizationEngine';
import { getEligibleEmployees } from '../../../core/engines/eligibilityEngine';
import { getFiscalMonths, isWithinFY } from '../../../core/utils/fiscalYear';
import { buildEmployeeTimelines } from '../../../core/engines/apEngine';
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
import { useGlobalFilters } from '../../../core/context/GlobalFilterContext';

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

export const usePerformanceData = ({
  tab: tabProp, filter: filterProp, viewBy = 'Team', tsMode = 'score',
  employees: propsEmps, attendance: propsAtt, scores: propsScs, nominations: propsNoms
}: UsePerformanceDataProps): PerformanceDataset & { resolutionLevel: 'Global' | 'Cluster' | 'Team' } => {

  // 1. Core State Hooks
  const { filters: globalFilters } = useGlobalFilters();
  const {
    finalData,
    teams: masterTeams,
    trainers: masterTrainers,
    eligibilityRules: rules
  } = useMasterData();
  const isEngineDebugActive = useDebugStore(state => state.enabled);

  // 2. Derive Configuration
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
  const scores = propsScs || [];

  // 3. Metadata Hooks
  const resolutionLevel = useMemo(() => {
    if (globalFilters.team) return 'Team';
    if (globalFilters.cluster) return 'Cluster';
    return 'Global';
  }, [globalFilters.team, globalFilters.cluster]);

  const effectiveViewBy = useMemo(() => {
    if (viewBy) return viewBy;
    return resolutionLevel === 'Global' ? 'Cluster' : 'Team';
  }, [resolutionLevel, viewBy]);

  const MONTHS = useMemo(() => getFiscalMonths(selectedFY), [selectedFY]);
  const activeNT = useMemo(() => normalizeTrainingType(tab), [tab]);

  // 4. Persistence Effect
  useEffect(() => {
    saveSession({ employees, attendance, scores, nominations, rules, masterTeams, tab, selectedFY, filter });
  }, [employees, attendance, scores, nominations, rules, masterTeams, tab, selectedFY, filter]);

  // 5. Data Pipeline Hooks (MUST be called unconditionally)
  const normalizedAttendance = useMemo(() => {
    return attendance.map(a => {
      const rawDate = a.attendanceDate || a.notificationDate || a.date || '';
      let monthKey = a.month || '';
      if (!monthKey && rawDate) {
        if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
          monthKey = rawDate.substring(0, 7);
        } else {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          }
        }
      }
      return { ...a, month: monthKey };
    });
  }, [attendance]);

  const isActiveNomination = (n: TrainingNomination) =>
    (n as any).isCancelled !== true && (n as any).isVoided !== true && (n as any).finalStatus !== 'VOID';

  const rawUnified = useMemo(() => {
    if (!attendance.length) return [];
    return logStep("Unified Dataset Construction", () => {
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
  }, [activeNT, normalizedAttendance, scores, nominations, employees, masterTeams, rules, tab, attendance]);

  const tabNoms = useMemo(
    () => nominations.filter(n => (n as any).isCancelled !== true && normalizeTrainingType(n.trainingType) === activeNT),
    [nominations, activeNT]
  );

  const filteredData = useMemo(() => {
    if (!rawUnified.length) return [];
    return applyFilters(rawUnified, filter, masterTeams)
      .filter(row => isWithinFY((row.attendance as any).attendanceDate || (row.attendance as any).notificationDate, selectedFY));
  }, [rawUnified, filter, masterTeams, selectedFY]);

  const unified = filteredData;

  const activeTimelines = useMemo(() => {
    return buildEmployeeTimelines(
      unified
        .filter((u: any) => normalizeTrainingType(u.attendance.trainingType) === activeNT)
        .map((u: any) => u.attendance),
      tabNoms,
      masterTeams, activeNT,
      scores.filter(s => normalizeTrainingType(s.trainingType) === activeNT)
    );
  }, [unified, tabNoms, masterTeams, activeNT, scores]);

  // 6. Domain Sub-hooks (MUST be called unconditionally)
  const ipData = useIPData(unified, MONTHS, activeNT);
  const apData = useAPData(activeTimelines, MONTHS, activeNT, unified, tabNoms);
  const mipData = useMIPData(activeTimelines, MONTHS, activeNT, unified);
  const refresherData = useRefresherData(activeTimelines, MONTHS, activeNT, unified);
  const capsuleData = useCapsuleData(activeTimelines, MONTHS, activeNT, unified);

  const eligibilityResults = useMemo(() => {
    const rule = rules.find(r => normalizeTrainingType(r.trainingType) === activeNT);
    return getEligibleEmployees(activeNT as TrainingType, rule, employees, attendance, nominations);
  }, [activeNT, rules, employees, attendance, nominations]);

  const gapMetrics = useGapMetrics(tab, eligibilityResults, attendance);
  const groups = useGroupedData(unified, effectiveViewBy, tabNoms, employees, masterTeams);
  const ranked = useRankedGroups(groups, tab);
  const trainerStats = useTrainerStats(unified, masterTrainers || []);
  const drilldownNodes = useDrilldownNodes(unified, tab);
  const months = useMonthsFromData(unified);
  const timeSeries = useTimeSeries(groups, months, tab, tsMode);

  // 7. Final Output Construction (Handling early exit states gracefully)
  const isEmpty = !attendance.length || isEngineDebugActive;

  if (isEmpty) {
    return {
      MONTHS: isEngineDebugActive ? [] : MONTHS,
      activeNT,
      rawUnified: [],
      unified: [],
      filteredData: [],
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
      isDebugMode: isEngineDebugActive,
      resolutionLevel
    };
  }

  return {
    MONTHS,
    activeNT,
    rawUnified,
    unified,
    filteredData,
    ipData: ipData.ipData,
    ipRankData: ipData.ipRankData,
    apAttData: apData.apAttData,
    apPerfData: apData.apPerfData,
    mipAttData: mipData.mipAttData,
    mipPerfData: mipData.mipPerfData,
    refresherAttData: refresherData.refresherAttData,
    refresherPerfData: refresherData.refresherPerfData,
    capsuleAttData: capsuleData.capsuleAttData,
    capsulePerfData: capsuleData.capsulePerfData,
    rawTimelines: activeTimelines,
    filteredTimelines: activeTimelines,
    eligibilityResults,
    gapMetrics,
    groups,
    ranked,
    trainerStats,
    drilldownNodes,
    months,
    timeSeries,
    tabNoms,
    ipKPI: ipData.ipKPI,
    apKPI: apData.apKPI,
    mipKPI: mipData.mipKPI,
    refresherKPI: refresherData.refresherKPI,
    capsuleKPI: capsuleData.capsuleKPI,
    preApKPI: apData.preApKPI,
    resolutionLevel
  };
};
