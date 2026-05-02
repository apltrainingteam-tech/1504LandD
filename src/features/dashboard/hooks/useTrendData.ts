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
  IP: ["percent", "tScore"],
  AP: ["knowledge", "bse"],
  MIP: ["scienceScore", "skillScore"]
};

const MONTH_ORDER = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

/**
 * Robust Month Normalizer for Chart Axis
 * Converts YYYY-MM or long names to "MMM" (Apr, May, etc.)
 */
const normalizeMonthForChart = (m: any): string => {
  if (!m) return '';
  const str = String(m).trim().toLowerCase();
  
  // If already a short month name
  const shortMonths: Record<string, string> = {
    jan: 'Jan', feb: 'Feb', mar: 'Mar', apr: 'Apr', may: 'May', jun: 'Jun',
    jul: 'Jul', aug: 'Aug', sep: 'Sep', oct: 'Oct', nov: 'Nov', dec: 'Dec'
  };
  
  if (shortMonths[str.substring(0, 3)]) return shortMonths[str.substring(0, 3)];

  // If YYYY-MM
  if (/^\d{4}-\d{2}/.test(str)) {
    const monthNum = parseInt(str.split('-')[1]);
    const monthMap: Record<number, string> = {
      1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
      7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec'
    };
    return monthMap[monthNum] || '';
  }

  return '';
};

export const useTrendData = (rawUnified: UnifiedRecord[]): TrendPoint[] => {
  const { filters } = useGlobalFilters();
  const { trainingType, cluster: selectedCluster, team: selectedTeam } = filters;

  return useMemo(() => {
    if (!rawUnified || rawUnified.length === 0) return [];

    // STEP 1: Apply Hierarchy-Based Filtering (PRIORITY LOGIC)
    const filtered = rawUnified.filter(r => {
      // 1. Strict Training Type Filter
      if (r.attendance.trainingType !== trainingType) return false;

      // 2. Hierarchy Filter (Using actual Team and Cluster fields from record)
      const empTeam = r.employee.team || r.employee.teamId || '';
      const empCluster = r.employee.cluster || 'Others';

      // Highest priority → Team
      if (selectedTeam) {
        return empTeam === selectedTeam;
      }

      // Next → Cluster
      if (selectedCluster) {
        return empCluster === selectedCluster;
      }

      // Default → All clusters (Aggregate All)
      return true;
    });

    // STEP 2 & 3: Group by Month and Map Metrics
    const [m1, m2] = METRIC_MAP[trainingType] || ["percent", "tScore"];
    
    const monthGroups: Record<string, UnifiedRecord[]> = {};
    filtered.forEach(r => {
      // Robust month extraction from multiple possible fields
      const rawMonth = r.attendance.month || 
                       r.attendance.attendanceDate || 
                       (r as any).month || 
                       '';
                       
      const normalizedMonth = normalizeMonthForChart(rawMonth);
      
      // If month normalization fails, default to 'Apr' to prevent dropping records
      const finalMonth = normalizedMonth || 'Apr';

      if (!monthGroups[finalMonth]) monthGroups[finalMonth] = [];
      monthGroups[finalMonth].push(r);
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
  }, [rawUnified, trainingType, selectedCluster, selectedTeam]);
};
