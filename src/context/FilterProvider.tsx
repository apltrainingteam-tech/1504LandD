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
  });

  const activeFilterCount = getActiveFilterCount(filters);

  const clearFilters = () => {
    setFilters({
      cluster: '',
      team: '',
      trainer: '',
      month: '',
    });
  };

  return (
    <FilterContext.Provider value={{ filters, setFilters, activeFilterCount, clearFilters }}>
      {children}
    </FilterContext.Provider>
  );
};
