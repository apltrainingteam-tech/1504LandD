import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface SelectionSession {
  trainingType: string;
  fiscalYear: string;
  teams: string[]; // names for display
  teamIds: string[]; // actual IDs
}

export interface NominationDraft {
  id: string; // matches trainingId
  trainingId: string;
  trainingType: string;
  team: string; // display
  teamId: string; // stable
  trainer?: string; // trainer id
  startDate?: string;
  endDate?: string;
  status: 'DRAFT' | 'APPROVED' | 'SENT' | 'COMPLETED';
  candidates: string[]; // employeeIds
  // Audit trail
  approvedBy?: string;
  approvedAt?: string;
  sentBy?: string;
  sentAt?: string;
}

// ── Training Batch ────────────────────────────────────────────────────────────
// Created when a NominationDraft transitions to SENT. Immutable header;
// CandidateRecord rows are mutable (attendance, score updated in place).

export type BatchAttStatus = 'pending' | 'present' | 'absent';

export interface CandidateRecord {
  empId: string;
  attendance: BatchAttStatus;
  score: string; // '' until entered
}

export interface TrainingBatch {
  id: string;           // batchId = draftId at commit time
  draftId: string;
  source: 'NOTIFICATION' | 'UPLOAD'; // how this batch was created
  sourceDraftId?: string;            // draftId for NOTIFICATION, undefined for UPLOAD
  trainingType: string;
  team: string;
  teamId: string;
  trainer: string;      // trainer id / name
  startDate: string;
  endDate: string;
  committedAt: string;  // ISO timestamp when SENT
  candidates: CandidateRecord[];
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
  commitBatch: (draft: NominationDraft) => void;
  updateBatchCandidate: (batchId: string, empId: string, update: Partial<CandidateRecord>) => void;
  getBatches: (filter?: { teamId?: string; trainingType?: string; month?: string }) => TrainingBatch[];
}

const PlanningFlowContext = createContext<PlanningFlowContextType | undefined>(undefined);

export const PlanningFlowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectionSession, setSelectionSession] = useState<SelectionSession | null>(null);

  const [consumedTeams, setConsumedTeams]       = useState<Set<string>>(new Set());
  const [consumedTrainers, setConsumedTrainers] = useState<Set<string>>(new Set());
  const [drafts, setDrafts]                     = useState<NominationDraft[]>([]);
  const [batches, setBatches]                   = useState<TrainingBatch[]>([]);

  // ── Consumed ────────────────────────────────────────────────────────────────
  const addConsumed = (team: string, trainer: string) => {
    setConsumedTeams(prev => new Set(prev).add(team));
    setConsumedTrainers(prev => new Set(prev).add(trainer));
  };
  const removeConsumed = (team: string, trainer: string) => {
    setConsumedTeams(prev => { const n = new Set(prev); n.delete(team); return n; });
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
   * Skips silently if a batch with the same draftId already exists.
   */
  const commitBatch = useCallback((draft: NominationDraft) => {
    setBatches(prev => {
      if (prev.some(b => b.draftId === draft.id)) return prev; // idempotent
      const batch: TrainingBatch = {
        id:            draft.id,
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
      return [batch, ...prev];
    });
  }, []);

  /**
   * Inline edit of attendance / score for a single candidate row.
   */
  const updateBatchCandidate = useCallback(
    (batchId: string, empId: string, update: Partial<CandidateRecord>) => {
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
    },
    []
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
