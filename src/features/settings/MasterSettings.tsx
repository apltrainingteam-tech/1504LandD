import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, Settings, Users, Layers, AlertCircle } from 'lucide-react';
import { useMasterData, Trainer, Team, Cluster } from '../../context/MasterDataContext';

export const MasterSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'trainers' | 'teams'>('trainers');
  const { 
    trainers, teams, clusters, 
    addTrainer, updateTrainer, deleteTrainer,
    addTeam, updateTeam, deleteTeam,
    addCluster 
  } = useMasterData();

  const [showModal, setShowModal] = useState<any>(null); // { type: 'trainer' | 'team', mode: 'add' | 'edit', data?: any }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Settings size={32} color="var(--accent-primary)" /> Master Data Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Manage Trainers, Teams, and Cluster mappings</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px' }}>
        <button 
          onClick={() => setActiveTab('trainers')}
          style={{ 
            padding: '12px 24px', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'trainers' ? '3px solid var(--accent-primary)' : '3px solid transparent',
            color: activeTab === 'trainers' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Users size={18} /> Trainers
        </button>
        <button 
          onClick={() => setActiveTab('teams')}
          style={{ 
            padding: '12px 24px', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'teams' ? '3px solid var(--accent-primary)' : '3px solid transparent',
            color: activeTab === 'teams' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Layers size={18} /> Teams & Clusters
        </button>
      </div>

      {activeTab === 'trainers' ? (
        <TrainersList 
          trainers={trainers} 
          onAdd={() => setShowModal({ type: 'trainer', mode: 'add' })}
          onEdit={(t) => setShowModal({ type: 'trainer', mode: 'edit', data: t })}
          onDelete={deleteTrainer}
        />
      ) : (
        <TeamsList 
          teams={teams}
          clusters={clusters}
          onAdd={() => setShowModal({ type: 'team', mode: 'add' })}
          onEdit={(t) => setShowModal({ type: 'team', mode: 'edit', data: t })}
          onDelete={deleteTeam}
          onAddCluster={addCluster}
        />
      )}

      {showModal && (
        <MasterModal 
          config={showModal} 
          onClose={() => setShowModal(null)} 
          onSubmit={(data) => {
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
  <div className="glass-panel" style={{ padding: '0' }}>
    <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h3 style={{ margin: 0 }}>Trainer Directory</h3>
      <button className="btn btn-primary" onClick={onAdd}><Plus size={16} /> Add Trainer</button>
    </div>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', background: 'rgba(0,0,0,0.02)' }}>
            <th style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>Trainer Name</th>
            <th style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>Code</th>
            <th style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>Category</th>
            <th style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>Status</th>
            <th style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {trainers.map((t: Trainer) => (
            <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: t.status === 'Inactive' ? 0.5 : 1 }}>
              <td style={{ padding: '16px 24px', fontWeight: 600 }}>{t.trainerName}</td>
              <td style={{ padding: '16px 24px' }}><code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px' }}>{t.code}</code></td>
              <td style={{ padding: '16px 24px' }}>
                <span className={`badge ${t.category === 'HO' ? 'badge-primary' : 'badge-secondary'}`}>{t.category}</span>
              </td>
              <td style={{ padding: '16px 24px' }}>
                <span className={`badge ${t.status === 'Active' ? 'badge-success' : ''}`}>{t.status}</span>
              </td>
              <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => onEdit(t)}><Edit2 size={14} /></button>
                  {t.status === 'Active' && <button className="btn" style={{ padding: '6px', color: 'var(--danger)' }} onClick={() => onDelete(t.id)}><Trash2 size={14} /></button>}
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
  <div className="glass-panel" style={{ padding: '0' }}>
    <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h3 style={{ margin: 0 }}>Team & Cluster Mapping</h3>
      <div style={{ display: 'flex', gap: '12px' }}>
         <button className="btn btn-secondary" onClick={() => {
           const name = prompt("Enter new Cluster name:");
           if (name) onAddCluster(name);
         }}>+ Add Cluster</button>
         <button className="btn btn-primary" onClick={onAdd}><Plus size={16} /> Add Team</button>
      </div>
    </div>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', background: 'rgba(0,0,0,0.02)' }}>
            <th style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>Team Name</th>
            <th style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>Code</th>
            <th style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>Cluster</th>
            <th style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>Status</th>
            <th style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t: Team) => (
            <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: t.status === 'Inactive' ? 0.5 : 1 }}>
              <td style={{ padding: '16px 24px', fontWeight: 600 }}>{t.teamName}</td>
              <td style={{ padding: '16px 24px' }}><code>{t.code}</code></td>
              <td style={{ padding: '16px 24px' }}><span className="badge">{t.cluster}</span></td>
              <td style={{ padding: '16px 24px' }}>
                <span className={`badge ${t.status === 'Active' ? 'badge-success' : ''}`}>{t.status}</span>
              </td>
              <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => onEdit(t)}><Edit2 size={14} /></button>
                  {t.status === 'Active' && <button className="btn" style={{ padding: '6px', color: 'var(--danger)' }} onClick={() => onDelete(t.id)}><Trash2 size={14} /></button>}
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
    trainerName: '',
    code: '',
    category: 'HO',
    status: 'Active',
    teamName: '',
    cluster: clusters[0]?.id || ''
  });

  const isTrainer = config.type === 'trainer';
  const originalCode = config.data?.code || '';

  const handleSave = () => {
    const code = formData.code.trim().toUpperCase();
    if (code.length < 2) return alert("Code must be at least 2 characters.");

    // Uniqueness check
    const isDuplicate = isTrainer 
      ? existingTrainers.some((t: any) => t.code === code && t.id !== config.data?.id)
      : existingTeams.some((t: any) => t.code === code && t.id !== config.data?.id);

    if (isDuplicate) return alert(`Code "${code}" already exists in the system.`);

    if (config.mode === 'edit' && code !== originalCode) {
      if (!confirm(`Are you sure you want to change the code from "${originalCode}" to "${code}"? This will update the display code across all dashboards.`)) {
        return;
      }
    }

    onSubmit({ ...formData, code });
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ width: '400px', padding: '0' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{config.mode === 'add' ? 'Add' : 'Edit'} {isTrainer ? 'Trainer' : 'Team'}</h3>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={onClose}><X /></button>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isTrainer ? (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Trainer Name</label>
                <input className="form-input" value={formData.trainerName} onChange={e => setFormData({...formData, trainerName: e.target.value})} placeholder="e.g. Sunil" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Code (Short Form)</label>
                <input className="form-input" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} placeholder="e.g. SUN" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Category</label>
                <select className="form-input" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                  <option value="HO">HO (Authorized for all)</option>
                  <option value="RTM">RTM (Limited Access)</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Team Name</label>
                <input className="form-input" value={formData.teamName} onChange={e => setFormData({...formData, teamName: e.target.value})} placeholder="e.g. REVANCE" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Code</label>
                <input className="form-input" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} placeholder="e.g. RVA" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Cluster</label>
                <select className="form-input" value={formData.cluster} onChange={e => setFormData({...formData, cluster: e.target.value})}>
                  {clusters.map((c: Cluster) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                   ))}
                </select>
              </div>
            </>
          )}
          {config.mode === 'edit' && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Status</label>
              <select className="form-input" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          )}
        </div>
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
           <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
           <button className="btn btn-primary" onClick={handleSave}><Save size={16} /> Save Changes</button>
        </div>
      </div>
    </div>
  );
}
