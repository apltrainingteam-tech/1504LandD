import { useMemo } from 'react';
import { useGlobalFilters } from '../../../core/context/GlobalFilterContext';
import { UnifiedRecord } from '../../../types/reports';
import { normalizeScore } from '../../../core/utils/scoreNormalizer';
import { getSchema } from '../../../core/constants/trainingSchemas';

export interface TrendPoint {
  month: string;
  metric1: number;
  metric2: number;
}

const MONTH_ORDER = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

/**
 * Robust Month Normalizer for Chart Axis
 * Converts YYYY-MM or long names to "MMM" (Apr, May, etc.)
 */
const normalizeMonthForChart = (m: any): string => {
  if (!m) return '';
  const str = String(m).trim();
  const lower = str.toLowerCase();

  const shortMonths: Record<string, string> = {
    jan: 'Jan', feb: 'Feb', mar: 'Mar', apr: 'Apr', may: 'May', jun: 'Jun',
    jul: 'Jul', aug: 'Aug', sep: 'Sep', oct: 'Oct', nov: 'Nov', dec: 'Dec'
  };

  const prefix = lower.substring(0, 3);
  if (shortMonths[prefix]) return shortMonths[prefix];

  const yearMonthMatch = lower.match(/^(\d{4})-(\d{2})/);
  if (yearMonthMatch) {
    const monthNum = parseInt(yearMonthMatch[2], 10);
    const monthMap: Record<number, string> = {
      1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
      7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec'
    };
    return monthMap[monthNum] || '';
  }

  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const date = new Date(parsed);
    const monthMap: Record<number, string> = {
      0: 'Jan', 1: 'Feb', 2: 'Mar', 3: 'Apr', 4: 'May', 5: 'Jun',
      6: 'Jul', 7: 'Aug', 8: 'Sep', 9: 'Oct', 10: 'Nov', 11: 'Dec'
    };
    return monthMap[date.getMonth()] || '';
  }

  return '';
};

const METRIC_FIELDS: Record<string, [string, string]> = {
  IP: ["percent", "tScore"],
  AP: ["knowledge", "bse"],
  MIP: ["scienceScore", "skillScore"]
};

const avg = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const parseChartScore = (value: any): number | null => {
  const normalized = normalizeScore(value);
  return typeof normalized === 'number' && !Number.isNaN(normalized) ? normalized : null;
};

const extractMetricValue = (record: UnifiedRecord, key: string, trainingType: string): number | null => {
  const scores = record.score?.scores;
  if (!scores) return null;

  const direct = parseChartScore(scores[key]);
  if (direct !== null) return direct;

  if (trainingType === 'AP') {
    if (key === 'knowledge') {
      return parseChartScore(
        scores['knowledge'] ?? scores['knowledgeScore'] ?? scores['percent'] ?? scores['testScore'] ?? scores['Score'] ?? scores['test']
      );
    }

    if (key === 'bse') {
      const directBse = parseChartScore(scores['bse']);
      if (directBse !== null) return directBse;

      const bseKeys = ['grasping', 'participation', 'detailing', 'rolePlay', 'punctuality', 'grooming', 'behaviour'];
      const values = bseKeys
        .map(k => parseChartScore(scores[k]))
        .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
      return values.length ? avg(values) : null;
    }
  }

  if (trainingType === 'IP') {
    return parseChartScore(scores[key] ?? scores['percent'] ?? scores['tScore'] ?? scores['Test Score'] ?? scores['Trainability Score']);
  }

  return direct;
};

export const useTrendData = (rawUnified: UnifiedRecord[], trainingTypeOverride?: string): TrendPoint[] => {
  const { filters } = useGlobalFilters();
  const { trainingType: globalTrainingType, cluster: selectedCluster, team: selectedTeam } = filters;
  const trainingType = trainingTypeOverride || globalTrainingType;
  const selectedTrainingType = trainingType === 'ALL' ? 'IP' : trainingType;

  return useMemo(() => {
    if (!rawUnified || rawUnified.length === 0) return [];

    // STEP 1: Apply Hierarchy-Based Filtering (PRIORITY LOGIC)
    const filtered = rawUnified.filter(r => {
      if (r.attendance.trainingType !== selectedTrainingType) return false;

      const empTeam = r.employee.team || r.employee.teamId || '';
      const empCluster = r.employee.cluster || 'Others';

      if (selectedTeam) return empTeam === selectedTeam;
      if (selectedCluster) return empCluster === selectedCluster;
      return true;
    });

    const schema = getSchema(selectedTrainingType);
    const [key1, key2] = METRIC_FIELDS[selectedTrainingType] || [
      schema.scoreFields[0] || 'score',
      schema.scoreFields[1] || schema.scoreFields[0] || 'score'
    ];

    const monthGroups: Record<string, UnifiedRecord[]> = {};
    filtered.forEach(r => {
      const rawMonth = r.attendance.month || r.attendance.attendanceDate || r.score?.dateStr || r.nomination?.month || r.nomination?.notificationDate || '';
      const normalizedMonth = normalizeMonthForChart(rawMonth);
      if (!normalizedMonth) return;

      if (!monthGroups[normalizedMonth]) monthGroups[normalizedMonth] = [];
      monthGroups[normalizedMonth].push(r);
    });

    const result = Object.entries(monthGroups).map(([month, rows]) => {
      console.log("ROW SAMPLE:", rows[0]);
      console.log("KEYS:", key1, key2);

      // Cluster view: weighted average across team averages, weighted by record count.
      if (selectedTrainingType === 'IP' && selectedCluster && !selectedTeam) {
        const teams: Record<string, UnifiedRecord[]> = {};
        rows.forEach(r => {
          const empTeam = r.employee.team || r.employee.teamId || 'Unknown';
          if (!teams[empTeam]) teams[empTeam] = [];
          teams[empTeam].push(r);
        });

        let totalWeight1 = 0;
        let weightedSum1 = 0;
        let totalWeight2 = 0;
        let weightedSum2 = 0;

        Object.values(teams).forEach(teamRows => {
          const values1 = teamRows
            .map(r => extractMetricValue(r, key1, selectedTrainingType))
            .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));

          const values2 = teamRows
            .map(r => extractMetricValue(r, key2, selectedTrainingType))
            .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));

          console.log("VALUES1:", values1);
          console.log("VALUES2:", values2);

          if (values1.length) {
            const teamAvg1 = avg(values1);
            const weight = teamRows.length;
            weightedSum1 += teamAvg1 * weight;
            totalWeight1 += weight;
          }

          if (values2.length) {
            const teamAvg2 = avg(values2);
            const weight = teamRows.length;
            weightedSum2 += teamAvg2 * weight;
            totalWeight2 += weight;
          }
        });

        return {
          month,
          metric1: totalWeight1 ? Number(Math.round(weightedSum1 / totalWeight1)) : 0,
          metric2: totalWeight2 ? Number(Math.round(weightedSum2 / totalWeight2)) : 0
        };
      }

      const metric1Values: number[] = [];
      const metric2Values: number[] = [];

      rows.forEach(r => {
        const normalized1 = extractMetricValue(r, key1, selectedTrainingType);
        const normalized2 = extractMetricValue(r, key2, selectedTrainingType);

        if (typeof normalized1 === 'number' && !Number.isNaN(normalized1)) metric1Values.push(normalized1);
        if (typeof normalized2 === 'number' && !Number.isNaN(normalized2)) metric2Values.push(normalized2);
      });

      return {
        month,
        metric1: Number(Math.round(avg(metric1Values))) || 0,
        metric2: Number(Math.round(avg(metric2Values))) || 0
      };
    });

    const sorted = result.sort((a, b) => MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month));
    const normalized = sorted.map(r => ({
      month: normalizeMonthForChart(r.month) || String(r.month).slice(0, 3),
      metric1: Number(r.metric1),
      metric2: Number(r.metric2)
    }));
    return normalized;
  }, [rawUnified, trainingType, selectedCluster, selectedTeam]);
};
