export const TRAINING_TEMPLATES: Record<string, string[]> = {
  IP: ['Detailing', 'Test Score', 'Trainability Score'],

  AP: [
    'Knowledge',
    'BSE',
    'Grasping',
    'Participation',
    'Detailing & Presentation',
    'Role Play',
    'Punctuality',
    'Grooming & Dress Code',
    'Behaviour'
  ],

  PreAP: ['AP Date', 'Notified', 'Test Score'],

  MIP: ['Science Score', 'Skill Score'],

  Capsule: ['Score'],

  Refresher: ['Knowledge', 'Situation Handling', 'Presentation']
};

export const TEMPLATE_FIELD_MAP: Record<string, string> = {
  'Detailing': 'detailing',
  'Test Score': 'percent',
  'Trainability Score': 'tScore',

  'Knowledge': 'knowledge',
  'BSE': 'bse',
  'Grasping': 'grasping',
  'Participation': 'participation',

  'Detailing & Presentation': 'detailing',
  'Role Play': 'rolePlay',
  'Punctuality': 'punctuality',
  'Grooming & Dress Code': 'grooming',
  'Behaviour': 'behaviour',

  'AP Date': 'apDate',
  'Notified': 'notified',

  'Science Score': 'scienceScore',
  'Skill Score': 'skillScore',

  'Situation Handling': 'situationHandling',
  'Presentation': 'presentation',

  'Score': 'score'
};

/**
 * Fields that are raw ratings/numbers, NOT percentages.
 * These will be rendered without the '%' suffix.
 */
export const RATING_FIELDS = new Set<string>([
  'tScore',        // Trainability Score (0–30 rating scale)
  'grasping',      // AP sub-score rating
  'participation', // AP sub-score rating
  'detailing',     // AP sub-score rating (Detailing & Presentation)
  'rolePlay',      // AP sub-score rating
  'punctuality',   // AP sub-score rating
  'grooming',      // AP sub-score rating
  'behaviour',     // AP sub-score rating
  'notified',      // Notification count
  'apDate',        // Date field
]);

