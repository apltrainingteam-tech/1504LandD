import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, Settings, Users, Layers } from 'lucide-react';
import { useMasterData, Trainer, Team, Cluster } from '../../context/MasterDataContext';
import styles from './MasterSettings.module.css';

export const MasterSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'trainers' | 'teams'>('trainers');
  const {
    trainers, teams, clusters,
    addTrainer, updateTrainer, deleteTrainer,
    addTeam, updateTeam, deleteTeam,
    addCluster
  } = useMasterData();

  const [showModal, setShowModal] = useState<any>(null);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          <Settings size={32} color="var(--accent-primary)" /> Master Data Settings
        </h1>
        <p className={styles.pageSubtitle}>Manage Trainers, Teams, and Cluster mappings</p>
      </div>

      {/* Tabs */}
      <div className={styles.tabBar}>
        <button
          onClick={() => setActiveTab('trainers')}
          className={`${styles.tabBtn} ${activeTab === 'trainers' ? styles.tabBtnActive : styles.tabBtnInactive}`}
        >
          <Users size={18} /> Trainers
        </button>
        <button
          onClick={() => setActiveTab('teams')}
          className={`${styles.tabBtn} ${activeTab === 'teams' ? styles.tabBtnActive : styles.tabBtnInactive}`}
        >
          <Layers size={18} /> Teams &amp; Clusters
        </button>
      </div>

      {activeTab === 'trainers' ? (
        <TrainersList
          trainers={trainers}
          onAdd={() => setShowModal({ type: 'trainer', mode: 'add' })}
          onEdit={(t: Trainer) => setShowModal({ type: 'trainer', mode: 'edit', data: t })}
          onDelete={deleteTrainer}
        />
      ) : (
        <TeamsList
          teams={teams}
          clusters={clusters}
          onAdd={() => setShowModal({ type: 'team', mode: 'add' })}
          onEdit={(t: Team) => setShowModal({ type: 'team', mode: 'edit', data: t })}
          onDelete={deleteTeam}
          onAddCluster={addCluster}
        />
      )}

      {showModal && (
        <MasterModal
          config={showModal}
          onClose={() => setShowModal(null)}
          onSubmit={(data: any) => {
            if (showModal.type === 'trainer') {
              if (showModal.mode === 'add') addTrainer(data);
              else updateTrainer(showModal.data.id, data);
            } else {
              if (showModal.mode === 'add') addTeam(data);
              else updateTeam(showModal.data.id, data);
            }
            setShowModal(null);
          }}
          clusters={clusters}
          existingTrainers={trainers}
          existingTeams={teams}
        />
      )}
    </div>
  );
};

const TrainersList = ({ trainers, onAdd, onEdit, onDelete }: any) => (
  <div className={`glass-panel ${styles.panelNoPad}`}>
    <div className={styles.panelHeader}>
      <h3 className={styles.panelHeaderTitle}>Trainer Directory</h3>
      <button className="btn btn-primary" onClick={onAdd}><Plus size={16} /> Add Trainer</button>
    </div>
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.theadTr}>
            <th className={styles.th}>Trainer Name</th>
            <th className={styles.th}>Code</th>
            <th className={styles.th}>Category</th>
            <th className={styles.th}>Status</th>
            <th className={styles.thRight}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {trainers.map((t: Trainer) => (
            <tr key={t.id} className={`${styles.tr} ${t.status === 'Inactive' ? styles.trInactive : ''}`}>
              <td className={styles.tdBold}>{t.trainerName}</td>
              <td className={styles.td}><code className={styles.codeTag}>{t.code}</code></td>
              <td className={styles.td}>
                <span className={`badge ${t.category === 'HO' ? 'badge-primary' : 'badge-secondary'}`}>{t.category}</span>
              </td>
              <td className={styles.td}>
                <span className={`badge ${t.status === 'Active' ? 'badge-success' : ''}`}>{t.status}</span>
              </td>
              <td className={styles.tdRight}>
                <div className={styles.actionGroup}>
                  <button className={`btn btn-secondary ${styles.iconBtn}`} onClick={() => onEdit(t)} title="Edit Trainer" aria-label="Edit Trainer"><Edit2 size={14} /></button>
                  {t.status === 'Active' && <button className={`btn ${styles.iconBtnDanger}`} onClick={() => onDelete(t.id)} title="Delete Trainer" aria-label="Delete Trainer"><Trash2 size={14} /></button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const TeamsList = ({ teams, clusters, onAdd, onEdit, onDelete, onAddCluster }: any) => (
  <div className={`glass-panel ${styles.panelNoPad}`}>
    <div className={styles.panelHeader}>
      <h3 className={styles.panelHeaderTitle}>Team &amp; Cluster Mapping</h3>
      <div className={styles.panelHeaderActions}>
        <button className="btn btn-secondary" onClick={() => { const name = prompt('Enter new Cluster name:'); if (name) onAddCluster(name); }}>+ Add Cluster</button>
        <button className="btn btn-primary" onClick={onAdd}><Plus size={16} /> Add Team</button>
      </div>
    </div>
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.theadTr}>
            <th className={styles.th}>Team Name</th>
            <th className={styles.th}>Code</th>
            <th className={styles.th}>Cluster</th>
            <th className={styles.th}>Status</th>
            <th className={styles.thRight}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t: Team) => (
            <tr key={t.id} className={`${styles.tr} ${t.status === 'Inactive' ? styles.trInactive : ''}`}>
              <td className={styles.tdBold}>{t.teamName}</td>
              <td className={styles.td}><code>{t.code}</code></td>
              <td className={styles.td}><span className="badge">{t.cluster}</span></td>
              <td className={styles.td}>
                <span className={`badge ${t.status === 'Active' ? 'badge-success' : ''}`}>{t.status}</span>
              </td>
              <td className={styles.tdRight}>
                <div className={styles.actionGroup}>
                  <button className={`btn btn-secondary ${styles.iconBtn}`} onClick={() => onEdit(t)} title="Edit Team" aria-label="Edit Team"><Edit2 size={14} /></button>
                  {t.status === 'Active' && <button className={`btn ${styles.iconBtnDanger}`} onClick={() => onDelete(t.id)} title="Delete Team" aria-label="Delete Team"><Trash2 size={14} /></button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const MasterModal = ({ config, onClose, onSubmit, clusters, existingTrainers, existingTeams }: any) => {
  const [formData, setFormData] = useState(config.data || {
    trainerName: '', code: '', category: 'HO', status: 'Active',
    teamName: '', cluster: clusters[0]?.id || ''
  });

  const isTrainer = config.type === 'trainer';
  const originalCode = config.data?.code || '';

  const handleSave = () => {
    const code = formData.code.trim().toUpperCase();
    if (code.length < 2) return alert('Code must be at least 2 characters.');
    const isDuplicate = isTrainer
      ? existingTrainers.some((t: any) => t.code === code && t.id !== config.data?.id)
      : existingTeams.some((t: any) => t.code === code && t.id !== config.data?.id);
    if (isDuplicate) return alert(`Code "${code}" already exists in the system.`);
    if (config.mode === 'edit' && code !== originalCode) {
      if (!confirm(`Are you sure you want to change the code from "${originalCode}" to "${code}"?`)) return;
    }
    onSubmit({ ...formData, code });
  };

  return (
    <div className={styles.backdrop}>
      <div className={`glass-panel ${styles.modal}`}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{config.mode === 'add' ? 'Add' : 'Edit'} {isTrainer ? 'Trainer' : 'Team'}</h3>
          <button className={styles.closeBtn} onClick={onClose} title="Close Modal" aria-label="Close Modal"><X /></button>
        </div>
        <div className={styles.modalBody}>
          {isTrainer ? (
            <>
              <div>
                <label className={styles.fieldLabel}>Trainer Name</label>
                <input className="form-input" value={formData.trainerName} onChange={e => setFormData({ ...formData, trainerName: e.target.value })} placeholder="e.g. Sunil" />
              </div>
              <div>
                <label className={styles.fieldLabel}>Code (Short Form)</label>
                <input className="form-input" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="e.g. SUN" />
              </div>
              <div>
                <label className={styles.fieldLabel}>Category</label>
                <select className="form-input" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} title="Select Category" aria-label="Select Category">
                  <option value="HO">HO (Authorized for all)</option>
                  <option value="RTM">RTM (Limited Access)</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={styles.fieldLabel}>Team Name</label>
                <input className="form-input" value={formData.teamName} onChange={e => setFormData({ ...formData, teamName: e.target.value })} placeholder="e.g. REVANCE" />
              </div>
              <div>
                <label className={styles.fieldLabel}>Code</label>
                <input className="form-input" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="e.g. RVA" />
              </div>
              <div>
                <label className={styles.fieldLabel}>Cluster</label>
                <select className="form-input" value={formData.cluster} onChange={e => setFormData({ ...formData, cluster: e.target.value })} title="Select Cluster" aria-label="Select Cluster">
                  {clusters.map((c: Cluster) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          {config.mode === 'edit' && (
            <div>
              <label className={styles.fieldLabel}>Status</label>
              <select className="form-input" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} title="Select Status" aria-label="Select Status">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}><Save size={16} /> Save Changes</button>
        </div>
      </div>
    </div>
  );
};
