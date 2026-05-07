import { useMemo } from 'react';
import { buildIPAggregates, buildIPMonthlyTeamRanks, calcExecutiveKPIs } from '../../../core/engines/ipEngine';
import { globalComputationCaches } from '../../../core/utils/computationCache';
import { useGlobalFilters } from '../../../core/context/GlobalFilterContext';

export const useIPData = (unified: any[], months: string[], activeNT: string, viewBy: string) => {
  const { filters } = useGlobalFilters();

  const ipData = useMemo(() => {
    if (activeNT !== 'IP') return null;
    const cacheKey = `${filters.trainingType}_${filters.trainer}_${filters.fiscalYear}_${unified.length}`;
    return globalComputationCaches.kpiCalculations.compute(
      [cacheKey, 'IP', months.join(',')],
      () => buildIPAggregates(unified)
    );
  }, [unified, months, activeNT, filters]);

  const ipRankData = useMemo(() => {
    if (activeNT !== 'IP') return null;
    return buildIPMonthlyTeamRanks(unified, months);
  }, [unified, months, activeNT]);

  const executiveKPIs = useMemo(() => {
    if (activeNT !== 'IP') return null;
    return calcExecutiveKPIs(unified, viewBy);
  }, [unified, activeNT, viewBy]);

  return { ipData, ipRankData, executiveKPIs };
};
