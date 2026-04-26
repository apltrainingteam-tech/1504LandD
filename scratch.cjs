const fs = require('fs');
const path = 'd:/Personal/visual-L-D-Database/src/features/dashboard/PerformanceCharts.tsx';
let content = fs.readFileSync(path, 'utf8');

const startStr = '  const MONTHS = useMemo(() => getFiscalMonths(selectedFY), [selectedFY]);';
const endStr = '  const monthsOptions = useMonthsFromData(rawUnified);';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr) + endStr.length;

const replacement = `  const {
    MONTHS,
    activeNT,
    rawUnified,
    unified,
    ipData,
    apAttData,
    mipAttData,
    refresherAttData,
    capsuleAttData,
    apPerfData,
    mipPerfData,
    refresherPerfData,
    capsulePerfData,
    eligibilityResults,
    gapMetrics,
    groups,
    trainerStats,
    months: dataMonths,
    timeSeries
  } = usePerformanceData({
    employees, attendance, scores, nominations, rules, masterTeams,
    tab, selectedFY, filter: {
      monthFrom: pageFilters.month ? normalizeMonthStr(pageFilters.month) : '', 
      monthTo: pageFilters.month ? normalizeMonthStr(pageFilters.month) : '',
      teams: pageFilters.team ? [pageFilters.team] : [],
      clusters: pageFilters.cluster ? [pageFilters.cluster] : [],
      trainer: pageFilters.trainer || ''
    }, viewBy: 'Month', tsMode, pageMode: 'performance-charts'
  });

  const activeAttData = activeNT === 'AP' ? apAttData : activeNT === 'MIP' ? mipAttData : activeNT === 'Refresher' ? refresherAttData : (activeNT === 'Pre_AP' ? apAttData : capsuleAttData);
  const activePerfData = activeNT === 'AP' ? apPerfData : activeNT === 'MIP' ? mipPerfData : activeNT === 'Refresher' ? refresherPerfData : (activeNT === 'Pre_AP' ? apPerfData : capsulePerfData);

  const {
    matrixData,
    kpis,
    distributionData,
    rankingData,
    trendData,
    attFunnelData,
    diagnostics
  } = useChartData({
    tab, activeNT, ipData, activePerfData, activeAttData, MONTHS, normalizedAttendance: attendance, rawUnified, unified
  });

  const tsChartData = useMemo(() => timeSeries.map((r) => ({ label: r.label, ...r.cells })), [timeSeries]);
  const tsKeys = useMemo(() => {
    const keys = new Set<string>();
    timeSeries.forEach((r) => Object.keys(r.cells).forEach(k => keys.add(k)));
    return Array.from(keys);
  }, [timeSeries]);

  const trainerScatterData = useMemo(() => {
    return trainerStats.map((t) => ({ name: t.trainerId, volume: t.trainingsConducted, score: t.avgScore })).sort((a, b) => b.volume - a.volume).slice(0, 30);
  }, [trainerStats]);
  const { allTeams, allTrainers } = useFilterOptions(employees, attendance, tab, masterTeams, masterTrainers);
  const allClusters = useMemo(() => masterClusters.map(c => c.name), [masterClusters]);
  const monthsOptions = useMonthsFromData(rawUnified);`;

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync(path, newContent);
console.log('Replaced PerformanceCharts logic with hooks!');
