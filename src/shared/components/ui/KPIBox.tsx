import React, { memo } from 'react';
import { LucideIcon } from 'lucide-react';
import { formatDisplayText } from '../../../core/engines/normalizationEngine';

interface KPIBoxProps {
  title: string;
  value: string | number | React.ReactNode;
  icon?: LucideIcon;
  color?: string;
  subValue?: string | React.ReactNode;
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
    <div className="stat-card" style={{ height: '100%' }}>
      {/* TOP: Small Muted Label */}
      <div className="stat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stat-title" style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>{title}</div>
        {Icon && (
          <div style={{ color: color, opacity: 0.7 }}>
            <Icon size={20} strokeWidth={2} />
          </div>
        )}
      </div>

      {/* MIDDLE: Primary KPI */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div className="stat-value" style={{ fontSize: '38px', fontWeight: 600, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
      </div>

      {/* BOTTOM: Supporting Metrics */}
      {(subValue || badge) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
          {subValue && <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>{subValue}</div>}
          {badge && <div>{badge}</div>}
        </div>
      )}
    </div>
  );
});

interface KPISplitCardProps {
  title: string;
  leftLabel: string;
  leftValue: string | number | React.ReactNode;
  leftSubValue?: string | React.ReactNode;
  rightLabel: string;
  rightValue: string | number | React.ReactNode;
  rightSubValue?: string | React.ReactNode;
  icon?: LucideIcon;
  color?: string;
}

export const KPISplitCard: React.FC<KPISplitCardProps> = memo(({
  title,
  leftLabel,
  leftValue,
  leftSubValue,
  rightLabel,
  rightValue,
  rightSubValue,
  icon: Icon,
  color = 'var(--accent-primary)'
}) => {
  return (
    <div className="stat-card" style={{ height: '100%', padding: '24px 0', display: 'flex', flexDirection: 'column' }}>
      {/* TOP HEADER */}
      <div style={{ padding: '0 24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="stat-title" style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>{title}</div>
        {Icon && <div style={{ color: color, opacity: 0.7 }}><Icon size={20} strokeWidth={2} /></div>}
      </div>

      {/* SPLIT BODY */}
      <div style={{ display: 'flex', flex: 1, alignItems: 'stretch' }}>
        {/* LEFT HALF */}
        <div style={{ flex: 1, padding: '0 24px', borderRight: '1px solid rgba(15, 23, 42, 0.08)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{formatDisplayText(leftLabel)}</div>
          <div className="stat-value" style={{ fontSize: typeof leftValue === 'object' ? 'inherit' : '28px', fontWeight: 600, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{leftValue}</div>
          {leftSubValue && <div style={{ marginTop: 'auto', paddingTop: '16px' }}>{leftSubValue}</div>}
        </div>

        {/* RIGHT HALF */}
        <div style={{ flex: 1, padding: '0 24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{formatDisplayText(rightLabel)}</div>
          <div className="stat-value" style={{ fontSize: typeof rightValue === 'object' ? 'inherit' : '28px', fontWeight: 600, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{rightValue}</div>
          {rightSubValue && <div style={{ marginTop: 'auto', paddingTop: '16px' }}>{rightSubValue}</div>}
        </div>
      </div>
    </div>
  );
});
