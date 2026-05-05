export interface TaskMasterEntry {
  id: string;
  category: string;
  type: string;
  task?: string;
  subtask?: string;
}

export type TaskStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Delayed';
export type RecurrenceType = 'None' | 'Daily' | 'Weekly' | 'Monthly';

export interface PlannedTask {
  id: string;
  category: string;
  type: string;
  task?: string;
  subtask?: string;
  assignee: string; // Trainer ID
  planDate: string; // ISO string
  dueDate: string; // ISO string
  recurrence: RecurrenceType;
  status: TaskStatus;
  completedAt?: string; // ISO string
}
