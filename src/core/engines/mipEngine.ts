import { Attendance, TrainingNomination, TrainingScore, TrainingType } from '../../types/attendance';
import { Team } from '../context/MasterDataContext';
import { normalizeTrainingType } from './normalizationEngine';
import { normalizeText } from '../utils/textNormalizer';
import { normalizeScore } from '../utils/scoreNormalizer';
import { EmployeeEventTimeline } from './apEngine';

export interface MIPAttendanceCell {
  notified: number;
  attended: number;
}

export interface MIPMonthMapNode {
  totalNotified: number;
  totalAttended: number;
  months: Record<string, MIPAttendanceCell>;
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

export interface MIPPerformanceCell {
  avgScience: number;
  avgSkill: number;
  count: number;
}

export interface MIPPerformanceTeamRow {
  team: string;
  cluster: string;
  total: number;
  avgScience: number;
  avgSkill: number;
  months: Record<string, MIPPerformanceCell>;
}

export interface MIPPerformanceClusterRow {
  cluster: string;
  total: number;
  avgScience: number;
  avgSkill: number;
  months: Record<string, MIPPerformanceCell>;
  teams: Record<string, MIPPerformanceTeamRow>;
}

export interface MIPPerformanceAggregates {
  clusterMap: Record<string, MIPPerformanceClusterRow>;
  globalKPIs: {
    totalAttended: number;
    avgScience: number;
    avgSkill: number;
    uniqueCandidates: number;
    highPerformersPct: number;
  };
}

// ─── ATTENDANCE ENGINE ───────────────────────────────────────────────────────

export const buildMIPAttendanceMatrix = (
  timelines: Map<string, EmployeeEventTimeline>,
  fyMonths: string[]
): MIPAttendanceAggregates => {
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
};

// ─── PERFORMANCE ENGINE ──────────────────────────────────────────────────────

export const getMIPPerformanceAggregates = (
  timelines: Map<string, EmployeeEventTimeline>,
  fyMonths: string[]
): MIPPerformanceAggregates => {
  const clusterMap: Record<string, MIPPerformanceClusterRow> = {};
  const DUMMY_TEAMS = new Set(['Team A', '—', 'Unknown Team']);

  let globalScienceSum = 0;
  let globalScienceCount = 0;
  let globalSkillSum = 0;
  let globalSkillCount = 0;
  let totalAttended = 0;
  const uniqueCandidateIds = new Set<string>();

  for (const timeline of timelines.values()) {
    if (DUMMY_TEAMS.has(timeline.team) || DUMMY_TEAMS.has(timeline.cluster)) continue;
    const cluster = timeline.cluster;
    const team = timeline.team;

    if (!clusterMap[cluster]) clusterMap[cluster] = { cluster, total: 0, avgScience: 0, avgSkill: 0, months: {}, teams: {} };
    if (!clusterMap[cluster].teams[team]) clusterMap[cluster].teams[team] = { team, cluster, total: 0, avgScience: 0, avgSkill: 0, months: {} };

    const cNode = clusterMap[cluster];
    const tNode = cNode.teams[team];

    for (const att of timeline.attendances) {
      if (att.status !== 'Present') continue;
      const month = att.month;
      if (!fyMonths.includes(month)) continue;

      if (!clusterMap[cluster].months[month]) clusterMap[cluster].months[month] = { avgScience: 0, avgSkill: 0, count: 0 };
      if (!clusterMap[cluster].teams[team].months[month]) clusterMap[cluster].teams[team].months[month] = { avgScience: 0, avgSkill: 0, count: 0 };

      totalAttended++;
      if (!uniqueCandidateIds.has(timeline.employeeId)) {
        uniqueCandidateIds.add(timeline.employeeId);
        cNode.total++;
        tNode.total++;
      }

      const sVal = normalizeScore(att.scores['scienceScore']);
      const kVal = normalizeScore(att.scores['skillScore']);

      const cMonth: any = clusterMap[cluster].months[month];
      const tMonth: any = clusterMap[cluster].teams[team].months[month];

      if (!cMonth._sSum && cMonth._sSum !== 0) { cMonth._sSum = 0; cMonth._sCount = 0; cMonth._kSum = 0; cMonth._kCount = 0; }
      if (!tMonth._sSum && tMonth._sSum !== 0) { tMonth._sSum = 0; tMonth._sCount = 0; tMonth._kSum = 0; tMonth._kCount = 0; }
      
      if (!(cNode as any)._sSum) { (cNode as any)._sSum = 0; (cNode as any)._sCount = 0; (cNode as any)._kSum = 0; (cNode as any)._kCount = 0; }
      if (!(tNode as any)._sSum) { (tNode as any)._sSum = 0; (tNode as any)._sCount = 0; (tNode as any)._kSum = 0; (tNode as any)._kCount = 0; }

      if (sVal !== null) {
        globalScienceSum += sVal; globalScienceCount++;
        cMonth._sSum += sVal; cMonth._sCount++;
        tMonth._sSum += sVal; tMonth._sCount++;
        (cNode as any)._sSum += sVal; (cNode as any)._sCount++;
        (tNode as any)._sSum += sVal; (tNode as any)._sCount++;
      }
      if (kVal !== null) {
        globalSkillSum += kVal; globalSkillCount++;
        cMonth._kSum += kVal; cMonth._kCount++;
        tMonth._kSum += kVal; tMonth._kCount++;
        (cNode as any)._kSum += kVal; (cNode as any)._kCount++;
        (tNode as any)._kSum += kVal; (tNode as any)._kCount++;
      }

      cMonth.count++;
      tMonth.count++;
    }
  }

  let highPerformersCount = 0;
  for (const timeline of timelines.values()) {
    let candidateAvgSum = 0;
    let candidateAvgCount = 0;
    for (const att of timeline.attendances) {
      if (att.status !== 'Present') continue;
      const month = att.month;
      if (!fyMonths.includes(month)) continue;
      
      const sVal = normalizeScore(att.scores['scienceScore']);
      const kVal = normalizeScore(att.scores['skillScore']);
      
      let sessionSum = 0; let sessionCount = 0;
      if (sVal !== null) { sessionSum += sVal; sessionCount++; }
      if (kVal !== null) { sessionSum += kVal; sessionCount++; }
      
      if (sessionCount > 0) {
        candidateAvgSum += (sessionSum / sessionCount);
        candidateAvgCount++;
      }
    }
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
      t.avgScience = (t as any)._sCount > 0 ? ((t as any)._sSum / (t as any)._sCount) : 0;
      t.avgSkill = (t as any)._kCount > 0 ? ((t as any)._kSum / (t as any)._kCount) : 0;
    }
    c.avgScience = (c as any)._sCount > 0 ? ((c as any)._sSum / (c as any)._sCount) : 0;
    c.avgSkill = (c as any)._kCount > 0 ? ((c as any)._kSum / (c as any)._kCount) : 0;
  }

  return {
    clusterMap,
    globalKPIs: {
      totalAttended,
      avgScience: globalScienceCount > 0 ? globalScienceSum / globalScienceCount : 0,
      avgSkill: globalSkillCount > 0 ? globalSkillSum / globalSkillCount : 0,
      uniqueCandidates: uniqueCandidateIds.size,
      highPerformersPct: uniqueCandidateIds.size > 0 ? (highPerformersCount / uniqueCandidateIds.size) * 100 : 0
    }
  };
};

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
        science: normalizeScore(scores['scienceScore']),
        skill: normalizeScore(scores['skillScore'])
      });
    }
  }
  return results;
}

export interface RoleBifurcation {
  dm: number;
  rsm: number;
  dsm: number;
}

export interface MIPExecutiveKPIs {
  highestTeam: { name: string; total: number; bifurcation: RoleBifurcation };
  lowestTeam: { name: string; total: number; bifurcation: RoleBifurcation };
  totalManagers: { total: number; bifurcation: RoleBifurcation };
}

const categorizeMIPRole = (desig: string): 'dm' | 'rsm' | 'dsm' => {
  const d = (desig || '').toUpperCase();
  if (d.includes('DSM')) return 'dsm';
  if (d.includes('RSM') || d.includes('SLM') || d.includes('RM') || d.includes('ZSM') || d.includes('REGIONAL')) return 'rsm';
  // Default to DM for all other FLM/Manager roles in MIP context
  return 'dm';
};

export const calcMIPExecutiveKPIs = (
  timelines: Map<string, EmployeeEventTimeline>,
  fyMonths: string[]
): MIPExecutiveKPIs | null => {
  const teamStats = new Map<string, { 
    uniqueCandidates: Set<string>; 
    bifurcation: RoleBifurcation 
  }>();

  const globalBifurcation: RoleBifurcation = { dm: 0, rsm: 0, dsm: 0 };
  const globalCandidates = new Set<string>();

  const DUMMY_TEAMS = new Set(['Team A', '—', 'Unknown Team', 'Unknown', 'Unknown Team']);

  for (const timeline of timelines.values()) {
    if (!timeline.team || DUMMY_TEAMS.has(timeline.team)) continue;

    const attendedPresent = timeline.attendances.some(a => a.status === 'Present' && fyMonths.includes(a.month));
    if (!attendedPresent) continue;

    if (!teamStats.has(timeline.team)) {
      teamStats.set(timeline.team, { 
        uniqueCandidates: new Set(), 
        bifurcation: { dm: 0, rsm: 0, dsm: 0 } 
      });
    }

    const stats = teamStats.get(timeline.team)!;
    const role = categorizeMIPRole(timeline.designation);

    if (!stats.uniqueCandidates.has(timeline.employeeId)) {
      stats.uniqueCandidates.add(timeline.employeeId);
      stats.bifurcation[role]++;
    }

    if (!globalCandidates.has(timeline.employeeId)) {
      globalCandidates.add(timeline.employeeId);
      globalBifurcation[role]++;
    }
  }

  const teams = Array.from(teamStats.entries()).map(([name, s]) => ({
    name,
    total: s.uniqueCandidates.size,
    bifurcation: s.bifurcation
  })).sort((a, b) => b.total - a.total);

  if (teams.length === 0) return null;

  return {
    highestTeam: teams[0],
    lowestTeam: teams[teams.length - 1],
    totalManagers: {
      total: globalCandidates.size,
      bifurcation: globalBifurcation
    }
  };
};
