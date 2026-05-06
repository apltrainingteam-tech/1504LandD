export const TRAINING_TEMPLATES: Record<string, string[]> = {
  IP: ['Detailing', 'Test Score', 'Trainability Score'],

  AP: [
    'Knowledge',
    'BSE'
  ],

  PreAP: ['AP Date', 'Notified', 'Test Score'],

  MIP: ['Science Score', 'Skill Score'],

  Capsule: ['Score'],

  Refresher: ['Knowledge', 'Situation Handling', 'Presentation']
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
  'bse_prod',      // BSE: Product Knowledge
  'bse_therapy',   // BSE: Therapy Knowledge
  'bse_comp',      // BSE: Competitor Handling
  'bse_va',        // BSE: Visual Aid Usage
  'bse_obj',       // BSE: Objection Handling
]);

export const BSE_SUB_METRICS = [
  { label: 'Grasping', field: 'grasping' },
  { label: 'Participation', field: 'participation' },
  { label: 'Detailing & Presentation', field: 'detailing' },
  { label: 'Role Play', field: 'rolePlay' },
  { label: 'Punctuality', field: 'punctuality' },
  { label: 'Grooming & Dress Code', field: 'grooming' },
  { label: 'Behaviour', field: 'behaviour' },
];

export const TEMPLATE_FIELD_MAP: Record<string, string> = {
  'Detailing': 'detailing',
  'Test Score': 'percent',
  'Trainability Score': 'tScore',

  'Knowledge': 'knowledge',
  'BSE': 'bse',
  'Product Knowledge': 'bse_prod',
  'Therapy Knowledge': 'bse_therapy',
  'Competitor Handling': 'bse_comp',
  'Visual Aid Usage': 'bse_va',
  'Objection Handling': 'bse_obj',

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

