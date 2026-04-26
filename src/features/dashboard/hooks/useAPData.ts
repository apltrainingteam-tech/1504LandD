import { useMemo } from 'react';
import { buildAPMonthlyMatrix, getAPPerformanceAggregates } from '../../../core/engines/apEngine';
import { calcAP, calcPreAP } from '../../../core/engines/reportEngine';
import { globalComputationCaches } from '../../../core/utils/computationCache';

export const useAPData = (filteredTimelines: Map<string, any>, months: string[], activeNT: string, unified: any[], tabNoms: any[]) => {
  const apAttData = useMemo(() => {
    if (activeNT !== 'AP' && activeNT !== 'Pre_AP') return null;
    return buildAPMonthlyMatrix(filteredTimelines, months);
  }, [activeNT, filteredTimelines, months]);

  const apPerfData = useMemo(() => {
    if (activeNT !== 'AP' && activeNT !== 'Pre_AP') return null;
    return getAPPerformanceAggregates(filteredTimelines, months);
  }, [activeNT, filteredTimelines, months]);

  const apKPI = useMemo(() => {
    if (activeNT !== 'AP') return null;
    return calcAP(unified, tabNoms);
  }, [unified, tabNoms, activeNT]);

  const preApKPI = useMemo(() => {
    if (activeNT !== 'Pre_AP') return null;
    return calcPreAP(unified, tabNoms);
  }, [unified, tabNoms, activeNT]);

  return { apAttData, apPerfData, apKPI, preApKPI };
};
