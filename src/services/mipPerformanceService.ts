import { EmployeeEventTimeline } from './apIntelligenceService';

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

export interface MIPPerfMonthCell {
  avgScience: number;
  avgSkill: number;
  count: number;
}

export interface MIPPerfTeamRow {
  team: string;
  cluster: string;
  months: Record<string, MIPPerfMonthCell>;
}

export interface MIPPerfClusterRow {
  cluster: string;
  months: Record<string, MIPPerfMonthCell>;
  teams: Record<string, MIPPerfTeamRow>;
}

export interface MIPPerformanceAggregates {
  clusterMap: Record<string, MIPPerfClusterRow>;
  globalKPIs: {
    totalAttended: number;
    avgScience: number;
    avgSkill: number;
    highPerformersPct: number;
  };
}

export function getMIPPerformanceAggregates(
  timelines: Map<string, EmployeeEventTimeline>,
  fyMonths: string[]
): MIPPerformanceAggregates {
  const clusterMap: Record<string, MIPPerfClusterRow> = {};
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

    // High Performer Tracking (per candidate)
    // If a candidate scores >=80 on both in ANY month in the FY, they are a high performer.
    let isHighPerformer = false;

    // Process all Present attendances
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
      
      let hasScience = false;
      let hasSkill = false;

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
        hasScience = true;
      }

      if (typeof kVal === 'number') {
        globalSkillSum += kVal;
        globalSkillCount++;
        cMonth._kSum += kVal; cMonth._kCount++;
        tMonth._kSum += kVal; tMonth._kCount++;
        hasSkill = true;
      }

      cMonth.count++;
      tMonth.count++;

      if (hasScience && hasSkill && sVal! >= 80 && kVal! >= 80) {
        isHighPerformer = true;
      }
    }

    if (isHighPerformer) {
      highPerformersCount++;
    }
  }

  // Finalize averages
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

export function getMIPPerformanceDrilldown(
  timelines: Map<string, EmployeeEventTimeline>,
  filters: { cluster: string; team: string; month: string }
): MIPCandidatePerformance[] {
  const results: MIPCandidatePerformance[] = [];

  for (const timeline of timelines.values()) {
    if (timeline.cluster !== filters.cluster || timeline.team !== filters.team) continue;

    for (const att of timeline.attendances) {
      if (att.status !== 'Present' || att.month !== filters.month) continue;

      const scores = att.scores;
      const sVal = typeof scores['scienceScore'] === 'number' ? scores['scienceScore'] : null;
      const kVal = typeof scores['skillScore'] === 'number' ? scores['skillScore'] : null;

      results.push({
        employeeId: timeline.employeeId,
        name: timeline.name,
        team: timeline.team,
        cluster: timeline.cluster,
        trainer: att.trainerId || 'Unknown',
        attendanceDate: att.date,
        science: sVal,
        skill: kVal
      });
    }
  }

  return results;
}
