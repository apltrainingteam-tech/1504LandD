import { DataEdit } from '../contracts/edit.contract';

/**
 * Pure functions to apply delta edits to an immutable base dataset.
 */
export function applyEdits<T extends { id?: string; _id?: string }>(
  baseData: T[], 
  edits: DataEdit[],
  module: string
): T[] {
  // 1. Filter edits for this specific module
  const moduleEdits = edits.filter(e => e.module === (module as any));
  if (moduleEdits.length === 0) return baseData;

  // 2. Create a working map for performance
  const dataMap = new Map<string, T>();
  baseData.forEach(item => {
    const id = String(item.id || item._id || '');
    if (id) dataMap.set(id, { ...item });
  });

  // 3. Sort edits by timestamp to ensure deterministic application
  const sortedEdits = [...moduleEdits].sort((a, b) => a.createdAt - b.createdAt);

  // 4. Apply transformations
  sortedEdits.forEach(edit => {
    const recordId = String(edit.recordId);
    
    switch (edit.type) {
      case 'UPDATE':
        const existing = dataMap.get(recordId);
        if (existing) {
          dataMap.set(recordId, { ...existing, ...edit.changes });
        }
        break;
      case 'DELETE':
        dataMap.delete(recordId);
        break;
      case 'ADD':
        if (edit.changes) {
          dataMap.set(recordId, { ...edit.changes, id: recordId } as T);
        }
        break;
    }
  });

  return Array.from(dataMap.values());
}

/**
 * Helpers for creating specific edit objects
 */
export function createUpdateEdit(module: string, recordId: string, changes: Record<string, any>): DataEdit {
  return {
    id: `edit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    module,
    recordId,
    type: 'UPDATE',
    changes,
    createdAt: Date.now()
  };
}
