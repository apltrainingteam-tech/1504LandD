import { Employee } from './employee';
import { Attendance, TrainingScore, TrainingNomination } from './attendance';

export interface UnifiedRecord {
  employee: Employee;
  attendance: Attendance;
  score: TrainingScore | null;
  nomination: TrainingNomination | null;
}

export interface GroupedData {
  key: string;
  records: UnifiedRecord[];
  nominations: TrainingNomination[];
  metric: number;
  rank?: number;
}

export type ViewByOption = 'Month' | 'Cluster' | 'Team';

export const SCORE_SCHEMAS: Record<string, string[]> = {
  IP: ['Score'],
  AP: ['Knowledge', 'BSE', 'Grasping', 'Detailing', 'Situation Handling', 'English', 'Local Language', 'Involvement', 'Effort', 'Confidence'],
  MIP: ['Science Score', 'Skill Score']
};
