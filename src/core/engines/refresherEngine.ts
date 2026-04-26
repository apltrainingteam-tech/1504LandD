/**
 * Refresher Engine
 * ⚠️ DO NOT IMPORT IN COMPONENTS — USE HOOKS ONLY
 */
import { EmployeeEventTimeline } from './apEngine';

// ─── TYPES & INTERFACES ──────────────────────────────────────────────────────

export interface RefresherCellSummary {
  notified: number;
  attended: number;
}

export interface RefresherMonthMapNode {
  totalNotified: number;
  totalAttended: number;
  months: Record<string, RefresherCellSummary>;
}

export interface RefresherAttendanceAggregates {
  clusterMonthMap: Record<string, RefresherMonthMapNode>;
}

export interface RefresherCandidatePerformance {
  employeeId: string;
  name: string;
  team: string;
  cluster: string;
  trainer: string;
  attendanceDate: string;
  science: number | null;
  skill: number | null;
  knowledge: number | null;
  situationHandling: number | null;
  presentation: number | null;
}

export interface RefresherPerformanceMonthCell {
  avgScience: number;
  avgSkill: number;
  avgKnowledge: number;
  avgSituation: number;
  avgPresentation: number;
  count: number;
}

export interface RefresherPerformanceTeamRow {
  team: string;
  cluster: string;
  months: Record<string, RefresherPerformanceMonthCell>;
}

export interface RefresherPerformanceClusterRow {
  cluster: string;
  months: Record<string, RefresherPerformanceMonthCell>;
  teams: Record<string, RefresherPerformanceTeamRow>;
}

export interface RefresherPerformanceAggregates {
  clusterMap: Record<string, RefresherPerformanceClusterRow>;
  globalKPIs: {
    totalAttended: number;
    avgScience: number;
    avgSkill: number;
    avgKnowledge: number;
    avgSituation: number;
    avgPresentation: number;
    highPerformersPct: number;
  };
}

// ─── ATTENDANCE ENGINE ───────────────────────────────────────────────────────

export function buildRefresherAttendanceMatrix(
  timelines: Map<string, EmployeeEventTimeline>,
  fyMonths: string[]
): RefresherAttendanceAggregates {
  const clusterMonthMap: Record<string, RefresherMonthMapNode> = {};
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

export function getRefresherPerformanceAggregates(
  timelines: Map<string, EmployeeEventTimeline>,
  fyMonths: string[]
): RefresherPerformanceAggregates {
  const clusterMap: Record<string, RefresherPerformanceClusterRow> = {};
  const DUMMY_TEAMS = new Set(['Team A', '—', 'Unknown Team']);

  const sums = { s: 0, k: 0, kn: 0, sh: 0, pr: 0 };
  const counts = { s: 0, k: 0, kn: 0, sh: 0, pr: 0 };
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

      if (!clusterMap[cluster].months[month]) clusterMap[cluster].months[month] = { avgScience: 0, avgSkill: 0, avgKnowledge: 0, avgSituation: 0, avgPresentation: 0, count: 0 };
      if (!clusterMap[cluster].teams[team].months[month]) clusterMap[cluster].teams[team].months[month] = { avgScience: 0, avgSkill: 0, avgKnowledge: 0, avgSituation: 0, avgPresentation: 0, count: 0 };

      totalAttended++;
      const s = att.scores;
      const vals = {
        s: s['scienceScore'], k: s['skillScore'], kn: s['knowledge'],
        sh: s['situationHandling'], pr: s['presentation']
      };

      const cMonth: any = clusterMap[cluster].months[month];
      const tMonth: any = clusterMap[cluster].teams[team].months[month];

      ['s', 'k', 'kn', 'sh', 'pr'].forEach(key => {
        const v = (vals as any)[key];
        if (typeof v === 'number') {
          (sums as any)[key] += v; (counts as any)[key]++;
          if (!cMonth[`_${key}Sum`]) { cMonth[`_${key}Sum`] = 0; cMonth[`_${key}Count`] = 0; }
          if (!tMonth[`_${key}Sum`]) { tMonth[`_${key}Sum`] = 0; tMonth[`_${key}Count`] = 0; }
          cMonth[`_${key}Sum`] += v; cMonth[`_${key}Count`]++;
          tMonth[`_${key}Sum`] += v; tMonth[`_${key}Count`]++;
        }
      });
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
      
      const scores = Object.values(att.scores).filter(v => typeof v === 'number') as number[];
      if (scores.length > 0) {
        candidateAvgSum += (scores.reduce((s, v) => s + v, 0) / scores.length);
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
        m.avgScience = m._sCount > 0 ? (m._sSum / m._sCount) : 0;
        m.avgSkill = m._kCount > 0 ? (m._kSum / m._kCount) : 0;
        m.avgKnowledge = m._knCount > 0 ? (m._knSum / m._knCount) : 0;
        m.avgSituation = m._shCount > 0 ? (m._shSum / m._shCount) : 0;
        m.avgPresentation = m._prCount > 0 ? (m._prSum / m._prCount) : 0;
      }
    });
  }

  return {
    clusterMap,
    globalKPIs: {
      totalAttended,
      avgScience: counts.s > 0 ? sums.s / counts.s : 0,
      avgSkill: counts.k > 0 ? sums.k / counts.k : 0,
      avgKnowledge: counts.kn > 0 ? sums.kn / counts.kn : 0,
      avgSituation: counts.sh > 0 ? sums.sh / counts.sh : 0,
      avgPresentation: counts.pr > 0 ? sums.pr / counts.pr : 0,
      highPerformersPct: uniqueIds.size > 0 ? (highPerformersCount / uniqueIds.size) * 100 : 0
    }
  };
}

export function getRefresherDrilldownList(
  timelines: Map<string, EmployeeEventTimeline>,
  filters: { cluster: string; team: string; month: string }
): RefresherCandidatePerformance[] {
  const results: RefresherCandidatePerformance[] = [];
  for (const timeline of timelines.values()) {
    if (timeline.cluster !== filters.cluster || timeline.team !== filters.team) continue;
    for (const att of timeline.attendances) {
      if (att.status !== 'Present' || att.month !== filters.month) continue;
      const s = att.scores;
      results.push({
        employeeId: timeline.employeeId,
        name: timeline.name,
        team: timeline.team,
        cluster: timeline.cluster,
        trainer: att.trainerId || 'Unknown',
        attendanceDate: att.date,
        science: typeof s['scienceScore'] === 'number' ? s['scienceScore'] : null,
        skill: typeof s['skillScore'] === 'number' ? s['skillScore'] : null,
        knowledge: typeof s['knowledge'] === 'number' ? s['knowledge'] : null,
        situationHandling: typeof s['situationHandling'] === 'number' ? s['situationHandling'] : null,
        presentation: typeof s['presentation'] === 'number' ? s['presentation'] : null
      });
    }
  }
  return results;
}

