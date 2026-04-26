import { useMemo } from 'react';
import { buildIPAggregates, buildIPMonthlyTeamRanks } from '../../../core/engines/ipEngine';
import { calcIP } from '../../../core/engines/reportEngine';
import { globalComputationCaches } from '../../../core/utils/computationCache';

export const useIPData = (unified: any[], months: string[], activeNT: string) => {
  const ipData = useMemo(() => {
    if (activeNT !== 'IP') return null;
    return globalComputationCaches.kpiCalculations.compute(
      [unified.length, 'IP', months],
      () => buildIPAggregates(unified)
    );
  }, [unified, months, activeNT]);

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
