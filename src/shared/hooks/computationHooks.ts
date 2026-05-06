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
import { normalizeTrainingType, toProperCase, normalizeForMatch } from '../../core/engines/normalizationEngine';
import { isWithinFY } from '../../core/utils/fiscalYear';

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
    return groupData(unified, viewBy, tabNoms, employees);
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
  data: (UnifiedRecord | Employee)[] = [],
  attendance: any[] = [], 
  trainingType?: string,
  masterTrainers: Trainer[] = [],
  selectedClusters: string[] = []
) {
  const allClusters = useMemo(() => {
    const clusters = [...new Set(data.map(r => {
      if ('employee' in r) return r.employee?.cluster;
      return r.cluster;
    }).filter((c): c is string => Boolean(c)))].sort();
    console.log("[FilterHook] Derived Clusters:", clusters);
    return clusters;
  }, [data]);

  const allTeams = useMemo(() => {
    let filtered = data;
    if (selectedClusters.length > 0) {
      filtered = data.filter(r => {
        const cluster = 'employee' in r ? r.employee?.cluster : r.cluster;
        return selectedClusters.includes(cluster || '');
      });
    }
    
    // Build unique team list from data
    const teamMap = new Map<string, string>(); // id -> label
    filtered.forEach(r => {
      const emp = 'employee' in r ? r.employee : r;
      const id = emp?.teamId;
      const label = emp?.team;
      if (id && label) {
        teamMap.set(id, label);
      }
    });

    return Array.from(teamMap.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data, selectedClusters]);
  
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







/**
 * Hook: Compute Trainer-Level KPI stats for TOE
 */
export function useTOEStats(
  attendance: any[],
  masterTrainers: Trainer[],
  selectedFY: string,
  filters: any
) {
  return useMemo(() => {
    const activeType = normalizeTrainingType(filters.trainingType);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const statsMap = new Map<string, {
      trainerName: string;
      batches: Set<string>;
      attendees: Set<string>;
      avatarUrl: string | null;
      category: string;
    }>();

    attendance.forEach(a => {
      const dateVal = a.attendanceDate || a.date || a.month;
      if (!dateVal) return;
      
      const d = new Date(dateVal);
      if (isNaN(d.getTime()) || d > today) return;
      if (!isWithinFY(dateVal, selectedFY)) return;

      const type = normalizeTrainingType(a.trainingType);
      if (filters.trainingType !== 'ALL' && type !== activeType) return;

      const rawTrainer = a.sessionTrainer || a.trainer || a.trainerId || 'Unassigned';
      const trainerName = toProperCase(rawTrainer);
      const rawTrainerId = a.trainerId || '';

      // Global trainer filter - Robust Matching (ID or Name)
      if (filters.trainer !== 'ALL') {
        const filterMT = masterTrainers.find(t => t.id === filters.trainer);
        const filterNorm = normalizeForMatch(filters.trainer);
        const recordNorm = normalizeForMatch(rawTrainer);
        const idNorm = normalizeForMatch(rawTrainerId);
        
        const isMatch = recordNorm === filterNorm || 
                        idNorm === filterNorm ||
                        (filterMT && recordNorm === normalizeForMatch(filterMT.name));
        
        if (!isMatch) return;
      }
      
      // Global team filter
      if (filters.team && a.teamId !== filters.team) return;

      if (!statsMap.has(trainerName)) {
        const mt = masterTrainers.find(t => 
          normalizeForMatch(t.name) === normalizeForMatch(rawTrainer) ||
          normalizeForMatch(t.id) === normalizeForMatch(rawTrainer)
        );
        statsMap.set(trainerName, {
          trainerName,
          batches: new Set(),
          attendees: new Set(),
          avatarUrl: mt?.avatarUrl || null,
          category: mt?.category || 'Unknown'
        });
      }

      const stats = statsMap.get(trainerName)!;
      const team = a.team || a.sessionTeam || 'Unknown';
      const dateStr = d.toISOString().split('T')[0];

      // Batch Identity Rules
      let bid = '';
      if (type === 'IP' || type === 'MIP') {
        bid = `${type}_${trainerName}_${dateStr}`;
      } else {
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        bid = `${type}_${trainerName}_${team}_${monthKey}`;
      }
      stats.batches.add(bid);

      // Candidates (Present only)
      if (String(a.attendanceStatus || '').toLowerCase() === 'present') {
        stats.attendees.add(a.employeeId);
      }
    });

    return Array.from(statsMap.values()).map(s => ({
      trainerName: s.trainerName,
      trainingsConducted: s.batches.size,
      candidatesTrained: s.attendees.size,
      avatarUrl: s.avatarUrl,
      category: s.category
    })).sort((a, b) => a.trainerName.localeCompare(b.trainerName));
  }, [attendance, masterTrainers, selectedFY, filters]);
}
