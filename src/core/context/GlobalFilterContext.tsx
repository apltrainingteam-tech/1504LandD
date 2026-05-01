import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { getCurrentFYString } from '../utils/fiscalYear';

/**
 * Global Filter System
 * 🎯 PHASE 1 — Foundation
 * 
 * Objective: Establish a single source of truth for global filters.
 * 
 * Rules:
 * - Must use useContext
 * - Must NOT contain business logic
 * - Must NOT import any engine
 */

export type GlobalFilterState = {
  trainingType: string;   // "ALL" | "IP" | "AP" | etc.
  trainer: string;        // "ALL" | trainerId
  fiscalYear: string;     // "YYYY-YY"
};

type GlobalFilterContextType = {
  filters: GlobalFilterState;
  setFilters: (updates: Partial<GlobalFilterState>) => void;
};

const GlobalFilterContext = createContext<GlobalFilterContextType | undefined>(undefined);

export const GlobalFilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [filters, setFiltersInternal] = useState<GlobalFilterState>({
    trainingType: "ALL",
    trainer: "ALL",
    fiscalYear: getCurrentFYString(),
  });

  const setFilters = useCallback((updates: Partial<GlobalFilterState>) => {
    setFiltersInternal(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  return (
    <GlobalFilterContext.Provider value={{ filters, setFilters }}>
      {children}
    </GlobalFilterContext.Provider>
  );
};

export const useGlobalFilters = () => {
  const context = useContext(GlobalFilterContext);
  if (context === undefined) {
    throw new Error('useGlobalFilters must be used within a GlobalFilterProvider');
  }
  return context;
};
