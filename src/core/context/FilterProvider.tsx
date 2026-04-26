import React, { useState, ReactNode } from 'react';
import { FilterContext, GlobalFilters, getActiveFilterCount } from './filterContext';

interface FilterProviderProps {
  children: ReactNode;
}

export const FilterProvider: React.FC<FilterProviderProps> = ({ children }) => {
  const [filters, setFilters] = useState<GlobalFilters>({
    cluster: '',
    team: '',
    trainer: '',
    month: '',
    clusters: [],
    teams: [],
    trainers: [],
    trainerTypes: [],
  });

  const activeFilterCount = getActiveFilterCount(filters);

  const clearFilters = () => {
    setFilters({
      cluster: '',
      team: '',
      trainer: '',
      month: '',
      clusters: [],
      teams: [],
      trainers: [],
      trainerTypes: [],
    });
  };

  return (
    <FilterContext.Provider value={{ filters, setFilters, activeFilterCount, clearFilters }}>
      {children}
    </FilterContext.Provider>
  );
};

