import { UnifiedRecord } from '../types/reports';
import { IPRecord, IPAggregates, IPMonthMapNode, IPHeritageMapCell } from '../types/reports';
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
    const s = r.score?.scores?.['Percent'] ?? r.score?.scores?.['T Score'] ?? r.score?.scores?.['Score'];
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
      bestTeam: '—', 
      worstTeam: '—',
    },
    penaltyEnabled: IP_CONFIG.penaltyEnabled
  };
}
