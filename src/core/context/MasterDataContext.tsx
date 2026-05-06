import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';


/**
 * MasterDataContext
 * 
 * THE SOURCE OF TRUTH for reference and configuration data.
 * 
 * RESPONSIBILITIES:
 * 1. Fetch and store master datasets (Clusters, Trainers, Teams, Eligibility Rules).
 * 2. Provide a globally accessible state for static/reference data.
 * 3. Centralize API calls for metadata to reduce redundant network traffic.
 * 
 * ⚠️ ARCHITECTURAL GUARDRAILS:
 * - DO NOT store transient UI state or computation results here.
 * - DO NOT import domain engines (IP, AP, etc.) here. Use it ONLY for core metadata.
 * - ENSURE all consumers use the useMasterData() hook for access.
 */
import { getCollection, upsertDoc, updateDocument, deleteDocument } from '../engines/apiClient';
import { EligibilityRule, NotificationRecord, TrainingBatch, NewProduct } from '../../types/attendance';
import { generateChecklistForTraining } from '../engines/checklistEngine';
import { ValidationError } from '../contracts/validation.contract';
import { DataEdit } from '../contracts/edit.contract';
import { applyEdits } from '../engines/editEngine';
import { validateTrainingData, validateNominationData, validateEmployeeData } from '../engines/validationEngine';
import { Employee } from '../../types/employee';
import { normalizeDataset, normalizeEmployeeRecord, processTeamData } from '../engines/normalizationEngine';
import { ChecklistTemplate, ChecklistItem, ChecklistTaskTemplate } from '../../types/checklist';
import { TaskMasterEntry, PlannedTask, RecurrenceType } from '../../types/task';

export interface Cluster {
  id: string;
  name: string;
}

export interface Trainer {
  id: string;
  name: string;
  code: string;
  category: 'HO' | 'RTM';
  status: 'Active' | 'Inactive';
  avatarUrl: string | null;
}


export interface Team {
  id: string;
  teamName: string;
  code: string;
  cluster: string;
  status: 'Active' | 'Inactive';
}

interface MasterDataContextType {
  clusters: Cluster[];
  trainers: Trainer[];
  teams: Team[];
  eligibilityRules: EligibilityRule[];
  checklistTemplates: ChecklistTemplate[];
  checklistItems: ChecklistItem[];
  taskMaster: TaskMasterEntry[];
  plannedTasks: PlannedTask[];
  newProducts: NewProduct[];
  loading: boolean;
  
  addTrainer: (trainer: Omit<Trainer, 'id'>) => Promise<void>;
  updateTrainer: (id: string, updates: Partial<Trainer>) => Promise<void>;
  deleteTrainer: (id: string) => Promise<void>;
  
  addTeam: (team: Omit<Team, 'id'>) => Promise<void>;
  updateTeam: (id: string, updates: Partial<Team>) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;

  addCluster: (name: string) => Promise<void>;

  // Checklist Handlers
  addChecklistTemplate: (template: ChecklistTemplate) => Promise<void>;
  updateChecklistTemplate: (template: ChecklistTemplate) => Promise<void>;
  deleteChecklistTemplate: (id: string) => Promise<void>;
  toggleChecklistItem: (itemId: string) => Promise<void>;
  createChecklistForTraining: (trainingId: string, trainingType: string, trainer: string, triggerDate: string) => Promise<void>;

  // Task Master & Planned Tasks Handlers
  addTaskMasterEntry: (entry: TaskMasterEntry) => Promise<void>;
  updateTaskMasterEntry: (entry: TaskMasterEntry) => Promise<void>;
  deleteTaskMasterEntry: (id: string) => Promise<void>;
  addPlannedTask: (task: Omit<PlannedTask, 'id' | 'status'>) => Promise<void>;
  updatePlannedTask: (id: string, updates: Partial<PlannedTask>) => Promise<void>;
  togglePlannedTaskCompletion: (id: string) => Promise<void>;
  deletePlannedTask: (id: string) => Promise<void>;
  addNewProduct: (name: string) => Promise<void>;

  // --- NEW: Data Quality & Edit Layer ---
  baseData: {
    trainingData: any[];
    nominationData: any[];
    employeeData: Employee[];
    notificationHistory: NotificationRecord[];
    trainingBatches: TrainingBatch[];
  };
  finalData: {
    trainingData: any[];
    nominationData: any[];
    employeeData: Employee[];
    notificationHistory: NotificationRecord[];
    trainingBatches: TrainingBatch[];
  };
  edits: DataEdit[];
  validationErrors: ValidationError[];
  activeError: ValidationError | null;

  addEdit: (edit: DataEdit) => void;
  bulkEdit: (edits: DataEdit[]) => void;
  clearEdits: (module?: string) => void;
  setActiveError: (error: ValidationError | null) => void;
  refreshTransactional: () => Promise<void>;
  errorIndex: {
    byType: Record<string, ValidationError[]>;
    byField: Record<string, ValidationError[]>;
    byValue: Record<string, ValidationError[]>;
  };

  patchRecord: (module: "trainingData" | "nomination" | "employee", recordId: string, field: string, newValue: any) => void;
}



const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

// Initial bootstrap data (Fallback if DB empty)
const INITIAL_TRAINERS: Trainer[] = [
  { id: "SUNIL", name: "Sunil", code: "SUN", category: "HO", status: "Active", avatarUrl: "C:\\Users\\sunils\\.gemini\antigravity\\brain\\4e2958f8-d96a-4e61-8be8-00d407b017e6\\trainer_sunil_1778065448523.png" },
  { id: "RUTUJA", name: "Rutuja", code: "RUT", category: "HO", status: "Active", avatarUrl: "C:\\Users\\sunils\\.gemini\antigravity\\brain\\4e2958f8-d96a-4e61-8be8-00d407b017e6\\trainer_rutuja_1778065471914.png" },
  { id: "VIVEKANAND", name: "Vivekanand", code: "VIV", category: "HO", status: "Active", avatarUrl: "C:\\Users\\sunils\\.gemini\antigravity\\brain\\4e2958f8-d96a-4e61-8be8-00d407b017e6\\trainer_vivekanand_1778065490464.png" },
  { id: "SULEENA", name: "Suleena", code: "SUL", category: "HO", status: "Active", avatarUrl: "C:\\Users\\sunils\\.gemini\antigravity\\brain\\4e2958f8-d96a-4e61-8be8-00d407b017e6\\trainer_suleena_1778065514366.png" },
  { id: "ROMY", name: "Romy", code: "ROM", category: "HO", status: "Active", avatarUrl: "C:\\Users\\sunils\\.gemini\antigravity\\brain\\4e2958f8-d96a-4e61-8be8-00d407b017e6\\trainer_romy_meiraj_1778065537955.png" },
  { id: "MEIRAJ", name: "Meiraj", code: "MEI", category: "HO", status: "Active", avatarUrl: "C:\\Users\\sunils\\.gemini\antigravity\\brain\\4e2958f8-d96a-4e61-8be8-00d407b017e6\\trainer_romy_meiraj_1778065537955.png" },
  { id: "TEJAS", name: "Tejas", code: "TEJ", category: "HO", status: "Active", avatarUrl: null },
  { id: "PRAMOD", name: "Pramod", code: "PRA", category: "RTM", status: "Active", avatarUrl: null },
  { id: "KAUSHIK", name: "Kaushik", code: "KAU", category: "RTM", status: "Active", avatarUrl: "C:\\Users\\sunils\\.gemini\antigravity\\brain\\4e2958f8-d96a-4e61-8be8-00d407b017e6\\trainer_rtm_kaushik_1778065614461.png" },
  { id: "PRAYAS", name: "Prayas", code: "PRY", category: "RTM", status: "Active", avatarUrl: null },
  { id: "SREENATH", name: "Sreenath", code: "SRE", category: "RTM", status: "Active", avatarUrl: null }

];

const INITIAL_CLUSTERS: Cluster[] = [
  { id: "CARDIAC", name: "CARDIAC" },
  { id: "OPHTHAL", name: "OPHTHAL" },
  { id: "DERMA", name: "DERMA" },
  { id: "MAX", name: "MAX" },
  { id: "NEPHRO", name: "NEPHRO" },
  { id: "GYNAEC", name: "GYNAEC" },
  { id: "DENTAL", name: "DENTAL" }
];

const INITIAL_TEAMS: Team[] = [
  { id: "RVA", teamName: "REVANCE", code: "RVA", cluster: "CARDIAC", status: "Active" },
  { id: "NVA", teamName: "NUVENTA", code: "NVA", cluster: "CARDIAC", status: "Active" },
  { id: "SLS", teamName: "SOLESTA", code: "SLS", cluster: "CARDIAC", status: "Active" },
  { id: "ACA", teamName: "AVECEA", code: "ACA", cluster: "DERMA", status: "Active" }
];

export const MasterDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [eligibilityRules, setEligibilityRules] = useState<EligibilityRule[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [taskMaster, setTaskMaster] = useState<TaskMasterEntry[]>([]);
  const [plannedTasks, setPlannedTasks] = useState<PlannedTask[]>([]);
  const [newProducts, setNewProducts] = useState<NewProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Transactional Data & Edits ---
  const [baseData, setBaseData] = useState<{
    trainingData: any[];
    nominationData: any[];
    employeeData: Employee[];
    notificationHistory: NotificationRecord[];
    trainingBatches: TrainingBatch[];
  }>({

    trainingData: [],
    nominationData: [],
    employeeData: [],
    notificationHistory: [],
    trainingBatches: []
  });

  const [edits, setEdits] = useState<DataEdit[]>([]);
  const [activeError, setActiveError] = useState<ValidationError | null>(null);

  // Removed Debug Layer State
  // Sync with DB
  const loadMasterData = async () => {
    setLoading(true);
    try {
      const [tBD, tmBD, cBD, rulesBD, checklistTemplatesBD, taskMasterBD, plannedTasksBD, checklistItemsBD, newProductsBD] = await Promise.all([
        getCollection('trainers'),
        getCollection('teams'),
        getCollection('clusters'),
        getCollection('eligibility_rules'),
        getCollection('checklist_templates'),
        getCollection('task_master'),
        getCollection('planned_tasks'),
        getCollection('checklist_items'),
        getCollection('new_products')
      ]);

      const sanitizedTrainers = (tBD as Trainer[]).map(t => {
        if (t.avatarUrl && (t.avatarUrl.includes(':\\') || t.avatarUrl.includes(':/') || t.avatarUrl.includes('Users/'))) {
          return { ...t, avatarUrl: null };
        }
        return t;
      });

      const normalizedTeams = (tmBD as Team[]).map(t => ({
        ...t,
        teamName: processTeamData(t.teamName).normalized
      }));

      setTrainers(sanitizedTrainers.length > 0 ? sanitizedTrainers : INITIAL_TRAINERS);
      setTeams(normalizedTeams.length > 0 ? normalizedTeams : INITIAL_TEAMS);
      setClusters(cBD.length > 0 ? cBD as Cluster[] : INITIAL_CLUSTERS);
      setEligibilityRules(rulesBD as EligibilityRule[]);
      setChecklistTemplates(checklistTemplatesBD as ChecklistTemplate[]);
      setTaskMaster(taskMasterBD as TaskMasterEntry[]);
    } catch (e) {
      console.warn("Falling back to INITIAL master data due to fetch error:", e);
      setTrainers(INITIAL_TRAINERS);
      setTeams(INITIAL_TEAMS);
      setClusters(INITIAL_CLUSTERS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
    loadTransactionalData();
  }, []);

  const loadTransactionalData = async () => {
    try {
      const [td, emps, nh, tb, checklistItemsBD, plannedTasksBD, newProductsBD] = await Promise.all([
        getCollection('training_data'),
        getCollection('employees'),
        getCollection('notification_history'),
        getCollection('training_batches'),
        getCollection('checklist_items'),
        getCollection('planned_tasks'),
        getCollection('new_products')
      ]);
      
      const rawTraining = td as any[];
      console.log("[MasterDataProvider] Raw Training Data Count:", rawTraining.length);
      console.log("[MasterDataProvider] Sample Raw Training Record:", rawTraining[0]);

      const normalizedTraining = normalizeDataset(rawTraining);
      console.log("[MasterDataProvider] Normalized Training Data Count:", normalizedTraining.length);
      console.log("[MasterDataProvider] Sample Normalized Training Record:", normalizedTraining[0]);

      const filteredTraining = normalizedTraining.filter(r => {
        const processed = processTeamData(r.team);
        if (processed.excluded) {
          console.log(`[MasterDataProvider] Excluding training record due to team: ${r.team}`);
        }
        return !processed.excluded;
      });
      console.log("[MasterDataProvider] Filtered Training Data Count (after team exclusion):", filteredTraining.length);
      console.log("[MasterDataProvider] Sample Filtered Training Record:", filteredTraining[0]);

      const normalizedEmployees = (emps as any[])
        .map(normalizeEmployeeRecord)
        .filter(r => !processTeamData(r.team).excluded);

      setBaseData({
        trainingData: filteredTraining,
        nominationData: filteredTraining.filter(x => x.notified || x.data?.notified),
        employeeData: normalizedEmployees as Employee[],
        notificationHistory: nh as NotificationRecord[],
        trainingBatches: tb as TrainingBatch[]
      });
      setChecklistItems(checklistItemsBD as ChecklistItem[]);
      setPlannedTasks(plannedTasksBD as PlannedTask[]);
      setNewProducts(newProductsBD as NewProduct[] || []);


    } catch (e) {
      console.error("Failed to load transactional data:", e);
    }
  };

  // --- Derived State: Final Data & Validation ---
  const finalData = useMemo(() => {
    return {
      trainingData: applyEdits(baseData.trainingData, edits, 'trainingData'),
      nominationData: applyEdits(baseData.nominationData, edits, 'nomination'),
      employeeData: applyEdits(baseData.employeeData, edits, 'employee'),
      notificationHistory: baseData.notificationHistory, // Edits not yet supported for history
      trainingBatches: baseData.trainingBatches
    };
  }, [baseData, edits]);

  const validationErrors = useMemo(() => {
    const masterInfo = {
      employeeIds: new Set(finalData.employeeData.map((e: Employee) => String(e.employeeId))),
      teamNames: new Set(teams.map(t => t.teamName.toUpperCase())),
      trainerIds: new Set(trainers.map(t => t.id)),
      rawMasterTeams: teams.map(t => t.teamName)
    };


    return [
      ...validateTrainingData(finalData.trainingData, masterInfo),
      ...validateNominationData(finalData.nominationData, masterInfo),
      ...validateEmployeeData(finalData.employeeData, masterInfo)
    ];
  }, [finalData, teams, trainers]);

  // --- Edit Handlers ---
  const addEdit = (edit: DataEdit) => {
    setEdits(prev => [...prev, edit]);
  };

  const bulkEdit = (newEdits: DataEdit[]) => {
    setEdits(prev => [...prev, ...newEdits]);
  };

  const clearEdits = (module?: string) => {
    if (module) {
      setEdits(prev => prev.filter(e => e.module !== module));
    } else {
      setEdits([]);
    }
  };

  // Trainer Handlers
  const addTrainer = async (t: Omit<Trainer, 'id'>) => {
    const id = t.code.toUpperCase();
    const newTrainer = { ...t, id };
    await upsertDoc('trainers', id, newTrainer);
    setTrainers(prev => [...prev.filter(x => x.id !== id), newTrainer]);
  };

  const updateTrainer = async (id: string, updates: Partial<Trainer>) => {
    const existing = trainers.find(x => x.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    await updateDocument('trainers', id, updated);
    setTrainers(prev => prev.map(t => t.id === id ? updated : t));
  };

  const deleteTrainer = async (id: string) => {
    await updateTrainer(id, { status: 'Inactive' });
  };

  // Team Handlers
  const addTeam = async (t: Omit<Team, 'id'>) => {
    const id = t.code.toUpperCase();
    const newTeam = { ...t, id };
    await upsertDoc('teams', id, newTeam);
    setTeams(prev => [...prev.filter(x => x.id !== id), newTeam]);
  };

  const updateTeam = async (id: string, updates: Partial<Team>) => {
    const existing = teams.find(x => x.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    await updateDocument('teams', id, updated);
    setTeams(prev => prev.map(t => t.id === id ? updated : t));
  };

  const deleteTeam = async (id: string) => {
    await updateTeam(id, { status: 'Inactive' });
  };

  const addCluster = async (name: string) => {
    const id = name.toUpperCase().replace(/\s/g, '_');
    if (!clusters.find(c => c.id === id)) {
      const newCluster = { id, name };
      await upsertDoc('clusters', id, newCluster);
      setClusters(prev => [...prev, newCluster]);
    }
  };

  // --- Checklist Template Handlers ---
  const addChecklistTemplate = async (template: ChecklistTemplate) => {
    await upsertDoc('checklist_templates', template.id, template);
    setChecklistTemplates(prev => [...prev.filter(t => t.id !== template.id), template]);
  };

  const updateChecklistTemplate = async (template: ChecklistTemplate) => {
    await updateDocument('checklist_templates', template.id, template);
    setChecklistTemplates(prev => prev.map(t => t.id === template.id ? template : t));
  };

  const deleteChecklistTemplate = async (id: string) => {
    await updateDocument('checklist_templates', id, { status: 'Deleted' }); // Or real delete if preferred
    setChecklistTemplates(prev => prev.filter(t => t.id !== id));
  };

  // --- Checklist Item Logic ---
  const toggleChecklistItem = async (itemId: string) => {
    const item = checklistItems.find(i => i.id === itemId);
    if (!item) return;

    const updated: ChecklistItem = {
      ...item,
      status: item.status === 'Pending' ? 'Completed' : 'Pending',
      completedAt: item.status === 'Pending' ? new Date().toISOString() : undefined
    };

    await updateDocument('checklist_items', itemId, updated);
    setChecklistItems(prev => prev.map(i => i.id === itemId ? updated : i));
  };

  const createChecklistForTraining = async (trainingId: string, trainingType: string, trainer: string, triggerDate: string) => {
    const newItems = await generateChecklistForTraining({
      parentId: trainingId,
      checklistType: 'Training',
      key: trainingType,
      trainer,
      triggerDate
    });

    if (newItems && newItems.length > 0) {
      setChecklistItems(prev => [...prev, ...newItems]);
    }
  };

  // --- Task Master Handlers ---
  const addTaskMasterEntry = async (entry: TaskMasterEntry) => {
    await upsertDoc('task_master', entry.id, entry);
    setTaskMaster(prev => [...prev, entry]);
  };

  const updateTaskMasterEntry = async (entry: TaskMasterEntry) => {
    await updateDocument('task_master', entry.id, entry);
    setTaskMaster(prev => prev.map(e => e.id === entry.id ? entry : e));
  };

  const deleteTaskMasterEntry = async (id: string) => {
    await updateDocument('task_master', id, { status: 'Deleted' });
    setTaskMaster(prev => prev.filter(e => e.id !== id));
  };

  // --- Planned Task Logic ---
  const addPlannedTask = async (taskData: Omit<PlannedTask, 'id' | 'status'>) => {
    const id = `pt-${Date.now()}`;
    const newTask: PlannedTask = { ...taskData, id, status: 'Not Started' };
    await upsertDoc('planned_tasks', id, newTask);
    setPlannedTasks(prev => [...prev, newTask]);

    // Trigger New Product Checklist if applicable
    if (taskData.category === 'New Product') {
      const newItems = await generateChecklistForTraining({
        parentId: id,
        checklistType: 'NewProduct',
        key: taskData.type,
        trainer: taskData.assignee, // Defaulting assignee as trainer for checklist
        triggerDate: taskData.planDate
      });

      if (newItems && newItems.length > 0) {
        setChecklistItems(prev => [...prev, ...newItems]);
      }
    }
  };

  const updatePlannedTask = async (id: string, updates: Partial<PlannedTask>) => {
    const existing = plannedTasks.find(t => t.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    await updateDocument('planned_tasks', id, updated);
    setPlannedTasks(prev => prev.map(t => t.id === id ? updated : t));
  };

  const togglePlannedTaskCompletion = async (id: string) => {
    const task = plannedTasks.find(t => t.id === id);
    if (!task) return;

    const isChecked = !task.completedAt;
    const updated: PlannedTask = {
      ...task,
      completedAt: isChecked ? new Date().toISOString() : undefined
    };

    await updateDocument('planned_tasks', id, updated);
    setPlannedTasks(prev => prev.map(t => t.id === id ? updated : t));
  };

  const deletePlannedTask = async (id: string) => {
    await deleteDocument('planned_tasks', id);
    setPlannedTasks(prev => prev.filter(t => t.id !== id));
  };

  const addNewProduct = async (productName: string) => {
    const id = `np-${Date.now()}`;
    const newProd: NewProduct = {
      id,
      productName,
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Persist Product
      await upsertDoc('new_products', id, newProd);
      setNewProducts(prev => [...prev, newProd]);

      // 2. AUTO CHECKLIST GENERATION (Non-blocking if possible, but for reliability we await)
      const newItems = await generateChecklistForTraining({
        parentId: id,
        checklistType: 'NewProduct',
        key: 'New Product',
        triggerDate: newProd.createdAt
      });

      if (newItems && newItems.length > 0) {
        setChecklistItems(prev => [...prev, ...newItems]);
      }
    } catch (error) {
      console.error('[MasterData] Failed to create new product or checklist', error);
      throw error;
    }
  };

  const errorIndex = useMemo(() => {
    const idx = {
      byType: {} as Record<string, ValidationError[]>,
      byField: {} as Record<string, ValidationError[]>,
      byValue: {} as Record<string, ValidationError[]>,
    };

    validationErrors.forEach((err: ValidationError) => {
      const typeKey = err.errorType;
      const fieldKey = err.field;
      const valueKey = String(err.value || 'NULL');

      if (!idx.byType[typeKey]) idx.byType[typeKey] = [];
      if (!idx.byField[fieldKey]) idx.byField[fieldKey] = [];
      if (!idx.byValue[valueKey]) idx.byValue[valueKey] = [];

      idx.byType[typeKey].push(err);
      idx.byField[fieldKey].push(err);
      idx.byValue[valueKey].push(err);
    });

    return idx;
  }, [validationErrors]);

  // --- DEBUG INDEXES removed from context — built lazily in DataQualityCenter —

  const patchRecord = (module: "trainingData" | "nomination" | "employee", recordId: string, field: string, newValue: any) => {
    addEdit({
      id: `edit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      module: module,
      recordId,
      field,
      newValue,
      timestamp: Date.now(),
      status: 'applied'
    });
  };

  return (
    <MasterDataContext.Provider value={{
      clusters, trainers, teams, eligibilityRules, loading,
      addTrainer, updateTrainer, deleteTrainer,
      addTeam, updateTeam, deleteTeam,
      addCluster,
      addChecklistTemplate, updateChecklistTemplate, deleteChecklistTemplate,
      checklistTemplates, checklistItems, toggleChecklistItem, createChecklistForTraining,
      taskMaster, plannedTasks, newProducts, addTaskMasterEntry, updateTaskMasterEntry, deleteTaskMasterEntry,
      addPlannedTask, updatePlannedTask, togglePlannedTaskCompletion, deletePlannedTask,
      addNewProduct,
      baseData, finalData, edits, validationErrors, activeError,
      addEdit, bulkEdit, clearEdits, setActiveError, refreshTransactional: loadTransactionalData, errorIndex,
      patchRecord,
    }}>
      {children}
    </MasterDataContext.Provider>
  );
};

export const useMasterData = () => {
  const context = useContext(MasterDataContext);
  if (context === undefined) {
    throw new Error('useMasterData must be used within a MasterDataProvider');
  }
  return context;
};




