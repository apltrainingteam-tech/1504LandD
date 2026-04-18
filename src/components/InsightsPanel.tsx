import React from 'react';
import { AlertCircle, TrendingDown, TrendingUp, CheckCircle } from 'lucide-react';
import { SRMInsight } from '../utils/srmInsights';

interface InsightsPanelProps {
  insights: SRMInsight[];
  className?: string;
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({ insights, className = '' }) => {
  if (insights.length === 0) {
    return (
      <div className={`glass-panel ${className}`} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No insights available
      </div>
    );
  }

  const getIcon = (type: string, severity: string) => {
    if (type === 'risk') return <AlertCircle size={18} />;
    if (type === 'trend' && severity === 'high') return <TrendingDown size={18} />;
    if (type === 'opportunity') return <TrendingUp size={18} />;
    return <CheckCircle size={18} />;
  };

  const getColor = (severity: string) => {
    if (severity === 'high') return 'var(--danger)';
    if (severity === 'medium') return 'var(--warning)';
    return 'var(--success)';
  };

  const getBgColor = (severity: string) => {
    if (severity === 'high') return 'rgba(239, 68, 68, 0.08)';
    if (severity === 'medium') return 'rgba(245, 158, 11, 0.08)';
    return 'rgba(16, 185, 129, 0.08)';
  };

  // Group by type
  const riskInsights = insights.filter(i => i.type === 'risk');
  const trendInsights = insights.filter(i => i.type === 'trend');
  const validationInsights = insights.filter(i => i.type === 'validation');
  const opportunityInsights = insights.filter(i => i.type === 'opportunity');

  return (
    <div className={`glass-panel ${className}`} style={{ padding: '24px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Key Insights</h3>

      {/* Risks */}
      {riskInsights.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            🚨 Risks ({riskInsights.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {riskInsights.map((insight, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  background: getBgColor(insight.severity),
                  border: `1px solid rgba(239, 68, 68, 0.3)`,
                  borderRadius: '6px',
                  display: 'flex',
                  gap: '12px'
                }}
              >
                <div style={{ color: getColor(insight.severity), flexShrink: 0, marginTop: '2px' }}>
                  {getIcon(insight.type, insight.severity)}
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {insight.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '6px' }}>
                    {insight.message}
                  </div>
                  {insight.action && (
                    <div style={{ fontSize: '11px', color: getColor(insight.severity), fontStyle: 'italic' }}>
                      → {insight.action}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trends */}
      {trendInsights.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            📊 Trends ({trendInsights.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {trendInsights.map((insight, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  background: getBgColor(insight.severity),
                  border: `1px solid rgba(245, 158, 11, 0.3)`,
                  borderRadius: '6px',
                  display: 'flex',
                  gap: '12px'
                }}
              >
                <div style={{ color: getColor(insight.severity), flexShrink: 0, marginTop: '2px' }}>
                  {getIcon(insight.type, insight.severity)}
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {insight.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '6px' }}>
                    {insight.message}
                  </div>
                  {insight.action && (
                    <div style={{ fontSize: '11px', color: getColor(insight.severity), fontStyle: 'italic' }}>
                      → {insight.action}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation */}
      {validationInsights.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            ✓ Validation ({validationInsights.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {validationInsights.map((insight, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  background: getBgColor(insight.severity),
                  border: `1px solid rgba(59, 130, 246, 0.3)`,
                  borderRadius: '6px',
                  display: 'flex',
                  gap: '12px'
                }}
              >
                <div style={{ color: getColor(insight.severity), flexShrink: 0, marginTop: '2px' }}>
                  {getIcon(insight.type, insight.severity)}
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {insight.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '6px' }}>
                    {insight.message}
                  </div>
                  {insight.action && (
                    <div style={{ fontSize: '11px', color: getColor(insight.severity), fontStyle: 'italic' }}>
                      → {insight.action}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opportunities */}
      {opportunityInsights.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            ⭐ Opportunities ({opportunityInsights.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {opportunityInsights.map((insight, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  background: getBgColor(insight.severity),
                  border: `1px solid rgba(16, 185, 129, 0.3)`,
                  borderRadius: '6px',
                  display: 'flex',
                  gap: '12px'
                }}
              >
                <div style={{ color: getColor(insight.severity), flexShrink: 0, marginTop: '2px' }}>
                  {getIcon(insight.type, insight.severity)}
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {insight.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '6px' }}>
                    {insight.message}
                  </div>
                  {insight.action && (
                    <div style={{ fontSize: '11px', color: getColor(insight.severity), fontStyle: 'italic' }}>
                      → {insight.action}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
