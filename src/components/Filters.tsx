import React from 'react';

interface FiltersProps {
  options: string[];
  activeOption: string;
  onChange: (opt: string) => void;
  viewByOptions?: string[];
  activeViewBy?: string;
  onViewByChange?: (opt: string) => void;
  title?: string;
}

export const Filters: React.FC<FiltersProps> = ({ 
  options, 
  activeOption, 
  onChange,
  viewByOptions,
  activeViewBy,
  onViewByChange,
  title
}) => {
  return (
    <div className="flex-between mb-6" style={{ background: 'var(--bg-card)', padding: '16px 24px', borderRadius: '16px' }}>
      <div className="flex-center" style={{ gap: '8px' }}>
        {options.map(opt => (
          <button 
            key={opt} 
            className={`btn ${activeOption === opt ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onChange(opt)}
            style={{ padding: '8px 20px', fontSize: '14px' }}
          >
            {opt}
          </button>
        ))}
      </div>

      {viewByOptions && (
        <div className="flex-center">
          <span className="text-muted" style={{ fontSize: '13px', fontWeight: '500' }}>View By:</span>
          <select 
            className="form-select" 
            style={{ width: 'auto', padding: '6px 36px 6px 16px', fontSize: '13px' }}
            value={activeViewBy}
            onChange={(e) => onViewByChange?.(e.target.value)}
          >
            {viewByOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      )}
    </div>
  );
};
