/**
 * Capsule Engine
 * ⚠️ DO NOT IMPORT IN COMPONENTS — USE HOOKS ONLY
 */
import { EmployeeEventTimeline } from './apEngine';
import { normalizeScore } from '../utils/scoreNormalizer';

// ─── TYPES & INTERFACES ──────────────────────────────────────────────────────

export interface CapsuleCellSummary {
  notified: number;
  attended: number;
}

export interface CapsuleMonthMapNode {
  totalNotified: number;
  totalAttended: number;
  months: Record<string, CapsuleCellSummary>;
}

export interface CapsuleAttendanceAggregates {
  clusterMonthMap: Record<string, CapsuleMonthMapNode>;
  globalKPIs: {
    totalNotified: number;
    totalAttended: number;
    attendancePercent: number;
  };
}

export interface CapsuleCandidateAttendance {
  employeeId: string;
  name: string;
  team: string;
  trainer: string;
  date: string;
}

export interface CapsuleCandidatePerformance {
  employeeId: string;
  name: string;
  team: string;
  cluster: string;
  trainer: string;
  attendanceDate: string;
  score: number | null;
}

export interface CapsulePerformanceMonthCell {
  avgScore: number;
  count: number;
}

export interface CapsulePerformanceTeamRow {
  team: string;
  cluster: string;
  months: Record<string, CapsulePerformanceMonthCell>;
}

export interface CapsulePerformanceClusterRow {
  cluster: string;
  months: Record<string, CapsulePerformanceMonthCell>;
  teams: Record<string, CapsulePerformanceTeamRow>;
}

export interface CapsulePerformanceAggregates {
  clusterMap: Record<string, CapsulePerformanceClusterRow>;
  globalKPIs: {
    totalAttended: number;
    avgScore: number;
    highPerformersPct: number;
  };
}

// ─── ATTENDANCE ENGINE ───────────────────────────────────────────────────────

export const buildCapsuleAttendanceMatrix = (
  timelines: Map<string, EmployeeEventTimeline>,
  fyMonths: string[]
): CapsuleAttendanceAggregates => {
  const clusterMonthMap: Record<string, CapsuleMonthMapNode> = {};
  const DUMMY_TEAMS = new Set(['Team A', '—', 'Unknown Team']);

  for (const timeline of timelines.values()) {
    if (DUMMY_TEAMS.has(timeline.team) || DUMMY_TEAMS.has(timeline.cluster)) continue;
    const cluster = timeline.cluster;

    if (!clusterMonthMap[cluster]) clusterMonthMap[cluster] = { totalNotified: 0, totalAttended: 0, months: {} };

    for (const month of fyMonths) {
      if (!clusterMonthMap[cluster].months[month]) clusterMonthMap[cluster].months[month] = { notified: 0, attended: 0 };

      const isNotifiedMonth = timeline.notifications.some(n => n.month === month);
      const isAttendedMonth = timeline.attendances.some(a => a.month === month && a.status === 'Present');

      if (isNotifiedMonth) clusterMonthMap[cluster].months[month].notified++;
      if (isAttendedMonth) clusterMonthMap[cluster].months[month].attended++;
    }
  }

  let totalNotified = 0;
  let totalAttended = 0;

  for (const cluster of Object.values(clusterMonthMap)) {
    for (const data of Object.values(cluster.months)) {
      cluster.totalNotified += data.notified;
      cluster.totalAttended += data.attended;
      totalNotified += data.notified;
      totalAttended += data.attended;
    }
  }

  const attendancePercent = totalNotified > 0 ? (totalAttended / totalNotified) * 100 : 0;

  return {
    clusterMonthMap,
    globalKPIs: {
      totalNotified,
      totalAttended,
      attendancePercent
    }
  };
};

export function getCapsuleAttendanceDrilldown(
  timelines: Map<string, EmployeeEventTimeline>,
  filters: { cluster: string; team: string; month: string }
): CapsuleCandidateAttendance[] {
  const results: CapsuleCandidateAttendance[] = [];
  for (const timeline of timelines.values()) {
    if (timeline.cluster !== filters.cluster || timeline.team !== filters.team) continue;
    for (const att of timeline.attendances) {
      if (att.status !== 'Present' || att.month !== filters.month) continue;
      results.push({
        employeeId: timeline.employeeId,
        name: timeline.name,
        team: timeline.team,
        trainer: att.trainerId || 'Unknown',
        date: att.date
      });
    }
  }
  return results;
}

// ─── PERFORMANCE ENGINE ──────────────────────────────────────────────────────

export const getCapsulePerformanceAggregates = (
  timelines: Map<string, EmployeeEventTimeline>,
  fyMonths: string[]
): CapsulePerformanceAggregates => {
  const clusterMap: Record<string, CapsulePerformanceClusterRow> = {};
  const DUMMY_TEAMS = new Set(['Team A', '—', 'Unknown Team']);

  let globalScoreSum = 0;
  let globalScoreCount = 0;
  let totalAttended = 0;

  for (const timeline of timelines.values()) {
    if (DUMMY_TEAMS.has(timeline.team) || DUMMY_TEAMS.has(timeline.cluster)) continue;
    const cluster = timeline.cluster;
    const team = timeline.team;

    if (!clusterMap[cluster]) clusterMap[cluster] = { cluster, months: {}, teams: {} };
    if (!clusterMap[cluster].teams[team]) clusterMap[cluster].teams[team] = { team, cluster, months: {} };

    for (const att of timeline.attendances) {
      if (att.status !== 'Present') continue;
      const month = att.month;
      if (!fyMonths.includes(month)) continue;

      if (!clusterMap[cluster].months[month]) clusterMap[cluster].months[month] = { avgScore: 0, count: 0 };
      if (!clusterMap[cluster].teams[team].months[month]) clusterMap[cluster].teams[team].months[month] = { avgScore: 0, count: 0 };

      totalAttended++;
      const score = normalizeScore(att.scores['score']);

      const cMonth: any = clusterMap[cluster].months[month];
      const tMonth: any = clusterMap[cluster].teams[team].months[month];

      if (!cMonth._sSum && cMonth._sSum !== 0) { cMonth._sSum = 0; cMonth._sCount = 0; }
      if (!tMonth._sSum && tMonth._sSum !== 0) { tMonth._sSum = 0; tMonth._sCount = 0; }

      if (score !== null) {
        globalScoreSum += score; globalScoreCount++;
        cMonth._sSum += score; cMonth._sCount++;
        tMonth._sSum += score; tMonth._sCount++;
      }
      cMonth.count++; tMonth.count++;
    }
  }

  let highPerformersCount = 0;
  const uniqueIds = new Set<string>();
  for (const timeline of timelines.values()) {
    let candidateAvgSum = 0;
    let candidateAvgCount = 0;
    let hasAttended = false;
    for (const att of timeline.attendances) {
      if (att.status !== 'Present') continue;
      if (!fyMonths.includes(att.month)) continue;
      
      const score = normalizeScore(att.scores['score']);
      if (score !== null) {
        candidateAvgSum += score;
        candidateAvgCount++;
        hasAttended = true;
      }
    }
    if (hasAttended) uniqueIds.add(timeline.employeeId);
    if (candidateAvgCount > 0 && (candidateAvgSum / candidateAvgCount) >= 80) {
      highPerformersCount++;
    }
  }

  for (const c of Object.values(clusterMap)) {
    [c.months, ...Object.values(c.teams).map(t => t.months)].forEach(monthSet => {
      for (const m of Object.values(monthSet) as any[]) {
        m.avgScore = m._sCount > 0 ? (m._sSum / m._sCount) : 0;
      }
    });
  }

  return {
    clusterMap,
    globalKPIs: {
      totalAttended,
      avgScore: globalScoreCount > 0 ? globalScoreSum / globalScoreCount : 0,
      highPerformersPct: uniqueIds.size > 0 ? (highPerformersCount / uniqueIds.size) * 100 : 0
    }
  };
};

export function getCapsulePerformanceDrilldown(
  timelines: Map<string, EmployeeEventTimeline>,
  filters: { cluster: string; team: string; month: string }
): CapsuleCandidatePerformance[] {
  const results: CapsuleCandidatePerformance[] = [];
  for (const timeline of timelines.values()) {
    if (timeline.cluster !== filters.cluster || timeline.team !== filters.team) continue;
    for (const att of timeline.attendances) {
      if (att.status !== 'Present' || att.month !== filters.month) continue;
      results.push({
        employeeId: timeline.employeeId,
        name: timeline.name,
        team: timeline.team,
        cluster: timeline.cluster,
        trainer: att.trainerId || 'Unknown',
        attendanceDate: att.date,
        score: normalizeScore(att.scores['score'])
      });
    }
  }
  return results;
}

