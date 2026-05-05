export interface ChecklistTaskTemplate {
  id: string;
  taskName: string;
  defaultAssignee: string;
  defaultOffsetDays: number;
}

export interface ChecklistTemplate {
  id: string;
  trainingType: string;
  tasks: ChecklistTaskTemplate[];
}

export interface ChecklistItem {
  id: string;
  trainingId: string;
  trainingType: string;
  taskName: string;
  assignee: string;
  dueDate: string;
  status: 'Pending' | 'Completed';
  completedAt?: string;
}
