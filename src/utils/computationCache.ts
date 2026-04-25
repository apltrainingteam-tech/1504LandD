/**
 * Computation Cache Utility
 * 
 * Caches expensive computation results based on input data hash.
 * Prevents redundant recalculation when same dataset is processed.
 * 
 * Usage:
 *   const cache = new ComputationCache<MyResultType>();
 *   const result = cache.get(key, () => expensiveComputation(data));
 */

export class ComputationCache<T> {
  private cache = new Map<string, T>();
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  /**
   * Generate a simple hash from an array of values.
   * Fast but collision-prone; suitable for caching checks.
   */
  private hashKey(...values: any[]): string {
    return values
      .map(v => {
        if (typeof v === 'object' && v !== null) {
          return v.length ?? Object.keys(v).length;
        }
        return String(v);
      })
      .join(':');
  }

  /**
   * Get cached result or compute if not in cache.
   */
  get(key: string, compute: () => T): T {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const result = compute();
    this.set(key, result);
    return result;
  }

  /**
   * Compute result from input values and cache it.
   */
  compute(inputs: any[], compute: () => T): T {
    const key = this.hashKey(...inputs);
    return this.get(key, compute);
  }

  /**
   * Manually set cached value.
   */
  set(key: string, value: T): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry (FIFO)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  /**
   * Clear all cached values.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size.
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * Global cache instances for common computation types.
 */
export const globalComputationCaches = {
  grouping: new ComputationCache<any>(100),
  kpiCalculations: new ComputationCache<any>(50),
  timeSeries: new ComputationCache<any>(50),
  drilldown: new ComputationCache<any>(50),
};

/**
 * Clear all global caches (useful on major data refresh).
 */
export function clearAllCaches() {
  Object.values(globalComputationCaches).forEach(cache => cache.clear());
}
