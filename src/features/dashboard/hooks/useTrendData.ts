import { useMemo } from 'react';
import { useGlobalFilters } from '../../../core/context/GlobalFilterContext';
import { UnifiedRecord } from '../../../types/reports';
import { normalizeScore } from '../../../core/utils/scoreNormalizer';

export interface TrendPoint {
  month: string;
  metric1: number | null;
  metric2: number | null;
}

const METRIC_MAP: Record<string, [string, string]> = {
  IP: ["testScore", "trainability"],
  AP: ["knowledge", "bse"],
  MIP: ["scienceScore", "skillScore"]
};

const MONTH_ORDER = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

export const useTrendData = (rawUnified: UnifiedRecord[]): TrendPoint[] => {
  const { filters } = useGlobalFilters();
  const { trainingType, cluster, team } = filters;

  return useMemo(() => {
    if (!rawUnified || rawUnified.length === 0) return [];

    // STEP 1: Apply Hierarchy-Based Filtering (PRIORITY LOGIC)
    const filtered = rawUnified.filter(r => {
      // Highest priority → Team
      if (team) {
        return (r.employee.teamId || r.employee.team) === team;
      }

      // Next → Cluster
      if (cluster) {
        return (r.employee.cluster || 'Others') === cluster;
      }

      // Default → All clusters
      return true;
    });

    // STEP 2 & 3: Group by Month and Map Metrics
    const [m1, m2] = METRIC_MAP[trainingType] || ["testScore", "trainability"];
    
    const monthGroups: Record<string, UnifiedRecord[]> = {};
    filtered.forEach(r => {
      const month = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7);
      if (!month) return;
      if (!monthGroups[month]) monthGroups[month] = [];
      monthGroups[month].push(r);
    });

    // STEP 4: Aggregate from RAW DATA ONLY
    const result = Object.entries(monthGroups).map(([month, rows]) => {
      let sum1 = 0, count1 = 0;
      let sum2 = 0, count2 = 0;

      rows.forEach(r => {
        const scores = r.score?.scores;
        if (!scores) return;

        // Extract raw metrics using the map
        const val1 = scores[m1];
        const val2 = scores[m2];

        if (val1 != null) {
          const s1 = normalizeScore(val1);
          if (s1 !== null) { sum1 += s1; count1++; }
        }
        if (val2 != null) {
          const s2 = normalizeScore(val2);
          if (s2 !== null) { sum2 += s2; count2++; }
        }
      });

      return {
        month,
        metric1: count1 > 0 ? Math.round(sum1 / count1) : null,
        metric2: count2 > 0 ? Math.round(sum2 / count2) : null
      };
    });

    // STEP 5: Sort Chronologically (Apr -> Mar)
    return result.sort((a, b) => {
      return MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month);
    });
  }, [rawUnified, trainingType, cluster, team]);
};
