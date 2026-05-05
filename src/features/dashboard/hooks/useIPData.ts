import { useMemo } from 'react';
import { buildIPAggregates, buildIPMonthlyTeamRanks } from '../../../core/engines/ipEngine';
import { globalComputationCaches } from '../../../core/utils/computationCache';
import { calcIP } from '../../../core/engines/reportEngine';
import { useGlobalFilters } from '../../../core/context/GlobalFilterContext';

export const useIPData = (unified: any[], months: string[], activeNT: string) => {
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

  const ipKPI = useMemo(() => {
    if (activeNT !== 'IP') return null;
    return calcIP(unified);
  }, [unified, activeNT]);

  return { ipData, ipRankData, ipKPI };
};
