import { normalizeText } from '../utils/textNormalizer';

/**
 * Debug Index Engine
 * 
 * Provides high-speed, indexed lookups for large datasets to enable
 * zero-overhead debugging and isolation.
 */

export interface DebugIndex {
  byRow: Map<number, any>;
  byValue: Map<string, number[]>; // Value -> Row Indexes
  byField: Map<string, Map<string, number[]>>; // Field -> Value -> Row Indexes
}

export function buildDebugIndex(data: any[]): DebugIndex {
  const byRow = new Map<number, any>();
  const byValue = new Map<string, number[]>();
  const byField = new Map<string, Map<string, number[]>>();

  data.forEach((row, index) => {
    byRow.set(index, row);

    Object.entries(row).forEach(([field, val]) => {
      if (val === null || val === undefined) return;

      const stringVal = normalizeText(String(val));
      if (!stringVal) return;

      // Global value index
      if (!byValue.has(stringVal)) byValue.set(stringVal, []);
      byValue.get(stringVal)!.push(index);

      // Per-field index
      if (!byField.has(field)) byField.set(field, new Map());
      const fieldMap = byField.get(field)!;
      if (!fieldMap.has(stringVal)) fieldMap.set(stringVal, []);
      fieldMap.get(stringVal)!.push(index);
    });
  });

  return { byRow, byValue, byField };
}

/**
 * Search the debug index for a specific value across all fields.
 */
export function searchDebug(index: DebugIndex, value: string): number[] {
  const searchVal = normalizeText(value);
  if (!searchVal) return [];
  
  // Try exact match in global value index
  return index.byValue.get(searchVal) || [];
}

/**
 * Extract partial data from the base dataset using row indexes.
 */
export function getDebugData<T>(rowIndexes: number[], baseData: T[]): T[] {
  return rowIndexes
    .map(idx => baseData[idx])
    .filter(row => row !== undefined);
}
