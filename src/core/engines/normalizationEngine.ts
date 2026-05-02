/**
 * Normalization Engine
 * 
 * RESPONSIBILITY:
 * Ensure all incoming data from API/External sources is sanitized, typed, 
 * and consistent before hitting the MasterDataContext or UI components.
 */

/**
 * Normalizes a string for logic comparisons (lowercase, no spaces)
 */
/**
 * Normalizes a string for logic comparisons (lowercase, no spaces)
 */
export const normalizeString = (val?: string): string =>
  val?.toLowerCase().trim() || "";

/**
 * Normalizes a string strictly for matching (lowercase, no spaces)
 */
export const normalizeForMatch = (val?: string): string =>
  val?.toLowerCase().trim().replace(/\s+/g, "") || "";

// ─── TEAM INGESTION RULES ──────────────────────────────────────────────────
const TEAM_NORMALIZATION_RULES: Record<string, string> = {
  "ajantadental": "Dental",
  "ajantanephro": "Nephro",
  "diabetestaskforce": "DTF",
  "dtf": "DTF",
  "axlear": "Axelar", // Added normalization rule for 'Axlear'
};

const TEAM_EXCLUSION_RULES = new Set([
  "aplife",
  "hospicare",
  "gencare",
  "fieldl&d",
]);

/**
 * Formats a string to Proper Case (Capitalize each word)
 */
export const toProperCase = (str: string | undefined | null): string => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Team Case Formatting Engine
 */
export const formatTeamName = (teamName: string): { formatted: string, isException: boolean } => {
  const exceptions = ['CDC', 'DTF'];
  const upper = teamName.toUpperCase().trim();

  if (exceptions.includes(upper)) {
    return { formatted: upper, isException: true };
  }

  return { formatted: toProperCase(teamName), isException: false };
};

/**
 * Training Type Case Formatting Engine
 */
export const formatTrainingType = (type: string): { formatted: string, isAbbreviation: boolean } => {
  const raw = (type || "").trim();
  // Detect abbreviation: at least 2 uppercase letters and nothing else
  if (/^[A-Z]{2,}$/.test(raw)) {
    return { formatted: raw, isAbbreviation: true };
  }
  return { formatted: raw, isAbbreviation: false };
};

/**
 * Team Normalization and Exclusion Engine (for ingestion)
 */
export const processTeamData = (teamName?: string): {
  normalized: string,
  excluded: boolean,
  ruleApplied?: string,
  caseFormatted: boolean,
  isException: boolean
} => {
  const raw = (teamName || "").trim();
  if (!raw) return { normalized: "", excluded: false, caseFormatted: false, isException: false };

  const normalizedKey = normalizeForMatch(raw);

  // 1. Check exclusion (Hard Filter)
  if (TEAM_EXCLUSION_RULES.has(normalizedKey)) {
    return { normalized: raw, excluded: true, caseFormatted: false, isException: false };
  }

  // 2. Check normalization
  let currentName = raw;
  let ruleApplied: string | undefined;

  const canonical = TEAM_NORMALIZATION_RULES[normalizedKey];
  if (canonical) {
    currentName = canonical;
    if (canonical.toLowerCase() !== raw.toLowerCase()) {
      ruleApplied = `${raw} → ${canonical}`;
    }
  }

  // 3. Apply Casing
  const casing = formatTeamName(currentName);

  return {
    normalized: casing.formatted,
    excluded: false,
    ruleApplied,
    caseFormatted: casing.formatted !== currentName,
    isException: casing.isException
  };
};


const TRAINING_TYPE_MAP: Record<string, string> = {
  ip: "IP",
  ap: "AP",
  mip: "MIP",
  refresher: "Refresher",
  capsule: "Capsule",
  preap: "PreAP",
};

/**
 * Normalizes training type to canonical form
 */
export const normalizeTrainingType = (val?: string): string => {
  const key = normalizeString(val);
  return TRAINING_TYPE_MAP[key] || "Unknown";
};

/**
 * Shared utility for logic-safe string matching
 */
export const match = (a?: string, b?: string): boolean =>
  normalizeString(a) === normalizeString(b);

/**
 * Shared utility for null-safe string sorting
 */
export const safeSort = (a?: string, b?: string): number =>
  (a || "").localeCompare(b || "");

/**
 * Preserves a readable label for UI display
 */
const preserveLabel = (val?: string, fallback = "Unknown"): string =>
  val?.trim() || fallback;

/**
 * Ensures a value is a valid number, falling back to 0
 */
const normalizeNumber = (val: any): number => {
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

/**
 * Ensures a value is a valid Date object or null
 */
const normalizeDate = (val: any): Date | null => {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Generates a stable fallback ID if one is missing
 */
const generateFallbackId = (r: any): string =>
  `${r.employeeId || "emp"}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

/**
 * Core Normalizer for Training Records
 */
export const normalizeTrainingRecord = (record: any) => {
  if (!record.trainingType) {
    console.warn("Missing trainingType:", record);
  }

  return {
    ...record,

    // STRING NORMALIZATION (For Logic)
    trainingType: normalizeString(record.trainingType),
    team: processTeamData(record.team).normalized,
    trainer: normalizeString(record.trainer),

    // SAFE FALLBACKS / LABELS (For UI Display)
    trainingTypeLabel: formatTrainingType(record.trainingType).formatted,
    teamLabel: formatTeamName(record.team || "").formatted || "Unknown",
    trainerLabel: preserveLabel(record.trainer, "Unassigned"),

    // DATE NORMALIZATION
    date: normalizeDate(record.date || record.attendanceDate || record.startDate),

    // NUMERIC SAFETY
    score: normalizeNumber(record.score),
    attendanceStatus: record.attendanceStatus ?? "Absent",

    // ID SAFETY
    trainingId: record.trainingId || record.id || generateFallbackId(record),
  };
};

/**
 * Normalizes Employee Records
 */
export const normalizeEmployeeRecord = (record: any) => {
  return {
    ...record,
    employeeId: String(record.employeeId || "").trim(),
    name: preserveLabel(record.name, "Unknown Employee"),
    team: processTeamData(record.team).normalized,
    teamLabel: preserveLabel(record.team, "Unknown Team"),
    designation: preserveLabel(record.designation, "Not Specified"),
    status: record.status || "ACTIVE"
  };
};

/**
 * Normalizes an entire dataset of training records
 */
export const normalizeDataset = (data: any[]) => {
  console.log("Before normalization:", data.length);
  const normalized = data.map(normalizeTrainingRecord);
  console.log("After normalization:", normalized.length);
  return normalized;
};

/**
 * Debug-aware fallback filter.
 * If the filter results in an empty set, it optionally returns the original data
 * with a warning, preventing silent UI failures in controlled scenarios.
 */
export const applyFallbackFilter = <T>(
  data: T[],
  predicate: (item: T) => boolean,
  useFallback: boolean = false
): T[] => {
  const filtered = data.filter(predicate);

  if (filtered.length === 0 && useFallback) {
    console.warn("Filter returned empty set — fallback triggered");
    return data;
  }

  return filtered;
};
