/**
 * Advanced Computation Memoization Hook
 * 
 * Separates KPI, drilldown, and table computations into independent memoized hooks.
 * Reduces re-computation when only one computation parameter changes.
 */

import { useMemo, useCallback } from 'react';
import { UnifiedRecord, GroupedData, ViewByOption } from '../../types/reports';
import {
  groupData, rankGroups, calcTrainerStats, buildDrilldown,
  buildTimeSeries, getGapData
} from '../../core/engines/reportEngine';
import { TrainingNomination, Demographics } from '../../types/attendance';
import { EligibilityResult } from '../../core/engines/eligibilityEngine';
import { Employee } from '../../types/employee';
import { getAvailableTrainers } from '../../core/engines/trainerEngine';
import { Team, Trainer } from '../../core/context/MasterDataContext';

/**
 * Hook: Compute grouped data independently
 * Memoizes grouping logic to prevent recomputation when other props change
 */
export function useGroupedData(
  unified: UnifiedRecord[],
  viewBy: ViewByOption,
  tabNoms: TrainingNomination[],
  employees: Employee[],
  masterTeams: Team[]
) {
  return useMemo(() => {
    return groupData(unified, viewBy, tabNoms, employees, masterTeams);
  }, [unified, viewBy, tabNoms, employees, masterTeams]);
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
export function useTrainerStats(unified: UnifiedRecord[], masterTrainers: Trainer[]) {
  return useMemo(() => calcTrainerStats(unified, masterTrainers), [unified, masterTrainers]);
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
  unified: UnifiedRecord[] = [],
  attendance: any[] = [], 
  trainingType?: string,
  masterTrainers: Trainer[] = [],
  selectedClusters: string[] = []
) {
  const allClusters = useMemo(() => {
    const clusters = [...new Set(unified.map(r => r?.employee?.cluster).filter((c): c is string => Boolean(c)))].sort();
    console.log("[FilterHook] Derived Clusters:", clusters);
    return clusters;
  }, [unified]);

  const allTeams = useMemo(() => {
    let filtered = unified;
    if (selectedClusters.length > 0) {
      filtered = unified.filter(r => selectedClusters.includes(r?.employee?.cluster || ''));
    }
    
    // Build unique team list from data
    const teamMap = new Map<string, string>(); // id -> label
    filtered.forEach(r => {
      const id = r?.employee?.teamId;
      const label = r?.employee?.team;
      if (id && label) {
        teamMap.set(id, label);
      }
    });

    return Array.from(teamMap.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [unified, selectedClusters]);
  
  const allTrainers = useMemo(() => {
    if (trainingType) {
      return getAvailableTrainers(trainingType, masterTrainers).map(t => ({
        id: t.id,
        label: `${t.name} (${t.category})`,
        avatarUrl: t.avatarUrl
      }));
    }
    if (masterTrainers && masterTrainers.length > 0) {
      return masterTrainers
        .filter(t => t.status === 'Active')
        .map(t => ({ 
          id: t.id, 
          label: `${t.name} (${t.category})`,
          avatarUrl: t.avatarUrl 
        }));
    }

    const uniqueIds = [...new Set(attendance.map(a => a.trainerId).filter((tr): tr is string => Boolean(tr)))].sort();
    return uniqueIds.map(id => ({ id, label: id }));
  }, [attendance, trainingType, masterTrainers]);
  
  return { allClusters, allTeams, allTrainers };
}






