import { useState, useCallback, useEffect } from 'react';
import { getCollection, upsertDoc, deleteDocument } from '../../../core/engines/apiClient';
import { TeamClusterMapping, Trainer, EligibilityRule, TrainingType } from '../../../types/attendance';

export const useDemographicsData = (tab: 'mapping' | 'trainers' | 'rules') => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mapping, setMapping] = useState<TeamClusterMapping[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [rules, setRules] = useState<EligibilityRule[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'mapping') {
        const data = await getCollection('team_cluster_mapping');
        setMapping(data as TeamClusterMapping[]);
      } else if (tab === 'trainers') {
        const data = await getCollection('trainers');
        setTrainers(data as Trainer[]);
      } else if (tab === 'rules') {
        const data = await getCollection('eligibility_rules');
        setRules(data as EligibilityRule[]);
      }
    } catch (err) {
      console.error('Error loading demographics data:', err);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addMapping = async (team: string, cluster: string) => {
    setSaving(true);
    try {
      const id = team.replace(/\s+/g, '_');
      await upsertDoc('team_cluster_mapping', id, { id, team, cluster });
      await loadData();
      return true;
    } catch (err) {
      console.error('Error adding mapping:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const removeMapping = async (id: string) => {
    if (!window.confirm('Delete this team mapping permanently?')) return;
    setLoading(true);
    try {
      await deleteDocument('team_cluster_mapping', id);
      await loadData();
    } catch (err) {
      console.error('Error deleting mapping:', err);
    } finally {
      setLoading(false);
    }
  };

  const addTrainer = async (name: string, types: TrainingType[], avatarUrl: string | null = null) => {
    setSaving(true);
    try {
      const id = name.replace(/\s+/g, '_');
      await upsertDoc('trainers', id, { id, name, avatarUrl, trainingTypes: types });

      await loadData();
      return true;
    } catch (err) {
      console.error('Error adding trainer:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const removeTrainer = async (id: string) => {
    if (!window.confirm('Delete this trainer?')) return;
    setLoading(true);
    try {
      await deleteDocument('trainers', id);
      await loadData();
    } catch (err) {
      console.error('Error deleting trainer:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveRule = async (rule: EligibilityRule) => {
    setSaving(true);
    try {
      await upsertDoc('eligibility_rules', rule.id, rule);
      await loadData();
      return true;
    } catch (err) {
      console.error('Error saving rule:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return {
    loading,
    saving,
    mapping,
    trainers,
    rules,
    refresh: loadData,
    addMapping,
    removeMapping,
    addTrainer,
    removeTrainer,
    saveRule
  };
};
