import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Zap } from 'lucide-react';
import { useQualityMetrics } from './hooks/useQualityMetrics';
import { SRMSnapshot } from './components/SRMSnapshot';
import { TSIPChart } from '../dashboard/components/TSIPChart';
import { SRMTable } from './components/SRMTable';
import { InsightsPanel } from '../dashboard/components/InsightsPanel';
import { GlobalFilterPanel } from '../../shared/components/ui/GlobalFilterPanel';
import { GlobalFilters, getActiveFilterCount } from '../../core/context/filterContext';
import { Employee } from '../../types/employee';
import { Attendance, TrainingScore } from '../../types/attendance';
import { scheduleIdle } from '../../core/utils/stagedComputation';
import { useMasterData } from '../../core/context/MasterDataContext';
import { useFilterOptions } from '../../shared/hooks/computationHooks';
import TopRightControls from '../../shared/components/ui/TopRightControls';
import { getFiscalYears } from '../../core/utils/fiscalYear';
import styles from './RecruitmentQuality.module.css';

interface RecruitmentQualityProps {
  employees: Employee[];
  attendance: Attendance[];
  scores: TrainingScore[];
  onFilter?: (filter: GlobalFilters) => void;
}

export const RecruitmentQuality: React.FC<RecruitmentQualityProps> = ({
  employees, attendance, scores, onFilter
}) => {
  const { teams: masterTeams, trainers: masterTrainers, clusters: masterClusters } = useMasterData();
  const [filters, setFilters] = useState<GlobalFilters>({ cluster: '', team: '', trainer: '', month: '' });
  const [viewMode, setViewMode] = useState<'srm' | 'cluster'>('srm');
  const [selectedCluster, setSelectedCluster] = useState<string | undefined>(undefined);
  const [renderStage, setRenderStage] = useState(0);
  const [showGlobalFilters, setShowGlobalFilters] = useState(false);
  const FY_OPTIONS = getFiscalYears(2015);
  const [selectedFY, setSelectedFY] = useState<string>(FY_OPTIONS[0]);

  const activeFilterCount = getActiveFilterCount(filters);
  const { allTeams, allTrainers } = useFilterOptions(employees, attendance, 'IP', masterTeams, masterTrainers);
  const allClusters = useMemo(() => masterClusters.map(c => c.name), [masterClusters]);
  const months = useMemo(() => {
    const m = new Set<string>();
    attendance.forEach(a => { if (a.month) m.add(a.month); if (a.attendanceDate) m.add((a.attendanceDate || '').substring(0, 7)); });
    return [...m].sort();
  }, [attendance]);

  const { srmRecords, insights, diagnosis } = useQualityMetrics(employees, attendance, scores, filters, masterTeams);

  useEffect(() => {
    if (renderStage === 0) scheduleIdle(() => 1, setRenderStage);
    else if (renderStage === 1) scheduleIdle(() => 2, setRenderStage);
    else if (renderStage === 2) scheduleIdle(() => 3, setRenderStage);
  }, [renderStage]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>
            <BarChart3 size={32} className={styles.accentIcon} />
            SRM: Recruitment Quality Intelligence
          </h1>
          <p className={`text-muted ${styles.pageSubtitle}`}>Evaluate entry quality (TS), outcome quality (IP), and hiring effectiveness</p>
          <div className={styles.viewToggle}>
            <button
              className={`btn ${viewMode === 'srm' ? 'btn-primary' : 'btn-secondary'} ${styles.modeBtn}`}
              onClick={() => { setViewMode('srm'); setSelectedCluster(undefined); }}
            >SRM Mode</button>
            <button
              className={`btn ${viewMode === 'cluster' ? 'btn-primary' : 'btn-secondary'} ${styles.modeBtn}`}
              onClick={() => setViewMode('cluster')}
            >Cluster Mode</button>
          </div>
        </div>
        <TopRightControls
          fiscalOptions={FY_OPTIONS} selectedFY={selectedFY} onChangeFY={setSelectedFY}
          onOpenGlobalFilters={() => setShowGlobalFilters(true)}
          onExport={() => alert('Export not available (UI placeholder)')}
          activeFilterCount={activeFilterCount}
        />
      </div>

      {/* Filters */}
      <GlobalFilterPanel
        isOpen={showGlobalFilters} onClose={() => setShowGlobalFilters(false)}
        onApply={(f) => { setFilters(f); setShowGlobalFilters(false); }}
        initialFilters={filters} clusterOptions={allClusters}
        teamOptions={allTeams} trainerOptions={allTrainers} monthOptions={months}
        onClearAll={() => { setFilters({ cluster: '', team: '', trainer: '', month: '' }); setShowGlobalFilters(false); }}
      />

      {/* Status */}
      {srmRecords.length === 0 ? (
        <div className={`glass-panel ${styles.emptyPanel}`}>
          <BarChart3 size={48} className={styles.emptyIcon} />
          <h3 className={styles.emptyTitle}>No Data Available</h3>
          <p className="text-muted">No IP training records with Present status found matching your filters.</p>
        </div>
      ) : (
        <>
          {/* Diagnosis Badge */}
          <div className={styles.diagnosisRow}>
            <div className={`glass-panel ${styles.diagnosisCard}`}>
              <span className={styles.diagnosisIcon}>{diagnosis.icon}</span>
              <div>
                <div className={styles.diagnosisLabel}>Overall Diagnosis</div>
                <div className={`${styles.diagnosisValue} ${
                  diagnosis.diagnosis === 'Strong' ? styles.diagStrong :
                  diagnosis.diagnosis === 'Moderate' ? styles.diagModerate :
                  diagnosis.diagnosis === 'Poor' ? styles.diagPoor :
                  styles.diagOther
                }`}>
                  {diagnosis.diagnosis}
                </div>
              </div>
            </div>
            <div className={`glass-panel ${styles.countCard}`}>
              📊 {srmRecords.length} candidates | IP Training | Present Only
            </div>
          </div>

          {renderStage >= 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
              <SRMSnapshot records={srmRecords} />
            </motion.div>
          )}

          {renderStage >= 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className={styles.stageBlock}>
              <TSIPChart records={srmRecords} />
            </motion.div>
          )}

          {renderStage >= 3 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
              <div className={styles.stageBlock}>
                <h2 className={styles.sectionTitle}>{viewMode === 'cluster' ? 'Cluster Analysis' : 'Cluster Comparison'}</h2>
                <SRMTable records={srmRecords} mode="cluster" className="mb-8" />
              </div>

              {viewMode === 'cluster' && selectedCluster && (
                <div className={styles.stageBlock}>
                  <h2 className={styles.sectionTitle}>Teams in {selectedCluster}</h2>
                  <SRMTable records={srmRecords} mode="team" clusterFilter={selectedCluster} />
                </div>
              )}

              {viewMode === 'srm' && (
                <div className={styles.stageBlock}>
                  <h2 className={styles.sectionTitle}>Team Breakdown</h2>
                  <SRMTable records={srmRecords} mode="team" />
                </div>
              )}

              <div className={styles.stageBlock}>
                <h2 className={styles.insightsTitle}>
                  <Zap size={20} /> Key Insights &amp; Recommendations
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









