import { useMemo } from 'react';
import { buildIPAggregates, buildIPMonthlyTeamRanks } from '../../../core/engines/ipEngine';
import { globalComputationCaches } from '../../../core/utils/computationCache';
import { calcIP } from '../../../core/engines/reportEngine';
import { logStep } from '../../../core/debug/pipelineTracer';
import { saveSnapshot } from '../../../core/debug/snapshotStore';

export const useIPData = (unified: any[], months: string[], activeNT: string) => {
  const ipData = useMemo(() => {
    if (activeNT !== 'IP') return null;
    return logStep("IP Engine: Aggregates", () => {
      const result = globalComputationCaches.kpiCalculations.compute(
        [unified.length, 'IP', months],
        () => buildIPAggregates(unified)
      );
      saveSnapshot("ip-aggregates", result);
      return result;
    });
  }, [unified, months, activeNT]);

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
