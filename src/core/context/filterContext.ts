import { createContext, useContext } from 'react';

export interface GlobalFilters {
  cluster: string;
  team: string;
  trainer: string;
  month: string;
}

export interface FilterContextType {
  filters: GlobalFilters;
  setFilters: (filters: GlobalFilters) => void;
  activeFilterCount: number;
  clearFilters: () => void;
}

const defaultFilters: GlobalFilters = {
  cluster: '',
  team: '',
  trainer: '',
  month: '',
};

export const FilterContext = createContext<FilterContextType>({
  filters: defaultFilters,
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
  return Object.values(filters).filter(value => value && value.length > 0).length;
};

