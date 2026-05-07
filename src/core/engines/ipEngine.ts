/**
 * IP Engine
 * ⚠️ DO NOT IMPORT IN COMPONENTS — USE HOOKS ONLY
 */
import { UnifiedRecord } from '../../types/reports';
import { IPRecord, IPAggregates, IPMonthMapNode, IPHeritageMapCell, IPMonthlyTeamRank, IPMonthlyRankMatrix } from '../../types/reports';

import { normalizeText } from '../utils/textNormalizer';
import { getFiscalMonths, FISCAL_YEARS } from '../utils/fiscalYear';
import { normalizeScore } from '../utils/scoreNormalizer';

export { getFiscalMonths, FISCAL_YEARS };




export const IP_CONFIG = {
  highThreshold: 75,
  mediumThreshold: 50,
  lowThreshold: 50,
  penaltyEnabled: false,
};



export function classifyBucket(score: number | null | undefined): 'ELITE' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score == null) return 'LOW';
  if (score > 90) return 'ELITE';
  if (score >= 75) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

export function calculateWeightedScore(e: number, h: number, m: number, l: number, total: number): number {
  if (total === 0) return 0;
  // Summary score for Overview KPIs
  return ((e * 98) + (h * 85) + (m * 65) + (l * 35)) / total;
}



// Convert core UnifiedRecords to IPRecords
export function normalizeToIPRecords(ds: UnifiedRecord[]): IPRecord[] {
  const records: IPRecord[] = [];
  ds.filter(r => !r.attendance.isVoided).forEach(r => {

    const rawStatus = String(r.attendance.attendanceStatus || '').trim().toLowerCase();
    // ACCEPT: "present", empty status (implied present), or anything except explicit non-attendance
    if (rawStatus !== '' && rawStatus !== 'present' && rawStatus !== 'attended') return;
    
    // Universal extraction via schema field definitions
    const scoreValues = (r.score?.scores) ? Object.keys(r.score.scores)
      .filter(k => ['percent', 'Percent', 'tScore', 'T Score', 'detailing', 'Detailing', 'score', 'Score', 'testScore', 'test', 'knowledgeScore', 'scienceScore', 'avgScore', 'IP Score', 'IP'].includes(k))
      .map(k => normalizeScore(r.score?.scores?.[k]))
      .filter((s): s is number => s !== null) : [];
      
    const s = scoreValues.length > 0 ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length : null;

    if (s == null) {
      console.warn(`[ipEngine] Missing score for employee ${r.employee.employeeId} in month ${r.attendance.month}. Skipping record.`);
      return;
    }
    
    // Normalize team name to match map keys reliably
    const team = normalizeText(r.employee.team);
    
    // DEFENSIVE: Skip known dummy/orphaned data entirely
    if (['Team A', '—', 'Unknown Team'].includes(team)) return;
    const cluster = normalizeText(r.employee.cluster || 'Others');
    
    const month = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7);
    records.push({
      employeeId: r.employee.employeeId,
      team: team || '—',
      cluster: cluster || 'Others',
      month: month,
      score: s as number,
      bucket: classifyBucket(s as number)
    });
  });
  return records;
}


export const buildIPAggregates = (ds: UnifiedRecord[]): IPAggregates => {
  const records = normalizeToIPRecords(ds);


  
  const dedupMap = new Map<string, IPRecord>();
  records.forEach(r => {
    const key = `${r.employeeId}_${r.month}`;
    dedupMap.set(key, r);
  });
  const dedupedRecords = Array.from(dedupMap.values());

  const clusterMonthMap: Record<string, IPMonthMapNode> = {};
  const teamMonthMap: Record<string, Record<string, IPMonthMapNode>> = {};

  dedupedRecords.forEach(record => {
    const { cluster, team, month, bucket } = record;

    // ---- CLUSTER LEVEL ----
    if (!clusterMonthMap[cluster]) {
      clusterMonthMap[cluster] = { total: 0, elite: 0, high: 0, medium: 0, low: 0, months: {} };
    }
    if (!clusterMonthMap[cluster].months[month]) {
      clusterMonthMap[cluster].months[month] = { elite: 0, high: 0, medium: 0, low: 0, total: 0 };
    }

    clusterMonthMap[cluster].total += 1;
    clusterMonthMap[cluster].months[month].total += 1;

    if (bucket === 'ELITE') { clusterMonthMap[cluster].elite++; clusterMonthMap[cluster].months[month].elite++; }
    else if (bucket === 'HIGH') { clusterMonthMap[cluster].high++; clusterMonthMap[cluster].months[month].high++; }
    else if (bucket === 'MEDIUM') { clusterMonthMap[cluster].medium++; clusterMonthMap[cluster].months[month].medium++; }
    else if (bucket === 'LOW') { clusterMonthMap[cluster].low++; clusterMonthMap[cluster].months[month].low++; }

    // ---- TEAM LEVEL ----
    if (!teamMonthMap[cluster]) teamMonthMap[cluster] = {};
    if (!teamMonthMap[cluster][team]) {
      teamMonthMap[cluster][team] = { total: 0, elite: 0, high: 0, medium: 0, low: 0, months: {} };
    }
    if (!teamMonthMap[cluster][team].months[month]) {
      teamMonthMap[cluster][team].months[month] = { elite: 0, high: 0, medium: 0, low: 0, total: 0 };
    }

    teamMonthMap[cluster][team].total += 1;
    teamMonthMap[cluster][team].months[month].total += 1;

    if (bucket === 'ELITE') { teamMonthMap[cluster][team].elite++; teamMonthMap[cluster][team].months[month].elite++; }
    else if (bucket === 'HIGH') { teamMonthMap[cluster][team].high++; teamMonthMap[cluster][team].months[month].high++; }
    else if (bucket === 'MEDIUM') { teamMonthMap[cluster][team].medium++; teamMonthMap[cluster][team].months[month].medium++; }
    else if (bucket === 'LOW') { teamMonthMap[cluster][team].low++; teamMonthMap[cluster][team].months[month].low++; }
  });

  return {
    clusterMonthMap,
    teamMonthMap,
    recordsCount: records.length,
    penaltyEnabled: IP_CONFIG.penaltyEnabled
  };
};

export function calcExecutiveKPIs(ds: UnifiedRecord[], viewBy: string = 'Team') {
  const records = normalizeToIPRecords(ds);
  
  const dedupMap = new Map<string, IPRecord>();
  records.forEach(r => {
    const key = `${r.employeeId}_${r.month}`;
    dedupMap.set(key, r);
  });
  const dedupedRecords = Array.from(dedupMap.values());
  const totalCandidates = dedupedRecords.length;

  if (totalCandidates === 0) return null;

  const eliteCount = dedupedRecords.filter(r => r.bucket === 'ELITE').length;
  const lowCount = dedupedRecords.filter(r => r.bucket === 'LOW').length;

  // Group by entity (Team or Cluster) for distribution cards
  const entityMap = new Map<string, { total: number; elite: number; low: number }>();
  dedupedRecords.forEach(r => {
    const key = viewBy === 'Cluster' ? r.cluster : r.team;
    if (!key || key === '—' || key === 'Others') return;
    
    if (!entityMap.has(key)) entityMap.set(key, { total: 0, elite: 0, low: 0 });
    const stats = entityMap.get(key)!;
    stats.total++;
    if (r.bucket === 'ELITE') stats.elite++;
    if (r.bucket === 'LOW') stats.low++;
  });

  const entities = Array.from(entityMap.entries()).map(([name, stats]) => ({
    name,
    elitePct: (stats.elite / stats.total) * 100,
    lowPct: (stats.low / stats.total) * 100,
    eliteCount: stats.elite,
    lowCount: stats.low,
    total: stats.total
  })).filter(e => e.total >= 1); // Allow all entities that have data

  const sortedByElite = [...entities].sort((a, b) => b.elitePct - a.elitePct);
  const sortedByLow = [...entities].sort((a, b) => b.lowPct - a.lowPct);

  return {
    totalCandidates,
    eliteCount,
    eliteRatio: (eliteCount / totalCandidates) * 100,
    lowCount,
    lowRatio: (lowCount / totalCandidates) * 100,
    highestElite: sortedByElite[0] || { name: '—', elitePct: 0, eliteCount: 0 },
    lowestElite: sortedByElite[sortedByElite.length - 1] || { name: '—', elitePct: 0, eliteCount: 0 },
    highestLow: sortedByLow[0] || { name: '—', lowPct: 0, lowCount: 0 },
    lowestLow: sortedByLow[sortedByLow.length - 1] || { name: '—', lowPct: 0, lowCount: 0 }
  };
}



// ─── RANKING CONFIG ───────────────────────────────────────────────
export const IP_RANK_CONFIG = {
  bucketElite: 90,    // >90%
  bucketHigh: 75,     // 75–90%
  bucketMedium: 50,   // 50–75%
  weightElite: 95,
  weightHigh: 82.5,
  weightMedium: 62.5,
  penaltyLow: 25,     // <50%
};

// Competition ranking: same score → same rank, next rank skips
function applyRanking(list: IPMonthlyTeamRank[], rankField: 'overallRank' | 'clusterRank'): void {
  list.sort((a, b) => b.score - a.score);
  let rank = 1;
  for (let i = 0; i < list.length; i++) {
    if (i > 0 && list[i].score < list[i - 1].score) {
      rank = i + 1;
    }
    list[i][rankField] = rank;
  }
}

export function buildIPMonthlyTeamRanks(ds: UnifiedRecord[], fyMonths?: string[]): IPMonthlyRankMatrix {
  const DUMMY_TEAMS = new Set(['Team A', 'Unknown', '—', 'Unknown Team', 'Others']);


  const dedupMap = new Map<string, UnifiedRecord>();
  ds.filter(r => !r.attendance.isVoided).forEach(r => {

    const rawStatus = String(r.attendance.attendanceStatus || '').trim().toLowerCase();
    if (rawStatus !== '' && rawStatus !== 'present' && rawStatus !== 'attended') return;

    const month = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7);
    if (!month) return;

    // FY filter BEFORE aggregation
    if (fyMonths && fyMonths.length > 0 && !fyMonths.includes(month)) return;

    const key = `${r.employee.employeeId}_${month}`;
    dedupMap.set(key, r);
  });

  // ── STEP 2: Build month→team bucket map ──
  const monthTeamMap: Record<string, IPMonthlyTeamRank> = {};

  dedupMap.forEach(r => {
    const month = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7);
    const team = normalizeText(r.employee.team);

    if (!team || DUMMY_TEAMS.has(team)) return;

    const cluster = r.employee.cluster || 'Others';

    // Universal extraction logic
    const scoreValues = (r.score?.scores) ? Object.keys(r.score.scores)
      .filter(k => ['percent', 'Percent', 'tScore', 'T Score', 'detailing', 'Detailing', 'score', 'Score', 'testScore', 'test', 'knowledgeScore', 'scienceScore', 'avgScore', 'IP Score', 'IP'].includes(k))
      .map(k => normalizeScore(r.score?.scores?.[k]))
      .filter((s): s is number => s !== null) : [];
      
    const rawScore = scoreValues.length > 0 ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length : 0;

    const key = `${month}__${team}`;
    if (!monthTeamMap[key]) {
      monthTeamMap[key] = { team, cluster, month, total: 0, a90: 0, b75: 0, c50: 0, dBelow50: 0, score: 0, clusterRank: 0, overallRank: 0 };
    }

    const t = monthTeamMap[key];
    t.total++;
    if (rawScore > IP_RANK_CONFIG.bucketElite)        t.a90++;
    else if (rawScore >= IP_RANK_CONFIG.bucketHigh)   t.b75++;
    else if (rawScore >= IP_RANK_CONFIG.bucketMedium) t.c50++;
    else                                              t.dBelow50++;
  });

  // ── STEP 3: Calculate weighted score per team-month ──
  const monthlyList: IPMonthlyTeamRank[] = Object.values(monthTeamMap).map(t => {
    // PART 5 - New SUM-based score (no division by total)
    const finalScore = (t.a90   * IP_RANK_CONFIG.weightElite) +
                       (t.b75   * IP_RANK_CONFIG.weightHigh) +
                       (t.c50   * IP_RANK_CONFIG.weightMedium) -
                       (t.dBelow50 * IP_RANK_CONFIG.penaltyLow);

    return { ...t, score: finalScore };
  });

  // ── STEP 4: Group by month → apply competition ranking independently ──
  const monthGroups: Record<string, IPMonthlyTeamRank[]> = {};
  monthlyList.forEach(t => {
    if (!monthGroups[t.month]) monthGroups[t.month] = [];
    monthGroups[t.month].push(t);
  });

  Object.values(monthGroups).forEach(group => {
    // Overall ranking across all teams in this month
    applyRanking(group, 'overallRank');

    // Cluster ranking within each cluster in this month
    const clusterBuckets: Record<string, IPMonthlyTeamRank[]> = {};
    group.forEach(t => {
      if (!clusterBuckets[t.cluster]) clusterBuckets[t.cluster] = [];
      clusterBuckets[t.cluster].push(t);
    });
    Object.values(clusterBuckets).forEach(g => applyRanking(g, 'clusterRank'));
  });

  // ── STEP 5: Transform into matrix output ──
  const matrix: IPMonthlyRankMatrix = { teams: {} };
  monthlyList.forEach(t => {
    if (!matrix.teams[t.team]) {
      matrix.teams[t.team] = { cluster: t.cluster, months: {} };
    }
    matrix.teams[t.team].months[t.month] = {
      score: t.score,
      rank: t.overallRank,
      clusterRank: t.clusterRank,
    };
  });

  return matrix;
}






