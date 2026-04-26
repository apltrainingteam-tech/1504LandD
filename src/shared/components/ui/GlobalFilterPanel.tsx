import React, { useState, useCallback, memo } from 'react';
import { X } from 'lucide-react';
import { GlobalFilters } from '../../../core/context/filterContext';
import styles from './GlobalFilterPanel.module.css';

interface GlobalFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: GlobalFilters) => void;
  initialFilters: GlobalFilters;
  clusterOptions: string[];
  teamOptions: { id: string, label: string }[];
  trainerOptions: { id: string, label: string }[];
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

  const handleInputChange = useCallback((key: keyof GlobalFilters, value: string) => {
    setTempFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleApply = useCallback(() => {
    onApply(tempFilters);
    onClose();
  }, [tempFilters, onApply, onClose]);

  const handleClearAll = useCallback(() => {
    const cleared = { cluster: '', team: '', trainer: '', month: '' };
    setTempFilters(cleared);
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
              {clusterOptions.map((cluster) => (
                <option key={cluster} value={cluster} className={styles.option}>
                  {cluster}
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
                  {team.label}
                </option>
              ))}
            </select>
          </div>

          {/* Trainer Filter */}
          <div>
            <label htmlFor="global-filter-trainer" className={styles.label}>
              Trainer
            </label>
            <select
              id="global-filter-trainer"
              name="trainer"
              value={tempFilters.trainer}
              onChange={(e) => handleInputChange('trainer', e.target.value)}
              title="Select Trainer"
              aria-label="Select Trainer"
              className={`form-select ${styles.select}`}
            >
              <option value="" className={styles.option}>All Trainers</option>
              {trainerOptions.map((trainer) => (
                <option key={trainer.id} value={trainer.id} className={styles.option}>
                  {trainer.label}
                </option>
              ))}
            </select>
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






