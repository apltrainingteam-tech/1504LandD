import { useMemo } from 'react';
import { buildAPMonthlyMatrix, getAPPerformanceAggregates, calcAPExecutiveKPIs } from '../../../core/engines/apEngine';
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

  const apExecutiveKPIs = useMemo(() => {
    if (activeNT !== 'AP') return null;
    return calcAPExecutiveKPIs(filteredTimelines, months);
  }, [filteredTimelines, months, activeNT]);

  return { apAttData, apPerfData, apExecutiveKPIs };
};
