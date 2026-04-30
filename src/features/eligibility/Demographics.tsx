import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  MapPin, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Save, 
  AlertCircle, 
  ChevronRight,
  UserPlus,
  ChevronDown,
  User
} from 'lucide-react';
import API_BASE from '../../config/api';
import { DESIGNATIONS } from '../../seed/masterData';
import { 
  TeamClusterMapping, 
  Trainer, 
  EligibilityRule, 
  TrainingType 
} from '../../types/attendance';
import { DataTable } from '../../shared/components/ui/DataTable';
import { useDemographicsData } from './hooks/useDemographicsData';
import { useAvatarUpload } from '../uploads/hooks/useAvatarUpload';
import { AvatarUpload } from '../uploads/components/AvatarUpload';
import styles from './Demographics.module.css';

const TRAINING_TYPES: TrainingType[] = ['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'Pre_AP', 'GTG'];
const TRAINER_TYPES: TrainingType[] = ['HO', 'RTM'];

export const Demographics = () => {
  const [tab, setTab] = useState<'mapping' | 'trainers' | 'rules'>('mapping');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const { handleUpload } = useAvatarUpload();
  
  const {
    loading,
    saving,
    mapping,
    trainers,
    rules,
    refresh: loadData,
    addMapping: apiAddMapping,
    removeMapping: apiRemoveMapping,
    addTrainer: apiAddTrainer,
    removeTrainer: apiRemoveTrainer,
    saveRule: apiSaveRule
  } = useDemographicsData(tab);

  // UI state only
  const [newTeam, setNewTeam] = useState('');
  const [newCluster, setNewCluster] = useState('');
  const [newTrainer, setNewTrainer] = useState({ name: '', types: [] as TrainingType[] });
  const [activeRuleType, setActiveRuleType] = useState<TrainingType>('IP');
  const [editingRule, setEditingRule] = useState<EligibilityRule | null>(null);
  const [designationDropdownOpen, setDesignationDropdownOpen] = useState(false);
  const [openPrerequisiteDropdown, setOpenPrerequisiteDropdown] = useState<TrainingType | null>(null);

  // --- Handlers: Mapping ---
  const saveMapping = async () => {
    const team = newTeam.trim().toUpperCase();
    const cluster = newCluster.trim().toUpperCase();

    if (!team || !cluster) {
      alert('Please enter both Team Name and Cluster');
      return;
    }

    const exists = mapping.some(m => m.team.toUpperCase() === team);
    if (exists) {
      alert('This team already exists. Edit instead of adding duplicate.');
      return;
    }

    try {
      await apiAddMapping(team, cluster);
      alert('Mapping added successfully!');
      setNewTeam(''); setNewCluster('');
    } catch (err: any) {
      alert('Error saving mapping: ' + err.message);
    }
  };

  // --- Handlers: Trainers ---
  const saveTrainer = async () => {
    if (!newTrainer.name) {
      alert('Please enter a Trainer Name');
      return;
    }
    try {
      let avatarUrl = null;
      if (selectedFile) {
        avatarUrl = await handleUpload(selectedFile);
      }

      await apiAddTrainer(newTrainer.name, newTrainer.types, avatarUrl);
      alert('Trainer registered successfully!');
      setNewTrainer({ name: '', types: [] });
      setSelectedFile(null);
      setUploadPreview(null);
    } catch (err: any) {
      alert('Error saving trainer: ' + err.message);
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
          mode: existing?.aplExperience?.mode || 'ALL',
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
    try {
      await apiSaveRule(editingRule);
      alert('Eligibility rule for ' + activeRuleType + ' saved successfully!');
    } catch (err: any) {
      alert('Error saving rule: ' + err.message);
    }
  };

  const handleDelete = async (col: string, id: string, name: string) => {
    if (!id) {
      alert('Invalid ID. Cannot delete.');
      return;
    }
    if (col === 'trainers') {
      await apiRemoveTrainer(id);
    } else if (col === 'team_cluster_mapping') {
      await apiRemoveMapping(id);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="header">
        <div>
          <h2 className={styles.pageTitle}>Demographics &amp; Eligibility Console</h2>
          <p className="text-muted">Dynamic rule management for training intelligence</p>
        </div>
      </div>

      <div className={`flex-center mb-8 ${styles.tabNav}`}>
        <button className={`nav-item ${tab === 'mapping' ? 'active' : ''}`} onClick={() => setTab('mapping')}><MapPin size={18} /> Cluster Mapping</button>
        <button className={`nav-item ${tab === 'trainers' ? 'active' : ''}`} onClick={() => setTab('trainers')}><UserPlus size={18} /> Trainer Master</button>
        <button className={`nav-item ${tab === 'rules' ? 'active' : ''}`} onClick={() => setTab('rules')}><ShieldCheck size={18} /> Eligibility Builder</button>
      </div>

      {tab === 'mapping' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 glass-panel p-6">
            <h3 className="mb-4">Advisory: Team Mapping</h3>
            <div className="form-group">
              <label htmlFor="new-team-name">Team Name</label>
              <input id="new-team-name" name="teamName" value={newTeam} onChange={e => setNewTeam(e.target.value)} className="form-input" placeholder="e.g. Gamma Squad" aria-label="Team Name" />
            </div>
            <div className="form-group">
              <label htmlFor="new-cluster-name">Cluster</label>
              <input id="new-cluster-name" name="clusterName" value={newCluster} onChange={e => setNewCluster(e.target.value)} className="form-input" placeholder="e.g. North Zone" aria-label="Cluster" />
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
                  <td className={styles.cellBold}>{m.team}</td>
                  <td><span className="badge badge-info">{m.cluster}</span></td>
                  <td>
                    <button 
                      className="btn btn-secondary p-2" 
                      onClick={() => handleDelete('team_cluster_mapping', m.id, m.team)}
                      disabled={saving}
                      title="Delete Mapping"
                      aria-label="Delete Mapping"
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
              <label htmlFor="new-trainer-name">Trainer Name</label>
                <input id="new-trainer-name" name="trainerName" value={newTrainer.name} onChange={e => setNewTrainer({ ...newTrainer, name: e.target.value })} className="form-input" aria-label="Trainer Name" />

            </div>
            <div className="form-group">
              <label>Avatar (Optional)</label>
              <div className="mt-2">
                <AvatarUpload 
                  value={uploadPreview || undefined}
                  onChange={(file) => {
                    setSelectedFile(file);
                    if (file) setUploadPreview(URL.createObjectURL(file));
                    else setUploadPreview(null);
                  }}
                  trainerCode={newTrainer.name.slice(0, 2).toUpperCase()}
                />
              </div>
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
                  <td className={styles.cellBold}>
                    <div className="flex-center gap-3">
                      {tr.avatarUrl ? (
                        <img 
                          src={tr.avatarUrl.startsWith('http') ? tr.avatarUrl : `${API_BASE.replace('/api', '')}${tr.avatarUrl}`} 
                          alt="" 
                          className={styles.trainerAvatarTable} 
                        />
                      ) : (
                        <div className={styles.trainerAvatarPlaceholder}>
                          <User size={14} />
                        </div>
                      )}
                      {tr.name}
                    </div>
                  </td>

                  <td>
                    <div className="flex flex-wrap gap-2">
                      {tr.trainingTypes.map(t => <span key={t} className="badge badge-info">{t}</span>)}
                    </div>
                  </td>
                  <td>
                    <button 
                      className="btn btn-secondary p-2" 
                      onClick={() => handleDelete('trainers', tr.id, tr.name)}

                      disabled={saving}
                      title="Delete Trainer"
                      aria-label="Delete Trainer"
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
                <div className={`mt-4 ${styles.dropdownWrapper}`}>
                  <button 
                    className={`form-input flex-between w-full ${styles.dropdownTrigger}`}
                    onClick={() => setDesignationDropdownOpen(!designationDropdownOpen)}
                  >
                    <span className={editingRule.designation.values.length > 0 ? styles.dropdownTriggerTextActive : styles.dropdownTriggerText}>
                      {editingRule.designation.values.length > 0 
                        ? `${editingRule.designation.values.length} Selected` 
                        : "Select Designations..."}
                    </span>
                    <ChevronDown size={16} className={styles.chevronIcon} />
                  </button>
                  
                  {designationDropdownOpen && (
                    <div className={styles.dropdownMenu}>
                      {DESIGNATIONS.map(d => {
                        const isSelected = editingRule.designation.values.includes(d);
                        return (
                          <label
                            key={d}
                            className={`flex items-center gap-3 p-2 cursor-pointer rounded ${styles.dropdownItem}`}
                          >
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={(e) => {
                                const next = e.target.checked 
                                  ? [...editingRule.designation.values, d]
                                  : editingRule.designation.values.filter(v => v !== d);
                                setEditingRule({ ...editingRule, designation: { ...editingRule.designation, values: next } });
                              }}
                              className={styles.dropdownCheckbox}
                            />
                            <span className={`${styles.dropdownItemLabel} ${isSelected ? styles.dropdownItemLabelSelected : styles.dropdownItemLabelUnselected}`}>{d}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  
                  {editingRule.designation.values.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {editingRule.designation.values.map(v => (
                        <span key={v} className={`badge badge-primary flex gap-2 items-center ${styles.selectedBadge}`}>
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
                    <div key={t} className={styles.dropdownWrapper}>
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
                        <div className={styles.prerequisiteDropdown}>
                          <div className="text-xs text-muted mb-2 px-1">Designations required to have completed {t}:<br/><i>(Leave empty for all designations)</i></div>
                          {DESIGNATIONS.map(d => {
                            const isDesignationSelected = req.designations.includes(d);
                            return (
                              <label
                                key={d}
                                className={`flex items-center gap-3 p-2 cursor-pointer rounded ${styles.dropdownItem}`}
                              >
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
                                  className={styles.dropdownCheckbox}
                                />
                                <span className={`${styles.dropdownItemLabel} ${isDesignationSelected ? styles.dropdownItemLabelSelected : styles.dropdownItemLabelUnselected}`}>{d}</span>
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
              <div className="flex gap-4 mt-3">
                {['ALL', 'RANGE'].map(m => (
                  <button 
                    key={m} 
                    className={`btn ${editingRule.aplExperience.mode === m ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setEditingRule({ ...editingRule, aplExperience: { ...editingRule.aplExperience, mode: m as any } })}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {editingRule.aplExperience.mode === 'RANGE' && (
                <div className="flex gap-8 mt-4">
                <div className="flex gap-8 mt-4">
                  <div className="form-group flex-1">
                    <label htmlFor="min-years">Min Years</label>
                    <input id="min-years" name="minYears" type="number" className="form-input" value={editingRule.aplExperience.min} onChange={e => setEditingRule({ ...editingRule, aplExperience: { ...editingRule.aplExperience, min: parseInt(e.target.value) } })} aria-label="Min Years" />
                  </div>
                  <div className="form-group flex-1">
                    <label htmlFor="max-years">Max Years</label>
                    <input id="max-years" name="maxYears" type="number" className="form-input" value={editingRule.aplExperience.max} onChange={e => setEditingRule({ ...editingRule, aplExperience: { ...editingRule.aplExperience, max: parseInt(e.target.value) } })} aria-label="Max Years" />
                  </div>
                </div>
                </div>
              )}
            </div>

            <div className="rule-section">
              <h4>4. Constraint Logic (Special)</h4>
              <div className="flex flex-col gap-4 mt-3">
                <label className={`flex items-center gap-3 glass-panel p-4 cursor-pointer ${editingRule.specialConditions.noAPInNext90Days ? styles.conditionLabelActive : styles.conditionLabelInactive}`}>
                  <input type="checkbox" checked={editingRule.specialConditions.noAPInNext90Days} onChange={e => setEditingRule({ ...editingRule, specialConditions: { ...editingRule.specialConditions, noAPInNext90Days: e.target.checked } })} />
                  <div>
                    <div className={styles.conditionTitle}>Capsule Lock</div>
                    <div className={`text-muted ${styles.conditionDesc}`}>Ineligible if any AP training is scheduled within the next 90 days.</div>
                  </div>
                </label>
                <label className={`flex items-center gap-3 glass-panel p-4 cursor-pointer ${editingRule.specialConditions.preAPOnlyIfInvited ? styles.conditionLabelActive : styles.conditionLabelInactive}`}>
                  <input type="checkbox" checked={editingRule.specialConditions.preAPOnlyIfInvited} onChange={e => setEditingRule({ ...editingRule, specialConditions: { ...editingRule.specialConditions, preAPOnlyIfInvited: e.target.checked } })} />
                  <div>
                    <div className={styles.conditionTitle}>Invitation Only (Pre-AP)</div>
                    <div className={`text-muted ${styles.conditionDesc}`}>Ineligible unless the employee exists in the active nominations pool for AP.</div>
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


