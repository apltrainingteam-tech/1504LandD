import { EmployeeEventTimeline } from './apIntelligenceService';
import { normalizeText } from '../utils/textNormalizer';

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
  };
}

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

  // For Lowest Parameter
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

    if (!clusterMap[cluster]) {
      clusterMap[cluster] = { cluster, months: {}, teams: {} };
    }
    if (!clusterMap[cluster].teams[team]) {
      clusterMap[cluster].teams[team] = { team, cluster, months: {} };
    }

    // Process all Present attendances
    for (const att of timeline.attendances) {
      if (att.status !== 'Present') continue;

      const month = att.month;
      if (!fyMonths.includes(month)) continue;

      if (!clusterMap[cluster].months[month]) {
        clusterMap[cluster].months[month] = { avgKnowledge: 0, avgBSE: 0, count: 0 };
      }
      if (!clusterMap[cluster].teams[team].months[month]) {
        clusterMap[cluster].teams[team].months[month] = { avgKnowledge: 0, avgBSE: 0, count: 0 };
      }

      totalAttended++;
      uniqueCandidateIds.add(timeline.employeeId);

      // Knowledge extraction
      let kVal = att.scores['knowledge'];
      if (typeof kVal !== 'number') kVal = att.scores['knowledgeScore'];
      if (typeof kVal !== 'number') kVal = att.scores['percent'];
      if (typeof kVal !== 'number') kVal = att.scores['testScore'];
      if (typeof kVal !== 'number') kVal = att.scores['Score'];
      if (typeof kVal !== 'number') kVal = att.scores['test'];

      let hasKnowledge = false;
      if (typeof kVal === 'number') {
        globalKnowledgeSum += kVal;
        globalKnowledgeCount++;
        hasKnowledge = true;
      }

      // BSE extraction
      let bseVal = typeof att.scores['bse'] === 'number' ? att.scores['bse'] : null;
      let hasBse = false;

      if (bseVal === null) {
        const bseKeys = [
          'grasping', 'participation', 'detailing', 'rolePlay', 'punctuality', 'grooming', 'behaviour'
        ];
        
        let bseSum = 0;
        let bseCount = 0;
        for (const k of bseKeys) {
          const val = att.scores[k];
          if (typeof val === 'number') {
            bseSum += val;
            bseCount++;
            if (bseParamTotals[k]) {
              bseParamTotals[k].sum += val;
              bseParamTotals[k].count++;
            }
          }
        }
        if (bseCount > 0) bseVal = bseSum / bseCount;
      }

      if (bseVal !== null) {
        globalBSESum += bseVal;
        globalBSECount++;
        hasBse = true;
      }

      const cMonth: any = clusterMap[cluster].months[month];
      const tMonth: any = clusterMap[cluster].teams[team].months[month];

      if (!cMonth._kSum && cMonth._kSum !== 0) {
        cMonth._kSum = 0; cMonth._kCount = 0;
        cMonth._bseSum = 0; cMonth._bseCount = 0;
      }
      if (!tMonth._kSum && tMonth._kSum !== 0) {
        tMonth._kSum = 0; tMonth._kCount = 0;
        tMonth._bseSum = 0; tMonth._bseCount = 0;
      }

      if (hasKnowledge) {
        cMonth._kSum += kVal; cMonth._kCount++;
        tMonth._kSum += kVal; tMonth._kCount++;
      }
      if (hasBse && bseVal !== null) {
        cMonth._bseSum += bseVal; cMonth._bseCount++;
        tMonth._bseSum += bseVal; tMonth._bseCount++;
      }

      // Always increment count so the team is included in matrixData
      cMonth.count++;
      tMonth.count++;
    }
  }

  // Finalize averages
  for (const c of Object.values(clusterMap)) {
    for (const m of Object.values(c.months) as any[]) {
      m.avgKnowledge = m._kCount > 0 ? (m._kSum / m._kCount) : 0;
      m.avgBSE = m._bseCount > 0 ? (m._bseSum / m._bseCount) : 0;
    }
    for (const t of Object.values(c.teams)) {
      for (const m of Object.values(t.months) as any[]) {
        m.avgKnowledge = m._kCount > 0 ? (m._kSum / m._kCount) : 0;
        m.avgBSE = m._bseCount > 0 ? (m._bseSum / m._bseCount) : 0;
      }
    }
  }

  // Calculate Lowest Parameter
  let lowestParam = 'None';
  let lowestParamScore = 1000;
  for (const [key, data] of Object.entries(bseParamTotals)) {
    if (data.count > 0) {
      const avg = data.sum / data.count;
      if (avg < lowestParamScore) {
        lowestParamScore = avg;
        lowestParam = key;
      }
    }
  }

  return {
    clusterMap,
    globalKPIs: {
      totalAttended,
      avgKnowledge: globalKnowledgeCount > 0 ? globalKnowledgeSum / globalKnowledgeCount : 0,
      avgBSE: globalBSECount > 0 ? globalBSESum / globalBSECount : 0,
      uniqueCandidates: uniqueCandidateIds.size,
      lowestParameter: lowestParamScore < 1000 ? `${lowestParam} (Avg ${Math.round(lowestParamScore)})` : 'N/A'
    }
  };
}

export function getDrilldownList(
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
      
      const bseKeys = [
        'grasping', 'detailing', 'situationHandling', 
        'english', 'localLanguage', 'involvement', 'effort', 'confidence'
      ];
      let bSum = 0; let bCount = 0;
      for (const key of bseKeys) {
        const val = scores[key];
        if (typeof val === 'number') {
          bSum += val; bCount++;
        }
      }
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
