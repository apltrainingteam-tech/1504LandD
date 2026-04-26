import { useMemo } from 'react';

/**
 * useChartData
 * 
 * THE VISUAL TRANSFORMATION HOOK.
 * 
 * RESPONSIBILITIES:
 * 1. Convert domain-aggregated data into Recharts-compatible structures.
 * 2. Handle visual-only logic (colors, labels, distribution buckets).
 * 3. Calculate chart-specific metrics (best/worst team, trends).
 * 
 * ⚠️ ARCHITECTURAL GUARDRAILS:
 * - DO NOT perform raw data processing here. Rely on usePerformanceData outputs.
 * - DO NOT interact with API or Global Context directly.
 * - KEEP this hook pure (Data In → Chart Data Out).
 */

const normalizeMonthStr = (m: any): string => {
  if (!m) return '';
  let str = String(m).trim();
  if (/^\d{4}-\d{2}/.test(str)) return str.substring(0, 7);
  const monthNames: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  const slashMatch = str.match(/^(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    let mm = slashMatch[1].padStart(2, '0');
    let yy = slashMatch[2];
    let yyyy = yy.length === 2 ? (parseInt(yy) > 50 ? `19${yy}` : `20${yy}`) : yy;
    return `${yyyy}-${mm}`;
  }
  const wordMatch = str.match(/^([A-Za-z]{3})[-\s](\d{2,4})$/);
  if (wordMatch) {
    let mm = monthNames[wordMatch[1].toLowerCase()] || '00';
    let yy = wordMatch[2];
    let yyyy = yy.length === 2 ? (parseInt(yy) > 50 ? `19${yy}` : `20${yy}`) : yy;
    return `${yyyy}-${mm}`;
  }
  return str;
};
// The logic is entirely from PerformanceCharts.tsx

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

export const useChartData = ({
  tab, activeNT, ipData, activePerfData, activeAttData, MONTHS, normalizedAttendance, rawUnified, unified
}: any) => {

  const matrixData: MatrixCluster[] = useMemo(() => {
    let clusterMap: Record<string, any> = {};
    if (tab === 'IP') {
      Object.entries(ipData?.clusterMonthMap || {}).forEach(([clusterName, clusterData]: [string, any]) => {
        clusterMap[clusterName] = { ...clusterData, teams: {} };
      });
      Object.entries(ipData?.teamMonthMap || {}).forEach(([clusterName, teams]: [string, any]) => {
        if (clusterMap[clusterName]) clusterMap[clusterName].teams = teams;
      });
    } else if (activePerfData) {
      clusterMap = (activePerfData as any).clusterMap || (activePerfData as any).clusterMonthMap || {};
    }

    return Object.entries(clusterMap).map(([clusterName, clusterData]: [string, any]) => {
      const teams: MatrixTeam[] = [];
      const teamSources = Object.entries(clusterData.teams || {});

      teamSources.forEach(([teamName, teamData]: [string, any]) => {
        let score = 0;
        let metrics: Record<string, number> = {};
        const teamMonths = Object.values(teamData.months || {}) as any[];
        const activeMonths = teamMonths.filter(m => (m.count > 0 || m.attended > 0 || m.total > 0));
        
        const teamTotal = activeMonths.reduce((sum, m) => sum + (m.count || m.attended || 0), 0);

        if (tab === 'IP') {
          const tot = teamData.total || 1;
          score = ((teamData.elite * 98) + (teamData.high * 85) + (teamData.medium * 65) + (teamData.low * 35)) / tot;
          metrics = { Elite: (teamData.elite/tot)*100, High: (teamData.high/tot)*100, Medium: (teamData.medium/tot)*100, Low: (teamData.low/tot)*100 };
        } else if (activeNT === 'AP' || activeNT === 'Pre_AP') {
          const avgK = activeMonths.reduce((s, m) => s + (m.avgKnowledge || 0), 0) / (activeMonths.length || 1);
          const avgB = activeMonths.reduce((s, m) => s + (m.avgBSE || 0), 0) / (activeMonths.length || 1);
          score = (avgK + avgB) / 2;
          metrics = { Knowledge: avgK, BSE: avgB };
        } else if (activeNT === 'MIP' || activeNT === 'Refresher') {
          const avgSci = activeMonths.reduce((s, m) => s + (m.avgScience ?? 0), 0) / (activeMonths.length || 1);
          const avgSki = activeMonths.reduce((s, m) => s + (m.avgSkill ?? 0), 0) / (activeMonths.length || 1);
          score = (avgSci + avgSki) / 2;
          metrics = { Science: avgSci, Skill: avgSki };
        } else if (activeNT === 'Capsule') {
          score = activeMonths.reduce((s, m) => s + (m.avgScore ?? m.avgKnowledge ?? 0), 0) / (activeMonths.length || 1);
          metrics = { Score: score };
        }

        if (activeMonths.length > 0 || tab === 'IP') {
          teams.push({ name: teamName, total: teamTotal || teamData.total || 0, score, metrics, monthly: teamData.months || {} });
        }
      });

      return {
        cluster: clusterName,
        teams: teams.sort((a, b) => b.score - a.score),
        avgScore: teams.length > 0 ? teams.reduce((s, t) => s + t.score, 0) / teams.length : 0
      };
    }).filter(c => c.teams.length > 0).sort((a, b) => b.avgScore - a.avgScore);
  }, [tab, activeNT, ipData, activePerfData]);

  const kpis = useMemo(() => {
    const allTeams = matrixData.flatMap(c => c.teams);
    if (allTeams.length === 0) return { total: 0, score: 0, best: '—', worst: '—' };
    const total = allTeams.reduce((sum, t) => sum + t.total, 0);
    const avgScore = allTeams.reduce((sum, t) => sum + t.score, 0) / (allTeams.length || 1);
    const sorted = [...allTeams].sort((a, b) => b.score - a.score);
    return { total, score: avgScore, best: sorted[0]?.name || '—', worst: sorted[sorted.length - 1]?.name || '—' };
  }, [matrixData]);

  const distributionData = useMemo(() => {
    return MONTHS.map((m: string) => {
      const parts = m.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${monthNames[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;
      const buckets: any = { label };
      let foundData = false;
      let count = 0;
      matrixData.forEach(c => c.teams.forEach(t => {
        // Need to safely parse keys if they are slightly mismatched
        const mon = Object.entries(t.monthly).find(([k]) => k.includes(m) || m.includes(k.substring(0,7)))?.[1];
        if (mon && (mon.count > 0 || mon.attended > 0 || mon.total > 0)) {
          foundData = true;
          count++;
          if (tab === 'IP') {
            const tot = mon.total || 1;
            buckets.Elite = (buckets.Elite || 0) + (mon.elite / tot) * 100;
            buckets.High = (buckets.High || 0) + (mon.high / tot) * 100;
            buckets.Medium = (buckets.Medium || 0) + (mon.medium / tot) * 100;
            buckets.Low = (buckets.Low || 0) + (mon.low / tot) * 100;
          } else if (activeNT === 'AP' || activeNT === 'Pre_AP') {
            buckets.Knowledge = (buckets.Knowledge || 0) + (mon.avgKnowledge || 0);
            buckets.BSE = (buckets.BSE || 0) + (mon.avgBSE || 0);
          } else if (activeNT === 'MIP' || activeNT === 'Refresher') {
            buckets.Science = (buckets.Science || 0) + (mon.avgScience ?? 0);
            buckets.Skill = (buckets.Skill || 0) + (mon.avgSkill ?? 0);
          } else if (activeNT === 'Capsule') {
            buckets.Score = (buckets.Score || 0) + (mon.avgScore ?? 0);
          }
        }
      }));
      if (foundData && count > 0) {
        Object.keys(buckets).forEach(k => { if (k !== 'label') buckets[k] /= count; });
        return buckets;
      }
      if (tab === 'IP') return { label, Elite: 0, High: 0, Medium: 0, Low: 0 };
      if (activeNT === 'AP' || activeNT === 'Pre_AP') return { label, Knowledge: 0, BSE: 0 };
      if (activeNT === 'MIP' || activeNT === 'Refresher') return { label, Science: 0, Skill: 0 };
      return { label, Score: 0 };
    });
  }, [matrixData, MONTHS, tab, activeNT]);

  const rankingData = useMemo(() => {
    return matrixData.flatMap(c => c.teams).sort((a, b) => b.score - a.score).slice(0, 15)
      .map(t => ({ name: t.name, score: Math.round(t.score * 10) / 10 }));
  }, [matrixData]);

  const trendData = useMemo(() => {
    const data = MONTHS.map((m: string) => {
      const parts = m.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${monthNames[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;
      const row: any = { label };
      let hasAny = false;
      matrixData.forEach(c => {
        let clusterScore = 0, count = 0;
        c.teams.forEach(t => {
          const mon = Object.entries(t.monthly).find(([k]) => k.includes(m) || m.includes(k.substring(0,7)))?.[1];
          if (mon && (mon.count > 0 || mon.attended > 0 || mon.total > 0)) {
            count++;
            if (tab === 'IP') {
              const tot = mon.total || 1;
              clusterScore += ((mon.elite * 98) + (mon.high * 85) + (mon.medium * 65) + (mon.low * 35)) / tot;
            } else if (activeNT === 'AP' || activeNT === 'Pre_AP') {
              clusterScore += ((mon.avgKnowledge || 0) + (mon.avgBSE || 0)) / 2;
            } else if (activeNT === 'MIP' || activeNT === 'Refresher') {
              clusterScore += ((mon.avgScience ?? 0) + (mon.avgSkill ?? 0)) / 2;
            } else if (activeNT === 'Capsule') {
              clusterScore += (mon.avgScore ?? 0);
            }
          }
        });
        if (count > 0) {
          row[c.cluster] = Math.round((clusterScore / count) * 10) / 10;
          hasAny = true;
        }
      });
      return hasAny ? row : { label, empty: true };
    });
    return { data, clusters: matrixData.map(c => c.cluster) };
  }, [matrixData, MONTHS, tab, activeNT]);

  const attFunnelData = useMemo(() => {
    if (!activeAttData) return [];
    return MONTHS.map((m: string) => {
      let notified = 0, attended = 0;
      Object.values(activeAttData.clusterMonthMap || {}).forEach((c: any) => {
        const mData = Object.entries(c.months || {}).find(([k]) => k.includes(m) || m.includes(k.substring(0,7)))?.[1];
        if (mData) {
          notified += (mData as any).notified || 0;
          attended += (mData as any).attended || 0;
        }
      });
      const parts = m.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${monthNames[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;
      return { label, Notified: notified, Attended: attended };
    });
  }, [activeAttData, MONTHS]);

  const diagnostics = useMemo(() => {
    const totalRaw = normalizedAttendance?.length || 0;
    const typeMatched = normalizedAttendance?.filter((a: any) => a.trainingType === activeNT).length || 0;
    const fyMatched = rawUnified?.filter((r: any) => MONTHS.includes(r.attendance.month || '')).length || 0;
    const hasScoresTotal = rawUnified?.filter((r: any) => !!r.score).length || 0;
    
    const unifiedInFY = unified?.length || 0;
    const ipNormalizedCount = tab === 'IP' ? ipData?.recordsCount || 0 : 0;
    const withScoresInFY = unified?.filter((r: any) => !!r.score).length || 0;
    
    return { 
      totalRaw, typeMatched, fyMatched, hasScoresTotal, 
      activeNT, unifiedInFY, withScoresInFY, ipNormalizedCount
    };
  }, [normalizedAttendance, rawUnified, unified, activeNT, MONTHS, tab, ipData]);

  return {
    matrixData,
    kpis,
    distributionData,
    rankingData,
    trendData,
    attFunnelData,
    diagnostics
  };
};
