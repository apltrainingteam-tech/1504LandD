import { useMemo } from 'react';
import { buildMIPAttendanceMatrix, getMIPPerformanceAggregates, calcMIPExecutiveKPIs } from '../../../core/engines/mipEngine';

export const useMIPData = (filteredTimelines: Map<string, any>, months: string[], activeNT: string, unified: any[]) => {
  const mipAttData = useMemo(() => {
    if (activeNT !== 'MIP') return null;
    return buildMIPAttendanceMatrix(filteredTimelines, months);
  }, [activeNT, filteredTimelines, months]);

  const mipPerfData = useMemo(() => {
    if (activeNT !== 'MIP') return null;
    return getMIPPerformanceAggregates(filteredTimelines, months);
  }, [activeNT, filteredTimelines, months]);

  const mipExecutiveKPIs = useMemo(() => {
    if (activeNT !== 'MIP') return null;
    return calcMIPExecutiveKPIs(filteredTimelines, months);
  }, [filteredTimelines, months, activeNT]);

  return { mipAttData, mipPerfData, mipExecutiveKPIs };
};
