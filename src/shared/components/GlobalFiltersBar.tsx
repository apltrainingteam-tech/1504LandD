import React from 'react';
import { Filter, Users, Calendar, GraduationCap, ChevronDown, ChevronUp, User } from 'lucide-react';
import { useGlobalFilters } from '../../core/context/GlobalFilterContext';
import { useMasterData } from '../../core/context/MasterDataContext';
import { FISCAL_YEARS } from '../../core/utils/fiscalYear';
import TrainerAvatar from './ui/TrainerAvatar';
import { useState } from 'react';

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
  const [isTrainerDropdownOpen, setIsTrainerDropdownOpen] = useState(false);

  const selectedTrainer = trainers.find(t => t.id === filters.trainer);

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

        {/* Trainer Filter - Custom Dropdown */}
        <div className="filter-item relative">
          <button 
            className="filter-trigger"
            onClick={() => setIsTrainerDropdownOpen(!isTrainerDropdownOpen)}
          >
            <div className="flex items-center gap-2">
              {selectedTrainer ? (
                <TrainerAvatar trainer={selectedTrainer} size={20} />
              ) : (
                <GraduationCap size={14} className="filter-icon" />
              )}
              <span className="filter-text">
                {selectedTrainer ? selectedTrainer.name : 'All Trainers'}
              </span>
            </div>
            {isTrainerDropdownOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {isTrainerDropdownOpen && (
            <div className="bar-dropdown-menu">
              <button 
                className={`bar-dropdown-item ${filters.trainer === 'ALL' ? 'active' : ''}`}
                onClick={() => {
                  setFilters({ trainer: 'ALL' });
                  setIsTrainerDropdownOpen(false);
                }}
              >
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <User size={12} />
                </div>
                <span>All Trainers</span>
              </button>

              {trainers.filter(t => t.status === 'Active').map(trainer => (
                <button 
                  key={trainer.id}
                  className={`bar-dropdown-item ${filters.trainer === trainer.id ? 'active' : ''}`}
                  onClick={() => {
                    setFilters({ trainer: trainer.id });
                    setIsTrainerDropdownOpen(false);
                  }}
                >
                  <TrainerAvatar trainer={trainer} size={24} />
                  <span>{trainer.name}</span>
                </button>
              ))}
            </div>
          )}
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
