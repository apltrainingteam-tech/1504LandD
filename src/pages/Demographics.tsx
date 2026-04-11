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
  UserPlus,
  ChevronDown
} from 'lucide-react';
import { getCollection, upsertDoc } from '../services/firestoreService';
import { DESIGNATIONS } from '../seed/masterData';
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
  const [designationDropdownOpen, setDesignationDropdownOpen] = useState(false);
  const [openPrerequisiteDropdown, setOpenPrerequisiteDropdown] = useState<TrainingType | null>(null);

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
    if (!newTeam || !newCluster) {
      alert("Please enter both Team Name and Cluster before adding.");
      return;
    }
    const id = newTeam.replace(/\s+/g, '_');
    await upsertDoc('team_cluster_mapping', id, { id, team: newTeam, cluster: newCluster });
    setNewTeam(''); setNewCluster('');
    loadData();
  };

  // --- Handlers: Trainers ---
  const saveTrainer = async () => {
    if (!newTrainer.name) return;
    const id = newTrainer.name.replace(/\s+/g, '_');
    await upsertDoc('trainers', id, { id, trainerName: newTrainer.name, trainingTypes: newTrainer.types });
    setNewTrainer({ name: '', types: [] });
    loadData();
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
      const existing: any = rules.find(r => r.trainingType === activeRuleType);
      setEditingRule({
        id: activeRuleType,
        trainingType: activeRuleType,
        designation: { 
          mode: existing?.designation?.mode || 'ALL', 
          values: existing?.designation?.values || [] 
        },
        previousTraining: { 
          mode: existing?.previousTraining?.mode || 'ALL', 
          values: existing?.previousTraining?.values || [] 
        },
        aplExperience: { 
          min: existing?.aplExperience?.min || 0, 
          max: existing?.aplExperience?.max || 10 
        },
        specialConditions: { 
          noAPInNext90Days: existing?.specialConditions?.noAPInNext90Days || false, 
          preAPOnlyIfInvited: existing?.specialConditions?.preAPOnlyIfInvited || false 
        }
      });
    }
  }, [activeRuleType, rules, tab]);

  const saveRule = async () => {
    if (!editingRule) return;
    await upsertDoc('eligibility_rules', editingRule.id, editingRule);
    alert('Rule saved successfully');
    loadData();
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
            <button className="btn btn-primary w-full mt-4" onClick={saveMapping}><Plus size={18} /> Add Mapping</button>
          </div>
          <div className="md:col-span-2">
            <DataTable headers={['Team', 'Cluster', 'Action']}>
              {mapping.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.team}</td>
                  <td><span className="badge badge-info">{m.cluster}</span></td>
                  <td><button className="btn btn-secondary p-2"><Trash2 size={16} /></button></td>
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
            <button className="btn btn-primary w-full mt-4" onClick={saveTrainer}><Plus size={18} /> Save Trainer</button>
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
                  <td><button className="btn btn-secondary p-2"><Trash2 size={16} /></button></td>
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
              <button className="btn btn-primary" onClick={saveRule}><Save size={18} /> Persistence Policy</button>
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
                <div className="mt-4" style={{ position: 'relative' }}>
                  <button 
                    className="form-input flex-between w-full"
                    onClick={() => setDesignationDropdownOpen(!designationDropdownOpen)}
                    style={{ background: 'var(--bg-card)', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ opacity: editingRule.designation.values.length ? 1 : 0.5 }}>
                      {editingRule.designation.values.length > 0 
                        ? `${editingRule.designation.values.length} Selected` 
                        : "Select Designations..."}
                    </span>
                    <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  
                  {designationDropdownOpen && (
                    <div style={{ 
                      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                      background: '#1e1b4b', border: '1px solid var(--accent-primary)', 
                      borderRadius: '8px', padding: '8px', maxHeight: '220px', overflowY: 'auto',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
                    }}>
                      {DESIGNATIONS.map(d => {
                        const isSelected = editingRule.designation.values.includes(d);
                        return (
                          <label key={d} className="flex items-center gap-3 p-2 cursor-pointer rounded" style={{ transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={(e) => {
                                const next = e.target.checked 
                                  ? [...editingRule.designation.values, d]
                                  : editingRule.designation.values.filter(v => v !== d);
                                setEditingRule({ ...editingRule, designation: { ...editingRule.designation, values: next } });
                              }}
                              style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '13px', color: isSelected ? 'white' : 'var(--text-secondary)' }}>{d}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  
                  {editingRule.designation.values.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {editingRule.designation.values.map(v => (
                        <span key={v} className="badge badge-primary flex gap-2 items-center" style={{ fontSize: '11px', padding: '4px 8px' }}>
                          {v}
                          <Trash2 size={12} className="cursor-pointer" onClick={() => {
                            setEditingRule({ ...editingRule, designation: { ...editingRule.designation, values: editingRule.designation.values.filter(x => x !== v) } });
                          }} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rule-section mb-6">
              <h4>2. Prerequisite Trainings</h4>
              <div className="flex flex-wrap gap-2 mt-3">
                {TRAINING_TYPES.map(t => {
                  const req = editingRule.previousTraining.values.find((v: any) => v.type === t);
                  const isSelected = !!req;

                  return (
                    <div key={t} style={{ position: 'relative' }}>
                      <button 
                        disabled={editingRule.previousTraining.mode === 'ALL'}
                        className={`badge ${isSelected ? 'badge-primary' : 'badge-secondary'} cursor-pointer flex-center gap-1`}
                        onClick={() => {
                          const next = isSelected 
                            ? editingRule.previousTraining.values.filter((x: any) => x.type !== t)
                            : [...editingRule.previousTraining.values, { type: t, designations: [] }];
                          setEditingRule({ ...editingRule, previousTraining: { ...editingRule.previousTraining, values: next } });
                          if (isSelected) {
                            if (openPrerequisiteDropdown === t) setOpenPrerequisiteDropdown(null);
                          } else {
                            setOpenPrerequisiteDropdown(t);
                          }
                        }}
                      >
                        {t}
                        {isSelected && (
                          <div 
                            onClick={(e) => { e.stopPropagation(); setOpenPrerequisiteDropdown(openPrerequisiteDropdown === t ? null : t); }}
                            className="hover:bg-white/20 rounded p-1"
                          >
                            <ChevronDown size={14} />
                          </div>
                        )}
                      </button>
                      
                      {isSelected && openPrerequisiteDropdown === t && (
                        <div style={{
                          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 60,
                          background: '#1e1b4b', border: '1px solid var(--accent-primary)',
                          borderRadius: '8px', padding: '8px', maxHeight: '220px', overflowY: 'auto',
                          width: '260px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                        }}>
                          <div className="text-xs text-muted mb-2 px-1">Designations required to have completed {t}:<br/><i>(Leave empty for all designations)</i></div>
                          {DESIGNATIONS.map(d => {
                            const isDesignationSelected = req.designations.includes(d);
                            return (
                              <label key={d} className="flex items-center gap-3 p-2 cursor-pointer rounded" style={{ transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <input 
                                  type="checkbox" 
                                  checked={isDesignationSelected}
                                  onChange={(e) => {
                                    const nextDesigs = e.target.checked 
                                      ? [...req.designations, d]
                                      : req.designations.filter((v: string) => v !== d);
                                    const nextValues = editingRule.previousTraining.values.map((v: any) => 
                                      v.type === t ? { ...v, designations: nextDesigs } : v
                                    );
                                    setEditingRule({ ...editingRule, previousTraining: { ...editingRule.previousTraining, values: nextValues } });
                                  }}
                                  style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '13px', color: isDesignationSelected ? 'white' : 'var(--text-secondary)' }}>{d}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
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
