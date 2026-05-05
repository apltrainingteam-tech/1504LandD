/**
 * Gap Engine
 * ⚠️ DO NOT IMPORT IN COMPONENTS — USE HOOKS ONLY
 */
import { Employee } from '../../types/employee';
import { Attendance, TrainingType, TrainingNomination, EligibilityRule } from '../../types/attendance';
import { getEligibleEmployees, EligibilityResult } from './eligibilityEngine';
import { standardizeDesignation } from '../utils/designationMapper';
import { getTeamId } from '../utils/teamIdMapper';
import { Team } from '../context/MasterDataContext';
import { STATE_ZONE } from '../../seed/masterData';
import { safeSort } from './normalizationEngine';


// Zone lookup from state
const getZoneFromState = (state?: string): string => {
  if (!state) return 'Unknown';
  const normalized = state.toUpperCase().trim();
  const stateZone = STATE_ZONE.find(sz => sz.state.toUpperCase() === normalized);
  return stateZone?.zone || 'Unknown';
};

// Simple ID normalization function
const normalizeId = (id: string | number | undefined | null): string => {
  if (id === null || id === undefined) return '';

  return String(id)
    .trim()
    .replace(/\.0+$/, '')     // remove trailing .0, .00 (Excel artifacts)
    .replace(/\s+/g, '')      // remove all spaces
    .toLowerCase();
};

// Normalize strings for comparison
const normalize = (val?: string): string => val?.toLowerCase().trim() || '';

export interface GapAnalysisData {
  cluster: string;
  team: string;
  teamId?: string;
  totalActive: number;
  eligible: number;
  untrained: number;
  untrainedPercent: number;
  over90Days: number;

  mrUntrained?: number;
  mrOver90?: number;
  flmUntrained?: number;
  flmOver90?: number;
  slmUntrained?: number;
  slmOver90?: number;
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
  const empAttendance = attendance
    .filter(a =>
      !a.isVoided &&
      normalizeId(a.employeeId) === normalizeId(employeeId) &&
      normalize(a.trainingType) === normalize(trainingType) &&
      normalize(a.attendanceStatus) === 'present'
    )

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

export const groupByClusterTeam = (employees: Employee[], masterTeams: Team[]): Map<string, Map<string, Employee[]>> => {
  const grouped = new Map<string, Map<string, Employee[]>>();

  // Build a lookup map for faster resolution
  const teamMap = Object.fromEntries(masterTeams.map(t => [t.id, t]));

  employees.forEach(emp => {
    if (!emp.teamId) {
      console.error("Assertion failed: teamId must be defined for employee", emp.employeeId);
      return; // skip
    }
    const cluster = teamMap[emp.teamId]?.cluster;
    if (!cluster) {
      console.error("Unmapped teamId:", emp.teamId);
      return; // skip
    }
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
        if (d.mrUntrained) clusterAgg.mrUntrained = (clusterAgg.mrUntrained || 0) + d.mrUntrained;
        if (d.mrOver90) clusterAgg.mrOver90 = (clusterAgg.mrOver90 || 0) + d.mrOver90;
        if (d.flmUntrained) clusterAgg.flmUntrained = (clusterAgg.flmUntrained || 0) + d.flmUntrained;
        if (d.flmOver90) clusterAgg.flmOver90 = (clusterAgg.flmOver90 || 0) + d.flmOver90;
        if (d.slmUntrained) clusterAgg.slmUntrained = (clusterAgg.slmUntrained || 0) + d.slmUntrained;
        if (d.slmOver90) clusterAgg.slmOver90 = (clusterAgg.slmOver90 || 0) + d.slmOver90;
        if (d.srManagerUntrained) clusterAgg.srManagerUntrained = (clusterAgg.srManagerUntrained || 0) + d.srManagerUntrained;
      });
    });
    clusterAgg.untrainedPercent = clusterAgg.totalActive > 0 ? (clusterAgg.untrained / clusterAgg.totalActive) * 100 : 0;
    clusterAggregates.push(clusterAgg);
  });
  return clusterAggregates;
};

// enrichEmployees removed - using Master Data directly in computeGapAnalysis

// Main function to compute gap analysis
export const computeGapAnalysis = (
  trainingType: TrainingType,
  employees: Employee[],
  attendance: Attendance[],
  nominations: TrainingNomination[],
  masterTeams: Team[],
  zoneFilter?: string
): { data: GapAnalysisData[], drilldownData: Map<string, EmployeeGapDetail[]> } => {

  // Training type mapping for common variations
  const trainingTypeMap: { [key: string]: TrainingType } = {
    'REFRESHER_SO': 'Refresher',
    'REFRESHER_MANAGER': 'Refresher',
    'CAPSULE_SO': 'Capsule',
    'CAPSULE_MANAGER': 'Capsule'
  };

  // Normalize training type
  const normalizedTrainingType = trainingTypeMap[trainingType.toUpperCase()] || trainingType;

  // 🔥 STEP 2: BUILD GLOBAL ATTENDED SET (FULL HISTORY - NO DATE FILTERING)
  const attendedSet = new Set(
    attendance
      .filter(a =>
        !a.isVoided &&
        a.employeeId &&
        normalize(a.attendanceStatus) === 'present' &&
        normalize(a.trainingType) === normalize(normalizedTrainingType)
      )

      .map(a => normalizeId(a.employeeId))
  );

  const teamMap = Object.fromEntries(masterTeams.map(t => [t.id, t]));

  // Enrich employees
  const enrichedEmployees = employees.map(emp => {
    const resolvedTeamId = getTeamId(emp.teamId || emp.team, masterTeams);
    const cluster = resolvedTeamId ? teamMap[resolvedTeamId]?.cluster : undefined;
    if (!cluster) {
      console.error("Unmapped team/cluster for employee:", emp.employeeId, "teamId:", emp.teamId, "team:", emp.team);
      return null;
    }

    return {
      ...emp,
      cluster,
      zone: emp.zone || getZoneFromState(emp.state)
    };
  }).filter((emp): emp is (Employee & { cluster: string, zone: string }) => emp !== null);

  // 🔥 STEP 3: USE ONLY ACTIVE EMPLOYEES
  const baseEmployees = enrichedEmployees.filter(e =>
    (e.status || '').toLowerCase() === 'active'
  );

  // Apply zone filter for Refresher
  let filteredEmployees = baseEmployees;
  if (zoneFilter && normalizedTrainingType === 'Refresher') {
    filteredEmployees = baseEmployees.filter(e => {
      const empZone = e.zone || getZoneFromState(e.state);
      return empZone === zoneFilter;
    });
  }

  // 🔥 STEP 4: COMPUTE ELIGIBLE EMPLOYEES (NO ATTENDANCE FILTER HERE)
  // Get the eligibility rule for this training type
  const rule = {
    trainingType: normalizedTrainingType,
    minimumMonthsForEligibility: 0,
    requiresTrainingNomination: false,
    excludeIfAlreadyTrained: false,
    ignoreTrainingStatus: true // For gap analysis, we want to see all eligible regardless of training
  } as unknown as EligibilityRule;

  const eligibilityResults = getEligibleEmployees(
    normalizedTrainingType,
    rule,
    filteredEmployees,
    attendance,
    nominations
  );

  const eligibleEmployees = eligibilityResults.filter(e => e.eligibilityStatus);
  const eligibleEmployeeIds = new Set(
    eligibleEmployees.map(e => normalizeId(e.employeeId))
  );

  // 🔥 STEP 5: COMPUTE TRAINED VS UNTRAINED
  const trainedEmployees = eligibleEmployees.filter(emp =>
    attendedSet.has(normalizeId(emp.employeeId))
  );

  const untrainedEmployees = eligibleEmployees.filter(emp =>
    !attendedSet.has(normalizeId(emp.employeeId))
  );


  // 🔥 STEP 7: GROUP BY CLUSTER → TEAM (FROM ELIGIBLE EMPLOYEES)
  const grouped = groupByClusterTeam(
    eligibleEmployees.map(e => {
      const emp = filteredEmployees.find(fe => normalizeId(fe.employeeId) === normalizeId(e.employeeId));
      return emp || (e as any);
    }),
    masterTeams
  );

  const data: GapAnalysisData[] = [];
  const drilldownData = new Map<string, EmployeeGapDetail[]>();

  // Build trained and untrained maps for quick lookup
  const trainedSet = new Set(trainedEmployees.map(e => normalizeId(e.employeeId)));
  const untrainedSet = new Set(untrainedEmployees.map(e => normalizeId(e.employeeId)));

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
        teamId: getTeamId(team, masterTeams),
        totalActive: emps.length,
        eligible: 0,
        untrained: 0,
        untrainedPercent: 0,
        over90Days: 0
      };

      const untrainedDetails: EmployeeGapDetail[] = [];

      emps.forEach(emp => {
        const normalizedEmpId = normalizeId(emp.employeeId);
        const isElig = eligibleEmployeeIds.has(normalizedEmpId);
        if (isElig) {
          teamData.eligible++;
          const isTrained = trainedSet.has(normalizedEmpId);
          const isUntrained = untrainedSet.has(normalizedEmpId);

          if (isUntrained) {
            teamData.untrained++;
            const daysSince = calculateDaysSinceDOJ(emp);
            const isOver90 = daysSince > 90;
            if (isOver90) teamData.over90Days++;

            untrainedDetails.push({
              employeeId: emp.employeeId,
              name: emp.name,
              designation: emp.designation,
              cluster: emp.cluster || 'Unknown',
              team: emp.team,
              dateOfJoining: emp.doj,
              daysSinceJoining: daysSince,
              trainingType: normalizedTrainingType
            });

            // Breakdown by designation for all training types globally
            const des = standardizeDesignation(emp.designation);
            if (des === 'MR') {
              teamData.mrUntrained = (teamData.mrUntrained || 0) + 1;
              if (isOver90) teamData.mrOver90 = (teamData.mrOver90 || 0) + 1;
            } else if (des === 'FLM') {
              teamData.flmUntrained = (teamData.flmUntrained || 0) + 1;
              if (isOver90) teamData.flmOver90 = (teamData.flmOver90 || 0) + 1;
            } else if (des === 'SLM') {
              teamData.slmUntrained = (teamData.slmUntrained || 0) + 1;
              if (isOver90) teamData.slmOver90 = (teamData.slmOver90 || 0) + 1;
            } else if (des === 'SR MANAGER') {
              teamData.srManagerUntrained = (teamData.srManagerUntrained || 0) + 1;
            }
          }
        }
      });

      clusterData.totalActive += teamData.totalActive;
      clusterData.eligible += teamData.eligible;
      clusterData.untrained += teamData.untrained;
      clusterData.over90Days += teamData.over90Days;
      if (teamData.mrUntrained) clusterData.mrUntrained = (clusterData.mrUntrained || 0) + teamData.mrUntrained;
      if (teamData.mrOver90) clusterData.mrOver90 = (clusterData.mrOver90 || 0) + teamData.mrOver90;
      if (teamData.flmUntrained) clusterData.flmUntrained = (clusterData.flmUntrained || 0) + teamData.flmUntrained;
      if (teamData.flmOver90) clusterData.flmOver90 = (clusterData.flmOver90 || 0) + teamData.flmOver90;
      if (teamData.slmUntrained) clusterData.slmUntrained = (clusterData.slmUntrained || 0) + teamData.slmUntrained;
      if (teamData.slmOver90) clusterData.slmOver90 = (clusterData.slmOver90 || 0) + teamData.slmOver90;
      if (teamData.srManagerUntrained) clusterData.srManagerUntrained = (clusterData.srManagerUntrained || 0) + teamData.srManagerUntrained;

      teamData.untrainedPercent = teamData.eligible > 0 ? (teamData.untrained / teamData.eligible) * 100 : 0;
      data.push(teamData);

      if (untrainedDetails.length > 0) {
        drilldownData.set(`${cluster}-${team}`, untrainedDetails);
      }
    });

    clusterData.untrainedPercent = clusterData.eligible > 0 ? (clusterData.untrained / clusterData.eligible) * 100 : 0;
  });

  // Sort teams within clusters
  data.sort((a, b) => {
    if (a.cluster !== b.cluster) return safeSort(a.cluster, b.cluster);
    if (a.team === '' && b.team !== '') return -1; // Cluster first
    if (a.team !== '' && b.team === '') return 1;
    if (a.team !== b.team) return b.untrained - a.untrained || b.over90Days - a.over90Days;
    return 0;
  });

  return { data, drilldownData };
};










