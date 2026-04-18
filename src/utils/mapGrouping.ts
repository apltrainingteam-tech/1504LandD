/**
 * Map-Based Grouping Utilities
 * 
 * Replaces inefficient nested loops with single-pass Map grouping.
 * Significantly faster for large datasets (1000+ items).
 */

import { UnifiedRecord } from '../types/reports';

/**
 * Group records by a single key extractor function.
 * Single pass through data with O(n) complexity.
 * 
 * @param data - Array of records
 * @param keyFn - Function to extract grouping key
 * @returns Map with keys mapped to arrays of records
 */
export function groupByKey<T>(
  data: T[],
  keyFn: (item: T) => string
): Map<string, T[]> {
  const map = new Map<string, T[]>();

  for (const item of data) {
    const key = keyFn(item);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(item);
  }

  return map;
}

/**
 * Group records by two levels (e.g., cluster -> team).
 * Single pass with nested Map structure.
 * 
 * @param data - Array of records
 * @param level1Fn - Function to extract level 1 grouping key
 * @param level2Fn - Function to extract level 2 grouping key
 * @returns Map of level1 -> Map of level2 -> arrays
 */
export function groupByTwoLevels<T>(
  data: T[],
  level1Fn: (item: T) => string,
  level2Fn: (item: T) => string
): Map<string, Map<string, T[]>> {
  const level1Map = new Map<string, Map<string, T[]>>();

  for (const item of data) {
    const key1 = level1Fn(item);
    const key2 = level2Fn(item);

    if (!level1Map.has(key1)) {
      level1Map.set(key1, new Map());
    }

    const level2Map = level1Map.get(key1)!;
    if (!level2Map.has(key2)) {
      level2Map.set(key2, []);
    }

    level2Map.get(key2)!.push(item);
  }

  return level1Map;
}

/**
 * Group unified records by cluster and team (common pattern).
 */
export function groupByClusterTeam(data: UnifiedRecord[]): Map<string, Map<string, UnifiedRecord[]>> {
  return groupByTwoLevels(
    data,
    r => r.employee.state || '—',
    r => r.employee.team || '—'
  );
}

/**
 * Group unified records by a single field (team, cluster, or month).
 */
export function groupByField(
  data: UnifiedRecord[],
  field: 'team' | 'cluster' | 'month'
): Map<string, UnifiedRecord[]> {
  if (field === 'team') {
    return groupByKey(data, r => r.employee.team || '—');
  } else if (field === 'cluster') {
    return groupByKey(data, r => r.employee.state || '—');
  } else {
    return groupByKey(data, r => r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7) || '—');
  }
}

/**
 * Filter Map by a predicate function applied to keys.
 */
export function filterMapKeys<K, V>(
  map: Map<K, V>,
  predicate: (key: K) => boolean
): Map<K, V> {
  const filtered = new Map<K, V>();
  for (const [key, value] of map) {
    if (predicate(key)) {
      filtered.set(key, value);
    }
  }
  return filtered;
}

/**
 * Map all values in a Map using a transform function.
 */
export function mapValues<K, V, R>(
  map: Map<K, V>,
  transform: (value: V, key: K) => R
): Map<K, R> {
  const result = new Map<K, R>();
  for (const [key, value] of map) {
    result.set(key, transform(value, key));
  }
  return result;
}

/**
 * Convert Map to sorted array entries.
 */
export function mapToSortedArray<K, V>(
  map: Map<K, V>,
  compareFn?: (a: [K, V], b: [K, V]) => number
): Array<[K, V]> {
  const entries = Array.from(map.entries());
  if (compareFn) {
    entries.sort(compareFn);
  }
  return entries;
}
