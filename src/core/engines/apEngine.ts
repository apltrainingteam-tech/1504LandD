/**
 * AP Engine
 * ⚠️ DO NOT IMPORT IN COMPONENTS — USE HOOKS ONLY
 */
import { Attendance, TrainingNomination, TrainingScore } from '../../types/attendance';
import { normalizeText } from '../utils/textNormalizer';
import { Team } from '../context/MasterDataContext';
import { getTeamId } from '../utils/teamIdMapper';
import { normalizeTrainingType } from './reportEngine';

// ─── TYPES & INTERFACES ──────────────────────────────────────────────────────

export type EmployeeEventTimeline = {
  employeeId: string;
  name: string;
  team: string; 
  cluster: string;
  notifications: Array<{ date: string; month: string }>;
  attendances: Array<{ date: string; month: string; status: 'Present' | 'Absent'; trainerId?: string; scores: Record<string, number | null> }>;
};

export interface APCellSummary {
  notified: number;
  attended: number;
}

export interface APMonthMapNode {
  totalNotified: number;
  totalAttended: number;
  months: Record<string, APCellSummary>;
}

export interface APAggregates {
  clusterMonthMap: Record<string, APMonthMapNode>;
  teamMonthMap: Record<string, Record<string, APMonthMapNode>>;
  globalKPIs: {
    totalEmployeesNotified: number;
    totalEmployeesAttended: number;
    attendancePercent: number;
    defaulters: number;
    compositeScore: number;
  };
}

export interface APCandidatePerformance {
  employeeId: string;
  name: string;
  team: string;
  cluster: string;
  trainer: string;
  attendanceDate: string;
  knowledge: number | null;
  bse: number | null;
  // BSE Breakdown
  grasping: number | null;
  detailing: number | null;
  situationHandling: number | null;
  english: number | null;
  localLanguage: number | null;
  involvement: number | null;
  effort: number | null;
  confidence: number | null;
}

export interface APMonthCell {
  avgKnowledge: number;
  avgBSE: number;
  count: number;
}

export interface APTeamRow {
  team: string;
  cluster: string;
  months: Record<string, APMonthCell>;
}

export interface APClusterRow {
  cluster: string;
  months: Record<string, APMonthCell>;
  teams: Record<string, APTeamRow>;
}

export interface APPerformanceAggregates {
  clusterMap: Record<string, APClusterRow>;
  globalKPIs: {
    totalAttended: number;
    avgKnowledge: number;
    avgBSE: number;
    uniqueCandidates: number;
    lowestParameter: string;
    highPerformersPct: number;
  };
}

// ─── INTELLIGENCE ENGINE ─────────────────────────────────────────────────────

export function buildEmployeeTimelines(
  attendances: Attendance[],
  nominations: TrainingNomination[],
  masterTeams: Team[],
  targetType: string = 'AP',
  scores: TrainingScore[] = []
): Map<string, EmployeeEventTimeline> {
  const map = new Map<string, EmployeeEventTimeline>();
  const teamMap = Object.fromEntries(masterTeams.map(t => [t.id, t]));

  const getTimeline = (empId: string, empName: string, teamRaw: string | undefined): EmployeeEventTimeline => {
    if (!map.has(empId)) {
      const team = normalizeText(teamRaw || 'Unknown');
      const teamId = getTeamId(team, masterTeams);
      const cluster = teamId ? (teamMap[teamId]?.cluster || 'Unmapped') : 'Unmapped';
      map.set(empId, { employeeId: empId, name: empName || 'Unknown', team, cluster, notifications: [], attendances: [] });
    }
    return map.get(empId)!;
  };

  nominations.forEach(n => {
    if (normalizeTrainingType(n.trainingType) !== targetType) return;
    const t = getTimeline(n.employeeId, n.name, n.team);
    t.notifications.push({
      date: n.notificationDate || '',
      month: n.month || (n.notificationDate ? n.notificationDate.substring(0, 7) : '')
    });
  });

  attendances.forEach(a => {
    const aType = normalizeTrainingType(a.trainingType);
    if (aType !== targetType) return;
    
    const t = getTimeline(a.employeeId, (a as any).name || 'Unknown', a.team);
    // Join scores: match by employeeId + normalized trainingType
    const sc = scores.find(s =>
      s.employeeId === a.employeeId &&
      normalizeTrainingType(s.trainingType) === aType
    );
    
    const rawStatus = String(a.attendanceStatus || '').trim().toLowerCase();
    const isPresent = rawStatus === '' || rawStatus === 'present';
    
    t.attendances.push({
      date: a.attendanceDate || '',
      month: a.month || (a.attendanceDate ? a.attendanceDate.substring(0, 7) : ''),
      status: isPresent ? 'Present' : 'Absent',
      trainerId: a.trainerId,
      scores: sc?.scores || {}
    });
  });

  // Sort them chronologically
  for (const t of map.values()) {
    t.notifications.sort((a, b) => a.date.localeCompare(b.date));
    t.attendances.sort((a, b) => a.date.localeCompare(b.date));
  }

  return map;
}

export function filterTimelines(
  rawTimelines: Map<string, EmployeeEventTimeline>,
  filters: { trainer?: string; validMonths?: string[] }
): Map<string, EmployeeEventTimeline> {
  const filtered = new Map<string, EmployeeEventTimeline>();

  for (const [empId, timeline] of rawTimelines.entries()) {
    let keep = true;
    if (filters.trainer) {
      const hasTrainer = timeline.attendances.some(a => a.trainerId === filters.trainer);
      if (!hasTrainer) keep = false;
    }
    if (keep && filters.validMonths && filters.validMonths.length > 0) {
      const hasValidNom = timeline.notifications.some(n => filters.validMonths!.includes(n.month));
      const hasValidAtt = timeline.attendances.some(a => filters.validMonths!.includes(a.month));
      if (!hasValidNom && !hasValidAtt) keep = false;
    }
    if (keep) {
      const tClone = { ...timeline };
      if (filters.validMonths && filters.validMonths.length > 0) {
        tClone.notifications = tClone.notifications.filter(n => filters.validMonths!.includes(n.month));
        tClone.attendances = tClone.attendances.filter(a => filters.validMonths!.includes(a.month));
      }
      filtered.set(empId, tClone);
    }
  }
  return filtered;
}

export function buildAPMonthlyMatrix(
  timelines: Map<string, EmployeeEventTimeline>,
  fyMonths: string[]
): APAggregates {
  const clusterMonthMap: Record<string, APMonthMapNode> = {};
  const teamMonthMap: Record<string, Record<string, APMonthMapNode>> = {};
  const DUMMY_TEAMS = new Set(['Team A', '—', 'Unknown Team']);
  const globalNotifiedSet = new Set<string>();
  const globalAttendedSet = new Set<string>();
  let defaulters = 0;
  let totalScoreSum = 0;
  let scoredSessions = 0;

  for (const timeline of timelines.values()) {
    if (DUMMY_TEAMS.has(timeline.team) || DUMMY_TEAMS.has(timeline.cluster)) continue;
    let presentCount = 0;
    timeline.attendances.forEach(a => {
      if (a.status === 'Present') {
        presentCount++;
        const vals = Object.values(a.scores).filter(v => v !== null) as number[];
        if (vals.length > 0) {
          totalScoreSum += (vals.reduce((s, v) => s + v, 0) / vals.length);
          scoredSessions++;
        }
      }
    });
    if (timeline.notifications.length >= 3 && presentCount === 0) defaulters++;

    const cluster = timeline.cluster;
    const team = timeline.team;

    if (!clusterMonthMap[cluster]) clusterMonthMap[cluster] = { totalNotified: 0, totalAttended: 0, months: {} };
    if (!teamMonthMap[cluster]) teamMonthMap[cluster] = {};
    if (!teamMonthMap[cluster][team]) teamMonthMap[cluster][team] = { totalNotified: 0, totalAttended: 0, months: {} };

    for (const month of fyMonths) {
      if (!clusterMonthMap[cluster].months[month]) clusterMonthMap[cluster].months[month] = { notified: 0, attended: 0 };
      if (!teamMonthMap[cluster][team].months[month]) teamMonthMap[cluster][team].months[month] = { notified: 0, attended: 0 };

      const isNotifiedMonth = timeline.notifications.some(n => n.month === month);
      const isAttendedMonth = timeline.attendances.some(a => a.month === month && a.status === 'Present');

      if (isNotifiedMonth) {
        clusterMonthMap[cluster].months[month].notified++;
        teamMonthMap[cluster][team].months[month].notified++;
        globalNotifiedSet.add(timeline.employeeId);
      }
      if (isAttendedMonth) {
        clusterMonthMap[cluster].months[month].attended++;
        teamMonthMap[cluster][team].months[month].attended++;
        globalAttendedSet.add(timeline.employeeId);
      }
    }
  }

  for (const cluster of Object.values(clusterMonthMap)) {
    for (const data of Object.values(cluster.months)) {
      cluster.totalNotified += data.notified;
      cluster.totalAttended += data.attended;
    }
  }
  for (const clusterObj of Object.values(teamMonthMap)) {
    for (const teamObj of Object.values(clusterObj)) {
      for (const data of Object.values(teamObj.months)) {
        teamObj.totalNotified += data.notified;
        teamObj.totalAttended += data.attended;
      }
    }
  }

  return {
    clusterMonthMap,
    teamMonthMap,
    globalKPIs: {
      totalEmployeesNotified: globalNotifiedSet.size,
      totalEmployeesAttended: globalAttendedSet.size,
      attendancePercent: globalNotifiedSet.size > 0 ? (globalAttendedSet.size / globalNotifiedSet.size) * 100 : (globalAttendedSet.size > 0 ? 100 : 0),
      defaulters,
      compositeScore: scoredSessions > 0 ? totalScoreSum / scoredSessions : 0
    }
  };
}

// ─── PERFORMANCE ENGINE ──────────────────────────────────────────────────────

export function getAPPerformanceAggregates(
  filteredTimelines: Map<string, EmployeeEventTimeline>,
  fyMonths: string[]
): APPerformanceAggregates {
  const clusterMap: Record<string, APClusterRow> = {};
  const DUMMY_TEAMS = new Set(['Team A', '—', 'Unknown Team']);
  let globalKnowledgeSum = 0;
  let globalKnowledgeCount = 0;
  let globalBSESum = 0;
  let globalBSECount = 0;
  let totalAttended = 0;
  const uniqueCandidateIds = new Set<string>();

  const bseParamTotals: Record<string, { sum: number; count: number }> = {
    'grasping': { sum: 0, count: 0 },
    'detailing': { sum: 0, count: 0 },
    'situationHandling': { sum: 0, count: 0 },
    'english': { sum: 0, count: 0 },
    'localLanguage': { sum: 0, count: 0 },
    'involvement': { sum: 0, count: 0 },
    'effort': { sum: 0, count: 0 },
    'confidence': { sum: 0, count: 0 }
  };

  for (const timeline of filteredTimelines.values()) {
    if (DUMMY_TEAMS.has(timeline.team) || DUMMY_TEAMS.has(timeline.cluster)) continue;
    const cluster = timeline.cluster;
    const team = timeline.team;
    if (!clusterMap[cluster]) clusterMap[cluster] = { cluster, months: {}, teams: {} };
    if (!clusterMap[cluster].teams[team]) clusterMap[cluster].teams[team] = { team, cluster, months: {} };

    for (const att of timeline.attendances) {
      if (att.status !== 'Present') continue;
      const month = att.month;
      if (!fyMonths.includes(month)) continue;

      if (!clusterMap[cluster].months[month]) clusterMap[cluster].months[month] = { avgKnowledge: 0, avgBSE: 0, count: 0 };
      if (!clusterMap[cluster].teams[team].months[month]) clusterMap[cluster].teams[team].months[month] = { avgKnowledge: 0, avgBSE: 0, count: 0 };

      totalAttended++;
      uniqueCandidateIds.add(timeline.employeeId);

      let kVal = att.scores['knowledge'] ?? att.scores['knowledgeScore'] ?? att.scores['percent'] ?? att.scores['testScore'] ?? att.scores['Score'] ?? att.scores['test'];
      let hasKnowledge = typeof kVal === 'number';
      if (hasKnowledge) { globalKnowledgeSum += kVal as number; globalKnowledgeCount++; }

      let bseVal = typeof att.scores['bse'] === 'number' ? att.scores['bse'] : null;
      let hasBse = false;
      if (bseVal === null) {
        const bseKeys = ['grasping', 'participation', 'detailing', 'rolePlay', 'punctuality', 'grooming', 'behaviour'];
        let bseSum = 0; let bseCount = 0;
        for (const k of bseKeys) {
          const val = att.scores[k];
          if (typeof val === 'number') { bseSum += val; bseCount++; if (bseParamTotals[k]) { bseParamTotals[k].sum += val; bseParamTotals[k].count++; } }
        }
        if (bseCount > 0) bseVal = bseSum / bseCount;
      }
      if (bseVal !== null) { globalBSESum += bseVal; globalBSECount++; hasBse = true; }

      const cMonth: any = clusterMap[cluster].months[month];
      const tMonth: any = clusterMap[cluster].teams[team].months[month];
      if (!cMonth._kSum && cMonth._kSum !== 0) { cMonth._kSum = 0; cMonth._kCount = 0; cMonth._bseSum = 0; cMonth._bseCount = 0; }
      if (!tMonth._kSum && tMonth._kSum !== 0) { tMonth._kSum = 0; tMonth._kCount = 0; tMonth._bseSum = 0; tMonth._bseCount = 0; }
      if (hasKnowledge) { cMonth._kSum += kVal; cMonth._kCount++; tMonth._kSum += kVal; tMonth._kCount++; }
      if (hasBse && bseVal !== null) { cMonth._bseSum += bseVal; cMonth._bseCount++; tMonth._bseSum += bseVal; tMonth._bseCount++; }
      cMonth.count++; tMonth.count++;
    }
  }

  let highPerformersCount = 0;
  for (const timeline of filteredTimelines.values()) {
    let candidateAvgSum = 0;
    let candidateAvgCount = 0;
    for (const att of timeline.attendances) {
      if (att.status !== 'Present') continue;
      const month = att.month;
      if (!fyMonths.includes(month)) continue;
      
      const scores = Object.values(att.scores).filter(v => typeof v === 'number') as number[];
      if (scores.length > 0) {
        candidateAvgSum += (scores.reduce((s, v) => s + v, 0) / scores.length);
        candidateAvgCount++;
      }
    }
    if (candidateAvgCount > 0 && (candidateAvgSum / candidateAvgCount) >= 80) {
      highPerformersCount++;
    }
  }

  for (const c of Object.values(clusterMap)) {
    for (const m of Object.values(c.months) as any[]) { m.avgKnowledge = m._kCount > 0 ? (m._kSum / m._kCount) : 0; m.avgBSE = m._bseCount > 0 ? (m._bseSum / m._bseCount) : 0; }
    for (const t of Object.values(c.teams)) { for (const m of Object.values(t.months) as any[]) { m.avgKnowledge = m._kCount > 0 ? (m._kSum / m._kCount) : 0; m.avgBSE = m._bseCount > 0 ? (m._bseSum / m._bseCount) : 0; } }
  }

  let lowestParam = 'None'; let lowestParamScore = 1000;
  for (const [key, data] of Object.entries(bseParamTotals)) { if (data.count > 0) { const avg = data.sum / data.count; if (avg < lowestParamScore) { lowestParamScore = avg; lowestParam = key; } } }

  return {
    clusterMap,
    globalKPIs: {
      totalAttended,
      avgKnowledge: globalKnowledgeCount > 0 ? globalKnowledgeSum / globalKnowledgeCount : 0,
      avgBSE: globalBSECount > 0 ? globalBSESum / globalBSECount : 0,
      uniqueCandidates: uniqueCandidateIds.size,
      lowestParameter: lowestParamScore < 1000 ? `${lowestParam} (Avg ${Math.round(lowestParamScore)})` : 'N/A',
      highPerformersPct: uniqueCandidateIds.size > 0 ? (highPerformersCount / uniqueCandidateIds.size) * 100 : 0
    }
  };
}

export function getAPDrilldownList(
  filteredTimelines: Map<string, EmployeeEventTimeline>,
  filters: { cluster: string; team: string; month: string }
): APCandidatePerformance[] {
  const results: APCandidatePerformance[] = [];
  for (const timeline of filteredTimelines.values()) {
    if (timeline.cluster !== filters.cluster || timeline.team !== filters.team) continue;
    for (const att of timeline.attendances) {
      if (att.status !== 'Present' || att.month !== filters.month) continue;
      const scores = att.scores;
      const kVal = typeof scores['knowledge'] === 'number' ? scores['knowledge'] : null;
      const bseKeys = ['grasping', 'detailing', 'situationHandling', 'english', 'localLanguage', 'involvement', 'effort', 'confidence'];
      let bSum = 0; let bCount = 0;
      for (const key of bseKeys) { const val = scores[key]; if (typeof val === 'number') { bSum += val; bCount++; } }
      const bseVal = bCount > 0 ? bSum / bCount : null;

      results.push({
        employeeId: timeline.employeeId,
        name: timeline.name,
        team: timeline.team,
        cluster: timeline.cluster,
        trainer: att.trainerId || 'Unknown',
        attendanceDate: att.date,
        knowledge: kVal,
        bse: bseVal,
        grasping: typeof scores['grasping'] === 'number' ? scores['grasping'] : null,
        detailing: typeof scores['detailing'] === 'number' ? scores['detailing'] : null,
        situationHandling: typeof scores['situationHandling'] === 'number' ? scores['situationHandling'] : null,
        english: typeof scores['english'] === 'number' ? scores['english'] : null,
        localLanguage: typeof scores['localLanguage'] === 'number' ? scores['localLanguage'] : null,
        involvement: typeof scores['involvement'] === 'number' ? scores['involvement'] : null,
        effort: typeof scores['effort'] === 'number' ? scores['effort'] : null,
        confidence: typeof scores['confidence'] === 'number' ? scores['confidence'] : null,
      });
    }
  }
  return results;
}





