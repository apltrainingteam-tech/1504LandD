// ─── TRAINING SCHEMA ENGINE ────────────────────────────────────────────────
// Single source of truth for all training-type specific field definitions.
// Used by parser, validator, and UI components.

export interface TrainingSchema {
  required: string[];         // camelCase keys that MUST be present
  scoreFields: string[];      // camelCase keys for numeric score extraction
  scoreLabels: Record<string, string>; // camelCase key → human display label
}

export const TRAINING_SCHEMAS: Record<string, TrainingSchema> = {
  IP: {
    required: ['aadhaarNumber', 'employeeId', 'mobileNumber', 'name', 'trainerId', 'team', 'designation', 'hq', 'state', 'attendanceDate'],
    scoreFields: ['detailing', 'percent', 'tScore'],
    scoreLabels: { detailing: 'Detailing', percent: 'Test Score', tScore: 'Trainability Score' }
  },

  AP: {
    required: ['aadhaarNumber', 'employeeId', 'mobileNumber', 'name', 'trainerId', 'team', 'designation', 'hq', 'state', 'attendanceDate', 'attendanceStatus'],
    scoreFields: ['knowledge', 'bse', 'grasping', 'participation', 'detailing', 'rolePlay', 'punctuality', 'grooming', 'behaviour'],
    scoreLabels: {
      knowledge: 'Knowledge',
      bse: 'BSE',
      grasping: 'Grasping',
      participation: 'Participation',
      detailing: 'Detailing & Presentation',
      rolePlay: 'Role Play',
      punctuality: 'Punctuality',
      grooming: 'Grooming & Dress Code',
      behaviour: 'Behaviour'
    }
  },

  MIP: {
    required: ['aadhaarNumber', 'employeeId', 'mobileNumber', 'name', 'trainerId', 'team', 'designation', 'hq', 'state', 'attendanceDate', 'attendanceStatus'],
    scoreFields: ['scienceScore', 'skillScore'],
    scoreLabels: { scienceScore: 'Science Score', skillScore: 'Skill Score' }
  },

  Refresher: {
    required: ['aadhaarNumber', 'employeeId', 'mobileNumber', 'name', 'trainerId', 'team', 'designation', 'hq', 'state', 'attendanceDate', 'attendanceStatus'],
    scoreFields: ['knowledge', 'situationHandling', 'presentation'],
    scoreLabels: {
      knowledge: 'Knowledge',
      situationHandling: 'Situation Handling',
      presentation: 'Presentation'
    }
  },

  Capsule: {
    required: ['aadhaarNumber', 'employeeId', 'mobileNumber', 'name', 'trainerId', 'team', 'designation', 'hq', 'state', 'attendanceDate', 'attendanceStatus'],
    scoreFields: ['score'],
    scoreLabels: { score: 'Score' }
  },

  PreAP: {
    required: ['aadhaarNumber', 'employeeId', 'mobileNumber', 'name', 'trainerId', 'team', 'designation', 'hq', 'state', 'attendanceDate', 'attendanceStatus'],
    scoreFields: ['percent'],
    scoreLabels: { percent: 'Test Score' }
  },

  GTG: {
    required: ['aadhaarNumber', 'employeeId', 'mobileNumber', 'name', 'trainerId', 'team', 'designation', 'hq', 'state', 'attendanceDate', 'attendanceStatus'],
    scoreFields: ['score'],
    scoreLabels: { score: 'Score' }
  },

  HO: {
    required: ['aadhaarNumber', 'employeeId', 'mobileNumber', 'name', 'trainerId', 'team', 'designation', 'hq', 'state', 'attendanceDate', 'attendanceStatus'],
    scoreFields: ['score'],
    scoreLabels: { score: 'Score' }
  },

  RTM: {
    required: ['aadhaarNumber', 'employeeId', 'mobileNumber', 'name', 'trainerId', 'team', 'designation', 'hq', 'state', 'attendanceDate', 'attendanceStatus'],
    scoreFields: ['score'],
    scoreLabels: { score: 'Score' }
  },

  NotificationHistory: {
    required: ['employeeId', 'trainingType', 'notificationDate'],
    scoreFields: [],
    scoreLabels: {}
  }
};

// ─── HEADER NORMALIZATION ───────────────────────────────────────────────────
// Converts any Excel header variation → the internal camelCase key used above.

/** Strip spaces, lowercase, remove non-alpha. Used for fuzzy header matching. */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '');
}

/**
 * Maps raw Excel header → camelCase internal key.
 * Falls back to the normalised form if no explicit mapping found.
 */
export const HEADER_ALIAS_MAP: Record<string, string> = {
  // Identity
  'aadhaar': 'aadhaarNumber',
  'aadhar': 'aadhaarNumber',
  'aadhaarnumber': 'aadhaarNumber',
  'aadhaarno': 'aadhaarNumber',
  'aadharno': 'aadhaarNumber',
  'employeeid': 'employeeId',
  'empid': 'employeeId',
  'employeecode': 'employeeId',
  'mobilenumber': 'mobileNumber',
  'mobile': 'mobileNumber',
  'phone': 'mobileNumber',
  'contact': 'mobileNumber',
  'employeename': 'name',
  'empname': 'name',
  'fullname': 'name',
  'name': 'name',
  'trainer': 'trainerId',
  'trainerid': 'trainerId',
  'trainername': 'trainerId',
  'team': 'team',
  'teamname': 'team',
  'designation': 'designation',
  'desig': 'designation',
  'hq': 'hq',
  'headquarter': 'hq',
  'headquarters': 'hq',
  'headoffice': 'hq',
  'state': 'state',
  'cluster': 'cluster',

  // Dates & Status
  'attendancedate': 'attendanceDate',
  'date': 'attendanceDate',
  'trainingdate': 'attendanceDate',
  'attdate': 'attendanceDate',
  'attendancestatus': 'attendanceStatus',
  'status': 'attendanceStatus',
  'presentabsent': 'attendanceStatus',
  'attendance': 'attendanceStatus',
  'notificationdate': 'notificationDate',

  // IP scores
  'percent': 'percent',
  'detailingpercent': 'percent',
  'detailing/percent': 'percent',
  'ipscore': 'percent',
  'testscorepercentage': 'percent',
  'tscore': 'tScore',
  'testscore': 'tScore',
  'score': 'score',

  // AP scores
  'knowledge': 'knowledge',
  'bse': 'bse',
  'grasping': 'grasping',
  'participation': 'participation',
  'detailing': 'detailing',
  'presentation': 'detailing', // mapped to detailing as per IP/AP overlap
  'detailingpresentation': 'detailing',
  'situationhandling': 'situationHandling',
  'roleplay': 'rolePlay',
  'punctuality': 'punctuality',
  'grooming': 'grooming',
  'groomingdresscode': 'grooming',
  'behaviour': 'behaviour',
  'english': 'english',
  'locallanguage': 'localLanguage',
  'involvement': 'involvement',
  'effort': 'effort',
  'confidence': 'confidence',

  // MIP / Refresher scores
  'sciencescore': 'scienceScore',
  'science': 'scienceScore',
  'skillscore': 'skillScore',
  'skill': 'skillScore',
};

/** Given a raw Excel column header, return the canonical camelCase key. */
export function mapHeader(rawHeader: string): string {
  const normalized = normalizeHeader(rawHeader);
  return HEADER_ALIAS_MAP[normalized] || normalized;
}

/** Get schema for a training type, falling back to a minimal default. */
export function getSchema(trainingType: string): TrainingSchema {
  return TRAINING_SCHEMAS[trainingType] || {
    required: ['employeeId', 'attendanceDate'],
    scoreFields: ['score'],
    scoreLabels: { score: 'Score' }
  };
}

