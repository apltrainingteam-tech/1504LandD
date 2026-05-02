import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, LayoutGrid, Users, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './HierarchyController.module.css';

interface HierarchyControllerProps {
  clusterTeamMap: Record<string, string[]>; // New prop
  selectedClusters: string[];
  selectedTeams: string[];
  onSelectCluster: (clusterName: string) => void;
  onSelectTeam: (teamName: string) => void; // Changed to teamName
  onClear: () => void;
}

export const HierarchyController: React.FC<HierarchyControllerProps> = ({
  clusterTeamMap,
  selectedClusters,
  selectedTeams,
  onSelectCluster,
  onSelectTeam,
  onClear
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
          const isSelected = selectedClusters.includes(clusterName) && selectedTeams.length === 0;
          const teamsInCluster = clusterTeamMap[clusterName] || [];
          
          return (
            <div key={clusterName} className={styles.clusterGroup}>
              <div 
                className={`${styles.clusterRow} ${isSelected ? styles.active : ''}`}
                onClick={() => {
                  onSelectCluster(clusterName);
                  toggleExpand(clusterName);
                }}
              >
                <div className={styles.expandIcon}>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
                <span className={styles.clusterName}>{clusterName}</span>
                {isSelected && <div className={styles.indicator} />}
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
                      const isTeamSelected = selectedTeams.includes(teamName);
                      return (
                        <div 
                          key={teamName}
                          className={`${styles.teamRow} ${isTeamSelected ? styles.active : ''}`}
                          onClick={() => onSelectTeam(teamName)}
                        >
                          <span className={styles.teamName}>{teamName}</span>
                          {isTeamSelected && <div className={styles.indicator} />}
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
