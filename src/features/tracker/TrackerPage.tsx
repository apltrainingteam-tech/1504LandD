import React, { useState, useMemo } from 'react';
import {
  Search, Filter, Calendar, Users, CheckCircle, Clock, AlertCircle,
  ChevronRight, ChevronDown, ArrowUpRight, ArrowDownRight, Activity, ClipboardList, User, Plus, Trash2, Target, Loader2
} from 'lucide-react';
import { useMasterData } from '../../core/context/MasterDataContext';
import { usePlanningFlow } from '../../core/context/PlanningFlowContext';
import TrainerAvatar from '../../shared/components/ui/TrainerAvatar';
import { toProperCase } from '../../core/engines/normalizationEngine';
import { ChecklistType } from '../../types/checklist';
import styles from './TrackerPage.module.css';
import { PlannedTaskForm } from './components/PlannedTaskForm';

interface ActivityRecord {
  id: string;
  trainingType: string;
  team: string;
  teamId: string;
  trainer: string;
  scheduledDate: string;
  actualDate?: string;
  status: 'Draft' | 'Approved' | 'Notified' | 'Ongoing' | 'Completed' | 'Cancelled';
  plannedCount: number;
  actualCount?: number;
  avgScore?: number;
  source: 'DRAFT' | 'BATCH';
}

const STATUS_CONFIG: Record<string, { className: string; icon: React.ElementType }> = {
  'Draft': { className: styles.statusDraft, icon: Clock },
  'Approved': { className: styles.statusApproved, icon: CheckCircle },
  'Notified': { className: styles.statusNotified, icon: AlertCircle },
  'Ongoing': { className: styles.statusOngoing, icon: Activity },
  'Completed': { className: styles.statusCompleted, icon: CheckCircle },
  'Cancelled': { className: styles.statusCancelled, icon: AlertCircle }
};

export const TrackerPage: React.FC = () => {
  const { finalData } = useMasterData();
  const { drafts } = usePlanningFlow();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const {
    checklistItems, toggleChecklistItem,
    plannedTasks, addPlannedTask, togglePlannedTaskCompletion, deletePlannedTask,
    newProducts, addNewProduct,
    trainers: masterTrainers
  } = useMasterData();

  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const handleSaveProduct = async () => {
    if (!newProductName.trim()) return;
    setIsSavingProduct(true);
    try {
      await addNewProduct(newProductName.trim());
      setIsAddProductModalOpen(false);
      setNewProductName('');
    } catch (error) {
      console.error('Failed to add product:', error);
      alert('Failed to add product. Please try again.');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const getTaskStatus = (task: any) => {
    if (task.completedAt) return 'Completed';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(task.dueDate);
    const planDate = new Date(task.planDate);

    if (today > dueDate) return 'Delayed';
    if (today >= planDate) return 'In Progress';
    return 'Not Started';
  };

  const activities = useMemo(() => {
    const list: ActivityRecord[] = [];
    // ... same mapping logic for drafts and batches ...

    // Map Drafts
    drafts.forEach(d => {
      // If there's a corresponding batch, we'll prefer the batch data later or mark it as ongoing
      const status: ActivityRecord['status'] = d.isCancelled ? 'Cancelled' :
        d.status === 'COMPLETED' ? 'Completed' :
          d.status === 'NOTIFIED' ? 'Notified' :
            d.status === 'APPROVED' ? 'Approved' : 'Draft';

      list.push({
        id: d.id,
        trainingType: d.trainingType,
        team: d.team,
        teamId: d.teamId,
        trainer: d.trainer || '',
        scheduledDate: d.startDate || '',
        status,
        plannedCount: d.candidates.length,
        source: 'DRAFT'
      });
    });

    // Map Batches (committed executions)
    finalData.trainingBatches.forEach(b => {
      // Find existing draft to update or add as new
      const existingIdx = list.findIndex(a => a.id === b.id || a.id === b.draftId);

      const presentCount = b.candidates.filter(c => c.attendance === 'present').length;
      const totalCount = b.candidates.length;
      const isCompleted = b.candidates.every(c => c.attendance !== 'pending');

      const scores = b.candidates
        .map(c => {
          const s = c.scores || {};
          const val = s.score ?? s.percent ?? s.tScore ?? Object.values(s).find(v => typeof v === 'number');
          return typeof val === 'number' ? val : parseFloat(val as any);
        })
        .filter(n => !isNaN(n));

      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : undefined;

      const activity: ActivityRecord = {
        id: b.id,
        trainingType: b.trainingType,
        team: b.team,
        teamId: b.teamId,
        trainer: typeof b.trainer === 'string' ? b.trainer : (b.trainer as any)?.id || '',
        scheduledDate: b.startDate,
        actualDate: b.committedAt,
        status: b.isVoided ? 'Cancelled' : (isCompleted ? 'Completed' : 'Ongoing'),
        plannedCount: totalCount,
        actualCount: presentCount,
        avgScore,
        source: 'BATCH'
      };

      if (existingIdx > -1) {
        list[existingIdx] = activity;
      } else {
        list.push(activity);
      }
    });

    return list.sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());
  }, [drafts, finalData.trainingBatches]);

  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      const matchesSearch = !search ||
        a.trainingType.toLowerCase().includes(search.toLowerCase()) ||
        a.team.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === 'ALL' || a.trainingType === filterType;
      const matchesStatus = filterStatus === 'ALL' || a.status === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [activities, search, filterType, filterStatus]);

  const stats = useMemo(() => {
    const total = activities.length;
    const completed = activities.filter(a => a.status === 'Completed').length;
    const ongoing = activities.filter(a => a.status === 'Ongoing' || a.status === 'Notified').length;
    const cancelled = activities.filter(a => a.status === 'Cancelled').length;

    return { total, completed, ongoing, cancelled };
  }, [activities]);

  const fmtDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const getTrainer = (id: string) => {
    return masterTrainers.find(t => t.id === id) || { id, name: id };
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Execution Tracker</h1>
          <p className={styles.subtitle}>Track training checklists and planned operational tasks</p>
        </div>
        <div className="flex gap-4">
          <button className="btn btn-primary" onClick={() => setShowTaskForm(true)}>
            <Plus size={16} className="mr-2" /> Add Planned Task
          </button>
        </div>
      </div>

      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <span className={styles.cardLabel}>Training Activities</span>
          <span className={styles.cardValue}>{stats.total}</span>
          <div className={`${styles.cardTrend} ${styles.trendUp}`}>
            <Activity size={14} /> <span>Live tracking</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.cardLabel}>Completed</span>
          <span className={styles.cardValue}>{stats.completed}</span>
          <div className={`${styles.cardTrend} ${styles.trendUp}`}>
            <CheckCircle size={14} /> <span>On target</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.cardLabel}>Ongoing / Notified</span>
          <span className={styles.cardValue}>{stats.ongoing}</span>
          <div className={`${styles.cardTrend} ${styles.trendUp}`}>
            <Clock size={14} /> <span>Active cycles</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.cardLabel}>Planned Tasks</span>
          <span className={styles.cardValue}>{plannedTasks.length}</span>
          <div className={`${styles.cardTrend} ${styles.trendUp}`}>
            <ClipboardList size={14} /> <span>Manual tasks</span>
          </div>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search..."
            className={styles.searchInput}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          className={styles.select}
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="ALL">All Training Types</option>
          <option value="IP">IP</option>
          <option value="AP">AP</option>
          <option value="MIP">MIP</option>
          <option value="Refresher">Refresher</option>
          <option value="Capsule">Capsule</option>
        </select>

        <select
          className={styles.select}
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="ALL">All Status</option>
          <option value="Draft">Draft</option>
          <option value="Approved">Approved</option>
          <option value="Notified">Notified</option>
          <option value="Ongoing">Ongoing</option>
          <option value="Completed">Completed</option>
          <option value="Delayed">Delayed</option>
        </select>
      </div>

      {/* SECTION 1: Training Checklists (Cards) */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <ClipboardList size={20} color="var(--accent-primary)" /> Training Checklists
        </h2>
        <div className={styles.checklistCardsGrid}>
          {filteredActivities.map(activity => {
            const items = checklistItems.filter(i => i.parentId === activity.id && i.checklistType === 'Training');
            const completedCount = items.filter(i => i.status === 'Completed').length;
            const totalCount = items.length;
            const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            const statusCfg = STATUS_CONFIG[activity.status] || STATUS_CONFIG['Draft'];
            const isExpanded = expandedSession === activity.id;

            return (
              <div key={activity.id} className={`${styles.checklistCard} ${isExpanded ? styles.cardExpanded : ''}`}>
                <div
                  className={styles.cardHeader}
                  onClick={() => setExpandedSession(isExpanded ? null : activity.id)}
                >
                  <div className={styles.cardHeaderMain}>
                    <div className={styles.cardIdentity}>
                      <span className={`${styles.typeBadge} ${styles['type' + activity.trainingType]}`}>{activity.trainingType}</span>
                      <h4 className={styles.cardTitle}>{toProperCase(activity.team)}</h4>
                    </div>
                    <div className={styles.cardMeta}>
                      <div className={styles.metaItem}>
                        <TrainerAvatar trainer={getTrainer(activity.trainer)} size={18} />
                        {getTrainer(activity.trainer).name}
                      </div>
                      <div className={styles.metaItem}><Calendar size={12} /> {fmtDate(activity.scheduledDate)}</div>
                    </div>
                  </div>
                  <div className={styles.cardStatusArea}>
                    <div className={styles.progressContainer}>
                      <span className={styles.progressLabel}>{completedCount}/{totalCount} Tasks</span>
                      <div className={styles.miniProgressTrack}>
                        <div className={styles.miniProgressBar} style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className={styles.cardContent}>
                    <SessionChecklist
                      parentId={activity.id}
                      checklistType="Training"
                      keyVal={activity.trainingType}
                      items={items}
                      onToggle={toggleChecklistItem}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {filteredActivities.length === 0 && (
            <div className={styles.emptyResults}>No training activities found.</div>
          )}
        </div>
      </section>

      <div className={styles.divider} />

      {/* NEW PRODUCT CHECKLISTS SECTION */}
      <section className={styles.section}>
        <div className="flex justify-between items-center mb-16">
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
            <Target size={20} color="var(--accent-primary)" /> New Product Checklists
          </h2>
          <button className="btn btn-primary btn-sm" onClick={() => setIsAddProductModalOpen(true)}>
            <Plus size={14} /> Add Product
          </button>
        </div>
        
        <div className={styles.checklistCardsGrid}>
          {newProducts.map(product => {
            const items = checklistItems.filter(i => i.parentId === product.id && i.checklistType === 'NewProduct');
            const completedCount = items.filter(i => i.status === 'Completed').length;
            const totalCount = items.length;
            const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            const isExpanded = expandedSession === product.id;

            return (
              <div key={product.id} className={`${styles.checklistCard} ${isExpanded ? styles.cardExpanded : ''}`}>
                <div
                  className={styles.cardHeader}
                  onClick={() => setExpandedSession(isExpanded ? null : product.id)}
                >
                  <div className={styles.cardHeaderMain}>
                    <div className={styles.cardIdentity}>
                      <span className={styles.typeBadge}>Product</span>
                      <h4 className={styles.cardTitle}>{product.productName}</h4>
                    </div>
                    <div className={styles.cardMeta}>
                      <div className={styles.metaItem}><Calendar size={12} /> Created: {new Date(product.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                    </div>
                  </div>
                  <div className={styles.cardStatusArea}>
                    <div className={styles.progressContainer}>
                      <span className={styles.progressLabel}>{completedCount}/{totalCount} Tasks</span>
                      <div className={styles.miniProgressTrack}>
                        <div className={styles.miniProgressBar} style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className={styles.cardContent}>
                    <SessionChecklist
                      parentId={product.id}
                      checklistType="NewProduct"
                      keyVal="New Product"
                      items={items}
                      onToggle={toggleChecklistItem}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {newProducts.length === 0 && (
            <div className={styles.emptyResults}>
              <p>No products added yet.</p>
              <button className="btn btn-secondary btn-sm mt-8" onClick={() => setIsAddProductModalOpen(true)}>
                <Plus size={14} /> Add Product
              </button>
            </div>
          )}
        </div>

        {/* Add Product Modal */}
        {isAddProductModalOpen && (
          <div className={styles.modalBackdrop}>
            <div className={`glass-panel ${styles.miniModal}`}>
              <h3>Add New Product</h3>
              <div className="mt-16">
                <label className="text-xs font-bold uppercase opacity-60">Product Name</label>
                <input 
                  autoFocus
                  className="form-input mt-4"
                  value={newProductName}
                  onChange={e => setNewProductName(e.target.value)}
                  placeholder="e.g. Revance Launch"
                  disabled={isSavingProduct}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newProductName.trim() && !isSavingProduct) {
                      handleSaveProduct();
                    }
                  }}
                />
              </div>
              <div className="flex gap-12 mt-24">
                <button 
                  className="btn btn-secondary flex-1" 
                  onClick={() => { setIsAddProductModalOpen(false); setNewProductName(''); }}
                  disabled={isSavingProduct}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary flex-1" 
                  disabled={!newProductName.trim() || isSavingProduct}
                  onClick={handleSaveProduct}
                >
                  {isSavingProduct ? (
                    <><Loader2 size={16} className="animate-spin mr-2" /> Saving...</>
                  ) : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <div className={styles.divider} />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <Activity size={20} color="var(--accent-primary)" /> Planned Tasks
        </h2>
        <div className={styles.tableContainer}>
          <table className={styles.plannedTable}>
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>✓</th>
                <th>Category</th>
                <th>Type</th>
                <th>Task</th>
                <th>Assignee</th>
                <th>Plan Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th style={{ width: '60px', textAlign: 'center' }}>Delete</th>
              </tr>
            </thead>
            <tbody>
              {plannedTasks
                .filter(t => {
                  const matchesSearch = !search || t.category.toLowerCase().includes(search.toLowerCase()) || t.type.toLowerCase().includes(search.toLowerCase());
                  const status = getTaskStatus(t);
                  const matchesStatus = filterStatus === 'ALL' || status === filterStatus;
                  return matchesSearch && matchesStatus;
                })
                .sort((a, b) => {
                  const sA = getTaskStatus(a);
                  const sB = getTaskStatus(b);

                  // Sort Order: Delayed -> In Progress -> Not Started -> Completed
                  const order = { 'Delayed': 0, 'In Progress': 1, 'Not Started': 2, 'Completed': 3 };
                  if (order[sA] !== order[sB]) return order[sA] - order[sB];

                  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                })
                .map(task => {
                  const status = getTaskStatus(task);
                  const isDelayed = status === 'Delayed';
                  const isCompleted = status === 'Completed';
                  const trainer = masterTrainers.find(tr => tr.id === task.assignee);

                  return (
                    <tr key={task.id} className={`${styles.tableTr} ${isCompleted ? styles.rowCompleted : ''}`}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          onChange={() => togglePlannedTaskCompletion(task.id)}
                          className={styles.checkbox}
                        />
                      </td>
                      <td className={`${styles.tdBold} ${isCompleted ? styles.strikeText : ''}`}>{task.category}</td>
                      <td className={isCompleted ? styles.strikeText : ''}>{task.type}</td>
                      <td className={isCompleted ? styles.strikeText : ''}>{task.task || '—'}</td>
                      <td>
                        <div className={`${styles.trainerCell} ${isCompleted ? styles.strikeText : ''}`}>
                          <TrainerAvatar trainer={trainer || { id: task.assignee, name: task.assignee }} size={26} />
                          <span style={{ marginLeft: '4px' }}>{trainer?.name || task.assignee}</span>
                        </div>
                      </td>
                      <td className={isCompleted ? styles.strikeText : ''}>{fmtDate(task.planDate)}</td>
                      <td className={isCompleted ? styles.strikeText : ''}>
                        <span className={isDelayed ? styles.textDelayed : ''}>
                          {fmtDate(task.dueDate)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${status === 'Completed' ? styles.bgSuccess :
                              status === 'Delayed' ? styles.bgDanger :
                                status === 'In Progress' ? styles.bgWarning :
                                  styles.bgDefault
                            }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn-icon text-danger"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this task?')) {
                              deletePlannedTask(task.id);
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              {plannedTasks.length === 0 && (
                <tr>
                  <td colSpan={9} className={styles.emptyTable}>No planned tasks configured.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showTaskForm && (
        <PlannedTaskForm
          onClose={() => setShowTaskForm(false)}
          onSubmit={async (data) => {
            await addPlannedTask(data);
            setShowTaskForm(false);
          }}
        />
      )}
    </div>
  );
};

const SessionChecklist: React.FC<{
  parentId: string;
  checklistType: ChecklistType;
  keyVal: string;
  items: any[];
  onToggle: (id: string) => void;
}> = ({ parentId, checklistType, keyVal, items, onToggle }) => {
  const { createChecklistForTraining } = useMasterData();
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [hasAttempted, setHasAttempted] = React.useState(false);

  // Auto-repair: If no items exist, trigger generation automatically from Master Settings
  React.useEffect(() => {
    if (items.length === 0 && keyVal && !hasAttempted && !isGenerating) {
      setIsGenerating(true);
      createChecklistForTraining(
        parentId,
        keyVal,
        'System',
        new Date().toISOString()
      ).finally(() => {
        setIsGenerating(false);
        setHasAttempted(true);
      });
    }
  }, [items.length, parentId, keyVal, createChecklistForTraining, hasAttempted, isGenerating]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.status === b.status) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return a.status === 'Pending' ? -1 : 1;
    });
  }, [items]);

  if (items.length === 0) {
    if (isGenerating) {
      return (
        <div className={styles.checklistEmpty}>
          <p>Generating checklist items...</p>
        </div>
      );
    }
    
    if (hasAttempted) {
      return (
        <div className={styles.checklistEmpty}>
          <p className="text-warning">No checklist template found for "{keyVal}" in Master Settings.</p>
        </div>
      );
    }

    return (
      <div className={styles.checklistEmpty}>
        <p>Loading checklist items...</p>
      </div>
    );
  }

  return (
    <div className={styles.checklistContainer}>
      <h4 className={styles.checklistTitle}>Action Checklist</h4>
      <div className={styles.taskList}>
        {sortedItems.map(item => {
          const isOverdue = item.status === 'Pending' && new Date(item.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
          return (
            <div
              key={item.id}
              className={`${styles.taskItem} ${item.status === 'Completed' ? styles.taskCompleted : ''} ${isOverdue ? styles.taskOverdue : ''}`}
            >
              <div className={styles.taskMain}>
                <input
                  type="checkbox"
                  checked={item.status === 'Completed'}
                  onChange={() => onToggle(item.id)}
                  className={styles.checkbox}
                />
                <span className={styles.taskName}>{item.taskName}</span>
              </div>
              <div className={styles.taskMeta}>
                <span className={styles.taskAssignee}><User size={12} /> {item.assignee}</span>
                <span className={styles.taskDue}><Calendar size={12} /> {new Date(item.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
