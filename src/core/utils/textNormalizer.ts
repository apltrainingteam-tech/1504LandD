const UPPERCASE_EXCEPTIONS = new Set([
  'CDC', 'DTF', 'RTM', 'RSM', 'DM', 'SM', 'DSM', 'SO', 'TSO', 'NUVENTA', 'GENCARE', 'PRISMA', 'AUREUS', 'REDEXIS', 'MIP', 'IP', 'AP', 'L&D'
]);

export function normalizeText(value: string): string {
  if (!value) return '';

  const trimmed = String(value).trim();
  if (!trimmed) return '';

  // Check if the entire string (after uppercasing) matches an exception
  const upper = trimmed.toUpperCase();
  if (UPPERCASE_EXCEPTIONS.has(upper)) {
    return upper;
  }

  // Convert to Title Case
  return trimmed
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (!word) return '';
      // If a single word matches an exception (e.g. "Ajanta CDC")
      const wordUpper = word.toUpperCase();
      if (UPPERCASE_EXCEPTIONS.has(wordUpper)) return wordUpper;
      
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

