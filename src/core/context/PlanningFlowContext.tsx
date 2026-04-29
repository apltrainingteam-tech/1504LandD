import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Employee } from '../../types/employee';
import { TrainingNomination, NotificationRecord, NominationDraft, TrainingBatch, CandidateRecord, BatchAttStatus } from '../../types/attendance';
import { addBatch, findByQuery, updateByQuery, getCollection, updateDocument } from '../engines/apiClient';

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
  getDrafts: (filter: { teamIds?: string[] }) => NominationDraft[];

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

  // ─── Notification History ──────────────────────────────────────────────────
  const loadNotificationHistory = useCallback(async () => {
    try {
      const data = await getCollection('notification_history');
      setNotificationRecords(data);
      return data;
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
    setDrafts(prev => [...prev, draft]);
  };
  const updateDraft = (id: string, updates: Partial<NominationDraft>) => {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  };
  const removeDraft = (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id));
  };
  const getDrafts = (filter: { teamIds?: string[] }) => {
    const valid = drafts.filter(d => Boolean(d.teamId));
    if (!filter.teamIds || filter.teamIds.length === 0) return valid;
    return valid.filter(d => filter.teamIds!.includes(d.teamId));
  };

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
      if (!filter) return batches;
      return batches.filter(b => {
        if (filter.teamId       && b.teamId       !== filter.teamId)       return false;
        if (filter.trainingType && b.trainingType !== filter.trainingType) return false;
        if (filter.month        && b.startDate.substring(0, 7) !== filter.month) return false;
        return true;
      });
    },
    [batches]
  );

  return (
    <PlanningFlowContext.Provider value={{
      selectionSession, setSelectionSession,
      consumedTeams, consumedTrainers, addConsumed, removeConsumed, resetConsumed,
      drafts, saveDraft, updateDraft, removeDraft, getDrafts,
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

