import React from 'react';
import { Filter, Download, ShieldAlert } from 'lucide-react';
// TopRightControls is UI-only; active filter count should be provided by the page

interface TopRightControlsProps {
  fiscalOptions?: string[];
  selectedFY?: string;
  onChangeFY?: (fy: string) => void;
  onOpenGlobalFilters?: () => void;
  onExport?: () => void;
  onSwitchDefaulter?: () => void;
  activeFilterCount?: number;
  extraControls?: React.ReactNode;
}

export const TopRightControls: React.FC<TopRightControlsProps> = ({
  fiscalOptions = [],
  selectedFY,
  onChangeFY,
  onOpenGlobalFilters,
  onExport,
  onSwitchDefaulter,
  activeFilterCount = 0,
  extraControls
}) => {

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {fiscalOptions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>FISCAL YEAR</label>
          <select
            value={selectedFY}
            onChange={(e) => onChangeFY?.(e.target.value)}
            style={{ padding: '6px 12px', fontSize: 13, border: '1px solid var(--border-color)', borderRadius: 8, background: 'transparent' }}
          >
            {fiscalOptions.map(fy => <option key={fy} value={fy}>{fy}</option>)}
          </select>
        </div>
      )}

      {extraControls}

      {onSwitchDefaulter && (
        <button className="btn btn-secondary" onClick={() => onSwitchDefaulter()} title="View Defaulters">
          <ShieldAlert size={16} />
        </button>
      )}

      <button className="btn btn-secondary" onClick={() => onExport?.()} title="Export">
        <Download size={16} />
      </button>
    </div>
  );
};

export default TopRightControls;

