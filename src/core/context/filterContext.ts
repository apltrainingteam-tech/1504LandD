import { createContext, useContext } from 'react';

export interface GlobalFilters {
  // Legacy single-select (deprecate)
  cluster: string;
  team: string;
  trainer: string;
  month: string;
  
  // New Array-based Multi-Select
  clusters: string[];
  teams: string[];
  trainers: string[];
  trainerTypes: string[];
}

export interface FilterContextType {
  filters: GlobalFilters;
  setFilters: (filters: GlobalFilters) => void;
  activeFilterCount: number;
  clearFilters: () => void;
}

export const INITIAL_FILTERS: GlobalFilters = {
  cluster: '',
  team: '',
  trainer: '',
  month: '',
  clusters: [],
  teams: [],
  trainers: [],
  trainerTypes: [],
};

export const FilterContext = createContext<FilterContextType>({
  filters: INITIAL_FILTERS,
  setFilters: () => {},
  activeFilterCount: 0,
  clearFilters: () => {},
});

export const useGlobalFilters = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useGlobalFilters must be used within FilterProvider');
  }
  return context;
};

export const getActiveFilterCount = (filters: GlobalFilters): number => {
  if (!filters) return 0;
  let count = 0;
  if (filters.cluster) count++;
  if (filters.team) count++;
  if (filters.trainer) count++;
  if (filters.month) count++;
  if (filters.clusters?.length > 0) count += filters.clusters.length;
  if (filters.teams?.length > 0) count += filters.teams.length;
  if (filters.trainers?.length > 0) count += filters.trainers.length;
  if (filters.trainerTypes?.length > 0) count += filters.trainerTypes.length;
  return count;
};

