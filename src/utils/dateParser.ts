/**
 * Handle Excel serials, dd-mm-yyyy, dd/mm/yyyy, 9-Apr-25, etc.
 * Returns YYYY-MM-DD
 */
export function parseAnyDate(raw: any): string | null {
  if (!raw && raw !== 0) return null;

  // Handle Excel serials
  if (typeof raw === 'number') {
    const d = new Date((raw - 25569) * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);
  }

  const s = String(raw).trim();
  if (!s) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);

  // DD/MM/YYYY or DD-MM-YYYY
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;

  // DD/MM/YY or DD-MM-YY
  const m1b = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (m1b) {
    const yr = parseInt(m1b[3]) < 50 ? '20' + m1b[3] : '19' + m1b[3];
    return `${yr}-${m1b[2].padStart(2, '0')}-${m1b[1].padStart(2, '0')}`;
  }

  // DD-Mon-YYYY or DD Mon YYYY
  const mos: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  const m2 = s.match(/^(\d{1,2})[\/\-\s]([A-Za-z]{3})[\/\-\s](\d{2,4})$/);
  if (m2) {
    const mo = mos[m2[2].toLowerCase()];
    const yr = m2[3].length === 2 ? (parseInt(m2[3]) < 50 ? '20' + m2[3] : '19' + m2[3]) : m2[3];
    if (mo) return `${yr}-${mo}-${m2[1].padStart(2, '0')}`;
  }

  // Fallback to JS Date
  const fb = new Date(s);
  if (!isNaN(fb.getTime())) return fb.toISOString().substring(0, 10);

  return null;
}

export function formatDateForDisplay(d: string | null | undefined): string {
  if (!d) return '-';
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : d;
}
