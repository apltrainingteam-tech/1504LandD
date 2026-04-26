import React from 'react';
import { AlertCircle, TrendingDown, TrendingUp, CheckCircle } from 'lucide-react';
import { SRMInsight } from '../../../core/utils/srmInsights';
import styles from './InsightsPanel.module.css';

interface InsightsPanelProps {
  insights: SRMInsight[];
  className?: string;
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({ insights, className = '' }) => {
  if (insights.length === 0) {
    return (
      <div className={`glass-panel ${styles.empty} ${className}`}>
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

  const iconClass = (severity: string) =>
    severity === 'high' ? styles.iconHigh : severity === 'medium' ? styles.iconMedium : styles.iconLow;

  const actionClass = (severity: string) =>
    severity === 'high' ? styles.actionHigh : severity === 'medium' ? styles.actionMedium : styles.actionLow;

  const renderInsightList = (list: SRMInsight[], cardVariant: string) => (
    <div className={styles.list}>
      {list.map((insight, idx) => (
        <div key={idx} className={`${styles.card} ${cardVariant}`}>
          <div className={`${styles.iconWrap} ${iconClass(insight.severity)}`}>
            {getIcon(insight.type, insight.severity)}
          </div>
          <div className={styles.cardBody}>
            <div className={styles.cardTitle}>{insight.title}</div>
            <div className={styles.cardMessage}>{insight.message}</div>
            {insight.action && (
              <div className={`${styles.cardAction} ${actionClass(insight.severity)}`}>
                → {insight.action}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  // Group by type
  const riskInsights        = insights.filter(i => i.type === 'risk');
  const trendInsights       = insights.filter(i => i.type === 'trend');
  const validationInsights  = insights.filter(i => i.type === 'validation');
  const opportunityInsights = insights.filter(i => i.type === 'opportunity');

  return (
    <div className={`glass-panel ${styles.panel} ${className}`}>
      <h3 className={styles.title}>Key Insights</h3>

      {riskInsights.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>🚨 Risks ({riskInsights.length})</div>
          {renderInsightList(riskInsights, styles.cardRisk)}
        </div>
      )}

      {trendInsights.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>📊 Trends ({trendInsights.length})</div>
          {renderInsightList(trendInsights, styles.cardTrend)}
        </div>
      )}

      {validationInsights.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>✓ Validation ({validationInsights.length})</div>
          {renderInsightList(validationInsights, styles.cardValidation)}
        </div>
      )}

      {opportunityInsights.length > 0 && (
        <div className={styles.sectionLast}>
          <div className={styles.sectionLabel}>⭐ Opportunities ({opportunityInsights.length})</div>
          {renderInsightList(opportunityInsights, styles.cardOpportunity)}
        </div>
      )}
    </div>
  );
};
