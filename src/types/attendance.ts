export type TrainingType = 'IP' | 'AP' | 'MIP' | 'Refresher' | 'Capsule' | 'Pre_AP' | 'GTG' | 'HO' | 'RTM';

export interface Attendance {
  id: string;
  employeeId: string;
  trainingType: TrainingType;
  attendanceDate: string; // ISO date string (yyyy-mm-dd)
  attendanceStatus: 'Present' | 'Absent';
  employeeStatus?: 'ACTIVE' | 'INACTIVE'; // Workforce classification
  trainerId?: string;
  month?: string; // Derived e.g. "2026-04"
  fiscalYear?: string; // Fiscal year e.g. "2025-26"
  aadhaarNumber?: string;
  mobileNumber?: string;
  name?: string;
  team?: string;
  teamId?: string;
  designation?: string;
  cluster?: string;
  hq?: string;
  state?: string;
}

export interface TrainingScore {
  id: string;
  employeeId: string;
  trainingType: TrainingType;
  dateStr: string; // associated training date
  scores: Record<string, number | null>; // e.g., { "Knowledge": 80, "BSE": 90 }
}

export interface TrainingNomination {
  id: string; // autoId
  employeeId: string;
  aadhaarNumber: string;
  mobileNumber: string;
  name: string;
  designation: string;
  team: string;
  teamId: string;
  hq: string;
  state: string;

  trainingType: string; 
  notificationDate: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  
  notificationCount?: number; 
  createdAt?: number;
}

export interface NotificationRecord {
  id: string; // employeeId_trainingType_notificationDate
  empId: string;
  aadhaarNumber: string;
  mobileNumber: string;
  trainerId: string;
  team: string;
  name: string;
  designation: string;
  hq: string;
  state: string;
  trainingType: string;
  notificationDate: string; // YYYY-MM-DD
  attended: boolean;
  trainingId?: string; // Links to the TrainingBatch/NominationDraft if available
  teamId?: string;
}

export type BatchAttStatus = 'pending' | 'present' | 'absent';

export interface CandidateRecord {
  empId: string;
  attendance: BatchAttStatus;
  score: string; // '' until entered
}

export interface TrainingBatch {
  id: string;           // batchId = draftId at commit time
  trainingId: string;
  draftId: string;
  source: 'NOTIFICATION' | 'UPLOAD'; // how this batch was created
  sourceDraftId?: string;            // draftId for NOTIFICATION, undefined for UPLOAD
  trainingType: string;
  team: string;
  teamId: string;
  trainer: string;      // trainer id / name
  startDate: string;
  endDate: string;
  committedAt: string;  // ISO timestamp when SENT
  candidates: CandidateRecord[];
}

export interface NominationDraft {
  id: string; // matches trainingId
  trainingId: string;
  trainingType: string;
  team: string; // display
  teamId: string; // stable
  trainer?: string; // trainer id
  startDate?: string;
  endDate?: string;
  status: 'DRAFT' | 'APPROVED' | 'SENT' | 'COMPLETED';
  candidates: string[]; // employeeIds
  // Audit trail
  approvedBy?: string;
  approvedAt?: string;
  sentBy?: string;
  sentAt?: string;
}

export interface Demographics {
  id: string;
  employeeId: string;
  eligibilityStatus: string;
  trainingType: TrainingType;
  lastUpdated: string; // ISO date string
}

export interface TeamClusterMapping {
  id: string;
  team: string;
  cluster: string;
}

export interface Trainer {
  id: string;
  trainerName: string;
  trainingTypes: TrainingType[];
}

export interface EligibilityRule {
  id: string; // usually the trainingType
  trainingType: TrainingType;
  designation: {
    mode: 'ALL' | 'INCLUDE' | 'EXCLUDE';
    values: string[];
  };
  previousTraining: {
    mode: 'ALL' | 'INCLUDE' | 'NONE';
    values: Array<{ type: TrainingType; designations: string[] }>;
  };
  aplExperience: {
    mode: 'ALL' | 'RANGE';
    min: number;
    max: number;
  };
  specialConditions: {
    noAPInNext90Days: boolean;
    preAPOnlyIfInvited: boolean;
  };
}
