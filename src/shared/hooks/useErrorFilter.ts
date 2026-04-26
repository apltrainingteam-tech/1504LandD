import { useMemo } from 'react';
import { ValidationError } from '../../core/contracts/validation.contract';

/**
 * useErrorFilter
 * 
 * Logic to filter a dataset based on an active validation error
 * and provide cell highlighting metadata.
 */
export function useErrorFilter<T extends Record<string, any>>(
  activeError: ValidationError | null,
  data: T[],
  module: string
) {
  const filteredData = useMemo(() => {
    if (!activeError || activeError.module !== module) return data;

    return data.filter((row, index) => {
      const recordId = String(row.id || row._id || '');
      
      // 1. Exact record match
      if (activeError.recordId && recordId === activeError.recordId) return true;
      
      // 2. Index match
      if (activeError.rowIndex === index) return true;
      
      // 3. Field + Value match (for bulk exploring the same error)
      const rowValue = row[activeError.field];
      if (activeError.field && String(rowValue || 'NULL') === String(activeError.value || 'NULL')) {
        return true;
      }

      return false;
    });
  }, [activeError, data, module]);

  const highlights = useMemo(() => {
    if (!activeError || activeError.module !== module) return new Set<string>();

    const highlightedRowIds = new Set<string>();
    data.forEach((row, index) => {
      const recordId = String(row.id || row._id || '');
      const rowValue = row[activeError.field];
      
      if (
        (activeError.recordId && recordId === activeError.recordId) ||
        (activeError.rowIndex === index) ||
        (activeError.field && String(rowValue || 'NULL') === String(activeError.value || 'NULL'))
      ) {
        highlightedRowIds.add(recordId || String(index));
      }
    });

    return {
      rowIds: highlightedRowIds,
      activeField: activeError.field
    };
  }, [activeError, data, module]);

  return { 
    filteredData, 
    isFiltered: !!(activeError && activeError.module === module),
    highlights: highlights as { rowIds: Set<string>; activeField: string }
  };
}
