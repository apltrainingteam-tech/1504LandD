import { useMemo } from 'react';

/**
 * useChartData
 * 
 * CORE ORCHESTRATION HOOK for Training-Type Aware Charts.
 * PHASE 2: ROUTING & SEPARATION
 */

export interface MatrixTeam {
  name: string;
  total: number;
  score: number;
  metrics: Record<string, number>;
  monthly: Record<string, any>;
}

export interface MatrixCluster {
  cluster: string;
  teams: MatrixTeam[];
  avgScore: number;
}

export interface ChartDataset {
  matrixData: MatrixCluster[];
  kpis: { total: number; score: number; best: string; worst: string };
  distributionData: any[];
  rankingData: any[];
  trendData: { data: any[]; clusters: string[] };
  attFunnelData: any[];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const useChartData = ({
  tab, activeNT, MONTHS,
  ipData, apData, mipData, refresherData, capsuleData, filteredData,
  globalFilters
}: {
  tab: string;
  activeNT: string;
  MONTHS: string[];
  ipData: any;
  apData: any;
  mipData: any;
  refresherData: any;
  capsuleData: any;
  filteredData: any[];
  globalFilters: any;
}): ChartDataset & { bseDistribution?: any[], scoreBands?: any[], competencyData?: any[], trainerEffectiveness?: any[], radarData?: any[], managerTiering?: any[] } => {

  const dimension = globalFilters?.team ? "team" : "cluster";

  return useMemo(() => {
    switch (activeNT) {
      case 'IP':
        return buildIPCharts(ipData, MONTHS, filteredData, dimension);
      case 'AP':
      case 'Pre_AP':
        return buildAPCharts(apData, MONTHS, filteredData, dimension);
      case 'MIP':
        return buildMIPCharts(mipData, MONTHS, filteredData, dimension);
      case 'Refresher':
        return buildRefresherCharts(refresherData, MONTHS, dimension);
      case 'Capsule':
        return buildCapsuleCharts(capsuleData, MONTHS, dimension);
      default:
        return buildEmptyCharts(MONTHS);
    }
  }, [activeNT, tab, MONTHS, ipData, apData, mipData, refresherData, capsuleData, filteredData, dimension]);
};

// ─── IP CHART BUILDER ────────────────────────────────────────────────────────
function buildIPCharts(ipData: any, months: string[], filteredData: any[], dimension: string): ChartDataset & { scoreBands?: any[], competencyData?: any[], trainerEffectiveness?: any[] } {
  if (!ipData) return buildEmptyCharts(months);

  // 1. Matrix (Score centric)
  const matrixData: MatrixCluster[] = Object.entries(ipData.ipData?.clusterMonthMap || {}).map(([cName, cData]: [string, any]) => {
    const teams: MatrixTeam[] = (ipData.ipRankData?.teamMonthMap?.[cName] || []).map((tData: any) => {
      return {
        name: tData.name,
        total: tData.total,
        score: tData.avgScore || 0,
        metrics: { Score: tData.avgScore || 0 },
        monthly: tData.months || {}
      };
    });
    return {
      cluster: cName,
      teams: teams.sort((a, b) => b.score - a.score),
      avgScore: teams.length > 0 ? teams.reduce((s, t) => s + t.score, 0) / teams.length : 0
    };
  }).filter(c => c.teams.length > 0).sort((a, b) => b.avgScore - a.avgScore);

  // 2. KPIs
  const allTeams = matrixData.flatMap(c => c.teams);
  const kpis = {
    total: ipData.ipKPI?.totalTrained || 0,
    score: ipData.ipKPI?.avgScore || 0,
    best: allTeams.sort((a, b) => b.score - a.score)[0]?.name || '—',
    worst: allTeams.sort((a, b) => a.score - b.score)[0]?.name || '—'
  };

  // 3. Score Band Distribution (A >= 85, B 70-84, C 50-69, D < 50)
  const bands = { A: 0, B: 0, C: 0, D: 0 };
  const competencySums = { Knowledge: 0, Detailing: 0, 'Role Play': 0, Grooming: 0 };
  const competencyCounts = { Knowledge: 0, Detailing: 0, 'Role Play': 0, Grooming: 0 };
  const trainerMap: Record<string, { sum: number; count: number }> = {};

  filteredData.forEach(r => {
    const s = r.score?.scores || {};
    const avg = r.score?.avgScore || 0;
    
    // Band Distribution
    if (avg >= 85) bands.A++;
    else if (avg >= 70) bands.B++;
    else if (avg >= 50) bands.C++;
    else bands.D++;

    // Competency Breakdown
    const compMap: Record<string, string[]> = {
      Knowledge: ['knowledge', 'knowledgeScore', 'testScore'],
      Detailing: ['detailing', 'Detailing'],
      'Role Play': ['rolePlay', 'roleplay', 'Role Play', 'situationHandling'],
      Grooming: ['grooming', 'Grooming']
    };

    Object.entries(compMap).forEach(([label, keys]) => {
      keys.forEach(k => {
        const val = typeof s[k] === 'number' ? s[k] : null;
        if (val !== null) {
          (competencySums as any)[label] += val;
          (competencyCounts as any)[label]++;
        }
      });
    });

    // Trainer Effectiveness
    const trainer = r.attendance.trainerName || r.attendance.trainerId || 'Unknown';
    if (!trainerMap[trainer]) trainerMap[trainer] = { sum: 0, count: 0 };
    trainerMap[trainer].sum += avg;
    trainerMap[trainer].count++;
  });

  const scoreBands = Object.entries(bands).map(([name, value]) => ({ name, value }));
  const competencyData = Object.entries(competencySums).map(([name, sum]) => ({
    name,
    score: (competencyCounts as any)[name] > 0 ? sum / (competencyCounts as any)[name] : 0
  }));
  const trainerEffectiveness = Object.entries(trainerMap)
    .map(([name, data]) => ({ name, score: data.sum / data.count }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // 4. Ranking
  const rankingData = allTeams.sort((a, b) => b.score - a.score).map(t => ({ name: t.name, score: t.score }));

  // 5. Trend (Line) - Score focus
  const trendDataRows = months.map(m => {
    const parts = m.split('-');
    const label = `${MONTH_NAMES[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;
    const row: any = { label };
    let hasAny = false;
    matrixData.forEach(c => {
      let clusterScore = 0, count = 0;
      c.teams.forEach(t => {
        const mon = Object.entries(t.monthly).find(([k]) => k.includes(m) || m.includes(k.substring(0, 7)))?.[1] as any;
        if (mon && mon.total > 0) { clusterScore += mon.avgScore || 0; count++; }
      });
      if (count > 0) { row[c.cluster] = clusterScore / count; hasAny = true; }
    });
    return hasAny ? row : { label, empty: true };
  });

  return { 
    matrixData, kpis, 
    distributionData: [], // Legacy
    rankingData, 
    trendData: { data: trendDataRows, clusters: matrixData.map(c => c.cluster) }, 
    attFunnelData: [],
    scoreBands,
    competencyData,
    trainerEffectiveness
  };
}

// ─── AP CHART BUILDER ────────────────────────────────────────────────────────
function buildAPCharts(apData: any, months: string[], filteredData: any[], dimension: string): ChartDataset & { bseDistribution?: any[] } {
  if (!apData || !apData.apPerfData) return buildEmptyCharts(months);

  const clusterMap = apData.apPerfData.clusterMap || {};

  // 1. Matrix (BSE centric)
  const matrixData: MatrixCluster[] = Object.entries(clusterMap).map(([cName, cData]: [string, any]) => {
    const teams: MatrixTeam[] = Object.entries(cData.teams || {}).map(([tName, tData]: [string, any]) => {
      const activeMonths = Object.values(tData.months || {}).filter((m: any) => m.count > 0);
      const avgB = activeMonths.reduce((s: number, m: any) => s + (m.avgBSE || 0), 0) / (activeMonths.length || 1);
      return {
        name: tName,
        total: activeMonths.reduce((sum: number, m: any) => sum + (m.count || 0), 0),
        score: avgB, // BSE is the primary score now
        metrics: { BSE: avgB },
        monthly: tData.months || {}
      };
    });
    return {
      cluster: cName,
      teams: teams.sort((a, b) => b.score - a.score),
      avgScore: teams.length > 0 ? teams.reduce((s, t) => s + t.score, 0) / teams.length : 0
    };
  }).filter(c => c.teams.length > 0).sort((a, b) => b.avgScore - a.avgScore);

  // 2. KPIs (BSE focus)
  const allTeams = matrixData.flatMap(c => c.teams);
  const kpis = {
    total: apData.apPerfData.globalKPIs.totalAttended,
    score: apData.apPerfData.globalKPIs.avgBSE,
    best: allTeams.sort((a, b) => b.score - a.score)[0]?.name || '—',
    worst: allTeams.sort((a, b) => a.score - b.score)[0]?.name || '—'
  };

  // 3. BSE Distribution (Buckets: >=90, 75-89, 60-74, <60)
  const bseBuckets = { Excellent: 0, Good: 0, Average: 0, Poor: 0 };
  filteredData.forEach(r => {
    const scores = r.score?.scores || {};
    // Calculate BSE (avg of parameters)
    const bseKeys = ['grasping', 'detailing', 'situationHandling', 'english', 'localLanguage', 'involvement', 'effort', 'confidence'];
    let sum = 0, count = 0;
    bseKeys.forEach(k => {
      const v = typeof scores[k] === 'number' ? scores[k] : null;
      if (v !== null) { sum += v; count++; }
    });
    if (count > 0) {
      const avg = sum / count;
      if (avg >= 90) bseBuckets.Excellent++;
      else if (avg >= 75) bseBuckets.Good++;
      else if (avg >= 60) bseBuckets.Average++;
      else bseBuckets.Poor++;
    }
  });

  const bseDistribution = Object.entries(bseBuckets).map(([name, value]) => ({ name, value }));

  // 4. Monthly Trend (Line) - BSE focus
  const trendDataRows = months.map(m => {
    const parts = m.split('-');
    const label = `${MONTH_NAMES[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;
    const row: any = { label };
    let hasAny = false;
    matrixData.forEach(c => {
      let clusterBSE = 0, count = 0;
      c.teams.forEach(t => {
        const mon = Object.entries(t.monthly).find(([k]) => k.includes(m) || m.includes(k.substring(0, 7)))?.[1] as any;
        if (mon && mon.count > 0) { clusterBSE += mon.avgBSE || 0; count++; }
      });
      if (count > 0) { row[c.cluster] = clusterBSE / count; hasAny = true; }
    });
    return hasAny ? row : { label, empty: true };
  });

  const rankingData = allTeams.sort((a, b) => b.score - a.score).map(t => ({ name: t.name, score: t.score }));

  return { 
    matrixData, kpis, 
    distributionData: [], // Replaced by bseDistribution
    rankingData, 
    trendData: { data: trendDataRows, clusters: matrixData.map(c => c.cluster) }, 
    attFunnelData: [],
    bseDistribution 
  };
}

// ─── MIP CHART BUILDER ───────────────────────────────────────────────────────
function buildMIPCharts(mipData: any, months: string[], filteredData: any[], dimension: string): ChartDataset & { radarData?: any[], managerTiering?: any[] } {
  if (!mipData || !mipData.mipPerfData) return buildEmptyCharts(months);

  const clusterMap = mipData.mipPerfData.clusterMap || {};

  // 1. Matrix
  const matrixData: MatrixCluster[] = Object.entries(clusterMap).map(([cName, cData]: [string, any]) => {
    const teams: MatrixTeam[] = Object.entries(cData.teams || {}).map(([tName, tData]: [string, any]) => {
      const activeMonths = Object.values(tData.months || {}).filter((m: any) => m.count > 0);
      const avgSci = activeMonths.reduce((s: number, m: any) => s + (m.avgScience || 0), 0) / (activeMonths.length || 1);
      const avgSkl = activeMonths.reduce((s: number, m: any) => s + (m.avgSkill || 0), 0) / (activeMonths.length || 1);
      return {
        name: tName,
        total: activeMonths.reduce((sum: number, m: any) => sum + (m.count || 0), 0),
        score: (avgSci + avgSkl) / 2,
        metrics: { Science: avgSci, Skill: avgSkl },
        monthly: tData.months || {}
      };
    });
    return {
      cluster: cName,
      teams: teams.sort((a, b) => b.score - a.score),
      avgScore: teams.length > 0 ? teams.reduce((s, t) => s + t.score, 0) / teams.length : 0
    };
  }).filter(c => c.teams.length > 0).sort((a, b) => b.avgScore - a.avgScore);

  const allTeams = matrixData.flatMap(c => c.teams);
  const kpis = {
    total: mipData.mipPerfData.globalKPIs.totalAttended,
    score: (mipData.mipPerfData.globalKPIs.avgScience + mipData.mipPerfData.globalKPIs.avgSkill) / 2,
    best: allTeams.sort((a, b) => b.score - a.score)[0]?.name || '—',
    worst: allTeams.sort((a, b) => a.score - b.score)[0]?.name || '—'
  };

  // 2. Behaviour Radar
  const radarSums = { Leadership: 0, Ownership: 0, Communication: 0, 'Decision Making': 0 };
  const radarCounts = { Leadership: 0, Ownership: 0, Communication: 0, 'Decision Making': 0 };
  const tiers = { Ready: 0, Developing: 0, Critical: 0 };

  filteredData.forEach(r => {
    const s = r.score?.scores || {};
    const avg = r.score?.avgScore || 0;

    // Manager Tiering (Ready >= 85, Developing 65-84, Critical < 65)
    if (avg >= 85) tiers.Ready++;
    else if (avg >= 65) tiers.Developing++;
    else tiers.Critical++;

    // Behavioural Metrics
    const bMap: Record<string, string[]> = {
      Leadership: ['leadership', 'coaching', 'Management', 'management'],
      Ownership: ['ownership', 'accountability', 'Ownership'],
      Communication: ['communication', 'presentation', 'Interpersonal', 'localLanguage'],
      'Decision Making': ['decisionMaking', 'analytical', 'Planning']
    };

    Object.entries(bMap).forEach(([label, keys]) => {
      keys.forEach(k => {
        const val = typeof s[k] === 'number' ? s[k] : null;
        if (val !== null) {
          (radarSums as any)[label] += val;
          (radarCounts as any)[label]++;
        }
      });
    });
  });

  const radarData = Object.entries(radarSums).map(([subject, sum]) => ({
    subject,
    A: (radarCounts as any)[subject] > 0 ? sum / (radarCounts as any)[subject] : 0,
    fullMark: 100
  }));

  const managerTiering = Object.entries(tiers).map(([name, value]) => ({ name, value }));

  const rankingData = allTeams.sort((a, b) => b.score - a.score).map(t => ({ name: t.name, score: t.score }));

  const trendDataRows = months.map(m => {
    const parts = m.split('-');
    const label = `${MONTH_NAMES[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;
    const row: any = { label };
    let hasAny = false;
    matrixData.forEach(c => {
      let clusterScore = 0, count = 0;
      c.teams.forEach(t => {
        const mon = Object.entries(t.monthly).find(([k]) => k.includes(m) || m.includes(k.substring(0, 7)))?.[1] as any;
        if (mon && mon.count > 0) { clusterScore += ((mon.avgScience || 0) + (mon.avgSkill || 0)) / 2; count++; }
      });
      if (count > 0) { row[c.cluster] = clusterScore / count; hasAny = true; }
    });
    return hasAny ? row : { label, empty: true };
  });

  const attFunnelData = months.map(m => {
    const parts = m.split('-');
    const label = `${MONTH_NAMES[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;
    let notified = 0, attended = 0;
    Object.values(mipData.mipAttData?.clusterMonthMap || {}).forEach((c: any) => {
      const mData = Object.entries(c.months || {}).find(([k]) => k.includes(m) || m.includes(k.substring(0, 7)))?.[1] as any;
      if (mData) { notified += mData.notified || 0; attended += mData.attended || 0; }
    });
    return { label, Notified: notified, Attended: attended };
  });

  return { matrixData, kpis, distributionData: [], rankingData, trendData: { data: trendDataRows, clusters: matrixData.map(c => c.cluster) }, attFunnelData, radarData, managerTiering };
}

// ─── REFRESHER CHART BUILDER ─────────────────────────────────────────────────
function buildRefresherCharts(refData: any, months: string[], dimension: string): ChartDataset {
  if (!refData || !refData.refresherPerfData) return buildEmptyCharts(months);

  const clusterMap = refData.refresherPerfData.clusterMap || {};

  const matrixData: MatrixCluster[] = Object.entries(clusterMap).map(([cName, cData]: [string, any]) => {
    const teams: MatrixTeam[] = Object.entries(cData.teams || {}).map(([tName, tData]: [string, any]) => {
      const activeMonths = Object.values(tData.months || {}).filter((m: any) => m.count > 0);
      const avgSci = activeMonths.reduce((s: number, m: any) => s + (m.avgScience || 0), 0) / (activeMonths.length || 1);
      const avgSkl = activeMonths.reduce((s: number, m: any) => s + (m.avgSkill || 0), 0) / (activeMonths.length || 1);
      const avgKno = activeMonths.reduce((s: number, m: any) => s + (m.avgKnowledge || 0), 0) / (activeMonths.length || 1);
      const avgSit = activeMonths.reduce((s: number, m: any) => s + (m.avgSituation || 0), 0) / (activeMonths.length || 1);
      const avgPre = activeMonths.reduce((s: number, m: any) => s + (m.avgPresentation || 0), 0) / (activeMonths.length || 1);
      
      const score = (avgSci + avgSkl + avgKno + avgSit + avgPre) / 5;
      
      return {
        name: tName,
        total: activeMonths.reduce((sum: number, m: any) => sum + (m.count || 0), 0),
        score,
        metrics: { Science: avgSci, Skill: avgSkl, Knowledge: avgKno, Situation: avgSit, Presentation: avgPre },
        monthly: tData.months || {}
      };
    });
    return {
      cluster: cName,
      teams: teams.sort((a, b) => b.score - a.score),
      avgScore: teams.length > 0 ? teams.reduce((s, t) => s + t.score, 0) / teams.length : 0
    };
  }).filter(c => c.teams.length > 0).sort((a, b) => b.avgScore - a.avgScore);

  const allTeams = matrixData.flatMap(c => c.teams);
  const kpis = {
    total: allTeams.reduce((sum, t) => sum + t.total, 0),
    score: allTeams.length > 0 ? allTeams.reduce((sum, t) => sum + t.score, 0) / allTeams.length : 0,
    best: allTeams.sort((a, b) => b.score - a.score)[0]?.name || '—',
    worst: allTeams.sort((a, b) => a.score - b.score)[0]?.name || '—'
  };

  const distributionData = months.map(m => {
    const parts = m.split('-');
    const label = `${MONTH_NAMES[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;
    let sums = { Science: 0, Skill: 0, Knowledge: 0, Situation: 0, Presentation: 0 };
    let count = 0;
    matrixData.forEach(c => c.teams.forEach(t => {
      const mon = Object.entries(t.monthly).find(([k]) => k.includes(m) || m.includes(k.substring(0, 7)))?.[1] as any;
      if (mon && mon.count > 0) {
        sums.Science += mon.avgScience || 0;
        sums.Skill += mon.avgSkill || 0;
        sums.Knowledge += mon.avgKnowledge || 0;
        sums.Situation += mon.avgSituation || 0;
        sums.Presentation += mon.avgPresentation || 0;
        count++;
      }
    }));
    const row: any = { label };
    Object.keys(sums).forEach(k => { (row as any)[k] = count > 0 ? (sums as any)[k] / count : 0; });
    return row;
  });

  const rankingData = allTeams.sort((a, b) => b.score - a.score).slice(0, 15).map(t => ({ name: t.name, score: t.score }));

  const trendDataRows = months.map(m => {
    const parts = m.split('-');
    const label = `${MONTH_NAMES[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;
    const row: any = { label };
    let hasAny = false;
    matrixData.forEach(c => {
      let clusterScore = 0, count = 0;
      c.teams.forEach(t => {
        const mon = Object.entries(t.monthly).find(([k]) => k.includes(m) || m.includes(k.substring(0, 7)))?.[1] as any;
        if (mon && mon.count > 0) {
          clusterScore += (mon.avgScience + mon.avgSkill + mon.avgKnowledge + mon.avgSituation + mon.avgPresentation) / 5;
          count++;
        }
      });
      if (count > 0) { row[c.cluster] = clusterScore / count; hasAny = true; }
    });
    return hasAny ? row : { label, empty: true };
  });

  const attFunnelData = months.map(m => {
    const parts = m.split('-');
    const label = `${MONTH_NAMES[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;
    let notified = 0, attended = 0;
    Object.values(refData.refresherAttData?.clusterMonthMap || {}).forEach((c: any) => {
      const mData = Object.entries(c.months || {}).find(([k]) => k.includes(m) || m.includes(k.substring(0, 7)))?.[1] as any;
      if (mData) { notified += mData.notified || 0; attended += mData.attended || 0; }
    });
    return { label, Notified: notified, Attended: attended };
  });

  return { matrixData, kpis, distributionData, rankingData, trendData: { data: trendDataRows, clusters: matrixData.map(c => c.cluster) }, attFunnelData };
}

// ─── CAPSULE CHART BUILDER ───────────────────────────────────────────────────
function buildCapsuleCharts(capData: any, months: string[], dimension: string): ChartDataset {
  if (!capData || !capData.capsulePerfData) return buildEmptyCharts(months);

  const clusterMap = capData.capsulePerfData.clusterMap || {};

  const matrixData: MatrixCluster[] = Object.entries(clusterMap).map(([cName, cData]: [string, any]) => {
    const teams: MatrixTeam[] = Object.entries(cData.teams || {}).map(([tName, tData]: [string, any]) => {
      const activeMonths = Object.values(tData.months || {}).filter((m: any) => m.count > 0);
      const avg = activeMonths.reduce((s: number, m: any) => s + (m.avgScore || 0), 0) / (activeMonths.length || 1);
      return {
        name: tName,
        total: activeMonths.reduce((sum: number, m: any) => sum + (m.count || 0), 0),
        score: avg,
        metrics: { Score: avg },
        monthly: tData.months || {}
      };
    });
    return {
      cluster: cName,
      teams: teams.sort((a, b) => b.score - a.score),
      avgScore: teams.length > 0 ? teams.reduce((s, t) => s + t.score, 0) / teams.length : 0
    };
  }).filter(c => c.teams.length > 0).sort((a, b) => b.avgScore - a.avgScore);

  const allTeams = matrixData.flatMap(c => c.teams);
  const kpis = {
    total: allTeams.reduce((sum, t) => sum + t.total, 0),
    score: allTeams.length > 0 ? allTeams.reduce((sum, t) => sum + t.score, 0) / allTeams.length : 0,
    best: allTeams.sort((a, b) => b.score - a.score)[0]?.name || '—',
    worst: allTeams.sort((a, b) => a.score - b.score)[0]?.name || '—'
  };

  const distributionData = months.map(m => {
    const parts = m.split('-');
    const label = `${MONTH_NAMES[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;
    let sSum = 0, count = 0;
    matrixData.forEach(c => c.teams.forEach(t => {
      const mon = Object.entries(t.monthly).find(([k]) => k.includes(m) || m.includes(k.substring(0, 7)))?.[1] as any;
      if (mon && mon.count > 0) { sSum += mon.avgScore || 0; count++; }
    }));
    return { label, Score: count > 0 ? sSum / count : 0 };
  });

  const rankingData = allTeams.sort((a, b) => b.score - a.score).slice(0, 15).map(t => ({ name: t.name, score: t.score }));

  const trendDataRows = months.map(m => {
    const parts = m.split('-');
    const label = `${MONTH_NAMES[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;
    const row: any = { label };
    let hasAny = false;
    matrixData.forEach(c => {
      let clusterScore = 0, count = 0;
      c.teams.forEach(t => {
        const mon = Object.entries(t.monthly).find(([k]) => k.includes(m) || m.includes(k.substring(0, 7)))?.[1] as any;
        if (mon && mon.count > 0) { clusterScore += mon.avgScore || 0; count++; }
      });
      if (count > 0) { row[c.cluster] = clusterScore / count; hasAny = true; }
    });
    return hasAny ? row : { label, empty: true };
  });

  const attFunnelData = months.map(m => {
    const parts = m.split('-');
    const label = `${MONTH_NAMES[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;
    let notified = 0, attended = 0;
    Object.values(capData.capsuleAttData?.clusterMonthMap || {}).forEach((c: any) => {
      const mData = Object.entries(c.months || {}).find(([k]) => k.includes(m) || m.includes(k.substring(0, 7)))?.[1] as any;
      if (mData) { notified += mData.notified || 0; attended += mData.attended || 0; }
    });
    return { label, Notified: notified, Attended: attended };
  });

  return { matrixData, kpis, distributionData, rankingData, trendData: { data: trendDataRows, clusters: matrixData.map(c => c.cluster) }, attFunnelData };
}

// ─── EMPTY CHART BUILDER ─────────────────────────────────────────────────────
function buildEmptyCharts(months: string[]): ChartDataset {
  return {
    matrixData: [],
    kpis: { total: 0, score: 0, best: '—', worst: '—' },
    distributionData: months.map(m => ({ label: m })),
    rankingData: [],
    trendData: { data: [], clusters: [] },
    attFunnelData: []
  };
}
