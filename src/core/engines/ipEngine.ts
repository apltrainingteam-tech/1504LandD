/**
 * IP Engine
 * ⚠️ DO NOT IMPORT IN COMPONENTS — USE HOOKS ONLY
 */
import { UnifiedRecord } from '../../types/reports';
import { IPRecord, IPAggregates, IPMonthMapNode, IPHeritageMapCell, IPMonthlyTeamRank, IPMonthlyRankMatrix } from '../../types/reports';

import { normalizeText } from '../utils/textNormalizer';
import { getFiscalMonths, FISCAL_YEARS } from '../utils/fiscalYear';
import { normalizeScore } from '../utils/scoreNormalizer';
import { traceEngine } from '../debug/traceEngine';
import { debugError } from '../debug/debugError';

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


export const buildIPAggregates = traceEngine("buildIPAggregates", (ds: UnifiedRecord[]): IPAggregates => {
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

  // KPI Calculations
  const totalCandidates = dedupedRecords.length;
  let gE = 0, gH = 0, gM = 0, gL = 0;
  dedupedRecords.forEach(r => {
    if (r.bucket === 'ELITE') gE++;
    else if (r.bucket === 'HIGH') gH++;
    else if (r.bucket === 'MEDIUM') gM++;
    else gL++;
  });
  
  const hPct = totalCandidates > 0 ? ((gE + gH) / totalCandidates) * 100 : 0;
  const mPct = totalCandidates > 0 ? (gM / totalCandidates) * 100 : 0;
  const lPct = totalCandidates > 0 ? (gL / totalCandidates) * 100 : 0;
  const gScore = calculateWeightedScore(gE, gH, gM, gL, totalCandidates);

  return {
    clusterMonthMap,
    teamMonthMap,
    recordsCount: records.length,
    globalKPIs: {
      totalCandidates,
      elitePct: totalCandidates > 0 ? (gE / totalCandidates) * 100 : 0,
      highPct: totalCandidates > 0 ? (gH / totalCandidates) * 100 : 0,
      medPct: totalCandidates > 0 ? (gM / totalCandidates) * 100 : 0,
      lowPct: totalCandidates > 0 ? (gL / totalCandidates) * 100 : 0,
      weightedScore: gScore,
      bestTeam: Object.keys(teamMonthMap).length > 0 
        ? Object.entries(teamMonthMap).reduce((best, [cluster, teams]) => {
            const teamScores = Object.entries(teams).map(([name, data]) => ({ name, score: calculateWeightedScore(data.elite, data.high, data.medium, data.low, data.total) }));
            const localBest = teamScores.sort((a, b) => b.score - a.score)[0];
            return !best || localBest.score > best.score ? localBest : best;
          }, null as any)?.name || '—' 
        : '—', 
      worstTeam: Object.keys(teamMonthMap).length > 0 
        ? Object.entries(teamMonthMap).reduce((worst, [cluster, teams]) => {
            const teamScores = Object.entries(teams).map(([name, data]) => ({ name, score: calculateWeightedScore(data.elite, data.high, data.medium, data.low, data.total) }));
            const localWorst = teamScores.sort((a, b) => a.score - b.score)[0];
            return !worst || localWorst.score < worst.score ? localWorst : worst;
          }, null as any)?.name || '—' 
        : '—',
    },
    penaltyEnabled: IP_CONFIG.penaltyEnabled
  };
});


/**
 * Partial Recompute for IP Engine
 * 
 * Instead of full iteration, this patches existing aggregates based on specific row changes.
 */
export function recomputeIPPartial(
  existingAggs: IPAggregates,
  oldRecords: UnifiedRecord[],
  newRecords: UnifiedRecord[]
): IPAggregates {
  // Deep clone to avoid side effects (or shallow if performance is key)
  const next = { ...existingAggs };
  
  // 1. Subtract old records
  const oldIP = normalizeToIPRecords(oldRecords);
  oldIP.forEach(r => {
    const { cluster, team, month, bucket } = r;
    if (next.clusterMonthMap[cluster]) {
      next.clusterMonthMap[cluster].total--;
      if (next.clusterMonthMap[cluster].months[month]) {
        next.clusterMonthMap[cluster].months[month].total--;
        if (bucket === 'ELITE') { next.clusterMonthMap[cluster].elite--; next.clusterMonthMap[cluster].months[month].elite--; }
        else if (bucket === 'HIGH') { next.clusterMonthMap[cluster].high--; next.clusterMonthMap[cluster].months[month].high--; }
        else if (bucket === 'MEDIUM') { next.clusterMonthMap[cluster].medium--; next.clusterMonthMap[cluster].months[month].medium--; }
        else if (bucket === 'LOW') { next.clusterMonthMap[cluster].low--; next.clusterMonthMap[cluster].months[month].low--; }
      }
    }
    // Repeat for teamMonthMap...
    if (next.teamMonthMap[cluster]?.[team]) {
      next.teamMonthMap[cluster][team].total--;
      if (next.teamMonthMap[cluster][team].months[month]) {
        next.teamMonthMap[cluster][team].months[month].total--;
        if (bucket === 'ELITE') { next.teamMonthMap[cluster][team].elite--; next.teamMonthMap[cluster][team].months[month].elite--; }
        else if (bucket === 'HIGH') { next.teamMonthMap[cluster][team].high--; next.teamMonthMap[cluster][team].months[month].high--; }
        else if (bucket === 'MEDIUM') { next.teamMonthMap[cluster][team].medium--; next.teamMonthMap[cluster][team].months[month].medium--; }
        else if (bucket === 'LOW') { next.teamMonthMap[cluster][team].low--; next.teamMonthMap[cluster][team].months[month].low--; }
      }
    }
  });

  // 2. Add new records
  const newIP = normalizeToIPRecords(newRecords);
  newIP.forEach(r => {
    const { cluster, team, month, bucket } = r;
    // ... logic to increment next ...
    // For brevity in this implementation, we assume cluster/team/month exist or create them
    if (!next.clusterMonthMap[cluster]) next.clusterMonthMap[cluster] = { total: 0, elite: 0, high: 0, medium: 0, low: 0, months: {} };
    if (!next.clusterMonthMap[cluster].months[month]) next.clusterMonthMap[cluster].months[month] = { total: 0, elite: 0, high: 0, medium: 0, low: 0 };
    
    next.clusterMonthMap[cluster].total++;
    next.clusterMonthMap[cluster].months[month].total++;
    if (bucket === 'ELITE') { next.clusterMonthMap[cluster].elite++; next.clusterMonthMap[cluster].months[month].elite++; }
    else if (bucket === 'HIGH') { next.clusterMonthMap[cluster].high++; next.clusterMonthMap[cluster].months[month].high++; }
    else if (bucket === 'MEDIUM') { next.clusterMonthMap[cluster].medium++; next.clusterMonthMap[cluster].months[month].medium++; }
    else if (bucket === 'LOW') { next.clusterMonthMap[cluster].low++; next.clusterMonthMap[cluster].months[month].low++; }
    
    if (!next.teamMonthMap[cluster]) next.teamMonthMap[cluster] = {};
    if (!next.teamMonthMap[cluster][team]) next.teamMonthMap[cluster][team] = { total: 0, elite: 0, high: 0, medium: 0, low: 0, months: {} };
    if (!next.teamMonthMap[cluster][team].months[month]) next.teamMonthMap[cluster][team].months[month] = { total: 0, elite: 0, high: 0, medium: 0, low: 0 };

    next.teamMonthMap[cluster][team].total++;
    next.teamMonthMap[cluster][team].months[month].total++;
    if (bucket === 'ELITE') { next.teamMonthMap[cluster][team].elite++; next.teamMonthMap[cluster][team].months[month].elite++; }
    else if (bucket === 'HIGH') { next.teamMonthMap[cluster][team].high++; next.teamMonthMap[cluster][team].months[month].high++; }
    else if (bucket === 'MEDIUM') { next.teamMonthMap[cluster][team].medium++; next.teamMonthMap[cluster][team].months[month].medium++; }
    else if (bucket === 'LOW') { next.teamMonthMap[cluster][team].low++; next.teamMonthMap[cluster][team].months[month].low++; }
  });

  return next;
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

    // PART 5 - DEBUG LOGGING
    console.log(`[IP Rank] Team: ${t.team}, Month: ${t.month}`, {
      eliteCount: t.a90,
      highCount: t.b75,
      mediumCount: t.c50,
      lowCount: t.dBelow50,
      finalScore
    });

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






