import React from 'react';
import { useGlobalFilters } from '../../../core/context/GlobalFilterContext';
import { useMasterData } from '../../../core/context/MasterDataContext';
import { Bookmark, Layout } from 'lucide-react';

export const ActiveContextBadge: React.FC = () => {
  const { filters } = useGlobalFilters();
  const { trainers } = useMasterData();

  // Resolve Trainer Name
  const trainerName = filters.trainer === 'ALL' 
    ? 'All Trainers' 
    : (trainers.find(t => t.id === filters.trainer)?.name || filters.trainer);

  // Resolve Training Type
  const trainingTypeStr = filters.trainingType === 'ALL'
    ? 'All Trainings'
    : filters.trainingType;

  return (
    <div 
      className="active-context-badge glass-panel" 
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '12px', 
        padding: '6px 14px', 
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--text-primary)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        border: '1px solid var(--border-color)',
        whiteSpace: 'nowrap'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)' }}>
        <Layout size={14} />
        <span>{trainingTypeStr}</span>
      </div>
      <div style={{ width: '1px', height: '14px', background: 'var(--border-color)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>FY {filters.fiscalYear}</span>
      </div>
      <div style={{ width: '1px', height: '14px', background: 'var(--border-color)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
        <Bookmark size={14} />
        <span>Trainer: {trainerName}</span>
      </div>
    </div>
  );
};
