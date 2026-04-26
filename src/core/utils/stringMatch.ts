/**
 * Simple string similarity / fuzzy matching utility
 */

export function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function getClosestMatch(value: string, masterList: string[]): string | null {
  if (!value || masterList.length === 0) return null;
  
  const v = value.toUpperCase();
  let minDistance = Infinity;
  let closest = null;

  for (const item of masterList) {
    const itemUpper = item.toUpperCase();
    if (v === itemUpper) return item;

    const distance = getLevenshteinDistance(v, itemUpper);
    if (distance < minDistance) {
      minDistance = distance;
      closest = item;
    }
  }

  // Only return if similarity is reasonable (e.g., distance < 4)
  return minDistance < 4 ? closest : null;
}
