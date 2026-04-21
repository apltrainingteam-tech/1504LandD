import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface SelectionSession {
  trainingType: string;
  fiscalYear: string;
  teams: string[];
}

export interface NominationDraft {
  id: string; // matches trainingId
  trainingId: string;
  trainingType: string;
  team: string;
  trainer: string;
  startDate: string;
  endDate: string;
  status: 'Draft' | 'Finalized';
  selectedEmployees: string[]; // employeeIds
}

interface PlanningFlowContextType {
  selectionSession: SelectionSession | null;
  setSelectionSession: (session: SelectionSession | null) => void;
  
  consumedTeams: Set<string>;
  consumedTrainers: Set<string>;
  addConsumed: (team: string, trainer: string) => void;
  removeConsumed: (team: string, trainer: string) => void;
  resetConsumed: () => void;
  
  draftNominations: NominationDraft[];
  addDraftNomination: (draft: NominationDraft) => void;
  updateDraftNomination: (id: string, updates: Partial<NominationDraft>) => void;
  removeDraftNomination: (id: string) => void;
}

const PlanningFlowContext = createContext<PlanningFlowContextType | undefined>(undefined);

export const PlanningFlowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectionSession, setSelectionSession] = useState<SelectionSession | null>(null);
  
  const [consumedTeams, setConsumedTeams] = useState<Set<string>>(new Set());
  const [consumedTrainers, setConsumedTrainers] = useState<Set<string>>(new Set());
  const [draftNominations, setDraftNominations] = useState<NominationDraft[]>([]);

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

  const addDraftNomination = (draft: NominationDraft) => {
    setDraftNominations(prev => [...prev, draft]);
  };

  const updateDraftNomination = (id: string, updates: Partial<NominationDraft>) => {
    setDraftNominations(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  };

  const removeDraftNomination = (id: string) => {
    setDraftNominations(prev => prev.filter(d => d.id !== id));
  };

  return (
    <PlanningFlowContext.Provider value={{
      selectionSession, setSelectionSession,
      consumedTeams, consumedTrainers, addConsumed, removeConsumed, resetConsumed,
      draftNominations, addDraftNomination, updateDraftNomination, removeDraftNomination
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
