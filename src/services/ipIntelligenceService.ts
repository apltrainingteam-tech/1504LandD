import { UnifiedRecord } from '../types/reports';
import { IPRecord, IPAggregates, IPMonthMapNode, IPHeritageMapCell, IPMonthlyTeamRank, IPMonthlyRankMatrix } from '../types/reports';

import { TEAM_CLUSTER_MAP } from './clusterMap';
import { normalizeText } from '../utils/textNormalizer';

export function getCurrentFY(): string {
  const today = new Date();
  const m = today.getMonth() + 1;
  const y = today.getFullYear();
  const startYear = m >= 4 ? y : y - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

export function getFiscalMonths(fy: string): string[] {
  const [startYear] = fy.split('-').map(Number);
  const months: string[] = [];
  // Apr -> Dec
  for (let m = 4; m <= 12; m++) {
    months.push(`${startYear}-${String(m).padStart(2, '0')}`);
  }
  // Jan -> Mar
  for (let m = 1; m <= 3; m++) {
    months.push(`${startYear + 1}-${String(m).padStart(2, '0')}`);
  }
  return months;
}

export const FISCAL_YEARS = Array.from({ length: 22 }, (_, i) => {
  const start = 2020 + i;
  const end = String(start + 1).slice(-2);
  return `${start}-${end}`;
});



export const IP_CONFIG = {
  highThreshold: 75,
  mediumThreshold: 50,
  lowThreshold: 50,
  highMidpoint: 95,
  mediumMidpoint: 82.5,
  lowMidpoint: 62.5,
  penaltyPerLowExtreme: 25,
  penaltyEnabled: false,
};



export function classifyBucket(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= IP_CONFIG.highThreshold) return 'HIGH';
  if (score >= IP_CONFIG.mediumThreshold) return 'MEDIUM';
  return 'LOW';
}

export function calculateWeightedScore(h: number, m: number, l: number, total: number): number {
  if (total === 0) return 0;
  let score = ((h * IP_CONFIG.highMidpoint) + (m * IP_CONFIG.mediumMidpoint) + (l * IP_CONFIG.lowMidpoint)) / total;
  if (IP_CONFIG.penaltyEnabled && IP_CONFIG.penaltyPerLowExtreme > 0) {
    // subtract penalty per Low element ? Or extreme lows ? We use `l`
    score -= (l * IP_CONFIG.penaltyPerLowExtreme);
  }
  return score;
}



// Convert core UnifiedRecords to IPRecords
export function normalizeToIPRecords(ds: UnifiedRecord[]): IPRecord[] {
  const records: IPRecord[] = [];
  ds.forEach(r => {
    if (r.attendance.attendanceStatus !== 'Present') return;
    // Prefer schema camelCase keys, fallback to legacy Title Case if needed.
    const s = r.score?.scores?.['score'] ?? 
              r.score?.scores?.['percent'] ?? 
              r.score?.scores?.['tScore'] ?? 
              r.score?.scores?.['Percent'] ?? 
              r.score?.scores?.['T Score'] ?? 
              r.score?.scores?.['Score'];
    if (s == null) return;
    
    // Normalize team name to match map keys reliably
    const team = normalizeText(r.employee.team);
    
    // DEFENSIVE: Skip known dummy/orphaned data entirely
    if (['Team A', 'Unknown', '—', 'Unknown Team', 'Unmapped'].includes(team)) return;

    const cluster = TEAM_CLUSTER_MAP[team];
    
    if (!cluster && team) {
      console.warn('Unmapped team after normalization:', team);
    }

    const month = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7);
    records.push({
      employeeId: r.employee.employeeId,
      team: team || '—',
      cluster: cluster || 'Unmapped',
      month: month,
      score: s as number,
      bucket: classifyBucket(s as number)
    });
  });
  return records;
}

export function buildIPAggregates(ds: UnifiedRecord[]): IPAggregates {
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
      clusterMonthMap[cluster] = { total: 0, high: 0, medium: 0, low: 0, months: {} };
    }
    if (!clusterMonthMap[cluster].months[month]) {
      clusterMonthMap[cluster].months[month] = { high: 0, medium: 0, low: 0, total: 0 };
    }

    clusterMonthMap[cluster].total += 1;
    clusterMonthMap[cluster].months[month].total += 1;

    if (bucket === 'HIGH') { clusterMonthMap[cluster].high++; clusterMonthMap[cluster].months[month].high++; }
    if (bucket === 'MEDIUM') { clusterMonthMap[cluster].medium++; clusterMonthMap[cluster].months[month].medium++; }
    if (bucket === 'LOW') { clusterMonthMap[cluster].low++; clusterMonthMap[cluster].months[month].low++; }

    // ---- TEAM LEVEL ----
    if (!teamMonthMap[cluster]) teamMonthMap[cluster] = {};
    if (!teamMonthMap[cluster][team]) {
      teamMonthMap[cluster][team] = { total: 0, high: 0, medium: 0, low: 0, months: {} };
    }
    if (!teamMonthMap[cluster][team].months[month]) {
      teamMonthMap[cluster][team].months[month] = { high: 0, medium: 0, low: 0, total: 0 };
    }

    teamMonthMap[cluster][team].total += 1;
    teamMonthMap[cluster][team].months[month].total += 1;

    if (bucket === 'HIGH') { teamMonthMap[cluster][team].high++; teamMonthMap[cluster][team].months[month].high++; }
    if (bucket === 'MEDIUM') { teamMonthMap[cluster][team].medium++; teamMonthMap[cluster][team].months[month].medium++; }
    if (bucket === 'LOW') { teamMonthMap[cluster][team].low++; teamMonthMap[cluster][team].months[month].low++; }
  });

  // KPI Calculations
  const totalCandidates = dedupedRecords.length;
  let gH = 0, gM = 0, gL = 0;
  dedupedRecords.forEach(r => {
    if (r.bucket === 'HIGH') gH++;
    else if (r.bucket === 'MEDIUM') gM++;
    else gL++;
  });
  
  const hPct = totalCandidates > 0 ? (gH / totalCandidates) * 100 : 0;
  const mPct = totalCandidates > 0 ? (gM / totalCandidates) * 100 : 0;
  const lPct = totalCandidates > 0 ? (gL / totalCandidates) * 100 : 0;
  const gScore = calculateWeightedScore(gH, gM, gL, totalCandidates);

  return {
    clusterMonthMap,
    teamMonthMap,
    globalKPIs: {
      totalCandidates,
      highPct: hPct,
      medPct: mPct,
      lowPct: lPct,
      weightedScore: gScore,
      bestTeam: Object.keys(teamMonthMap).length > 0 
        ? Object.entries(teamMonthMap).reduce((best, [cluster, teams]) => {
            const teamScores = Object.entries(teams).map(([name, data]) => ({ name, score: calculateWeightedScore(data.high, data.medium, data.low, data.total) }));
            const localBest = teamScores.sort((a, b) => b.score - a.score)[0];
            return !best || localBest.score > best.score ? localBest : best;
          }, null as any)?.name || '—' 
        : '—', 
      worstTeam: Object.keys(teamMonthMap).length > 0 
        ? Object.entries(teamMonthMap).reduce((worst, [cluster, teams]) => {
            const teamScores = Object.entries(teams).map(([name, data]) => ({ name, score: calculateWeightedScore(data.high, data.medium, data.low, data.total) }));
            const localWorst = teamScores.sort((a, b) => a.score - b.score)[0];
            return !worst || localWorst.score < worst.score ? localWorst : worst;
          }, null as any)?.name || '—' 
        : '—',
    },
    penaltyEnabled: IP_CONFIG.penaltyEnabled
  };
}

// ─── RANKING CONFIG ───────────────────────────────────────────────
export const IP_RANK_CONFIG = {
  bucketA: 90,    // ≥90
  bucketB: 75,    // 75–89
  bucketC: 50,    // 50–74
  weightA: 95,
  weightB: 82.5,
  weightC: 62.5,
  penaltyD: 25,   // <50
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
  const DUMMY_TEAMS = new Set(['Team A', 'Unknown', '—', 'Unknown Team', 'Unmapped']);


  // ── STEP 1: Dedup — one record per employee per month ──
  const dedupMap = new Map<string, UnifiedRecord>();
  ds.forEach(r => {
    if (r.attendance.attendanceStatus !== 'Present') return;

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

    const cluster = TEAM_CLUSTER_MAP[team];
    if (!cluster) {
      console.warn('[IP Rank] Unmapped team:', team);
      return;
    }

    // Score: prefer schema camelCase keys → fallback to legacy Title Case
    const rawScore = Number(
      r.score?.scores?.['score'] ??
      r.score?.scores?.['percent'] ??
      r.score?.scores?.['tScore'] ??
      r.score?.scores?.['Score'] ??
      r.score?.scores?.['Percent'] ??
      r.score?.scores?.['T Score'] ??
      0
    );

    const key = `${month}__${team}`;
    if (!monthTeamMap[key]) {
      monthTeamMap[key] = { team, cluster, month, total: 0, a90: 0, b75: 0, c50: 0, dBelow50: 0, score: 0, clusterRank: 0, overallRank: 0 };
    }

    const t = monthTeamMap[key];
    t.total++;
    if (rawScore >= IP_RANK_CONFIG.bucketA)      t.a90++;
    else if (rawScore >= IP_RANK_CONFIG.bucketB) t.b75++;
    else if (rawScore >= IP_RANK_CONFIG.bucketC) t.c50++;
    else                                          t.dBelow50++;
  });

  // ── STEP 3: Calculate weighted score per team-month ──
  const monthlyList: IPMonthlyTeamRank[] = Object.values(monthTeamMap).map(t => ({
    ...t,
    score: t.total === 0
      ? 0
      : Math.round(
          (t.a90   * IP_RANK_CONFIG.weightA +
           t.b75   * IP_RANK_CONFIG.weightB +
           t.c50   * IP_RANK_CONFIG.weightC -
           t.dBelow50 * IP_RANK_CONFIG.penaltyD) / t.total
        )
  }));

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
