import { useMemo } from 'react';
import { buildUnifiedDataset, getPrimaryMetricRaw } from '../../../core/engines/reportEngine';
import { normalizeTrainingType } from '../../../core/engines/normalizationEngine';
import { getFiscalYearFromDate } from '../../../core/utils/fiscalYear';
import { STATE_ZONE } from '../../../seed/masterData';
import { Employee } from '../../../types/employee';
import { Attendance, TrainingScore } from '../../../types/attendance';
import { GlobalFilters } from '../../../core/context/filterContext';
import { Team } from '../../../core/context/MasterDataContext';

const getZoneFromState = (state?: string): string => {
  if (!state) return 'Unknown';
  const normalized = state.toUpperCase().trim();
  const stateZone = STATE_ZONE.find(sz => sz.state.toUpperCase() === normalized);
  return stateZone?.zone || 'Unknown';
};

export const useTrainingsViewerData = (
  tab: string,
  employees: Employee[],
  attendance: Attendance[],
  scores: TrainingScore[],
  selectedFY: string,
  selectedZone: string,
  pageFilters: GlobalFilters,
  search: string,
  masterTeams: Team[]
) => {
  const filtered = useMemo(() => {
    const normalizedTab = normalizeTrainingType(tab);
    let data = attendance.filter(a => normalizeTrainingType(a.trainingType) === normalizedTab);
    const scs = scores.filter(s => normalizeTrainingType(s.trainingType) === normalizedTab);
    
    let ds = buildUnifiedDataset(employees, data, scs, [], [], masterTeams);

    if (selectedFY) {
      ds = ds.filter(r => getFiscalYearFromDate(r.attendance.attendanceDate) === selectedFY);
    }

    if (selectedZone !== 'All Zones') {
      ds = ds.filter(r => {
        const empZone = r.employee.zone || getZoneFromState(r.employee.state);
        return empZone === selectedZone;
      });
    }

    if (pageFilters.cluster) {
      ds = ds.filter(r => (r.employee.cluster || '') === pageFilters.cluster);
    }
    if (pageFilters.team) {
      ds = ds.filter(r => (r.employee.team || '') === pageFilters.team);
    }
    if (pageFilters.trainer) {
      ds = ds.filter(r => (r.attendance.trainerId || '') === pageFilters.trainer);
    }
    if (pageFilters.month) {
      ds = ds.filter(r => {
        const m = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7);
        return m === pageFilters.month;
      });
    }

    if (search) {
      const s = search.toLowerCase();
      ds = ds.filter(r => 
        r.employee.name.toLowerCase().includes(s) || 
        r.employee.employeeId.toLowerCase().includes(s) ||
        (r.employee.aadhaarNumber || '').includes(s)
      );
    }

    return ds;
  }, [employees, attendance, scores, tab, selectedFY, selectedZone, pageFilters, search, masterTeams]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const present = filtered.filter(r => r.attendance.attendanceStatus === 'Present');
    const attPercent = total > 0 ? ((present.length / total) * 100).toFixed(1) : '0';
    const avg = getPrimaryMetricRaw(filtered, tab);
    
    return {
      total,
      attPercent,
      avg: typeof avg === 'number' ? avg.toFixed(1) : avg,
      totalUnified: filtered.length
    };
  }, [filtered, tab]);

  return { filtered, kpis };
};
