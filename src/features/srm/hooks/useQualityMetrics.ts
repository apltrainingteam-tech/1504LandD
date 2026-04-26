import { useMemo } from 'react';
import { buildUnifiedDataset, applyFilters } from '../../../core/engines/reportEngine';
import { 
  filterSRMRecords, 
  calculateClusterMetrics, 
  calculateTeamMetrics, 
  calculateMonthlyTrend 
} from '../../../core/utils/srmCalculations';
import { generateInsights, getDiagnosisSummary } from '../../../core/utils/srmInsights';
import { Employee } from '../../../types/employee';
import { Attendance, TrainingScore } from '../../../types/attendance';
import { GlobalFilters } from '../../../core/context/filterContext';
import { Team } from '../../../core/context/MasterDataContext';

export const useQualityMetrics = (
  employees: Employee[],
  attendance: Attendance[],
  scores: TrainingScore[],
  filters: GlobalFilters,
  masterTeams: Team[]
) => {
  const unifiedDataset = useMemo(() => 
    buildUnifiedDataset(employees, attendance, scores, [], [], masterTeams), 
    [employees, attendance, scores, masterTeams]
  );

  const filteredDataset = useMemo(() => 
    applyFilters(unifiedDataset, {
      monthFrom: filters.month, monthTo: filters.month,
      teams: filters.team ? [filters.team] : [],
      clusters: filters.cluster ? [filters.cluster] : [],
      trainer: filters.trainer
    }, masterTeams), 
    [unifiedDataset, filters, masterTeams]
  );

  const srmRecords = useMemo(() => filterSRMRecords(filteredDataset), [filteredDataset]);

  const insights = useMemo(() => {
    const clusterMetrics = calculateClusterMetrics(srmRecords);
    const teamMetrics = calculateTeamMetrics(srmRecords);
    const monthlyTrends = calculateMonthlyTrend(srmRecords);
    return generateInsights(srmRecords, clusterMetrics, teamMetrics, monthlyTrends);
  }, [srmRecords]);

  const diagnosis = useMemo(() => getDiagnosisSummary(srmRecords), [srmRecords]);

  return { srmRecords, insights, diagnosis };
};
