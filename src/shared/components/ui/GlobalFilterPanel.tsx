import React, { useState, useCallback, memo } from 'react';
import { X, ChevronDown, ChevronUp, User } from 'lucide-react';
import { GlobalFilters, INITIAL_FILTERS } from '../../../core/context/filterContext';
import TrainerAvatar from './TrainerAvatar';
import styles from './GlobalFilterPanel.module.css';

import { sortClusters, formatDisplayText } from '../../../core/engines/normalizationEngine';

interface GlobalFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: GlobalFilters) => void;
  initialFilters: GlobalFilters;
  clusterOptions: string[];
  teamOptions: { id: string, label: string }[];
  trainerOptions: { id: string, label: string, avatarUrl?: string | null }[];
  monthOptions: string[];
  onClearAll: () => void;
}

export const GlobalFilterPanel: React.FC<GlobalFilterPanelProps> = memo(({
  isOpen,
  onClose,
  onApply,
  initialFilters,
  clusterOptions,
  teamOptions,
  trainerOptions,
  monthOptions,
  onClearAll,
}) => {
  const [tempFilters, setTempFilters] = useState<GlobalFilters>(initialFilters);
  const [isTrainerDropdownOpen, setIsTrainerDropdownOpen] = useState(false);

  const handleInputChange = useCallback((key: keyof GlobalFilters, value: string) => {
    setTempFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleApply = useCallback(() => {
    onApply(tempFilters);
    onClose();
  }, [tempFilters, onApply, onClose]);

  const handleClearAll = useCallback(() => {
    setTempFilters(INITIAL_FILTERS);
    onClearAll();
    onClose();
  }, [onClearAll, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={styles.backdrop}
        onClick={onClose}
      />

      {/* Filter Panel */}
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Filters</h2>
          <button
            onClick={onClose}
            title="Close Filters"
            aria-label="Close Filters"
            className={styles.closeButton}
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter Fields */}
        <div className={styles.filterFields}>
          {/* Cluster Filter */}
          <div>
            <label htmlFor="global-filter-cluster" className={styles.label}>
              Cluster
            </label>
            <select
              id="global-filter-cluster"
              name="cluster"
              value={tempFilters.cluster}
              onChange={(e) => handleInputChange('cluster', e.target.value)}
              title="Select Cluster"
              aria-label="Select Cluster"
              className={`form-select ${styles.select}`}
            >
              <option value="" className={styles.option}>All Clusters</option>
              {sortClusters(clusterOptions).map((cluster) => (
                <option key={cluster} value={cluster} className={styles.option}>
                  {formatDisplayText(cluster)}
                </option>
              ))}
            </select>
          </div>

          {/* Team Filter */}
          <div>
            <label htmlFor="global-filter-team" className={styles.label}>
              Team
            </label>
            <select
              id="global-filter-team"
              name="team"
              value={tempFilters.team}
              onChange={(e) => handleInputChange('team', e.target.value)}
              title="Select Team"
              aria-label="Select Team"
              className={`form-select ${styles.select}`}
            >
              <option value="" className={styles.option}>All Teams</option>
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id} className={styles.option}>
                  {formatDisplayText(team.label)}
                </option>
              ))}
            </select>
          </div>

          {/* Trainer Filter - Custom Dropdown */}
          <div>
            <label className={styles.label}>
              Trainer
            </label>
            <div className={styles.customSelect}>
              <button 
                className={styles.dropdownTrigger}
                onClick={() => setIsTrainerDropdownOpen(!isTrainerDropdownOpen)}
                type="button"
              >
                <div className="flex items-center gap-3">
                  {tempFilters.trainer ? (
                    <TrainerAvatar 
                      trainer={{
                        id: tempFilters.trainer,
                        name: trainerOptions.find(t => t.id === tempFilters.trainer)?.label.split(' (')[0] || tempFilters.trainer,
                        avatarUrl: trainerOptions.find(t => t.id === tempFilters.trainer)?.avatarUrl
                      }}
                      size={24}
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <User size={14} />
                    </div>
                  )}
                  <span className="font-medium">
                    {tempFilters.trainer 
                      ? trainerOptions.find(t => t.id === tempFilters.trainer)?.label 
                      : 'All Trainers'}
                  </span>
                </div>
                {isTrainerDropdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {isTrainerDropdownOpen && (
                <div className={styles.dropdownMenu}>
                  <button 
                    className={`${styles.dropdownItem} ${!tempFilters.trainer ? styles.dropdownItemActive : ''}`}
                    onClick={() => {
                      handleInputChange('trainer', '');
                      setIsTrainerDropdownOpen(false);
                    }}
                  >
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <User size={16} />
                    </div>
                    <span className={styles.trainerName}>All Trainers</span>
                  </button>

                  {trainerOptions.map((trainer) => (
                    <button 
                      key={trainer.id}
                      className={`${styles.dropdownItem} ${tempFilters.trainer === trainer.id ? styles.dropdownItemActive : ''}`}
                      onClick={() => {
                        handleInputChange('trainer', trainer.id);
                        setIsTrainerDropdownOpen(false);
                      }}
                    >
                      <TrainerAvatar 
                        trainer={{
                          id: trainer.id,
                          name: trainer.label.split(' (')[0],
                          avatarUrl: trainer.avatarUrl
                        }}
                        size={28}
                      />
                      <div className="flex flex-col">
                        <span className={styles.trainerName}>{trainer.label.split(' (')[0]}</span>
                        {trainer.label.includes('(') && (
                          <span className={styles.trainerRole}>{trainer.label.match(/\(([^)]+)\)/)?.[1]}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Month Filter */}
          <div>
            <label htmlFor="global-filter-month" className={styles.label}>
              Month
            </label>
            <select
              id="global-filter-month"
              name="month"
              value={tempFilters.month}
              onChange={(e) => handleInputChange('month', e.target.value)}
              title="Select Month"
              aria-label="Select Month"
              className={`form-select ${styles.select}`}
            >
              <option value="" className={styles.option}>All Months</option>
              {monthOptions.map((month) => (
                <option key={month} value={month} className={styles.option}>
                  {month}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className={styles.footer}>
          <button
            onClick={handleClearAll}
            className={styles.clearBtn}
          >
            Clear All
          </button>
          <button
            onClick={handleApply}
            className={styles.applyBtn}
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
});






