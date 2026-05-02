import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './HierarchyController.module.css';

interface HierarchyControllerProps {
  clusterTeamMap: Record<string, string[]>;
  selectedCluster: string | null;
  selectedTeam: string | null;
  onSelectCluster: (clusterName: string) => void;
  onSelectTeam: (clusterName: string, teamName: string) => void;
}

export const HierarchyController: React.FC<HierarchyControllerProps> = ({
  clusterTeamMap,
  selectedCluster,
  selectedTeam,
  onSelectCluster,
  onSelectTeam
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // If a cluster is selected from outside, ensure it is expanded
  useEffect(() => {
    if (selectedCluster) {
      setExpanded(prev => new Set(prev).add(selectedCluster));
    }
  }, [selectedCluster]);

  const toggleExpand = (clusterName: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(clusterName)) {
      newExpanded.delete(clusterName);
    } else {
      newExpanded.add(clusterName);
    }
    setExpanded(newExpanded);
  };

  const sortedClusters = useMemo(() => {
    return Object.keys(clusterTeamMap).sort((a, b) => a.localeCompare(b));
  }, [clusterTeamMap]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.headerTitle}>CLUSTER / TEAM</h3>
      </div>

      <div className={styles.list}>
        {sortedClusters.map(clusterName => {
          const isExpanded = expanded.has(clusterName);
          const isClusterActive = selectedCluster === clusterName && !selectedTeam;
          const teamsInCluster = clusterTeamMap[clusterName] || [];
          
          return (
            <div key={clusterName} className={styles.clusterGroup}>
              <div 
                className={`${styles.clusterRow} ${isClusterActive ? styles.active : ''}`}
                onClick={() => {
                  onSelectCluster(clusterName);
                  toggleExpand(clusterName);
                }}
              >
                <div className={styles.expandIcon}>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
                <span className={styles.clusterName}>{clusterName}</span>
                {isClusterActive && <div className={styles.indicator} />}
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className={styles.teamList}
                  >
                    {teamsInCluster.map(teamName => {
                      return (
                        <div 
                          key={teamName}
                          className={`${styles.teamRow} ${selectedTeam === teamName ? styles.active : ''}`}
                          onClick={() => onSelectTeam(clusterName, teamName)}
                        >
                          <span className={styles.teamName}>{teamName}</span>
                          {selectedTeam === teamName && <div className={styles.indicator} />}
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};
