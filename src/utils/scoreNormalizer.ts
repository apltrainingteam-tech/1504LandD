/**
 * Score Normalization: <=1 → ×100 (percentage), >1 → keep (rating). Round to 2 decimals.
 */
export function normalizeScore(val: any): number | null {
  const n = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(n)) return null;
  const out = (n > 0 && n <= 1) ? n * 100 : n;
  return Math.round(out * 100) / 100;
}

/**
 * Score Display: numeric → "93.56%" or "4" (for ratings <=5)
 */
export function displayScore(val: any): string {
  if (val === null || val === undefined || val === '') return '—';
  const n = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(n)) return '—';
  // If it's a 1-5 rating, don't add %
  if (n <= 5 && n === Math.floor(n)) return String(n);
  return n.toFixed(2) + '%';
}

export function flagScore(score: number): 'green' | 'amber' | 'red' {
  if (score > 75) return 'green';
  if (score >= 50) return 'amber';
  return 'red';
}

export function flagClass(f: 'green' | 'amber' | 'red'): string {
  return f === 'green' ? 'badge-success' : f === 'amber' ? 'badge-warning' : 'badge-danger';
}

export function flagLabel(f: 'green' | 'amber' | 'red'): string {
  return f === 'green' ? 'ON TRACK' : f === 'amber' ? 'AT RISK' : 'CRITICAL';
}
