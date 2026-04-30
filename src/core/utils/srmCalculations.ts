/**
 * SRM (Recruitment Quality Intelligence) Calculations
 * 
 * Core calculations for:
 * - TS Distribution (Low, Mid, High)
 * - IP Distribution (Score ranges)
 * - TS vs IP Matrix
 * - Monthly Trends
 */

export interface SRMRecord {
  employeeId: string;
  team: string;
  cluster: string;
  tsScore: number | null;
  ipScore: number | null;
  month: string;
}

export const TS_BUCKETS = {
  LOW: { min: 15, max: 17, label: '15-17' },
  MID: { min: 18, max: 20, label: '18-20' },
  HIGH: { min: 21, max: 25, label: '21-25' }
};

export const IP_BUCKETS = {
  BELOW_50: { min: 0, max: 50, label: '<50' },
  RANGE_50_75: { min: 50, max: 75, label: '50-75' },
  RANGE_75_90: { min: 75, max: 90, label: '75-90' },
  ABOVE_90: { min: 90, max: 100, label: '>90' }
};

export interface IPDistributionBucket {
  below50: number;
  range50_75: number;
  range75_90: number;
  above90: number;
  total: number;
}

export interface IPDistributionPercent extends IPDistributionBucket {
  below50Pct: number;
  range50_75Pct: number;
  range75_90Pct: number;
  above90Pct: number;
}

export interface TSvsIPMatrix {
  tsRange: string;
  distribution: IPDistributionPercent;
  count: number;
}

export interface MonthlyTrendPoint {
  month: string;
  avgIP: number;
  avgTS: number;
  below50Count: number;
  below50Pct: number;
  above90Count: number;
  above90Pct: number;
  totalCount: number;
}

/**
 * Filter records for SRM analysis
 * - Only IP training type
 * - Only Present attendance
 * - Valid TS and IP scores
 */
export function filterSRMRecords(records: any[]): SRMRecord[] {
  if (!records || records.length === 0) return [];

  return records
    .filter(r => {
      const att = r.attendance || r;
      const trainingType = att.trainingType || r.trainingType;
      const attendanceStatus = att.attendanceStatus || r.attendanceStatus;
      const isVoided = att.isVoided || r.isVoided;
      
      return trainingType === 'IP' && attendanceStatus === 'Present' && !isVoided;

    })
    .map(r => {
      const att = r.attendance || r;
      const emp = r.employee || r;
      
      // Extract TS (Trainability Score) - may be in nomination or employee record
      const tsScore = r.nomination?.tsScore || r.tsScore || null;
      
      // Extract IP score from training_scores
      const ipScore = r.score?.scores?.ip_score ?? 
                      r.score?.scores?.IP ?? 
                      r.score?.scores?.['IP Score'] ?? 
                      r.ipScore ?? 
                      null;

      return {
        employeeId: emp.employeeId || emp.id,
        team: emp.team || att.team || '—',
        cluster: emp.state || emp.cluster || att.cluster || att.hq || '—',
        tsScore: typeof tsScore === 'number' && !isNaN(tsScore) ? tsScore : null,
        ipScore: typeof ipScore === 'number' && !isNaN(ipScore) ? ipScore : null,
        month: att.month || (att.attendanceDate ? att.attendanceDate.substring(0, 7) : '')
      };
    })
    .filter(r => r.tsScore !== null && r.ipScore !== null);
}

/**
 * Calculate IP distribution across all records
 */
export function calculateIPDistribution(records: SRMRecord[]): IPDistributionPercent {
  if (records.length === 0) {
    return {
      below50: 0,
      range50_75: 0,
      range75_90: 0,
      above90: 0,
      total: 0,
      below50Pct: 0,
      range50_75Pct: 0,
      range75_90Pct: 0,
      above90Pct: 0
    };
  }

  const dist: IPDistributionBucket = {
    below50: 0,
    range50_75: 0,
    range75_90: 0,
    above90: 0,
    total: records.length
  };

  for (const r of records) {
    if (r.ipScore === null) continue;
    
    if (r.ipScore < 50) dist.below50++;
    else if (r.ipScore < 75) dist.range50_75++;
    else if (r.ipScore < 90) dist.range75_90++;
    else dist.above90++;
  }

  return {
    ...dist,
    below50Pct: Math.round((dist.below50 / dist.total) * 100),
    range50_75Pct: Math.round((dist.range50_75 / dist.total) * 100),
    range75_90Pct: Math.round((dist.range75_90 / dist.total) * 100),
    above90Pct: Math.round((dist.above90 / dist.total) * 100)
  };
}

/**
 * Calculate TS Distribution
 */
export function calculateTSDistribution(records: SRMRecord[]): { low: number; mid: number; high: number; lowPct: number; midPct: number; highPct: number } {
  if (records.length === 0) {
    return { low: 0, mid: 0, high: 0, lowPct: 0, midPct: 0, highPct: 0 };
  }

  let low = 0, mid = 0, high = 0;

  for (const r of records) {
    if (r.tsScore === null) continue;
    
    if (r.tsScore >= TS_BUCKETS.LOW.min && r.tsScore <= TS_BUCKETS.LOW.max) low++;
    else if (r.tsScore >= TS_BUCKETS.MID.min && r.tsScore <= TS_BUCKETS.MID.max) mid++;
    else if (r.tsScore >= TS_BUCKETS.HIGH.min && r.tsScore <= TS_BUCKETS.HIGH.max) high++;
  }

  const total = low + mid + high;
  return {
    low,
    mid,
    high,
    lowPct: total > 0 ? Math.round((low / total) * 100) : 0,
    midPct: total > 0 ? Math.round((mid / total) * 100) : 0,
    highPct: total > 0 ? Math.round((high / total) * 100) : 0
  };
}

/**
 * Calculate TS vs IP Matrix
 * Shows IP distribution for each TS bucket
 */
export function calculateTSvsIPMatrix(records: SRMRecord[]): TSvsIPMatrix[] {
  const buckets = [
    { key: 'LOW', label: TS_BUCKETS.LOW.label },
    { key: 'MID', label: TS_BUCKETS.MID.label },
    { key: 'HIGH', label: TS_BUCKETS.HIGH.label }
  ];

  return buckets.map(bucket => {
    const bucketRecords = records.filter(r => {
      if (r.tsScore === null) return false;
      const b = TS_BUCKETS[bucket.key as keyof typeof TS_BUCKETS];
      return r.tsScore >= b.min && r.tsScore <= b.max;
    });

    const dist = calculateIPDistribution(bucketRecords);

    return {
      tsRange: bucket.label,
      distribution: dist,
      count: bucketRecords.length
    };
  });
}

/**
 * Calculate monthly trends
 */
export function calculateMonthlyTrend(records: SRMRecord[]): MonthlyTrendPoint[] {
  if (records.length === 0) return [];

  const monthMap = new Map<string, SRMRecord[]>();

  for (const r of records) {
    if (!r.month) continue;
    if (!monthMap.has(r.month)) monthMap.set(r.month, []);
    monthMap.get(r.month)!.push(r);
  }

  const trends: MonthlyTrendPoint[] = [];

  for (const [month, monthRecords] of monthMap) {
    const ipScores = monthRecords.filter(r => r.ipScore !== null).map(r => r.ipScore!);
    const tsScores = monthRecords.filter(r => r.tsScore !== null).map(r => r.tsScore!);

    const avgIP = ipScores.length > 0 
      ? Math.round(ipScores.reduce((a, b) => a + b, 0) / ipScores.length)
      : 0;

    const avgTS = tsScores.length > 0
      ? Math.round(tsScores.reduce((a, b) => a + b, 0) / tsScores.length * 100) / 100
      : 0;

    const below50Count = ipScores.filter(ip => ip < 50).length;
    const above90Count = ipScores.filter(ip => ip >= 90).length;

    trends.push({
      month,
      avgIP,
      avgTS,
      below50Count,
      below50Pct: ipScores.length > 0 ? Math.round((below50Count / ipScores.length) * 100) : 0,
      above90Count,
      above90Pct: ipScores.length > 0 ? Math.round((above90Count / ipScores.length) * 100) : 0,
      totalCount: monthRecords.length
    });
  }

  return trends.sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Group records by cluster
 */
export function groupByCluster(records: SRMRecord[]): Map<string, SRMRecord[]> {
  const map = new Map<string, SRMRecord[]>();

  for (const r of records) {
    const cluster = r.cluster || '—';
    if (!map.has(cluster)) map.set(cluster, []);
    map.get(cluster)!.push(r);
  }

  return map;
}

/**
 * Group records by cluster and team
 */
export function groupByClusterAndTeam(records: SRMRecord[]): Map<string, Map<string, SRMRecord[]>> {
  const clusterMap = new Map<string, Map<string, SRMRecord[]>>();

  for (const r of records) {
    const cluster = r.cluster || '—';
    const team = r.team || '—';

    if (!clusterMap.has(cluster)) {
      clusterMap.set(cluster, new Map());
    }

    const teamMap = clusterMap.get(cluster)!;
    if (!teamMap.has(team)) {
      teamMap.set(team, []);
    }

    teamMap.get(team)!.push(r);
  }

  return clusterMap;
}

/**
 * Calculate cluster-level aggregates
 */
export function calculateClusterMetrics(records: SRMRecord[]) {
  const clusterMap = groupByCluster(records);
  const metrics: any[] = [];

  for (const [cluster, clusterRecords] of clusterMap) {
    const ipDist = calculateIPDistribution(clusterRecords);
    const ipScores = clusterRecords.map(r => r.ipScore!);
    const tsScores = clusterRecords.map(r => r.tsScore!);

    metrics.push({
      cluster,
      count: clusterRecords.length,
      avgTS: Math.round(tsScores.reduce((a, b) => a + b, 0) / tsScores.length * 100) / 100,
      avgIP: Math.round(ipScores.reduce((a, b) => a + b, 0) / ipScores.length),
      below50Pct: ipDist.below50Pct,
      range50_75Pct: ipDist.range50_75Pct,
      range75_90Pct: ipDist.range75_90Pct,
      above90Pct: ipDist.above90Pct
    });
  }

  return metrics.sort((a, b) => b.count - a.count);
}

/**
 * Calculate team-level aggregates (within a cluster)
 */
export function calculateTeamMetrics(records: SRMRecord[], cluster?: string) {
  const clusterAndTeamMap = groupByClusterAndTeam(records);
  const metrics: any[] = [];

  if (cluster) {
    const teamMap = clusterAndTeamMap.get(cluster);
    if (!teamMap) return metrics;

    for (const [team, teamRecords] of teamMap) {
      const ipDist = calculateIPDistribution(teamRecords);
      const ipScores = teamRecords.map(r => r.ipScore!);
      const tsScores = teamRecords.map(r => r.tsScore!);

      metrics.push({
        team,
        cluster,
        count: teamRecords.length,
        avgTS: Math.round(tsScores.reduce((a, b) => a + b, 0) / tsScores.length * 100) / 100,
        avgIP: Math.round(ipScores.reduce((a, b) => a + b, 0) / ipScores.length),
        below50Pct: ipDist.below50Pct,
        range50_75Pct: ipDist.range50_75Pct,
        range75_90Pct: ipDist.range75_90Pct,
        above90Pct: ipDist.above90Pct
      });
    }
  } else {
    for (const [cluster, teamMap] of clusterAndTeamMap) {
      for (const [team, teamRecords] of teamMap) {
        const ipDist = calculateIPDistribution(teamRecords);
        const ipScores = teamRecords.map(r => r.ipScore!);
        const tsScores = teamRecords.map(r => r.tsScore!);

        metrics.push({
          team,
          cluster,
          count: teamRecords.length,
          avgTS: Math.round(tsScores.reduce((a, b) => a + b, 0) / tsScores.length * 100) / 100,
          avgIP: Math.round(ipScores.reduce((a, b) => a + b, 0) / ipScores.length),
          below50Pct: ipDist.below50Pct,
          range50_75Pct: ipDist.range50_75Pct,
          range75_90Pct: ipDist.range75_90Pct,
          above90Pct: ipDist.above90Pct
        });
      }
    }
  }

  return metrics.sort((a, b) => b.count - a.count);
}
