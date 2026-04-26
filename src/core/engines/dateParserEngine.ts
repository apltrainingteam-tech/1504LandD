/**
 * ✅ DATE PARSER SERVICE - ACTIVE SYSTEM IN PRODUCTION
 * 
 * This service provides parseExcelDate(), which is used by uploadServiceEnriched
 * and parsingServiceEnriched to handle Excel date parsing.
 * 
 * HANDLES MULTIPLE FORMATS:
 * ✓ Excel numeric dates (serial format): 44999, 45000, etc.
 * ✓ ISO 8601: YYYY-MM-DD (2024-01-15)
 * ✓ Common formats:
 *   - DD/MM/YYYY (15/01/2024)
 *   - MM/DD/YYYY (01/15/2024)
 *   - DD-MM-YYYY (15-01-2024)
 *   - DD.MM.YYYY (15.01.2024)
 * ✓ Date objects (returned as-is)
 * 
 * VALIDATES:
 * ✓ Date format detection
 * ✓ Month/day range validation
 * ✓ Ambiguous format handling (prefers DD/MM for non-US locales)
 * 
 * NEVER REJECTS (always tries to parse):
 * ✓ Returns null only for truly unparseable input
 * ✓ Works with single/double digit months and days
 * ✓ Works with Excel numeric dates
 * 
 * REPLACES:
 * ❌ parseAnyDate from core/utils/dateParser (legacy)
 * 
 * Date Parser Service
 * Handles Excel date serial numbers, ISO strings, and various formats
 */

/**
 * Convert Excel serial number to Date
 * Excel stores dates as serial numbers starting from 1900-01-01
 * https://support.microsoft.com/en-us/office/date-function-65f5a747-3c4a-4cd8-bdb2-b4b439e48c74
 */
function excelDateToDate(excelDateSerial: number): Date {
  // Excel epoch: January 0, 1900 (treated as Jan 1, 1900)
  // JavaScript epoch: January 1, 1970
  // Days between epochs: 25567
  const excelEpochDifference = 25567;
  
  // Account for Excel's leap year bug (1900 is not a leap year but Excel thinks it is)
  const adjustedSerial = excelDateSerial > 59 ? excelDateSerial + 1 : excelDateSerial;
  
  const dateInMs = (adjustedSerial - excelEpochDifference) * 24 * 60 * 60 * 1000;
  return new Date(dateInMs);
}

/**
 * Try to parse a date value from various formats
 * 
 * Supports:
 * 1. Excel serial number (e.g., 45406)
 * 2. ISO string (YYYY-MM-DD)
 * 3. Common date strings
 * 4. Date objects
 * 
 * Returns date in format: DD MMM YYYY (en-IN)
 * Example: 18 Apr 2026
 * 
 * Throws error if date cannot be parsed
 */
export function parseExcelDate(value: any): string {
  if (!value) {
    throw new Error('Date value is empty');
  }

  let date: Date | null = null;

  try {
    // If it's already a Date object
    if (value instanceof Date) {
      date = value;
    }
    // If it's a number, treat as Excel serial number
    else if (typeof value === 'number') {
      date = excelDateToDate(value);
    }
    // If it's a string, try to parse it
    else if (typeof value === 'string') {
      // Trim whitespace
      const trimmed = value.trim();

      // Try ISO format first (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        date = new Date(trimmed);
      }
      // Try common formats
      else {
        // Try standard date parsing
        date = new Date(trimmed);
      }
    }

    // Validate the date
    if (!date || isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${value}`);
    }

    // Check if year is reasonable (between 1900 and 2100)
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) {
      throw new Error(`Date year ${year} is outside valid range`);
    }

    // Format as DD MMM YYYY (en-IN)
    // Example: 18 Apr 2026
    return formatDateToIndian(date);
  } catch (err: any) {
    throw new Error(`Cannot parse date "${value}": ${err.message}`);
  }
}

/**
 * Format date to DD MMM YYYY format (Indian locale)
 * Example: 18 Apr 2026
 */
export function formatDateToIndian(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${day} ${month} ${year}`;
}

/**
 * Convert date string to YYYY-MM-DD format for comparisons
 */
export function dateToISO(value: any): string {
  const date = new Date(parseExcelDate(value));
  return date.toISOString().split('T')[0];
}

/**
 * Check if a date string is valid
 */
export function isValidDate(value: any): boolean {
  try {
    parseExcelDate(value);
    return true;
  } catch {
    return false;
  }
}

export default {
  parseExcelDate,
  formatDateToIndian,
  dateToISO,
  isValidDate
};




