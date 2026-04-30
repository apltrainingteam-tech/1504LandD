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
export const normalizeString = (val?: string): string =>
  val?.toLowerCase().trim().replace(/\s+/g, "") || "";

const TRAINING_TYPE_MAP: Record<string, string> = {
  ip: "IP",
  ap: "AP",
  mip: "MIP",
  refresher: "Refresher",
  capsule: "Capsule",
  preap: "PRE_AP",
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
    team: normalizeString(record.team),
    trainer: normalizeString(record.trainer),

    // SAFE FALLBACKS / LABELS (For UI Display)
    trainingTypeLabel: normalizeTrainingType(record.trainingType),
    teamLabel: preserveLabel(record.team, "Unknown"),
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
    team: normalizeString(record.team),
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
