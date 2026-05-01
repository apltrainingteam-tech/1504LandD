import { useMemo } from 'react';
import { buildIPAggregates, buildIPMonthlyTeamRanks } from '../../../core/engines/ipEngine';
import { globalComputationCaches } from '../../../core/utils/computationCache';
import { calcIP } from '../../../core/engines/reportEngine';
import { logStep } from '../../../core/debug/pipelineTracer';
import { saveSnapshot } from '../../../core/debug/snapshotStore';
import { useGlobalFilters } from '../../../core/context/GlobalFilterContext';

export const useIPData = (unified: any[], months: string[], activeNT: string) => {
  const { filters } = useGlobalFilters();

  const ipData = useMemo(() => {
    if (activeNT !== 'IP') return null;
    return logStep("IP Engine: Aggregates", () => {
      const cacheKey = `${filters.trainingType}_${filters.trainer}_${filters.fiscalYear}_${unified.length}`;
      const result = globalComputationCaches.kpiCalculations.compute(
        [cacheKey, 'IP', months.join(',')],
        () => buildIPAggregates(unified)
      );
      saveSnapshot("ip-aggregates", result);
      return result;
    });
  }, [unified, months, activeNT, filters]);

  const ipRankData = useMemo(() => {
    if (activeNT !== 'IP') return null;
    return logStep("IP Engine: Ranks", () => {
      const result = buildIPMonthlyTeamRanks(unified, months);
      saveSnapshot("ip-ranks", result);
      return result;
    });
  }, [unified, months, activeNT]);

  const ipKPI = useMemo(() => {
    if (activeNT !== 'IP') return null;
    return logStep("IP Engine: KPI", () => {
      const result = calcIP(unified);
      saveSnapshot("ip-kpi", result);
      return result;
    });
  }, [unified, activeNT]);

  return { ipData, ipRankData, ipKPI };
};
