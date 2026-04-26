/**
 * Suggestion Engine for Data Correction
 */

export function getClosestMatches(input: string, possibleValues: string[] = [], limit: number = 3): string[] {
  if (!input || !possibleValues) return [];

  
  const normalizedInput = input.toLowerCase().trim();
  
  // Scoring function: simple similarity
  const scored = possibleValues.map(val => {
    const normalizedVal = val.toLowerCase().trim();
    
    // Exact match
    if (normalizedVal === normalizedInput) return { val, score: 100 };
    
    // Starts with
    if (normalizedVal.startsWith(normalizedInput)) return { val, score: 80 };
    
    // Contains
    if (normalizedVal.includes(normalizedInput)) return { val, score: 50 };
    
    // Levenshtein-like distance (simple version)
    let commonChars = 0;
    const inputChars = new Set(normalizedInput);
    for (const char of normalizedVal) {
      if (inputChars.has(char)) commonChars++;
    }
    
    const overlap = commonChars / Math.max(normalizedVal.length, normalizedInput.length);
    return { val, score: overlap * 40 };
  });
  
  return scored
    .sort((a, b) => b.score - a.score)
    .filter(s => s.score > 10)
    .slice(0, limit)
    .map(s => s.val);
}
