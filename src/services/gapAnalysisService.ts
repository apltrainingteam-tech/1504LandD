import { Employee } from '../types/employee';
import { Attendance, TrainingType, TrainingNomination, EligibilityRule } from '../types/attendance';
import { getEligibleEmployees, EligibilityResult } from './eligibilityService';
import { TEAM_CLUSTER, STATE_ZONE } from '../seed/masterData';
import { normalizeText } from '../utils/textNormalizer';

export interface GapAnalysisData {
  cluster: string;
  team: string;
  totalActive: number;
  eligible: number;
  untrained: number;
  untrainedPercent: number;
  over90Days: number;
  // For MIP: designation breakdowns
  flmUntrained?: number;
  slmUntrained?: number;
  srManagerUntrained?: number;
}

export interface EmployeeGapDetail {
  employeeId: string;
  name: string;
  designation: string;
  cluster: string;
  team: string;
  dateOfJoining: string;
  daysSinceJoining: number;
  trainingType: TrainingType;
}

// Reusable functions as per requirements

export const isEligible = (employee: Employee, trainingType: TrainingType, rules: EligibilityRule[], attendance: Attendance[], nominations: TrainingNomination[]): boolean => {
  const rule = rules.find(r => r.trainingType === trainingType);
  const eligible = getEligibleEmployees(trainingType, rule, [employee], attendance, nominations);
  return eligible[0]?.eligibilityStatus || false;
};

export const getLatestAttendance = (employeeId: string, trainingType: TrainingType, attendance: Attendance[]): Attendance | null => {
  const normalize = (val?: string) => val?.toLowerCase().trim();
  const normalizedTrainingType = normalize(trainingType);

  const empAttendance = attendance
    .filter(a => a.employeeId === employeeId && normalize(a.trainingType) === normalizedTrainingType && a.attendanceStatus === 'Present')
    .sort((a, b) => new Date(b.attendanceDate).getTime() - new Date(a.attendanceDate).getTime());
  return empAttendance[0] || null;
};

export const calculateUntrained = (eligibleEmployees: EligibilityResult[], attendance: Attendance[], trainingType: TrainingType): string[] => {
  return eligibleEmployees
    .filter(e => e.eligibilityStatus)
    .filter(e => !getLatestAttendance(e.employeeId, trainingType, attendance))
    .map(e => e.employeeId);
};

export const calculateDaysSinceDOJ = (employee: Employee): number => {
  const doj = new Date(employee.doj);
  const today = new Date();
  return Math.floor((today.getTime() - doj.getTime()) / (1000 * 60 * 60 * 24));
};

export const groupByClusterTeam = (employees: Employee[]): Map<string, Map<string, Employee[]>> => {
  const grouped = new Map<string, Map<string, Employee[]>>();
  employees.forEach(emp => {
    const cluster = emp.cluster || 'Unknown';
    const team = emp.team || 'Unknown';
    if (!grouped.has(cluster)) grouped.set(cluster, new Map());
    if (!grouped.get(cluster)!.has(team)) grouped.get(cluster)!.set(team, []);
    grouped.get(cluster)!.get(team)!.push(emp);
  });
  return grouped;
};

export const aggregateClusterMetrics = (groupedData: Map<string, Map<string, GapAnalysisData[]>>): GapAnalysisData[] => {
  const clusterAggregates: GapAnalysisData[] = [];
  groupedData.forEach((teamData, cluster) => {
    const clusterAgg: GapAnalysisData = {
      cluster,
      team: '', // Cluster level
      totalActive: 0,
      eligible: 0,
      untrained: 0,
      untrainedPercent: 0,
      over90Days: 0
    };
    teamData.forEach((data, team) => {
      data.forEach(d => {
        clusterAgg.totalActive += d.totalActive;
        clusterAgg.eligible += d.eligible;
        clusterAgg.untrained += d.untrained;
        clusterAgg.over90Days += d.over90Days;
        if (d.flmUntrained) clusterAgg.flmUntrained = (clusterAgg.flmUntrained || 0) + d.flmUntrained;
        if (d.slmUntrained) clusterAgg.slmUntrained = (clusterAgg.slmUntrained || 0) + d.slmUntrained;
        if (d.srManagerUntrained) clusterAgg.srManagerUntrained = (clusterAgg.srManagerUntrained || 0) + d.srManagerUntrained;
      });
    });
    clusterAgg.untrainedPercent = clusterAgg.totalActive > 0 ? (clusterAgg.untrained / clusterAgg.totalActive) * 100 : 0;
    clusterAggregates.push(clusterAgg);
  });
  return clusterAggregates;
};

// Enrich employees with cluster and zone
const enrichEmployees = (employees: Employee[]): Employee[] => {
  return employees.map(emp => {
    const normalizedTeam = normalizeText(emp.team || '');
    const teamMapping = TEAM_CLUSTER.find(tc => normalizeText(tc.team) === normalizedTeam);
    const normalizedState = emp.state?.trim().toUpperCase();
    const stateMapping = STATE_ZONE.find(sz => sz.state === normalizedState);
    return {
      ...emp,
      team: normalizedTeam || emp.team,
      cluster: teamMapping?.cluster || 'Unknown',
      zone: stateMapping?.zone || 'Unknown'
    };
  });
};

// Main function to compute gap analysis
export const computeGapAnalysis = (
  trainingType: TrainingType,
  employees: Employee[],
  attendance: Attendance[],
  nominations: TrainingNomination[],
  rules: EligibilityRule[],
  zoneFilter?: string
): { data: GapAnalysisData[], drilldownData: Map<string, EmployeeGapDetail[]> } => {
  // Normalize trainingType comparison
  const normalize = (val?: string) => val?.toLowerCase().trim();
  const normalizedTrainingType = normalize(trainingType);

  // Filter attendance by trainingType for attendance checks ONLY
  const typeAttendance = attendance.filter(
    a =>
      normalize(a.trainingType) === normalizedTrainingType &&
      a.attendanceStatus === 'Present'
  );

  // Enrich employees
  const enrichedEmployees = enrichEmployees(employees);

  // Filter active employees
  const activeEmployees = enrichedEmployees.filter(e => e.status === 'Active');

  // Apply zone filter for Refresher
  let filteredEmployees = activeEmployees;
  if (zoneFilter && trainingType === 'Refresher') {
    filteredEmployees = activeEmployees.filter(e => e.zone === zoneFilter);
  }

  // Get eligible employees using FULL attendance and nominations datasets
  const rule = rules.find(r => r.trainingType === trainingType);
  const eligibleResults = getEligibleEmployees(trainingType, rule, filteredEmployees, attendance, nominations);
  const eligibleEmployeeIds = new Set(eligibleResults.filter(e => e.eligibilityStatus).map(e => e.employeeId));

  // Debug logs
  console.log("DEBUG GAP:", {
    tab: trainingType,
    totalEmployees: filteredEmployees.length,
    totalAttendanceRaw: attendance.length,
    typeAttendance: typeAttendance.length,
    eligible: eligibleEmployeeIds.size
  });

  // Group employees by cluster/team
  const grouped = groupByClusterTeam(filteredEmployees);

  const data: GapAnalysisData[] = [];
  const drilldownData = new Map<string, EmployeeGapDetail[]>();

  grouped.forEach((teamEmps, cluster) => {
    const clusterData: GapAnalysisData = {
      cluster,
      team: '',
      totalActive: 0,
      eligible: 0,
      untrained: 0,
      untrainedPercent: 0,
      over90Days: 0
    };

    data.push(clusterData);

    teamEmps.forEach((emps, team) => {
      const teamData: GapAnalysisData = {
        cluster,
        team,
        totalActive: emps.length,
        eligible: 0,
        untrained: 0,
        untrainedPercent: 0,
        over90Days: 0
      };

      const untrainedDetails: EmployeeGapDetail[] = [];

      emps.forEach(emp => {
        const isElig = eligibleEmployeeIds.has(emp.employeeId);
        if (isElig) {
          teamData.eligible++;
          const latestAtt = getLatestAttendance(emp.employeeId, trainingType, typeAttendance);
          if (!latestAtt) {
            teamData.untrained++;
            const daysSince = calculateDaysSinceDOJ(emp);
            if (daysSince > 90) teamData.over90Days++;

            untrainedDetails.push({
              employeeId: emp.employeeId,
              name: emp.name,
              designation: emp.designation,
              cluster: emp.cluster,
              team: emp.team,
              dateOfJoining: emp.doj,
              daysSinceJoining: daysSince,
              trainingType
            });

            // For MIP, count by designation
            if (trainingType === 'MIP') {
              const des = emp.designation?.toLowerCase();
              if (des?.includes('flm')) teamData.flmUntrained = (teamData.flmUntrained || 0) + 1;
              else if (des?.includes('slm')) teamData.slmUntrained = (teamData.slmUntrained || 0) + 1;
              else if (des?.includes('sr manager') || des?.includes('senior manager')) teamData.srManagerUntrained = (teamData.srManagerUntrained || 0) + 1;
            }
          }
        }
      });

      clusterData.totalActive += teamData.totalActive;
      clusterData.eligible += teamData.eligible;
      clusterData.untrained += teamData.untrained;
      clusterData.over90Days += teamData.over90Days;
      if (teamData.flmUntrained) clusterData.flmUntrained = (clusterData.flmUntrained || 0) + teamData.flmUntrained;
      if (teamData.slmUntrained) clusterData.slmUntrained = (clusterData.slmUntrained || 0) + teamData.slmUntrained;
      if (teamData.srManagerUntrained) clusterData.srManagerUntrained = (clusterData.srManagerUntrained || 0) + teamData.srManagerUntrained;

      teamData.untrainedPercent = teamData.totalActive > 0 ? (teamData.untrained / teamData.totalActive) * 100 : 0;
      data.push(teamData);

      if (untrainedDetails.length > 0) {
        drilldownData.set(`${cluster}-${team}`, untrainedDetails);
      }
    });

    clusterData.untrainedPercent = clusterData.totalActive > 0 ? (clusterData.untrained / clusterData.totalActive) * 100 : 0;
  });

  // Sort teams within clusters
  data.sort((a, b) => {
    if (a.cluster !== b.cluster) return a.cluster.localeCompare(b.cluster);
    if (a.team === '' && b.team !== '') return -1; // Cluster first
    if (a.team !== '' && b.team === '') return 1;
    if (a.team !== b.team) return b.untrained - a.untrained || b.over90Days - a.over90Days;
    return 0;
  });

  return { data, drilldownData };
};