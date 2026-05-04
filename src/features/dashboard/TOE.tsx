import React from 'react';
import { Target, TrendingUp, Award, Zap } from 'lucide-react';
import styles from './TOE.module.css';

interface TOEProps {
  employees: any[];
  attendance: any[];
  scores: any[];
}

export const TOE: React.FC<TOEProps> = ({ employees, attendance, scores }) => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>TOE Analytics</h1>
          <p className={styles.subtitle}>Training Operational Excellence & Performance Metrics</p>
        </div>
        <div className={styles.actionSection}>
          <button className={styles.exportBtn}>Export Analysis</button>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}><Target size={24} color="#6366f1" /></div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>94.2%</div>
            <div className={styles.statLabel}>Efficiency Index</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}><TrendingUp size={24} color="#10b981" /></div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>+12.5%</div>
            <div className={styles.statLabel}>Growth Velocity</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}><Award size={24} color="#f59e0b" /></div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>A+</div>
            <div className={styles.statLabel}>Quality Rating</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}><Zap size={24} color="#ef4444" /></div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>0.8s</div>
            <div className={styles.statLabel}>Response Latency</div>
          </div>
        </div>
      </div>

      <div className={styles.contentGrid}>
        <div className={styles.mainPanel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Operational Insights</h2>
          </div>
          <div className={styles.placeholder}>
            <div className={styles.placeholderIcon}><TrendingUp size={48} opacity={0.2} /></div>
            <div className={styles.placeholderText}>
              TOE metrics calculation in progress. This dashboard will visualize the relationship between 
              training investment and operational performance outcomes.
            </div>
          </div>
        </div>
        
        <div className={styles.sidePanel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Focus Areas</h2>
          </div>
          <div className={styles.focusList}>
            <div className={styles.focusItem}>
              <div className={styles.focusDot} style={{ background: '#6366f1' }} />
              <div className={styles.focusLabel}>Knowledge Retention</div>
            </div>
            <div className={styles.focusItem}>
              <div className={styles.focusDot} style={{ background: '#10b981' }} />
              <div className={styles.focusLabel}>Field Application</div>
            </div>
            <div className={styles.focusItem}>
              <div className={styles.focusDot} style={{ background: '#f59e0b' }} />
              <div className={styles.focusLabel}>Behavioral Change</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
