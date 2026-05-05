export interface ChecklistTaskTemplate {
  id: string;
  taskName: string;
  defaultAssignee: string;
  defaultOffsetDays: number;
}

export type ChecklistType = 'Training' | 'NewProduct';

export interface ChecklistTemplate {
  id: string;
  checklistType: ChecklistType;
  key: string; // trainingType for Training, productType for NewProduct
  tasks: ChecklistTaskTemplate[];
}

export interface ChecklistItem {
  id: string;
  parentId: string; // trainingId or plannedTaskId
  checklistType: ChecklistType;
  key: string; // trainingType or productType
  taskName: string;
  assignee: string;
  dueDate: string;
  status: 'Pending' | 'Completed';
  completedAt?: string;
}
