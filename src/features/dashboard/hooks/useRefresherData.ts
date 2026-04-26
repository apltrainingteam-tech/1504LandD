import { useMemo } from 'react';
import { buildRefresherAttendanceMatrix, getRefresherPerformanceAggregates } from '../../../core/engines/refresherEngine';
import { calcRefresher } from '../../../core/engines/reportEngine';

export const useRefresherData = (filteredTimelines: Map<string, any>, months: string[], activeNT: string, unified: any[]) => {
  const refresherAttData = useMemo(() => {
    if (activeNT !== 'Refresher') return null;
    return buildRefresherAttendanceMatrix(filteredTimelines, months);
  }, [activeNT, filteredTimelines, months]);

  const refresherPerfData = useMemo(() => {
    if (activeNT !== 'Refresher') return null;
    return getRefresherPerformanceAggregates(filteredTimelines, months);
  }, [activeNT, filteredTimelines, months]);

  const refresherKPI = useMemo(() => {
    if (activeNT !== 'Refresher') return null;
    return calcRefresher(unified);
  }, [unified, activeNT]);

  return { refresherAttData, refresherPerfData, refresherKPI };
};
