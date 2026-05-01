/**
 * Fiscal Year Utilities (April - March based)
 * Indian fiscal year: April 1 to March 31
 */

/**
 * Get current fiscal year start year
 * April 2024 - March 2025 returns 2024
 */
export const getCurrentFiscalYear = (): number => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0 = Jan, 3 = April

  // If month >= April (month 3), FY = current year
  // Otherwise FY = previous year
  return month >= 3 ? year : year - 1;
};

/**
 * Format fiscal year as "YYYY-YY" (e.g., "2024-25")
 */
export const formatFiscalYear = (year: number): string => {
  const nextYear = year + 1;
  const nextYearSuffix = String(nextYear).slice(-2);
  return `${year}-${nextYearSuffix}`;
};

/**
 * Get array of all fiscal years from startYear to current
 * Returns in descending order (latest first)
 */
export const getFiscalYears = (startYear: number = 2015): string[] => {
  const currentFY = getCurrentFiscalYear();
  const years: string[] = [];

  for (let y = startYear; y <= currentFY; y++) {
    years.push(formatFiscalYear(y));
  }

  return years.reverse(); // Latest first
};

/**
 * Determine fiscal year from a date string
 * Handles YYYY-MM-DD and various date formats
 * @param dateStr ISO date string or any parseable date
 * @returns Fiscal year in format "YYYY-YY" or empty string if invalid
 */
export const getFiscalYearFromDate = (dateStr?: string): string => {
  if (!dateStr) return '';

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed: Jan=0, Mar=2, Apr=3

  // April or later = current fiscal year
  // January-March = previous fiscal year
  const fyStartYear = month >= 3 ? year : year - 1;

  return formatFiscalYear(fyStartYear);
};

/**
 * Get fiscal year range as display string
 * @param year Fiscal year start year
 * @returns "April 2024 - March 2025"
 */
export const getFiscalYearRange = (year: number): string => {
  const nextYear = year + 1;
  return `April ${year} - March ${nextYear}`;
};

/**
 * Parse fiscal year string to start year
 * @param fy Fiscal year string like "2024-25"
 * @returns Start year (2024) or null if invalid
 */
export const parseFiscalYear = (fy: string): number | null => {
  const match = fy.match(/^(\d{4})-\d{2}$/);
  if (!match) return null;
  return parseInt(match[1], 10);
};

const MONTH_ABBR: Record<string, string> = {
  '04': 'Apr', '05': 'May', '06': 'Jun', '07': 'Jul',
  '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov',
  '12': 'Dec', '01': 'Jan', '02': 'Feb', '03': 'Mar'
};

/**
 * Format a YYYY-MM string to a 3-letter month abbreviation.
 * Follows Indian fiscal year order (Apr–Mar).
 * @param month YYYY-MM string
 * @returns "Apr", "May", … "Mar" or the original string if unrecognized
 */
export const formatMonthLabel = (month: string): string => {
  const m = (month || '').split('-')[1];
  return MONTH_ABBR[m] || month;
};

/**
 * Get the current fiscal year as a string (e.g., "2024-25")
 */
export const getCurrentFYString = (): string => {
  return formatFiscalYear(getCurrentFiscalYear());
};

/**
 * Get all fiscal months for a given FY string
 */
export const getFiscalMonths = (fy: string): string[] => {
  const startYear = parseFiscalYear(fy);
  if (startYear === null) return [];
  
  const months: string[] = [];
  // Apr -> Dec
  for (let m = 4; m <= 12; m++) {
    months.push(`${startYear}-${String(m).padStart(2, '0')}`);
  }
  // Jan -> Mar
  for (let m = 1; m <= 3; m++) {
    months.push(`${startYear + 1}-${String(m).padStart(2, '0')}`);
  }
  return months;
};

export const FISCAL_YEARS = getFiscalYears(2015);

/**
 * Check if a date string falls within a given fiscal year
 * @param dateStr Date string (YYYY-MM-DD)
 * @param fy Fiscal year string (e.g., "2024-25")
 */
export const isWithinFY = (dateStr?: string, fy?: string): boolean => {
  if (!fy || fy === 'ALL') return true;
  return getFiscalYearFromDate(dateStr) === fy;
};
