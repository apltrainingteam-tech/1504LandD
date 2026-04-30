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
import { getCollection, upsertDoc, updateDocument } from '../engines/apiClient';
import { EligibilityRule, NotificationRecord, TrainingBatch } from '../../types/attendance';
import { ValidationError } from '../contracts/validation.contract';
import { DataEdit } from '../contracts/edit.contract';
import { applyEdits } from '../engines/editEngine';
import { validateTrainingData, validateNominationData, validateEmployeeData } from '../engines/validationEngine';
import { Employee } from '../../types/employee';

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
  loading: boolean;
  
  addTrainer: (trainer: Omit<Trainer, 'id'>) => Promise<void>;
  updateTrainer: (id: string, updates: Partial<Trainer>) => Promise<void>;
  deleteTrainer: (id: string) => Promise<void>;
  
  addTeam: (team: Omit<Team, 'id'>) => Promise<void>;
  updateTeam: (id: string, updates: Partial<Team>) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;

  addCluster: (name: string) => Promise<void>;

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
  { id: "SUNIL", name: "Sunil", code: "SUN", category: "HO", status: "Active", avatarUrl: null },
  { id: "RUTUJA", name: "Rutuja", code: "RUT", category: "HO", status: "Active", avatarUrl: null },
  { id: "VIVEKANAND", name: "Vivekanand", code: "VIV", category: "HO", status: "Active", avatarUrl: null },
  { id: "SULEENA", name: "Suleena", code: "SUL", category: "HO", status: "Active", avatarUrl: null },
  { id: "ROMY", name: "Romy", code: "ROM", category: "HO", status: "Active", avatarUrl: null },
  { id: "MEIRAJ", name: "Meiraj", code: "MEI", category: "HO", status: "Active", avatarUrl: null },
  { id: "TEJAS", name: "Tejas", code: "TEJ", category: "HO", status: "Active", avatarUrl: null },
  { id: "PRAMOD", name: "Pramod", code: "PRA", category: "RTM", status: "Active", avatarUrl: null },
  { id: "KAUSHIK", name: "Kaushik", code: "KAU", category: "RTM", status: "Active", avatarUrl: null },
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
      const [tBD, tmBD, cBD, rulesBD] = await Promise.all([
        getCollection('trainers'),
        getCollection('teams'),
        getCollection('clusters'),
        getCollection('eligibility_rules')
      ]);

      setTrainers(tBD.length > 0 ? tBD as Trainer[] : INITIAL_TRAINERS);
      setTeams(tmBD.length > 0 ? tmBD as Team[] : INITIAL_TEAMS);
      setClusters(cBD.length > 0 ? cBD as Cluster[] : INITIAL_CLUSTERS);
      setEligibilityRules(rulesBD as EligibilityRule[]);
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
      const [td, emps, nh, tb] = await Promise.all([
        getCollection('training_data'),
        getCollection('employees'),
        getCollection('notification_history'),
        getCollection('training_batches')
      ]);
      
      // Separate nominations if they are marked in training_data
      const nominations = (td as any[]).filter(x => x.notified || x.data?.notified);

      setBaseData({
        trainingData: td as any[],
        nominationData: (td as any[]).filter(x => x.notified || x.data?.notified),
        employeeData: emps as Employee[],
        notificationHistory: nh as NotificationRecord[],
        trainingBatches: tb as TrainingBatch[]
      });


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

  // --- DEBUG INDEXES removed from context — built lazily in DataQualityCenter ---

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




