import { useMemo } from 'react';
import { buildCapsuleAttendanceMatrix, getCapsulePerformanceAggregates } from '../../../core/engines/capsuleEngine';
import { calcCapsule } from '../../../core/engines/reportEngine';

export const useCapsuleData = (filteredTimelines: Map<string, any>, months: string[], activeNT: string, unified: any[]) => {
  const capsuleAttData = useMemo(() => {
    if (activeNT !== 'Capsule') return null;
    return buildCapsuleAttendanceMatrix(filteredTimelines, months);
  }, [activeNT, filteredTimelines, months]);

  const capsulePerfData = useMemo(() => {
    if (activeNT !== 'Capsule') return null;
    return getCapsulePerformanceAggregates(filteredTimelines, months);
  }, [activeNT, filteredTimelines, months]);

  const capsuleKPI = useMemo(() => {
    if (activeNT !== 'Capsule') return null;
    return calcCapsule(unified);
  }, [unified, activeNT]);

  return { capsuleAttData, capsulePerfData, capsuleKPI };
};
