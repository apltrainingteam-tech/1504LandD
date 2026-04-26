import { useMemo } from 'react';

/**
 * useChartData
 * 
 * SINGLE-SOURCE CHART TRANSFORMATION HOOK.
 * 
 * RULE: ALL chart outputs are PURE TRANSFORMATIONS of matrixData.
 *       matrixData is THE SAME dataset used by Performance Tables.
 *       NO independent calculations. NO re-aggregation. NO filtering.
 * 
 * DATA FLOW:
 *   Engine Output (ipData / activePerfData)
 *     → matrixData (Cluster→Team→Month matrix — shared with tables)
 *       → distributionData  (transform only)
 *       → rankingData       (sort only)
 *       → trendData         (reshape only)
 *       → kpis              (reduce only)
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

export const useChartData = ({
  tab, activeNT, ipData, activePerfData, activeAttData, MONTHS,
}: {
  tab: string;
  activeNT: string;
  ipData: any;
  activePerfData: any;
  activeAttData: any;
  MONTHS: string[];
  [key: string]: any; // accept extra props gracefully
}) => {

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: BUILD MATRIX — this is the ONLY aggregation. 
  //         Identical logic to what the Performance Table reads.
  // ═══════════════════════════════════════════════════════════════════════════
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
          metrics = { Elite: (teamData.elite / tot) * 100, High: (teamData.high / tot) * 100, Medium: (teamData.medium / tot) * 100, Low: (teamData.low / tot) * 100 };
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


  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: ALL BELOW are PURE TRANSFORMS of matrixData. Zero independent logic.
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── KPIs — reduce matrixData only ──────────────────────────────────────
  const kpis = useMemo(() => {
    const allTeams = matrixData.flatMap(c => c.teams);
    if (allTeams.length === 0) return { total: 0, score: 0, best: '—', worst: '—' };
    const total = allTeams.reduce((sum, t) => sum + t.total, 0);
    const avgScore = allTeams.reduce((sum, t) => sum + t.score, 0) / allTeams.length;
    const sorted = [...allTeams].sort((a, b) => b.score - a.score);
    return { total, score: avgScore, best: sorted[0]?.name || '—', worst: sorted[sorted.length - 1]?.name || '—' };
  }, [matrixData]);

  // ─── Distribution — aggregate raw counts from matrixData.monthly, convert to % ──
  const distributionData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return MONTHS.map((m: string) => {
      const parts = m.split('-');
      const label = `${monthNames[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;

      if (tab === 'IP') {
        // Aggregate RAW COUNTS across all teams for this month, then convert to %
        let totalElite = 0, totalHigh = 0, totalMedium = 0, totalLow = 0, grandTotal = 0;
        matrixData.forEach(c => c.teams.forEach(t => {
          const mon = Object.entries(t.monthly).find(([k]) => k.includes(m) || m.includes(k.substring(0, 7)))?.[1] as any;
          if (mon && (mon.total > 0)) {
            totalElite  += (mon.elite  || 0);
            totalHigh   += (mon.high   || 0);
            totalMedium += (mon.medium || 0);
            totalLow    += (mon.low    || 0);
            grandTotal  += (mon.total  || 0);
          }
        }));
        if (grandTotal === 0) return { label, Elite: 0, High: 0, Medium: 0, Low: 0 };
        return {
          label,
          Elite:  Math.round((totalElite  / grandTotal) * 1000) / 10,
          High:   Math.round((totalHigh   / grandTotal) * 1000) / 10,
          Medium: Math.round((totalMedium / grandTotal) * 1000) / 10,
          Low:    Math.round((totalLow    / grandTotal) * 1000) / 10,
        };
      }

      // Non-IP: average scores across teams for this month
      let count = 0;
      const buckets: any = { label };
      matrixData.forEach(c => c.teams.forEach(t => {
        const mon = Object.entries(t.monthly).find(([k]) => k.includes(m) || m.includes(k.substring(0, 7)))?.[1] as any;
        if (mon && (mon.count > 0 || mon.attended > 0 || mon.total > 0)) {
          count++;
          if (activeNT === 'AP' || activeNT === 'Pre_AP') {
            buckets.Knowledge = (buckets.Knowledge || 0) + (mon.avgKnowledge || 0);
            buckets.BSE       = (buckets.BSE || 0) + (mon.avgBSE || 0);
          } else if (activeNT === 'MIP' || activeNT === 'Refresher') {
            buckets.Science = (buckets.Science || 0) + (mon.avgScience ?? 0);
            buckets.Skill   = (buckets.Skill || 0) + (mon.avgSkill ?? 0);
          } else if (activeNT === 'Capsule') {
            buckets.Score = (buckets.Score || 0) + (mon.avgScore ?? 0);
          }
        }
      }));

      if (count > 0) {
        Object.keys(buckets).forEach(k => { if (k !== 'label') buckets[k] = Math.round((buckets[k] / count) * 10) / 10; });
        return buckets;
      }
      if (activeNT === 'AP' || activeNT === 'Pre_AP') return { label, Knowledge: 0, BSE: 0 };
      if (activeNT === 'MIP' || activeNT === 'Refresher') return { label, Science: 0, Skill: 0 };
      return { label, Score: 0 };
    });
  }, [matrixData, MONTHS, tab, activeNT]);

  // ─── Ranking — flatMap matrixData.teams → sort by weighted score ─────────
  const rankingData = useMemo(() => {
    return matrixData
      .flatMap(c => c.teams)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map(t => ({ name: t.name, score: Math.round(t.score * 10) / 10 }));
  }, [matrixData]);

  // ─── HARD VALIDATION + DEEP DIAGNOSTICS (dev only) ───────────────────────
  if (process.env.NODE_ENV === 'development') {
    // Deep diagnostic: dump raw month data from first team
    if (tab === 'IP' && matrixData.length > 0 && matrixData[0].teams.length > 0) {
      const firstTeam = matrixData[0].teams[0];
      const monthKeys = Object.keys(firstTeam.monthly);
      const firstMonthKey = monthKeys[0];
      const firstMonthData = firstTeam.monthly[firstMonthKey];
      console.debug('[IP RAW MONTH KEYS]', monthKeys);
      console.debug('[IP FIRST MONTH RAW]', firstMonthKey, JSON.stringify(firstMonthData));
      console.debug('[MONTHS ARRAY]', MONTHS);
      
      // Test matching
      if (MONTHS.length > 0 && monthKeys.length > 0) {
        const testMonth = MONTHS[0];
        const matchResult = Object.entries(firstTeam.monthly).find(([k]) => k.includes(testMonth) || testMonth.includes(k.substring(0, 7)));
        console.debug('[MONTH MATCH TEST]', testMonth, '→', matchResult ? matchResult[0] : 'NO MATCH');
      }
    }

    // Distribution key contract validation
    if (tab === 'IP' && distributionData.length > 0) {
      const nonEmpty = distributionData.find((d: any) => d.Elite > 0 || d.High > 0 || d.Medium > 0 || d.Low > 0);
      if (nonEmpty) {
        const REQUIRED = ['Elite', 'High', 'Medium', 'Low'] as const;
        REQUIRED.forEach(k => {
          if (!(k in nonEmpty)) console.error(`[CHART KEY MISMATCH] Missing key: ${k}`, nonEmpty);
        });
        console.debug('[DIST SAMPLE]', JSON.stringify(nonEmpty));
      } else {
        console.warn('[DIST WARNING] All distribution rows have zero values');
      }
    }

    // Ranking validation
    if (matrixData.length > 0 && rankingData.length === 0) {
      console.error('[CHART PIPELINE VIOLATION] Ranking data empty despite matrixData having teams');
    }
    if (rankingData.length > 0) {
      console.debug('[RANK SAMPLE]', JSON.stringify(rankingData.slice(0, 3)));
    }

    console.debug('[DIST DATA]', distributionData);
    console.debug('[RANK DATA]', rankingData);
  }

  // ─── Trend — reshape matrixData.monthly per cluster ────────────────────
  const trendData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data = MONTHS.map((m: string) => {
      const parts = m.split('-');
      const label = `${monthNames[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;
      const row: any = { label };
      let hasAny = false;

      matrixData.forEach(c => {
        let clusterScore = 0, count = 0;
        c.teams.forEach(t => {
          const mon = Object.entries(t.monthly).find(([k]) => k.includes(m) || m.includes(k.substring(0, 7)))?.[1];
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

  // ─── Attendance Funnel — from activeAttData engine output (no recompute) ─
  const attFunnelData = useMemo(() => {
    if (!activeAttData) return [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return MONTHS.map((m: string) => {
      let notified = 0, attended = 0;
      Object.values(activeAttData.clusterMonthMap || {}).forEach((c: any) => {
        const mData = Object.entries(c.months || {}).find(([k]) => k.includes(m) || m.includes(k.substring(0, 7)))?.[1];
        if (mData) {
          notified += (mData as any).notified || 0;
          attended += (mData as any).attended || 0;
        }
      });
      const parts = m.split('-');
      const label = `${monthNames[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;
      return { label, Notified: notified, Attended: attended };
    });
  }, [activeAttData, MONTHS]);

  // ─── Debug verification — temporary, remove after validation ────────────
  if (process.env.NODE_ENV === 'development') {
    console.debug('[CHART PIPELINE] matrixData source:', matrixData.length, 'clusters');
    console.debug('[CHART PIPELINE] ranking derived from matrixData:', rankingData.length, 'teams');
  }

  return {
    matrixData,
    kpis,
    distributionData,
    rankingData,
    trendData,
    attFunnelData,
  };
};
