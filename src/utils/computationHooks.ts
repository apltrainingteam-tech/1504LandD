/**
 * Advanced Computation Memoization Hook
 * 
 * Separates KPI, drilldown, and table computations into independent memoized hooks.
 * Reduces re-computation when only one computation parameter changes.
 */

import { useMemo, useCallback } from 'react';
import { UnifiedRecord, GroupedData, ViewByOption } from '../types/reports';
import {
  groupData, rankGroups, calcTrainerStats, buildDrilldown,
  buildTimeSeries, getGapData
} from '../services/reportService';
import { TrainingNomination, EligibilityResult, Demographics } from '../types/attendance';
import { Employee } from '../types/employee';
import { getAvailableTrainers, Trainer } from '../services/trainerService';

/**
 * Hook: Compute grouped data independently
 * Memoizes grouping logic to prevent recomputation when other props change
 */
export function useGroupedData(
  unified: UnifiedRecord[],
  viewBy: ViewByOption,
  tabNoms: TrainingNomination[],
  employees: Employee[]
) {
  return useMemo(() => {
    return groupData(unified, viewBy, tabNoms, employees);
  }, [unified, viewBy, tabNoms, employees]);
}

/**
 * Hook: Compute ranked groups
 */
export function useRankedGroups(groups: GroupedData[], tab: string) {
  return useMemo(() => rankGroups(groups, tab), [groups, tab]);
}

/**
 * Hook: Compute trainer statistics
 * Heavy operation - memoize separately
 */
export function useTrainerStats(unified: UnifiedRecord[]) {
  return useMemo(() => calcTrainerStats(unified), [unified]);
}

/**
 * Hook: Compute drilldown nodes
 * Very heavy nested loop operation - memoize separately
 */
export function useDrilldownNodes(unified: UnifiedRecord[], tab: string) {
  return useMemo(() => buildDrilldown(unified, tab), [unified, tab]);
}

/**
 * Hook: Compute time series data
 * Involves multiple filter passes - memoize separately
 */
export function useTimeSeries(
  groups: GroupedData[],
  months: string[],
  tab: string,
  mode: 'count' | 'score' = 'score'
) {
  return useMemo(() => {
    return buildTimeSeries(groups, months, tab, mode);
  }, [groups, months, tab, mode]);
}

/**
 * Hook: Compute gap metrics
 */
export function useGapMetrics(
  tab: string,
  eligibilityResults: EligibilityResult[],
  attendance: any[]
) {
  return useMemo(() => {
    return getGapData(tab, eligibilityResults, attendance);
  }, [tab, eligibilityResults, attendance]);
}

/**
 * Hook: Precompute all months from unified dataset
 * Extract month extraction logic to prevent inline computation in render
 */
export function useMonthsFromData(unified: UnifiedRecord[]) {
  return useMemo(() => {
    const monthsArray = unified
      .map(r => r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7))
      .filter((m): m is string => Boolean(m));
    return [...new Set(monthsArray)].sort();
  }, [unified]);
}

/**
 * Hook: Get dynamic filter options
 * Separate from main component to avoid inline mapping
 */
export function useFilterOptions(
  employees: Employee[], 
  attendance: any[], 
  trainingType?: string,
  masterTeams?: any[],
  masterTrainers?: Trainer[]
) {
  const allTeams = useMemo(() => {
    // If masterTeams provided, use Active teams from there
    if (masterTeams && masterTeams.length > 0) {
      return masterTeams
        .filter(t => t.status === 'Active')
        .map(t => t.teamName)
        .sort();
    }
    // Fallback to extraction from employees
    return [...new Set(employees.map(e => e.team).filter((t): t is string => Boolean(t)))].sort();
  }, [employees, masterTeams]);
  
  const allTrainers = useMemo(() => {
    // If trainingType and masterTrainers provided, use dynamic service logic
    if (trainingType) {
      return getAvailableTrainers(trainingType, masterTrainers).map(t => ({
        id: t.id,
        label: `${t.trainerName} (${t.category})`
      }));
    }
    // Fallback to active trainers from master list if no training type
    if (masterTrainers && masterTrainers.length > 0) {
      return masterTrainers
        .filter(t => t.status === 'Active')
        .map(t => ({ id: t.id, label: `${t.trainerName} (${t.category})` }));
    }
    // Deep fallback to existing data extraction
    const uniqueIds = [...new Set(attendance.map(a => a.trainerId).filter((tr): tr is string => Boolean(tr)))].sort();
    return uniqueIds.map(id => ({ id, label: id }));
  }, [attendance, trainingType, masterTrainers]);
  
  return { allTeams, allTrainers };
}
