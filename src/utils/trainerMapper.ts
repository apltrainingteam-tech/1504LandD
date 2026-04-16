export const normalizeTrainerName = (name?: string): string => {
  if (!name) return '';

  return name
    .toUpperCase()
    .replace(/MR.?|MS.?|MRS.?|DR.?/g, '')
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const trainerAliasMap: Record<string, string> = {
  'PRAMOD': 'PRAMOD KUMAR',
  'PRAMOD KUMAR': 'PRAMOD KUMAR'
};

export const standardizeTrainer = (name?: string): string => {
  const normalized = normalizeTrainerName(name);
  return trainerAliasMap[normalized] || normalized;
};
