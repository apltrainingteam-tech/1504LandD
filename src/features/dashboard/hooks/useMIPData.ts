import { useMemo } from 'react';
import { buildMIPAttendanceMatrix, getMIPPerformanceAggregates } from '../../../core/engines/mipEngine';
import { calcMIP } from '../../../core/engines/reportEngine';

export const useMIPData = (filteredTimelines: Map<string, any>, months: string[], activeNT: string, unified: any[]) => {
  const mipAttData = useMemo(() => {
    if (activeNT !== 'MIP') return null;
    return buildMIPAttendanceMatrix(filteredTimelines, months);
  }, [activeNT, filteredTimelines, months]);

  const mipPerfData = useMemo(() => {
    if (activeNT !== 'MIP') return null;
    return getMIPPerformanceAggregates(filteredTimelines, months);
  }, [activeNT, filteredTimelines, months]);

  const mipKPI = useMemo(() => {
    if (activeNT !== 'MIP') return null;
    return calcMIP(unified);
  }, [unified, activeNT]);

  return { mipAttData, mipPerfData, mipKPI };
};
