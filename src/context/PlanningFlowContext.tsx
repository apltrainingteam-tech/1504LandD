import React, { createContext, useContext, useState, ReactNode } from 'react';

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
}

const PlanningFlowContext = createContext<PlanningFlowContextType | undefined>(undefined);

export const PlanningFlowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectionSession, setSelectionSession] = useState<SelectionSession | null>(null);
  
  const [consumedTeams, setConsumedTeams] = useState<Set<string>>(new Set());
  const [consumedTrainers, setConsumedTrainers] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<NominationDraft[]>([]);

  const addConsumed = (team: string, trainer: string) => {
    setConsumedTeams(prev => new Set(prev).add(team));
    setConsumedTrainers(prev => new Set(prev).add(trainer));
  };

  const removeConsumed = (team: string, trainer: string) => {
    setConsumedTeams(prev => {
      const next = new Set(prev);
      next.delete(team);
      return next;
    });
    setConsumedTrainers(prev => {
      const next = new Set(prev);
      next.delete(trainer);
      return next;
    });
  };

  const resetConsumed = () => {
    setConsumedTeams(new Set());
    setConsumedTrainers(new Set());
    setSelectionSession(null);
  };

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
    const validDrafts = drafts.filter(d => Boolean(d.teamId));
    if (!filter.teamIds || filter.teamIds.length === 0) return validDrafts;
    return validDrafts.filter(d => filter.teamIds!.includes(d.teamId));
  };

  return (
    <PlanningFlowContext.Provider value={{
      selectionSession, setSelectionSession,
      consumedTeams, consumedTrainers, addConsumed, removeConsumed, resetConsumed,
      drafts, saveDraft, updateDraft, removeDraft, getDrafts
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
