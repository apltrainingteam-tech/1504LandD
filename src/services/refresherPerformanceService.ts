import { EmployeeEventTimeline } from './apIntelligenceService';

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

export interface RefresherPerfMonthCell {
  avgScience: number;
  avgSkill: number;
  count: number;
}

export interface RefresherPerfTeamRow {
  team: string;
  cluster: string;
  months: Record<string, RefresherPerfMonthCell>;
}

export interface RefresherPerfClusterRow {
  cluster: string;
  months: Record<string, RefresherPerfMonthCell>;
  teams: Record<string, RefresherPerfTeamRow>;
}

export interface RefresherPerformanceAggregates {
  clusterMap: Record<string, RefresherPerfClusterRow>;
  globalKPIs: {
    totalAttended: number;
    avgScience: number;
    avgSkill: number;
    highPerformersPct: number;
  };
}

export function getRefresherPerformanceAggregates(
  timelines: Map<string, EmployeeEventTimeline>,
  fyMonths: string[]
): RefresherPerformanceAggregates {
  const clusterMap: Record<string, RefresherPerfClusterRow> = {};
  const DUMMY_TEAMS = new Set(['Team A', '—', 'Unknown Team']);

  let globalScienceSum = 0;
  let globalScienceCount = 0;
  let globalSkillSum = 0;
  let globalSkillCount = 0;
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

      if (!clusterMap[cluster].months[month]) clusterMap[cluster].months[month] = { avgScience: 0, avgSkill: 0, count: 0 };
      if (!clusterMap[cluster].teams[team].months[month]) clusterMap[cluster].teams[team].months[month] = { avgScience: 0, avgSkill: 0, count: 0 };

      totalAttended++;
      uniqueCandidateIds.add(timeline.employeeId);

      const sVal = att.scores['scienceScore'];
      const kVal = att.scores['skillScore'];
      
      const cMonth: any = clusterMap[cluster].months[month];
      const tMonth: any = clusterMap[cluster].teams[team].months[month];

      if (!cMonth._sSum) {
        cMonth._sSum = 0; cMonth._sCount = 0;
        cMonth._kSum = 0; cMonth._kCount = 0;
        tMonth._sSum = 0; tMonth._sCount = 0;
        tMonth._kSum = 0; tMonth._kCount = 0;
      }

      if (typeof sVal === 'number') {
        globalScienceSum += sVal;
        globalScienceCount++;
        cMonth._sSum += sVal; cMonth._sCount++;
        tMonth._sSum += sVal; tMonth._sCount++;
      }

      if (typeof kVal === 'number') {
        globalSkillSum += kVal;
        globalSkillCount++;
        cMonth._kSum += kVal; cMonth._kCount++;
        tMonth._kSum += kVal; tMonth._kCount++;
      }

      cMonth.count++;
      tMonth.count++;

      // High performer ≥ 80 on both Science and Skill
      if (typeof sVal === 'number' && typeof kVal === 'number' && sVal >= 80 && kVal >= 80) {
        isHighPerformer = true;
      }
    }

    if (isHighPerformer) {
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
      highPerformersPct: uniqueCandidateIds.size > 0 ? (highPerformersCount / uniqueCandidateIds.size) * 100 : 0
    }
  };
}

export function getRefresherPerformanceDrilldown(
  timelines: Map<string, EmployeeEventTimeline>,
  filters: { cluster: string; team: string; month: string }
): RefresherCandidatePerformance[] {
  const results: RefresherCandidatePerformance[] = [];

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
        skill: typeof scores['skillScore'] === 'number' ? scores['skillScore'] : null,
        knowledge: typeof scores['knowledge'] === 'number' ? scores['knowledge'] : null,
        situationHandling: typeof scores['situationHandling'] === 'number' ? scores['situationHandling'] : null,
        presentation: typeof scores['presentation'] === 'number' ? scores['presentation'] : null,
      });
    }
  }

  return results;
}
