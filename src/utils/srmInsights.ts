/**
 * SRM Insights Engine
 * 
 * Generates actionable insights based on:
 * - IP Distribution
 * - TS Effectiveness
 * - Trend Analysis
 */

export interface SRMInsight {
  type: 'risk' | 'trend' | 'validation' | 'opportunity';
  severity: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  action?: string;
}

/**
 * Diagnosis engine for overall hiring quality
 */
export function getDiagnosis(
  avgTS: number,
  below75Percent: number,
  above90Percent: number
): string {
  if (above90Percent > 25 && below75Percent < 30) {
    return 'Strong Hiring';
  }
  if (below75Percent > 50) {
    return 'Poor Hiring';
  }
  if (avgTS > 20 && below75Percent > 40) {
    return 'TS Evaluation Issue';
  }
  return 'Moderate';
}

/**
 * Generate insights from SRM data
 */
export function generateInsights(
  records: any[],
  clusterMetrics: any[],
  teamMetrics: any[],
  monthlyTrends: any[]
): SRMInsight[] {
  const insights: SRMInsight[] = [];

  if (records.length === 0) return insights;

  // Calculate overall metrics
  const avgIP = records.length > 0 
    ? Math.round(records.reduce((sum, r) => sum + r.ipScore, 0) / records.length)
    : 0;

  const avgTS = records.length > 0
    ? Math.round(records.reduce((sum, r) => sum + r.tsScore, 0) / records.length * 100) / 100
    : 0;

  const ipScores = records.map(r => r.ipScore);
  const below75 = ipScores.filter(ip => ip < 75).length;
  const above90 = ipScores.filter(ip => ip >= 90).length;
  const below75Pct = Math.round((below75 / ipScores.length) * 100);
  const above90Pct = Math.round((above90 / ipScores.length) * 100);

  // ─── RISK INSIGHTS ─────────────────────────────────────────────
  
  // Risk 1: High low performers
  if (below75Pct > 50) {
    insights.push({
      type: 'risk',
      severity: 'high',
      title: 'High Proportion of Low Performers',
      message: `${below75Pct}% of candidates scored below 75 on IP. This indicates weak entry-level quality or poor training execution.`,
      action: 'Review hiring criteria and/or training content effectiveness'
    });
  } else if (below75Pct > 40) {
    insights.push({
      type: 'risk',
      severity: 'medium',
      title: 'Elevated Low Performer Rate',
      message: `${below75Pct}% of candidates scored below 75 on IP. Monitor closely for further deterioration.`,
      action: 'Conduct root cause analysis on bottom-performing clusters'
    });
  }

  // Risk 2: Weak TS predictivity
  const tsLowBucket = records.filter(r => r.tsScore >= 15 && r.tsScore <= 17);
  const tsLowBelowIP75 = tsLowBucket.filter(r => r.ipScore < 75);
  
  if (tsLowBucket.length > 0) {
    const lowTSBelow75Pct = Math.round((tsLowBelowIP75.length / tsLowBucket.length) * 100);
    
    if (lowTSBelow75Pct < 60) {
      insights.push({
        type: 'validation',
        severity: 'medium',
        title: 'Low TS Scores Not Predictive',
        message: `Only ${lowTSBelow75Pct}% of low TS candidates scored below 75 on IP. TS may not be effective as screening criterion.`,
        action: 'Revise TS evaluation framework or adjust cutoff scores'
      });
    }
  }

  // Risk 3: Weak high-performer representation
  if (above90Pct < 15) {
    insights.push({
      type: 'risk',
      severity: 'medium',
      title: 'Limited High Performers',
      message: `Only ${above90Pct}% of candidates achieved IP >90. Few star performers to accelerate business.`,
      action: 'Enhance recruitment targeting or training intensity'
    });
  }

  // ─── TREND INSIGHTS ────────────────────────────────────────────

  if (monthlyTrends.length >= 2) {
    const recentTrends = monthlyTrends.slice(-3);
    
    // Trend 1: Declining quality
    const avgIPTrend = recentTrends.map(t => t.avgIP);
    if (avgIPTrend[0] > avgIPTrend[avgIPTrend.length - 1]) {
      const decline = avgIPTrend[0] - avgIPTrend[avgIPTrend.length - 1];
      if (decline > 5) {
        insights.push({
          type: 'trend',
          severity: 'high',
          title: 'Quality Decline',
          message: `Average IP score declined by ${decline} points over recent months (${avgIPTrend[0]} → ${avgIPTrend[avgIPTrend.length - 1]}).`,
          action: 'Investigate root cause: hiring changes, trainer turnover, or content gaps'
        });
      } else if (decline > 2) {
        insights.push({
          type: 'trend',
          severity: 'medium',
          title: 'Slight Quality Decline',
          message: `Average IP score declined by ${decline} points. Monitor next month closely.`,
          action: 'Implement corrective measures if trend continues'
        });
      }
    }

    // Trend 2: Improving quality
    if (avgIPTrend[0] < avgIPTrend[avgIPTrend.length - 1]) {
      const improvement = avgIPTrend[avgIPTrend.length - 1] - avgIPTrend[0];
      if (improvement > 5) {
        insights.push({
          type: 'opportunity',
          severity: 'low',
          title: 'Quality Improving',
          message: `Average IP score improved by ${improvement} points. Recent changes are working.`,
          action: 'Document and scale successful initiatives'
        });
      }
    }

    // Trend 3: Low performer surge
    const below75Trend = recentTrends.map(t => t.below50Pct);
    if (below75Trend[below75Trend.length - 1] > below75Trend[0]) {
      const increase = below75Trend[below75Trend.length - 1] - below75Trend[0];
      if (increase > 10) {
        insights.push({
          type: 'trend',
          severity: 'high',
          title: 'Increasing Low Performers',
          message: `Percentage of candidates scoring <75 increased by ${increase}% recently.`,
          action: 'Urgent review of hiring and training processes'
        });
      }
    }
  }

  // ─── CLUSTER/TEAM INSIGHTS ────────────────────────────────────

  if (clusterMetrics.length > 0) {
    // Find weakest clusters
    const weakClusters = clusterMetrics.filter(c => c.below50Pct > 30).slice(0, 3);
    
    if (weakClusters.length > 0) {
      const clusterList = weakClusters.map(c => `${c.cluster} (${c.below50Pct}%)`).join(', ');
      insights.push({
        type: 'risk',
        severity: 'high',
        title: 'Weak Clusters Identified',
        message: `Clusters with >30% low performers (<50): ${clusterList}`,
        action: 'Deep dive into hiring and training execution in these regions'
      });
    }

    // Find strongest clusters
    const strongClusters = clusterMetrics.filter(c => c.above90Pct >= 20).slice(0, 2);
    
    if (strongClusters.length > 0) {
      const clusterList = strongClusters.map(c => `${c.cluster} (${c.above90Pct}%)`).join(', ');
      insights.push({
        type: 'opportunity',
        severity: 'low',
        title: 'Strong Clusters',
        message: `Clusters with ≥20% high performers: ${clusterList}. Use as best practice benchmark.`,
        action: 'Document and replicate success factors'
      });
    }
  }

  // ─── TS EFFECTIVENESS ──────────────────────────────────────────

  const tsBuckets = [
    { min: 15, max: 17, label: 'Low (15-17)' },
    { min: 18, max: 20, label: 'Mid (18-20)' },
    { min: 21, max: 25, label: 'High (21-25)' }
  ];

  const bucketCorrelations: any[] = [];
  
  for (const bucket of tsBuckets) {
    const bucketRecords = records.filter(r => r.tsScore >= bucket.min && r.tsScore <= bucket.max);
    if (bucketRecords.length === 0) continue;

    const avgIPForBucket = Math.round(
      bucketRecords.reduce((sum, r) => sum + r.ipScore, 0) / bucketRecords.length
    );

    bucketCorrelations.push({
      label: bucket.label,
      avgIP: avgIPForBucket,
      count: bucketRecords.length
    });
  }

  // Check TS-IP correlation
  if (bucketCorrelations.length >= 3) {
    const [low, mid, high] = bucketCorrelations;
    
    // Strong correlation: high TS → high IP
    if (high.avgIP > low.avgIP + 10 && high.avgIP > mid.avgIP + 5) {
      insights.push({
        type: 'validation',
        severity: 'low',
        title: 'TS is Predictive',
        message: `Higher TS correlates with higher IP: ${low.label} (${low.avgIP}) → ${high.label} (${high.avgIP}).`,
        action: 'Confidence in TS as selection criterion validated'
      });
    }

    // Weak correlation
    if (high.avgIP <= low.avgIP + 5) {
      insights.push({
        type: 'validation',
        severity: 'medium',
        title: 'Weak TS-IP Correlation',
        message: `TS shows weak predictivity: ${low.label} (${low.avgIP}) ≈ ${high.label} (${high.avgIP}). Other factors may drive performance.`,
        action: 'Investigate confounding variables or recalibrate TS assessment'
      });
    }
  }

  return insights;
}

/**
 * Get diagnosis summary
 */
export function getDiagnosisSummary(records: any[]): {
  diagnosis: string;
  color: string;
  icon: string;
} {
  if (records.length === 0) {
    return { diagnosis: 'No Data', color: 'var(--text-secondary)', icon: '—' };
  }

  const avgTS = Math.round(records.reduce((sum, r) => sum + r.tsScore, 0) / records.length * 100) / 100;
  const below75Pct = Math.round(
    (records.filter(r => r.ipScore < 75).length / records.length) * 100
  );
  const above90Pct = Math.round(
    (records.filter(r => r.ipScore >= 90).length / records.length) * 100
  );

  const diagnosis = getDiagnosis(avgTS, below75Pct, above90Pct);

  if (diagnosis === 'Strong Hiring') {
    return { diagnosis: 'Strong Hiring', color: 'var(--success)', icon: '✓' };
  }
  if (diagnosis === 'Poor Hiring') {
    return { diagnosis: 'Poor Hiring', color: 'var(--danger)', icon: '✗' };
  }
  if (diagnosis === 'TS Evaluation Issue') {
    return { diagnosis: 'TS Evaluation Issue', color: 'var(--warning)', icon: '⚠' };
  }
  return { diagnosis: 'Moderate', color: 'var(--accent-primary)', icon: '~' };
}
