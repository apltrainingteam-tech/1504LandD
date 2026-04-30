import { useState, useMemo, useEffect } from 'react';
import { CandidateRecord } from '../../types/attendance';
import { applyBulkEdit as applyBulkEditEngine, EditBuffer, buildChangeSet, prepareBulkSavePayload } from '../../core/engines/editEngine';
import API_BASE from '../../config/api';

export interface UseEditTrainingDataProps {
  filteredCandidateKeys: string[]; // batchId::empId
}

export function useEditTrainingData({ filteredCandidateKeys }: UseEditTrainingDataProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editBuffer, setEditBuffer] = useState<EditBuffer>({});

  // ── Selection State Derived ────────────────────────────────────────────────
  const isAllSelected = filteredCandidateKeys.length > 0 && 
    filteredCandidateKeys.every(key => selectedIds.has(key));
  
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  // ── Actions ────────────────────────────────────────────────────────────────

  const toggleEditMode = () => {
    if (isEditMode && Object.keys(editBuffer).length > 0) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to switch to View Mode?')) return;
    }
    setIsEditMode(prev => !prev);
  };

  const selectRow = (batchId: string, empId: string) => {
    const key = `${batchId}::${empId}`;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectBatch = (batchId: string, empIds: string[]) => {
    const keys = empIds.map(eid => `${batchId}::${eid}`);
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allBatchSelected = keys.every(k => next.has(k));
      const newState = !allBatchSelected;
      
      keys.forEach(k => {
        if (newState) next.add(k);
        else next.delete(k);
      });
      return next;
    });
  };

  const selectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCandidateKeys));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const updateCell = (batchId: string, empId: string, update: Partial<CandidateRecord>) => {
    const key = `${batchId}::${empId}`;
    setEditBuffer(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), ...update } as any
    }));
  };

  const applyBulkEdit = (field: 'attendance' | 'score', value: any) => {
    if (selectedIds.size === 0) return;
    setEditBuffer(prev => applyBulkEditEngine(selectedIds, field, value, prev));
  };

  const saveChanges = async (allBatches: any[]) => {
    if (Object.keys(editBuffer).length === 0) {
      return { success: true, message: 'No changes to save' };
    }

    const changeSet = buildChangeSet(editBuffer, allBatches);
    const updates = prepareBulkSavePayload(changeSet);

    if (updates.length === 0) {
      setEditBuffer({}); // Clear if no actual changes compared to original
      return { success: true, message: 'Changes matched original data' };
    }

    try {
      const response = await fetch(`${API_BASE}/training-data/bulk-overwrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });

      const result = await response.json();
      if (result.success) {
        setEditBuffer({});
        return { success: true };
      }
      return { success: false, error: result.error || 'Failed to save changes' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const resetBuffer = () => setEditBuffer({});

  // Reset selection on filter changes (when filteredCandidateKeys changes)
  useEffect(() => {
    clearSelection();
  }, [filteredCandidateKeys]);

  return {
    // State
    isEditMode,
    selectedIds,
    editBuffer,
    isAllSelected,
    isSomeSelected,

    // Actions
    toggleEditMode,
    selectRow,
    selectBatch,
    selectAll,
    clearSelection,
    updateCell,
    applyBulkEdit,
    saveChanges,
    resetBuffer
  };
}
