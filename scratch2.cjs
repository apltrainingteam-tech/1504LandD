const fs = require('fs');
const path = 'd:/Personal/visual-L-D-Database/src/features/dashboard/ReportsAnalytics.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix Imports
const importsToReplace = `import { buildUnifiedDataset, applyFilters, normalizeTrainingType } from '../../core/engines/reportEngine';
import { getEligibleEmployees } from '../../core/engines/eligibilityEngine';
import { getFiscalMonths, getCurrentFY, computeIPScore, buildIPAggregates, buildIPMonthlyTeamRanks } from '../../core/engines/ipEngine';
import { buildEmployeeTimelines, filterTimelines, buildAPMonthlyMatrix, getAPPerformanceAggregates } from '../../core/engines/apEngine';
import { buildMIPAttendanceMatrix, getMIPPerformanceAggregates } from '../../core/engines/mipEngine';
import { buildRefresherAttendanceMatrix, getRefresherPerformanceAggregates } from '../../core/engines/refresherEngine';
import { buildCapsuleAttendanceMatrix, getCapsulePerformanceAggregates } from '../../core/engines/capsuleEngine';
import { useGapMetrics, useGroupedData, useRankedGroups, useTrainerStats, useDrilldownNodes, useMonthsFromData, useTimeSeries, useFilterOptions } from '../../shared/hooks/computationHooks';`;

const newImports = `import { getCurrentFY, computeIPScore } from '../../core/engines/ipEngine';
import { useFilterOptions, useMonthsFromData } from '../../shared/hooks/computationHooks';
import { usePerformanceData } from './hooks/usePerformanceData';`;

content = content.replace(importsToReplace, newImports);

// 2. Replace engine logic with hook call
const startStr = '  const normalizeType = (value?: string) => normalizeTrainingType(value || \'\');';
const endStr = '  const timeSeries = useTimeSeries(groups, months, tab, tsMode);';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr) + endStr.length;

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find start or end strings in ReportsAnalytics.tsx");
  process.exit(1);
}

const replacement = `
  const {
    MONTHS,
    activeNT,
    rawUnified,
    unified,
    ipData,
    ipRankData,
    rawTimelines,
    filteredTimelines,
    apAttData: apData,
    mipAttData: mipAttendanceData,
    refresherAttData,
    capsuleAttData,
    apPerfData,
    mipPerfData,
    refresherPerfData,
    capsulePerfData,
    eligibilityResults,
    gapMetrics,
    groups,
    ranked,
    trainerStats,
    drilldownNodes,
    months,
    timeSeries
  } = usePerformanceData({
    employees, attendance, scores, nominations, rules, masterTeams,
    tab, selectedFY, filter, viewBy, tsMode, pageMode
  });
`;

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync(path, newContent);
console.log('Replaced ReportsAnalytics logic with hooks!');
