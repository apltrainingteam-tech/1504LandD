import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Filter, Zap } from 'lucide-react';
import { buildUnifiedDataset, applyFilters } from '../../services/reportService';
import { 
  filterSRMRecords, 
  calculateIPDistribution, 
  calculateClusterMetrics, 
  calculateTeamMetrics,
  calculateMonthlyTrend 
} from '../../utils/srmCalculations';
import { generateInsights, getDiagnosisSummary } from '../../utils/srmInsights';
import { SRMSnapshot } from '../../components/SRMSnapshot';
import { TSIPChart } from '../../components/TSIPChart';
import { SRMTable } from '../../components/SRMTable';
import { InsightsPanel } from '../../components/InsightsPanel';
import { GlobalFilterPanel } from '../../components/GlobalFilterPanel';
import { GlobalFilters } from '../../context/filterContext';
import { Employee } from '../../types/employee';
import { Attendance, TrainingScore } from '../../types/attendance';
import { scheduleIdle } from '../../utils/stagedComputation';

interface RecruitmentQualityProps {
  employees: Employee[];
  attendance: Attendance[];
  scores: TrainingScore[];
  onFilter?: (filter: GlobalFilters) => void;
}

export const RecruitmentQuality: React.FC<RecruitmentQualityProps> = ({
  employees,
  attendance,
  scores,
  onFilter
}) => {
  const [filters, setFilters] = useState<GlobalFilters>({
    monthFrom: undefined,
    monthTo: undefined,
    teams: [],
    clusters: [],
    trainer: undefined
  });

  const [viewMode, setViewMode] = useState<'srm' | 'cluster'>('srm');
  const [selectedCluster, setSelectedCluster] = useState<string | undefined>(undefined);
  const [renderStage, setRenderStage] = useState(0);

  // Data pipeline
  const unifiedDataset = useMemo(() => {
    return buildUnifiedDataset(employees, attendance, scores, []);
  }, [employees, attendance, scores]);

  const filteredDataset = useMemo(() => {
    return applyFilters(unifiedDataset, {
      monthFrom: filters.monthFrom,
      monthTo: filters.monthTo,
      teams: filters.teams,
      clusters: filters.clusters,
      trainer: filters.trainer
    });
  }, [unifiedDataset, filters]);

  const srmRecords = useMemo(() => {
    return filterSRMRecords(filteredDataset);
  }, [filteredDataset]);

  const insights = useMemo(() => {
    const clusterMetrics = calculateClusterMetrics(srmRecords);
    const teamMetrics = calculateTeamMetrics(srmRecords);
    const monthlyTrends = calculateMonthlyTrend(srmRecords);
    
    return generateInsights(srmRecords, clusterMetrics, teamMetrics, monthlyTrends);
  }, [srmRecords]);

  const diagnosis = useMemo(() => {
    return getDiagnosisSummary(srmRecords);
  }, [srmRecords]);

  // Staged rendering
  useEffect(() => {
    if (renderStage === 0) {
      scheduleIdle(() => setRenderStage(1));
    } else if (renderStage === 1) {
      scheduleIdle(() => setRenderStage(2));
    } else if (renderStage === 2) {
      scheduleIdle(() => setRenderStage(3));
    }
  }, [renderStage]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ padding: '24px' }}
    >
      {/* Header */}
      <div className="header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BarChart3 size={32} style={{ color: 'var(--accent-primary)' }} />
            SRM: Recruitment Quality Intelligence
          </h1>
          <p className="text-muted">Evaluate entry quality (TS), outcome quality (IP), and hiring effectiveness</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            className={`btn ${viewMode === 'srm' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setViewMode('srm'); setSelectedCluster(undefined); }}
            style={{ padding: '8px 16px' }}
          >
            SRM Mode
          </button>
          <button
            className={`btn ${viewMode === 'cluster' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('cluster')}
            style={{ padding: '8px 16px' }}
          >
            Cluster Mode
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: '24px' }}>
        <GlobalFilterPanel
          onFilter={setFilters}
          showEmployeeOnly={false}
        />
      </div>

      {/* Status */}
      {srmRecords.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
          <BarChart3 size={48} style={{ color: 'var(--text-secondary)', marginBottom: '16px', opacity: 0.3 }} />
          <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>No Data Available</h3>
          <p className="text-muted">No IP training records with Present status found matching your filters.</p>
        </div>
      ) : (
        <>
          {/* Diagnosis Badge */}
          <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="glass-panel" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>{diagnosis.icon}</span>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Overall Diagnosis</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: diagnosis.color }}>
                  {diagnosis.diagnosis}
                </div>
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '12px 20px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              📊 {srmRecords.length} candidates | IP Training | Present Only
            </div>
          </div>

          {/* Stage 1: Snapshot */}
          {renderStage >= 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
              <SRMSnapshot records={srmRecords} />
            </motion.div>
          )}

          {/* Stage 2: TS vs IP Chart */}
          {renderStage >= 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} style={{ marginBottom: '24px' }}>
              <TSIPChart records={srmRecords} />
            </motion.div>
          )}

          {/* Stage 3: Tables */}
          {renderStage >= 3 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>
                  {viewMode === 'cluster' ? 'Cluster Analysis' : 'Cluster Comparison'}
                </h2>
                <SRMTable
                  records={srmRecords}
                  mode="cluster"
                  className="mb-8"
                />
              </div>

              {viewMode === 'cluster' && selectedCluster && (
                <div style={{ marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>
                    Teams in {selectedCluster}
                  </h2>
                  <SRMTable
                    records={srmRecords}
                    mode="team"
                    clusterFilter={selectedCluster}
                  />
                </div>
              )}

              {viewMode === 'srm' && (
                <div style={{ marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>
                    Team Breakdown
                  </h2>
                  <SRMTable
                    records={srmRecords}
                    mode="team"
                  />
                </div>
              )}

              {/* Insights */}
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>
                  <Zap size={20} style={{ marginRight: '8px', display: 'inline' }} />
                  Key Insights & Recommendations
                </h2>
                <InsightsPanel insights={insights} />
              </div>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default RecruitmentQuality;
