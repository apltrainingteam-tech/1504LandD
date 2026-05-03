import React from 'react';
import { Filter, Users, Calendar, GraduationCap } from 'lucide-react';
import { useGlobalFilters } from '../../core/context/GlobalFilterContext';
import { useMasterData } from '../../core/context/MasterDataContext';
import { FISCAL_YEARS } from '../../core/utils/fiscalYear';

const ALL_TRAINING_TYPES = ['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'PRE_AP'];

/**
 * GlobalFiltersBar
 * 🎯 PHASE 2 — UI Implementation
 * 
 * Objective: Create fixed, sticky header filters.
 * 
 * Rules:
 * - No data computation
 * - Only reads + updates context
 */

export const GlobalFiltersBar: React.FC = () => {
  const { filters, setFilters } = useGlobalFilters();
  const { trainers } = useMasterData();

  return (
    <div className="global-filters-bar glass-panel">
      <div className="filters-container">
        {/* Training Type Filter */}
        <div className="filter-item">
          <Filter size={14} className="filter-icon" />
          <select 
            value={filters.trainingType}
            onChange={(e) => setFilters({ trainingType: e.target.value })}
            className="filter-select"
            aria-label="Filter by Training Type"
          >
            <option value="ALL">All Training Types</option>
            {ALL_TRAINING_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="filter-divider" />

        {/* Trainer Filter */}
        <div className="filter-item">
          <GraduationCap size={14} className="filter-icon" />
          <select 
            value={filters.trainer}
            onChange={(e) => setFilters({ trainer: e.target.value })}
            className="filter-select"
            aria-label="Filter by Trainer"
          >
            <option value="ALL">All Trainers</option>
            {trainers.filter(t => t.status === 'Active').map(trainer => (
              <option key={trainer.id} value={trainer.id}>{trainer.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-divider" />

        {/* Fiscal Year Filter */}
        <div className="filter-item">
          <Calendar size={14} className="filter-icon" />
          <select 
            value={filters.fiscalYear}
            onChange={(e) => setFilters({ fiscalYear: e.target.value })}
            className="filter-select"
            aria-label="Filter by Fiscal Year"
          >
            {FISCAL_YEARS.map(fy => (
              <option key={fy} value={fy}>{fy}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
