import { Employee } from './employee';
import { Attendance, TrainingScore, TrainingNomination } from './attendance';
export { TRAINING_SCHEMAS, getSchema } from '../services/trainingSchemas';

export interface UnifiedRecord {
  employee: Employee;
  attendance: Attendance;
  score: TrainingScore | null;
  nomination: TrainingNomination | null;
  eligibilityStatus?: boolean;
  eligibilityReason?: string;
}

export interface GroupedData {
  key: string;
  records: UnifiedRecord[];
  nominations: TrainingNomination[];
  metric: number;
  rank?: number;
}

export type ViewByOption = 'Month' | 'Cluster' | 'Team';

// Time-series pivot: one row per team/cluster, one column per month
export interface TimeSeriesRow {
  label: string; // team or cluster name
  cells: Record<string, number | null>; // YYYY-MM -> value
}

// Trainer performance stats
export interface TrainerStat {
  trainerId: string;
  trainingsConducted: number;
  totalTrainees: number;
  avgScore: number;
  attendancePct: number;
}

// Drill-down node (Cluster -> Team -> Employee)
export interface DrilldownNode {
  key: string;
  label: string;
  metric: number;
  count: number;
  children?: DrilldownNode[];
  records?: UnifiedRecord[];
}

// Report filter state
export interface ReportFilter {
  monthFrom: string;  // YYYY-MM, empty = no lower bound
  monthTo: string;    // YYYY-MM, empty = no upper bound
  teams: string[];    // empty = all
  clusters: string[]; // empty = all
  trainer: string;    // empty = all
}

// Legacy alias kept for any remaining consumers — prefer getSchema() from trainingSchemas.ts
// Maps trainingType → array of score field camelCase keys
export const SCORE_SCHEMAS: Record<string, string[]> = {
  IP: ['percent', 'tScore'],
  AP: ['knowledge', 'grasping', 'detailing', 'situationHandling', 'english', 'localLanguage', 'involvement', 'effort', 'confidence'],
  MIP: ['scienceScore', 'skillScore'],
  Refresher: ['scienceScore', 'skillScore', 'knowledge', 'situationHandling', 'presentation'],
  Capsule: ['score'],
  Pre_AP: ['knowledge', 'grasping'],
  GTG: ['score'],
  HO: ['score'],
  RTM: ['score'],
};

export interface IPRecord {
  employeeId: string;
  team: string;
  cluster: string;
  month: string;
  score: number;
  bucket: 'ELITE' | 'HIGH' | 'MEDIUM' | 'LOW';
}

  elite: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface IPMonthMapNode {
  total: number;
  elite: number;
  high: number;
  medium: number;
  low: number;
  months: Record<string, IPHeritageMapCell>;
}

export interface IPAggregates {
  clusterMonthMap: Record<string, IPMonthMapNode>;
  teamMonthMap: Record<string, Record<string, IPMonthMapNode>>;
  globalKPIs: {
    totalCandidates: number;
    highPct: number;
    medPct: number;
    lowPct: number;
    weightedScore: number;
    bestTeam: string;
    worstTeam: string;
  };
  penaltyEnabled: boolean;
}

export interface IPMonthlyTeamRank {
  team: string;
  cluster: string;
  month: string; // YYYY-MM
  total: number;
  a90: number;
  b75: number;
  c50: number;
  dBelow50: number;
  score: number;
  clusterRank: number;
  overallRank: number;
}

export interface IPMonthlyRankMatrix {
  teams: Record<string, {
    cluster: string;
    months: Record<string, {
      score: number;
      rank: number;
      clusterRank: number;
    }>;
  }>;
}

