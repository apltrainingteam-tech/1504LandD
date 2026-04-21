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
