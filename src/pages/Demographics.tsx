import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  MapPin, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Save, 
  AlertCircle, 
  Check, 
  ChevronRight,
  UserPlus
} from 'lucide-react';
import { getCollection, upsertDoc, deleteDocument } from '../services/firestoreService';
import { 
  TeamClusterMapping, 
  Trainer, 
  EligibilityRule, 
  TrainingType 
} from '../types/attendance';
import { DataTable } from '../components/DataTable';

const TRAINING_TYPES: TrainingType[] = ['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'Pre_AP', 'GTG'];
const TRAINER_TYPES: TrainingType[] = ['HO', 'RTM'];

export const Demographics = () => {
  const [tab, setTab] = useState<'mapping' | 'trainers' | 'rules'>('mapping');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Section A: Cluster Mapping State
  const [mapping, setMapping] = useState<TeamClusterMapping[]>([]);
  const [newTeam, setNewTeam] = useState('');
  const [newCluster, setNewCluster] = useState('');

  // Section B: Trainer State
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [newTrainer, setNewTrainer] = useState({ name: '', types: [] as TrainingType[] });

  // Section C: Rules State
  const [rules, setRules] = useState<EligibilityRule[]>([]);
  const [activeRuleType, setActiveRuleType] = useState<TrainingType>('IP');
  const [editingRule, setEditingRule] = useState<EligibilityRule | null>(null);

  useEffect(() => {
    loadData();
  }, [tab]);

  const loadData = async () => {
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers: Mapping ---
  const saveMapping = async () => {
    // 1. Normalize Inputs
    const team = newTeam.trim().toUpperCase();
    const cluster = newCluster.trim().toUpperCase();

    if (!team || !cluster) {
      alert('Please enter both Team Name and Cluster');
      return;
    }

    // 3. Prevent Duplicate Teams
    const exists = mapping.some(m => m.team.toUpperCase() === team);
    if (exists) {
      alert('This team already exists. Edit instead of adding duplicate.');
      return;
    }

    setSaving(true);
    try {
      // 2. Use STABLE ID
      const id = team.replace(/\s+/g, '_');
      
      // 4. Save CLEAN Data
      await upsertDoc('team_cluster_mapping', id, { id, team, cluster });
      
      alert('Mapping added successfully!');
      setNewTeam(''); setNewCluster('');
      await loadData();
    } catch (err: any) {
      alert('Error saving mapping: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Handlers: Trainers ---
  const saveTrainer = async () => {
    if (!newTrainer.name) {
      alert('Please enter a Trainer Name');
      return;
    }
    setSaving(true);
    try {
      const id = newTrainer.name.replace(/\s+/g, '_');
      await upsertDoc('trainers', id, { id, trainerName: newTrainer.name, trainingTypes: newTrainer.types });
      alert('Trainer registered successfully!');
      setNewTrainer({ name: '', types: [] });
      await loadData();
    } catch (err: any) {
      alert('Error saving trainer: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleTrainerType = (type: TrainingType) => {
    const next = newTrainer.types.includes(type)
      ? newTrainer.types.filter(t => t !== type)
      : [...newTrainer.types, type];
    setNewTrainer({ ...newTrainer, types: next });
  };

  // --- Handlers: Rules ---
  useEffect(() => {
    if (tab === 'rules') {
      const existing = rules.find(r => r.trainingType === activeRuleType);
      setEditingRule(existing || {
        id: activeRuleType,
        trainingType: activeRuleType,
        designation: { mode: 'ALL', values: [] },
        previousTraining: { mode: 'ALL', values: [] },
        aplExperience: { mode: 'ALL', min: 0, max: 10 },
        specialConditions: { noAPInNext90Days: false, preAPOnlyIfInvited: false }
      });
    }
  }, [activeRuleType, rules, tab]);

  const saveRule = async () => {
    if (!editingRule) return;
    setSaving(true);
    try {
      await upsertDoc('eligibility_rules', editingRule.id, editingRule);
      alert('Eligibility rule for ' + activeRuleType + ' saved successfully!');
      await loadData();
    } catch (err: any) {
      alert('Error saving rule: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (col: string, id: string, name: string) => {
    // 5. Fix Delete Robustness
    if (!id) {
      alert('Invalid ID. Cannot delete.');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    setSaving(true);
    try {
      await deleteDocument(col, id);
      alert(`Deleted ${name} successfully`);
      await loadData();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="header">
        <div>
          <h2 style={{ fontSize: '24px' }}>Demographics & Eligibility Console</h2>
          <p className="text-muted">Dynamic rule management for training intelligence</p>
        </div>
      </div>

      <div className="flex-center mb-8" style={{ background: 'var(--bg-card)', padding: '8px', borderRadius: '14px', width: 'fit-content' }}>
        <button className={`nav-item ${tab === 'mapping' ? 'active' : ''}`} onClick={() => setTab('mapping')}><MapPin size={18} /> Cluster Mapping</button>
        <button className={`nav-item ${tab === 'trainers' ? 'active' : ''}`} onClick={() => setTab('trainers')}><UserPlus size={18} /> Trainer Master</button>
        <button className={`nav-item ${tab === 'rules' ? 'active' : ''}`} onClick={() => setTab('rules')}><ShieldCheck size={18} /> Eligibility Builder</button>
      </div>

      {tab === 'mapping' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 glass-panel p-6">
            <h3 className="mb-4">Advisory: Team Mapping</h3>
            <div className="form-group">
              <label>Team Name</label>
              <input value={newTeam} onChange={e => setNewTeam(e.target.value)} className="form-input" placeholder="e.g. Gamma Squad" />
            </div>
            <div className="form-group">
              <label>Cluster</label>
              <input value={newCluster} onChange={e => setNewCluster(e.target.value)} className="form-input" placeholder="e.g. North Zone" />
            </div>
            <button 
              className="btn btn-primary w-full mt-4" 
              onClick={saveMapping}
              disabled={saving}
            >
              {saving ? 'Saving...' : <><Plus size={18} /> Add Mapping</>}
            </button>
          </div>
          <div className="md:col-span-2">
            <DataTable headers={['Team', 'Cluster', 'Action']}>
              {mapping.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.team}</td>
                  <td><span className="badge badge-info">{m.cluster}</span></td>
                  <td>
                    <button 
                      className="btn btn-secondary p-2" 
                      onClick={() => handleDelete('team_cluster_mapping', m.id, m.team)}
                      disabled={saving}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        </div>
      )}

      {tab === 'trainers' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 glass-panel p-6">
            <h3 className="mb-4">Register Trainer</h3>
            <div className="form-group">
              <label>Trainer Name</label>
              <input value={newTrainer.name} onChange={e => setNewTrainer({ ...newTrainer, name: e.target.value })} className="form-input" />
            </div>
            <div className="form-group">
              <label>Authorized Types</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {TRAINER_TYPES.map(t => (
                  <button 
                    key={t} 
                    className={`badge ${newTrainer.types.includes(t) ? 'badge-primary' : 'badge-secondary'} cursor-pointer`}
                    onClick={() => toggleTrainerType(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <button 
              className="btn btn-primary w-full mt-4" 
              onClick={saveTrainer}
              disabled={saving}
            >
              {saving ? 'Saving...' : <><Plus size={18} /> Save Trainer</>}
            </button>
          </div>
          <div className="md:col-span-2">
            <DataTable headers={['Trainer', 'Training Capabilities', 'Action']}>
              {trainers.map(tr => (
                <tr key={tr.id}>
                  <td style={{ fontWeight: 600 }}>{tr.trainerName}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {tr.trainingTypes.map(t => <span key={t} className="badge badge-info">{t}</span>)}
                    </div>
                  </td>
                  <td>
                    <button 
                      className="btn btn-secondary p-2" 
                      onClick={() => handleDelete('trainers', tr.id, tr.trainerName)}
                      disabled={saving}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        </div>
      )}

      {tab === 'rules' && editingRule && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <div className="glass-panel p-2">
              {TRAINING_TYPES.map(t => (
                <button 
                  key={t} 
                  className={`nav-item w-full flex-between ${activeRuleType === t ? 'active' : ''}`}
                  onClick={() => setActiveRuleType(t)}
                >
                  {t} <ChevronRight size={14} />
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-3 glass-panel p-8">
            <div className="flex-between mb-8">
              <h3>Rule Engine: {activeRuleType}</h3>
              <button 
                className="btn btn-primary" 
                onClick={saveRule}
                disabled={saving}
              >
                {saving ? 'Saving...' : <><Save size={18} /> Persistence Policy</>}
              </button>
            </div>

            <div className="rule-section mb-6">
              <h4>1. Designation Filter</h4>
              <div className="flex gap-4 mt-3">
                {['ALL', 'INCLUDE', 'EXCLUDE'].map(m => (
                  <button 
                    key={m} 
                    className={`btn ${editingRule.designation.mode === m ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setEditingRule({ ...editingRule, designation: { ...editingRule.designation, mode: m as any } })}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {editingRule.designation.mode !== 'ALL' && (
                <input 
                  className="form-input mt-4" 
                  placeholder="Enter designations separated by comma..." 
                  value={editingRule.designation.values.join(', ')}
                  onChange={e => setEditingRule({ ...editingRule, designation: { ...editingRule.designation, values: e.target.value.split(',').map(v => v.trim()) } })}
                />
              )}
            </div>

            <div className="rule-section mb-6">
              <h4>2. Prerequisite Trainings</h4>
              <div className="flex flex-wrap gap-2 mt-3">
                {TRAINING_TYPES.map(t => (
                  <button 
                    key={t}
                    disabled={editingRule.previousTraining.mode === 'ALL'}
                    className={`badge ${editingRule.previousTraining.values.includes(t) ? 'badge-primary' : 'badge-secondary'} cursor-pointer`}
                    onClick={() => {
                      const next = editingRule.previousTraining.values.includes(t)
                        ? editingRule.previousTraining.values.filter(x => x !== t)
                        : [...editingRule.previousTraining.values, t];
                      setEditingRule({ ...editingRule, previousTraining: { ...editingRule.previousTraining, values: next } });
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={editingRule.previousTraining.mode === 'ALL'} 
                    onChange={e => setEditingRule({ ...editingRule, previousTraining: { ...editingRule.previousTraining, mode: e.target.checked ? 'ALL' : 'INCLUDE' } })}
                  /> No Prerequisite (Universal)
                </label>
              </div>
            </div>

            <div className="rule-section mb-6">
              <h4>3. APL Experience Bracket</h4>
              <div className="flex gap-8 mt-3">
                <div className="form-group flex-1">
                  <label>Min Years</label>
                  <input type="number" className="form-input" value={editingRule.aplExperience.min} onChange={e => setEditingRule({ ...editingRule, aplExperience: { ...editingRule.aplExperience, min: parseInt(e.target.value) } })} />
                </div>
                <div className="form-group flex-1">
                  <label>Max Years</label>
                  <input type="number" className="form-input" value={editingRule.aplExperience.max} onChange={e => setEditingRule({ ...editingRule, aplExperience: { ...editingRule.aplExperience, max: parseInt(e.target.value) } })} />
                </div>
              </div>
            </div>

            <div className="rule-section">
              <h4>4. Constraint Logic (Special)</h4>
              <div className="flex flex-col gap-4 mt-3">
                <label className="flex items-center gap-3 glass-panel p-4 cursor-pointer" style={{ borderColor: editingRule.specialConditions.noAPInNext90Days ? 'var(--accent-primary)' : 'var(--border-color)' }}>
                  <input type="checkbox" checked={editingRule.specialConditions.noAPInNext90Days} onChange={e => setEditingRule({ ...editingRule, specialConditions: { ...editingRule.specialConditions, noAPInNext90Days: e.target.checked } })} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Capsule Lock</div>
                    <div className="text-muted" style={{ fontSize: '12px' }}>Ineligible if any AP training is scheduled within the next 90 days.</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 glass-panel p-4 cursor-pointer" style={{ borderColor: editingRule.specialConditions.preAPOnlyIfInvited ? 'var(--accent-primary)' : 'var(--border-color)' }}>
                  <input type="checkbox" checked={editingRule.specialConditions.preAPOnlyIfInvited} onChange={e => setEditingRule({ ...editingRule, specialConditions: { ...editingRule.specialConditions, preAPOnlyIfInvited: e.target.checked } })} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Invitation Only (Pre-AP)</div>
                    <div className="text-muted" style={{ fontSize: '12px' }}>Ineligible unless the employee exists in the active nominations pool for AP.</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
