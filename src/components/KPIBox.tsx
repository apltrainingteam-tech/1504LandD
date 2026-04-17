import React, { memo } from 'react';
import { LucideIcon } from 'lucide-react';

interface KPIBoxProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  color?: string;
  subValue?: string;
  badge?: React.ReactNode;
}

export const KPIBox: React.FC<KPIBoxProps> = memo(({ 
  title, 
  value, 
  icon: Icon, 
  color = 'var(--accent-primary)',
  subValue,
  badge
}) => {
  return (
    <div className="glass-panel stat-card">
      <div className="stat-header">
        <div className="stat-title">{title}</div>
        {Icon && (
          <div style={{ 
            padding: '8px', 
            borderRadius: '10px', 
            background: `${color}15`, 
            color: color 
          }}>
            <Icon size={18} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="stat-value">{value}</div>
          {subValue && <div className="text-muted" style={{ fontSize: '13px', marginTop: '4px' }}>{subValue}</div>}
        </div>
        {badge}
      </div>
    </div>
  );
});


