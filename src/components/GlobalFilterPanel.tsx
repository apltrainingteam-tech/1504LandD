import React, { useState } from 'react';
import { X } from 'lucide-react';
import { GlobalFilters } from '../context/filterContext';

interface GlobalFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: GlobalFilters) => void;
  initialFilters: GlobalFilters;
  clusterOptions: string[];
  teamOptions: string[];
  trainerOptions: string[];
  monthOptions: string[];
  onClearAll: () => void;
}

export const GlobalFilterPanel: React.FC<GlobalFilterPanelProps> = ({
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

  const handleInputChange = (key: keyof GlobalFilters, value: string) => {
    setTempFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    onApply(tempFilters);
    onClose();
  };

  const handleClearAll = () => {
    const cleared = { cluster: '', team: '', trainer: '', month: '' };
    setTempFilters(cleared);
    onClearAll();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={onClose}
      />

      {/* Filter Panel */}
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: '360px',
          background: 'var(--bg-main)',
          borderLeft: '1px solid var(--border-color)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Filters</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter Fields */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Cluster Filter */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                marginBottom: '8px',
                letterSpacing: '0.5px',
              }}
            >
              Cluster
            </label>
            <select
              value={tempFilters.cluster}
              onChange={(e) => handleInputChange('cluster', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              <option value="">All Clusters</option>
              {clusterOptions.map((cluster) => (
                <option key={cluster} value={cluster}>
                  {cluster}
                </option>
              ))}
            </select>
          </div>

          {/* Team Filter */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                marginBottom: '8px',
                letterSpacing: '0.5px',
              }}
            >
              Team
            </label>
            <select
              value={tempFilters.team}
              onChange={(e) => handleInputChange('team', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              <option value="">All Teams</option>
              {teamOptions.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>

          {/* Trainer Filter */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                marginBottom: '8px',
                letterSpacing: '0.5px',
              }}
            >
              Trainer
            </label>
            <select
              value={tempFilters.trainer}
              onChange={(e) => handleInputChange('trainer', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              <option value="">All Trainers</option>
              {trainerOptions.map((trainer) => (
                <option key={trainer} value={trainer}>
                  {trainer}
                </option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                marginBottom: '8px',
                letterSpacing: '0.5px',
              }}
            >
              Month
            </label>
            <select
              value={tempFilters.month}
              onChange={(e) => handleInputChange('month', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              <option value="">All Months</option>
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer Buttons */}
        <div
          style={{
            padding: '20px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            gap: '12px',
          }}
        >
          <button
            onClick={handleClearAll}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Clear All
          </button>
          <button
            onClick={handleApply}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: 'var(--accent-primary)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Apply
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
};
