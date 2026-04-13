import { EmployeeEventTimeline } from './apIntelligenceService';

export interface CapsuleCandidatePerformance {
  employeeId: string;
  name: string;
  team: string;
  cluster: string;
  trainer: string;
  attendanceDate: string;
  score: number | null;
}

export interface CapsulePerfMonthCell {
  avgScore: number;
  count: number;
}

export interface CapsulePerfTeamRow {
  team: string;
  cluster: string;
  months: Record<string, CapsulePerfMonthCell>;
}

export interface CapsulePerfClusterRow {
  cluster: string;
  months: Record<string, CapsulePerfMonthCell>;
  teams: Record<string, CapsulePerfTeamRow>;
}

export interface CapsulePerformanceAggregates {
  clusterMap: Record<string, CapsulePerfClusterRow>;
  globalKPIs: {
    totalAttended: number;
    avgScore: number;
    highPerformersPct: number;
  };
}

export function getCapsulePerformanceAggregates(
  timelines: Map<string, EmployeeEventTimeline>,
  fyMonths: string[]
): CapsulePerformanceAggregates {
  const clusterMap: Record<string, CapsulePerfClusterRow> = {};
  const DUMMY_TEAMS = new Set(['Team A', 'Unknown', '—', 'Unknown Team', 'Unmapped']);

  let globalScoreSum = 0;
  let globalScoreCount = 0;
  let totalAttended = 0;
  
  const uniqueCandidateIds = new Set<string>();
  let highPerformersCount = 0;

  for (const timeline of timelines.values()) {
    if (DUMMY_TEAMS.has(timeline.team) || DUMMY_TEAMS.has(timeline.cluster)) continue;

    const cluster = timeline.cluster;
    const team = timeline.team;

    if (!clusterMap[cluster]) {
      clusterMap[cluster] = { cluster, months: {}, teams: {} };
    }
    if (!clusterMap[cluster].teams[team]) {
      clusterMap[cluster].teams[team] = { team, cluster, months: {} };
    }

    let isHighPerformer = false;

    for (const att of timeline.attendances) {
      if (att.status !== 'Present') continue;

      const month = att.month;
      if (!fyMonths.includes(month)) continue;

      if (!clusterMap[cluster].months[month]) clusterMap[cluster].months[month] = { avgScore: 0, count: 0 };
      if (!clusterMap[cluster].teams[team].months[month]) clusterMap[cluster].teams[team].months[month] = { avgScore: 0, count: 0 };

      totalAttended++;
      uniqueCandidateIds.add(timeline.employeeId);

      const scoreVal = att.scores['score'];
      
      const cMonth: any = clusterMap[cluster].months[month];
      const tMonth: any = clusterMap[cluster].teams[team].months[month];

      if (!cMonth._sum) {
        cMonth._sum = 0; cMonth._count = 0;
        tMonth._sum = 0; tMonth._count = 0;
      }

      if (typeof scoreVal === 'number') {
        globalScoreSum += scoreVal;
        globalScoreCount++;
        cMonth._sum += scoreVal; cMonth._count++;
        tMonth._sum += scoreVal; tMonth._count++;
        
        if (scoreVal >= 80) isHighPerformer = true;
      }

      cMonth.count++;
      tMonth.count++;
    }

    if (isHighPerformer) {
      highPerformersCount++;
    }
  }

  for (const c of Object.values(clusterMap)) {
    for (const m of Object.values(c.months) as any[]) {
      m.avgScore = m._count > 0 ? (m._sum / m._count) : 0;
    }
    for (const t of Object.values(c.teams)) {
      for (const m of Object.values(t.months) as any[]) {
        m.avgScore = m._count > 0 ? (m._sum / m._count) : 0;
      }
    }
  }

  return {
    clusterMap,
    globalKPIs: {
      totalAttended,
      avgScore: globalScoreCount > 0 ? globalScoreSum / globalScoreCount : 0,
      highPerformersPct: uniqueCandidateIds.size > 0 ? (highPerformersCount / uniqueCandidateIds.size) * 100 : 0
    }
  };
}

export function getCapsulePerformanceDrilldown(
  timelines: Map<string, EmployeeEventTimeline>,
  filters: { cluster: string; team: string; month: string }
): CapsuleCandidatePerformance[] {
  const results: CapsuleCandidatePerformance[] = [];

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
        score: typeof scores['score'] === 'number' ? scores['score'] : null
      });
    }
  }

  return results;
}
