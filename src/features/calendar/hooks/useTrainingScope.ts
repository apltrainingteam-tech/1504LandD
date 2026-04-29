import { useState, useCallback } from 'react';
import api from '../../../core/engines/apiClient';

export interface TeamBatchStatus {
  trainingId: string;
  teamId: string;
  teamName: string;
  status: 'OPEN' | 'LOCKED';
}

export const useTrainingScope = (trainingId: string, initialTeams: TeamBatchStatus[], refetchTraining: () => void) => {
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const openTeams = initialTeams.filter(t => t.status === 'OPEN');
  
  const toggleSelection = (teamId: string) => {
    setSelectedTeamIds(prev => 
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  const clearSelection = () => setSelectedTeamIds([]);

  const removeTeams = async () => {
    if (selectedTeamIds.length === 0) return;
    
    // Only allow removing open teams
    const validIds = selectedTeamIds.filter(id => {
      const t = initialTeams.find(x => x.teamId === id);
      return t && t.status === 'OPEN';
    });

    if (validIds.length === 0) return;

    setLoading(true);
    try {
      await api.removeTeams(trainingId, validIds);
      clearSelection();
      refetchTraining();
    } catch (error) {
      console.error('Failed to remove teams:', error);
      alert('Failed to remove teams: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const lockTeams = async () => {
    if (selectedTeamIds.length === 0) return;

    // Only allow locking open teams
    const validIds = selectedTeamIds.filter(id => {
      const t = initialTeams.find(x => x.teamId === id);
      return t && t.status === 'OPEN';
    });

    if (validIds.length === 0) return;

    setLoading(true);
    try {
      await api.lockTeams(trainingId, validIds);
      clearSelection();
      refetchTraining();
    } catch (error) {
      console.error('Failed to lock teams:', error);
      alert('Failed to lock teams: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const resetTeams = async () => {
    if (selectedTeamIds.length === 0) return;

    // Only allow resetting locked teams
    const validIds = selectedTeamIds.filter(id => {
      const t = initialTeams.find(x => x.teamId === id);
      return t && t.status === 'LOCKED';
    });

    if (validIds.length === 0) return;

    setLoading(true);
    try {
      await (api as any).resetTeams(trainingId, validIds);
      clearSelection();
      refetchTraining();
    } catch (error) {
      console.error('Failed to reset teams:', error);
      alert('Failed to reset teams: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return {
    selectedTeamIds,
    toggleSelection,
    clearSelection,
    removeTeams,
    lockTeams,
    resetTeams,
    loading
  };
};
