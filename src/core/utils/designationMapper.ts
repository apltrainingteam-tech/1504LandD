// Designation standardization utility
export const standardizeDesignation = (designation?: string): string => {
  if (!designation) return 'OTHER';

  // Step 1: Remove bracket content and normalize
  const normalized = designation
    .toUpperCase()
    .replace(/\(.*?\)/g, '') // remove brackets and content
    .replace(/\./g, '')   // 🔥 REMOVE DOTS (IMPORTANT)
    .trim();

  // Step 2: Map to predefined abbreviations
  const designationMap: Record<string, string> = {
    "REGIONAL SALES MANAGER": "SLM",
    "SR REGIONAL SALES MANAGER": "SLM",

    "AREA SALES MANAGER": "FLM",
    "DISTRICT MANAGER": "FLM",

    "TERRITORY EXECUTIVE": "MR",
    "AREA BUSINESS EXECUTIVE": "MR",
    "SALES OFFICER": "MR",
    "TRAINEE SALES OFFICER": "MR",

    "SALES MANAGER": "SR MANAGER",
    "SR SALES MANAGER": "SR MANAGER",
    "DIVISIONAL SALES MANAGER": "SR MANAGER"
  };

  return designationMap[normalized] || 'OTHER';
};
