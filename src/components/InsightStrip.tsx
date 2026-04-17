import React from 'react';
import { AlertCircle, TrendingUp, CheckCircle2 } from 'lucide-react';

interface InsightStripProps {
  text: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  icon?: 'alert' | 'trending' | 'check' | 'none';
}

export const InsightStrip: React.FC<InsightStripProps> = ({ 
  text, 
  variant = 'primary',
  icon = 'trending'
}) => {
  const getIcon = () => {
    switch (icon) {
      case 'alert':
        return <AlertCircle size={16} />;
      case 'check':
        return <CheckCircle2 size={16} />;
      case 'trending':
        return <TrendingUp size={16} />;
      default:
        return null;
    }
  };

  const variantMap = {
    primary: 'insight-layer',
    success: 'insight-layer success',
    warning: 'insight-layer warning',
    danger: 'insight-layer danger'
  };

  return (
    <div className={variantMap[variant]} style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
      {icon !== 'none' && (
        <div style={{ marginTop: '2px', flexShrink: 0, opacity: 0.8 }}>
          {getIcon()}
        </div>
      )}
      <div style={{ flex: 1, lineHeight: '1.5' }}>
        {text}
      </div>
    </div>
  );
};
