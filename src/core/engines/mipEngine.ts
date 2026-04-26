/**
 * MIP Engine
 * ⚠️ DO NOT IMPORT IN COMPONENTS — USE HOOKS ONLY
 */
import { EmployeeEventTimeline } from './apEngine';

// ─── TYPES & INTERFACES ──────────────────────────────────────────────────────

export interface MIPCellSummary {
  notified: number;
  attended: number;
}

export interface MIPMonthMapNode {
  totalNotified: number;
  totalAttended: number;
  months: Record<string, MIPCellSummary>;
}

export interface MIPAttendanceAggregates {
  clusterMonthMap: Record<string, MIPMonthMapNode>;
}

export interface MIPCandidatePerformance {
  employeeId: string;
  name: string;
  team: string;
  cluster: string;
  trainer: string;
  attendanceDate: string;
  science: number | null;
  skill: number | null;
}

export interface MIPPerformanceMonthCell {
  avgScience: number;
  avgSkill: number;
  count: number;
}

export interface MIPPerformanceTeamRow {
  team: string;
  cluster: string;
  months: Record<string, MIPPerformanceMonthCell>;
}

export interface MIPPerformanceClusterRow {
  cluster: string;
  months: Record<string, MIPPerformanceMonthCell>;
  teams: Record<string, MIPPerformanceTeamRow>;
}

export interface MIPPerformanceAggregates {
  clusterMap: Record<string, MIPPerformanceClusterRow>;
  globalKPIs: {
    totalAttended: number;
    avgScience: number;
    avgSkill: number;
    highPerformersPct: number;
  };
}

// ─── ATTENDANCE ENGINE ───────────────────────────────────────────────────────

export function buildMIPAttendanceMatrix(
  timelines: Map<string, EmployeeEventTimeline>,
  fyMonths: string[]
): MIPAttendanceAggregates {
  const clusterMonthMap: Record<string, MIPMonthMapNode> = {};
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

  for (const cluster of Object.values(clusterMonthMap)) {
    for (const data of Object.values(cluster.months)) {
      cluster.totalNotified += data.notified;
      cluster.totalAttended += data.attended;
    }
  }

  return { clusterMonthMap };
}

// ─── PERFORMANCE ENGINE ──────────────────────────────────────────────────────

export function getMIPPerformanceAggregates(
  timelines: Map<string, EmployeeEventTimeline>,
  fyMonths: string[]
): MIPPerformanceAggregates {
  const clusterMap: Record<string, MIPPerformanceClusterRow> = {};
  const DUMMY_TEAMS = new Set(['Team A', '—', 'Unknown Team']);

  let globalScienceSum = 0;
  let globalScienceCount = 0;
  let globalSkillSum = 0;
  let globalSkillCount = 0;
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

      if (!clusterMap[cluster].months[month]) clusterMap[cluster].months[month] = { avgScience: 0, avgSkill: 0, count: 0 };
      if (!clusterMap[cluster].teams[team].months[month]) clusterMap[cluster].teams[team].months[month] = { avgScience: 0, avgSkill: 0, count: 0 };

      totalAttended++;

      const sVal = typeof att.scores['scienceScore'] === 'number' ? att.scores['scienceScore'] : null;
      const kVal = typeof att.scores['skillScore'] === 'number' ? att.scores['skillScore'] : null;

      const cMonth: any = clusterMap[cluster].months[month];
      const tMonth: any = clusterMap[cluster].teams[team].months[month];

      if (!cMonth._sSum && cMonth._sSum !== 0) { cMonth._sSum = 0; cMonth._sCount = 0; cMonth._kSum = 0; cMonth._kCount = 0; }
      if (!tMonth._sSum && tMonth._sSum !== 0) { tMonth._sSum = 0; tMonth._sCount = 0; tMonth._kSum = 0; tMonth._kCount = 0; }

      if (sVal !== null) {
        globalScienceSum += sVal; globalScienceCount++;
        cMonth._sSum += sVal; cMonth._sCount++;
        tMonth._sSum += sVal; tMonth._sCount++;
      }
      if (kVal !== null) {
        globalSkillSum += kVal; globalSkillCount++;
        cMonth._kSum += kVal; cMonth._kCount++;
        tMonth._kSum += kVal; tMonth._kCount++;
      }

      cMonth.count++;
      tMonth.count++;
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
      const month = att.month;
      if (!fyMonths.includes(month)) continue;
      
      const sVal = typeof att.scores['scienceScore'] === 'number' ? att.scores['scienceScore'] : null;
      const kVal = typeof att.scores['skillScore'] === 'number' ? att.scores['skillScore'] : null;
      
      let sessionSum = 0; let sessionCount = 0;
      if (sVal !== null) { sessionSum += sVal; sessionCount++; }
      if (kVal !== null) { sessionSum += kVal; sessionCount++; }
      
      if (sessionCount > 0) {
        candidateAvgSum += (sessionSum / sessionCount);
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
    for (const m of Object.values(c.months) as any[]) {
      m.avgScience = m._sCount > 0 ? (m._sSum / m._sCount) : 0;
      m.avgSkill = m._kCount > 0 ? (m._kSum / m._kCount) : 0;
    }
    for (const t of Object.values(c.teams)) {
      for (const m of Object.values(t.months) as any[]) {
        m.avgScience = m._sCount > 0 ? (m._sSum / m._sCount) : 0;
        m.avgSkill = m._kCount > 0 ? (m._kSum / m._kCount) : 0;
      }
    }
  }

  return {
    clusterMap,
    globalKPIs: {
      totalAttended,
      avgScience: globalScienceCount > 0 ? globalScienceSum / globalScienceCount : 0,
      avgSkill: globalSkillCount > 0 ? globalSkillSum / globalSkillCount : 0,
      highPerformersPct: uniqueIds.size > 0 ? (highPerformersCount / uniqueIds.size) * 100 : 0
    }
  };
}

export function getMIPDrilldownList(
  timelines: Map<string, EmployeeEventTimeline>,
  filters: { cluster: string; team: string; month: string }
): MIPCandidatePerformance[] {
  const results: MIPCandidatePerformance[] = [];
  for (const timeline of timelines.values()) {
    if (timeline.cluster !== filters.cluster || timeline.team !== filters.team) continue;
    for (const att of timeline.attendances) {
      if (att.status !== 'Present' || att.month !== filters.month) continue;
      const scores = att.scores;
      results.push({
        employeeId: timeline.employeeId,
        name: timeline.name,
        team: timeline.team,
        cluster: timeline.cluster,
        trainer: att.trainerId || 'Unknown',
        attendanceDate: att.date,
        science: typeof scores['scienceScore'] === 'number' ? scores['scienceScore'] : null,
        skill: typeof scores['skillScore'] === 'number' ? scores['skillScore'] : null
      });
    }
  }
  return results;
}

