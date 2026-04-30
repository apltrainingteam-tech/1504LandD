import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { Employee } from '../../types/employee';
import { TrainingNomination, NotificationRecord, NominationDraft, TrainingBatch, CandidateRecord, BatchAttStatus } from '../../types/attendance';
import { addBatch, updateByQuery, getCollection, updateDocument, upsertDoc } from '../engines/apiClient';
import API_BASE from '../../config/api';

export interface SelectionSession {
  trainingType: string;
  fiscalYear: string;
  teams: string[]; // names for display
  teamIds: string[]; // actual IDs
}

export interface NotificationHistoryState {
  records: NotificationRecord[];
  isBaselineUploaded: boolean;
}

// ── Context types ─────────────────────────────────────────────────────────────

interface PlanningFlowContextType {
  selectionSession: SelectionSession | null;
  setSelectionSession: (session: SelectionSession | null) => void;

  consumedTeams: Set<string>;
  consumedTrainers: Set<string>;
  addConsumed: (team: string, trainer: string) => void;
  removeConsumed: (team: string, trainer: string) => void;
  resetConsumed: () => void;

  drafts: NominationDraft[];
  saveDraft: (draft: NominationDraft) => void;
  updateDraft: (id: string, updates: Partial<NominationDraft>) => void;
  removeDraft: (id: string) => void;
  getDrafts: (filter: { teamIds?: string[]; includeCancelled?: boolean }) => NominationDraft[];
  cancelDraft: (draftId: string) => Promise<{ success: boolean; reason?: string }>;

  // Batch API
  batches: TrainingBatch[];
  commitBatch: (draft: NominationDraft, employees: Employee[]) => Promise<void>;
  updateBatchCandidate: (batchId: string, empId: string, update: Partial<CandidateRecord>) => Promise<void>;
  getBatches: (filter?: { teamId?: string; trainingType?: string; month?: string }) => TrainingBatch[];

  // Notification History
  notificationRecords: NotificationRecord[];
  loadNotificationHistory: () => Promise<NotificationRecord[]>;
}

const PlanningFlowContext = createContext<PlanningFlowContextType | undefined>(undefined);

export const PlanningFlowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectionSession, setSelectionSession] = useState<SelectionSession | null>(null);

  const [consumedTeams, setConsumedTeams]       = useState<Set<string>>(new Set());
  const [consumedTrainers, setConsumedTrainers] = useState<Set<string>>(new Set());
  const [drafts, setDrafts]                     = useState<NominationDraft[]>([]);
  const [batches, setBatches]                   = useState<TrainingBatch[]>([]);
  const [notificationRecords, setNotificationRecords] = useState<NotificationRecord[]>([]);

  useEffect(() => {
    const hydrateDrafts = async () => {
      try {
        const storedDrafts = await getCollection('nomination_drafts');
        if (Array.isArray(storedDrafts) && storedDrafts.length > 0) {
          setDrafts(storedDrafts as NominationDraft[]);
        }
      } catch (error) {
        console.error('Failed to load nomination drafts', error);
      }
    };
    hydrateDrafts();
  }, []);

  // ─── Notification History ──────────────────────────────────────────────────
  const loadNotificationHistory = useCallback(async () => {
    try {
      const data = await getCollection('notification_history');
      const normalized = (data || []).map((record: NotificationRecord) => ({
        ...record,
        finalStatus: record.finalStatus || 'Pending'
      }));
      setNotificationRecords(normalized);
      return normalized;
    } catch (error) {
      console.error("Failed to load notification history", error);
    }
  }, []);

  // ── Consumed ────────────────────────────────────────────────────────────────
  const addConsumed = (teamId: string, trainer: string) => {
    setConsumedTeams(prev => new Set(prev).add(teamId));
    setConsumedTrainers(prev => new Set(prev).add(trainer));
  };
  const removeConsumed = (teamId: string, trainer: string) => {
    setConsumedTeams(prev => { const n = new Set(prev); n.delete(teamId); return n; });
    setConsumedTrainers(prev => { const n = new Set(prev); n.delete(trainer); return n; });
  };
  const resetConsumed = () => {
    setConsumedTeams(new Set());
    setConsumedTrainers(new Set());
    setSelectionSession(null);
  };

  // ── Drafts ───────────────────────────────────────────────────────────────────
  const saveDraft = (draft: NominationDraft) => {
    const draftWithDefaults: NominationDraft = {
      ...draft,
      isCancelled: draft.isCancelled ?? false
    };
    setDrafts(prev => [...prev, draftWithDefaults]);
    upsertDoc('nomination_drafts', draft.id, draftWithDefaults).catch(err => {
      console.error('Failed to persist nomination draft', err);
    });
  };
  const updateDraft = (id: string, updates: Partial<NominationDraft>) => {
    setDrafts(prev => {
      const next = prev.map(d => d.id === id ? { ...d, ...updates } : d);
      const updated = next.find(d => d.id === id);
      if (updated) {
        upsertDoc('nomination_drafts', id, updated).catch(err => {
          console.error('Failed to persist draft update', err);
        });
      }
      return next;
    });
  };
  const removeDraft = (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id));
  };
  const getDrafts = (filter: { teamIds?: string[]; includeCancelled?: boolean }) => {
    const valid = drafts.filter(d =>
      Boolean(d.teamId) && (filter.includeCancelled ? true : !d.isCancelled)
    );
    if (!filter.teamIds || filter.teamIds.length === 0) return valid;
    return valid.filter(d => filter.teamIds!.includes(d.teamId));
  };

  const cancelDraft = useCallback(async (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if (!draft) return { success: false, reason: 'Draft not found.' };
    if (draft.status === 'COMPLETED') return { success: false, reason: 'Cannot cancel completed training.' };
    if (draft.isCancelled) return { success: true };

    const trainingId = draft.trainingId || draft.id;
    
    try {
      const response = await fetch(`${API_BASE}/training/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainingId })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Cancel failed.';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = `Server error: ${response.status}`;
        }
        return { success: false, reason: errorMessage };
      }

      const result = await response.json();
      
      if (result.success) {
        // Update local state
        setDrafts(prev => prev.map(d => 
          (d.id === draftId || d.trainingId === trainingId) 
            ? { ...d, isCancelled: true, status: 'Cancelled' as any, cancelledAt: new Date().toISOString() } 
            : d
        ));
        
        setNotificationRecords(prev => prev.map(r => 
          r.trainingId === trainingId ? { ...r, finalStatus: 'VOID', isVoided: true } : r
        ));

        return { success: true };
      } else {
        return { success: false, reason: result.error || 'Cancel failed.' };
      }
    } catch (error: any) {
      console.error('Cancel API error:', error);
      return { success: false, reason: error.message };
    }
  }, [drafts]);

  // ── Batches ──────────────────────────────────────────────────────────────────
  /**
   * Convert a SENT NominationDraft into a TrainingBatch (append-only).
   * Also creates NotificationRecords for each candidate.
   */
  const commitBatch = useCallback(async (draft: NominationDraft, employees: Employee[]) => {
    // 1. Create Training Batch
    const batchId = draft.id;
    const batch: TrainingBatch = {
      id:            batchId,
      trainingId:    batchId,
      draftId:       draft.id,
      source:        'NOTIFICATION',
      sourceDraftId: draft.id,
      trainingType:  draft.trainingType,
      team:          draft.team,
      teamId:        draft.teamId,
      trainer:       draft.trainer || '',
      startDate:     draft.startDate || '',
      endDate:       draft.endDate   || '',
      committedAt:   new Date().toISOString(),
      candidates:    draft.candidates.map(empId => ({
        empId,
        attendance: 'pending' as BatchAttStatus,
        score: '',
      })),
    };

    // 2. Create Notification Records
    const records: NotificationRecord[] = draft.candidates.map(empId => {
      const emp = employees.find(e => String(e.employeeId) === String(empId));
      return {
        id: `${empId}_${draft.trainingType}_${draft.startDate || new Date().toISOString().split('T')[0]}`,
        empId,
        aadhaarNumber: emp?.aadhaarNumber || '',
        mobileNumber: emp?.mobileNumber || '',
        trainerId: draft.trainer || '',
        team: draft.team,
        name: emp?.name || '',
        designation: emp?.designation || '',
        hq: emp?.hq || '',
        state: emp?.state || '',
        trainingType: draft.trainingType,
        notificationDate: draft.startDate || new Date().toISOString().split('T')[0],
        attended: false,
        finalStatus: 'Pending',
        trainingId: batchId,
        teamId: draft.teamId
      };
    });

    try {
      // Persist Batch
      await addBatch('training_batches', [batch]);
      
      // Persist Notification Records (Idempotent)
      await addBatch('notification_history', records);

      setBatches(prev => {
        if (prev.some(b => b.id === batch.id)) return prev;
        return [batch, ...prev];
      });

      setNotificationRecords(prev => {
        const next = [...prev];
        records.forEach(r => {
          if (!next.some(nr => nr.id === r.id)) next.push(r);
        });
        return next;
      });

    } catch (error) {
      console.error("Failed to commit batch and notifications", error);
      throw error;
    }
  }, []);

  /**
   * Inline edit of attendance / score for a single candidate row.
   * Also updates the corresponding NotificationRecord.
   */
  const updateBatchCandidate = useCallback(
    async (batchId: string, empId: string, update: Partial<CandidateRecord>) => {
      // Update Batch locally
      setBatches(prev =>
        prev.map(b =>
          b.id !== batchId ? b : {
            ...b,
            candidates: b.candidates.map(c =>
              c.empId === empId ? { ...c, ...update } : c
            ),
          }
        )
      );

      // Persist update to batch
      try {
        const batch = batches.find(b => b.id === batchId);
        if (batch) {
          const updatedCandidates = batch.candidates.map(c => 
            c.empId === empId ? { ...c, ...update } : c
          );
          await updateDocument('training_batches', batchId, { candidates: updatedCandidates });
        }

        // If attendance marked, update NotificationRecord
        if (update.attendance === 'present') {
          await updateByQuery('notification_history', 
            { empId, trainingId: batchId }, 
            { attended: true }
          );

          setNotificationRecords(prev => prev.map(r => 
            (r.empId === empId && r.trainingId === batchId) ? { ...r, attended: true } : r
          ));

          // Rule: Remove from Untrained (Handled by UI/Gap Engine naturally as attendance exists)
          // Rule: Block further nomination (Handled by Eligibility Engine)
        }
      } catch (error) {
        console.error("Failed to update candidate attendance", error);
      }
    },
    [batches]
  );

  /**
   * Filtered read-only view of batches (latest first already guaranteed by commitBatch).
   */
  const getBatches = useCallback(
    (filter?: { teamId?: string; trainingType?: string; month?: string }) => {
      const activeBatches = batches.filter(b => {
        if (b.source !== 'NOTIFICATION') return true;
        const draft = drafts.find(d => d.id === b.draftId || d.trainingId === b.trainingId);
        return draft ? !draft.isCancelled : true;
      });
      if (!filter) return activeBatches;
      return activeBatches.filter(b => {
        if (filter.teamId       && b.teamId       !== filter.teamId)       return false;
        if (filter.trainingType && b.trainingType !== filter.trainingType) return false;
        if (filter.month        && b.startDate.substring(0, 7) !== filter.month) return false;
        return true;
      });
    },
    [batches, drafts]
  );

  return (
    <PlanningFlowContext.Provider value={{
      selectionSession, setSelectionSession,
      consumedTeams, consumedTrainers, addConsumed, removeConsumed, resetConsumed,
      drafts, saveDraft, updateDraft, removeDraft, getDrafts, cancelDraft,
      batches, commitBatch, updateBatchCandidate, getBatches,
      notificationRecords, loadNotificationHistory
    }}>
      {children}
    </PlanningFlowContext.Provider>
  );
};

export const usePlanningFlow = () => {
  const context = useContext(PlanningFlowContext);
  if (context === undefined) {
    throw new Error('usePlanningFlow must be used within a PlanningFlowProvider');
  }
  return context;
};

