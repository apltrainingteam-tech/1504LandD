
export interface Attachment {
    id: string;
    name: string;
    type: string;
    data: string; // Base64
}

export interface ChecklistItem {
    id: string;
    text: string;
    completed: boolean;
}

export interface Recurrence {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    daysOfWeek?: number[]; // 0-6
    daysOfMonth?: number[];
    until?: string; // ISO date string
    count?: number;
}

export interface Task {
    id: string;
    text: string;
    completed: boolean;
    dueDate?: string; // YYYY-MM-DD
    assignee?: string;
    collapsed?: boolean;
    subtasks: Task[];
    checklist: ChecklistItem[];
    attachments?: Attachment[];
    startDate?: string;
    endDate?: string;
    recurrence?: Recurrence | null;
}

export interface List {
    id: string;
    name: string;
    assignee?: string;
    startDate?: string;
    endDate?: string;
    tasks: Task[];
}

export interface Workspace {
    id: string;
    name: string;
    lists: List[];
}

export interface FilterState {
    status: 'all' | 'completed' | 'incomplete' | 'overdue' | 'dueToday' | 'dueWeek';
    dueDate: string;
    assignee: string;
}

export type DraggedTaskInfo = {
    listId: string;
    taskId: string;
};

export type ViewMode = 'tasks' | 'calendar' | 'week' | 'today' | 'roster';

// Extended Task for Calendar rendering (flattened)
export interface CalendarTask extends Task {
    _workspaceId: string;
    _workspaceName: string;
    _listName: string;
    _listId: string;
    _assignee: string;
}

// Key is YYYY-MM, Value is 2D array of strings/cell values
export type RosterData = Record<string, any[][]>;
