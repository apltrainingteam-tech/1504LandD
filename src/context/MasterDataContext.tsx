import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { getCollection, upsertDoc, updateDocument } from '../services/apiClient';

export interface Cluster {
  id: string;
  name: string;
}

export interface Trainer {
  id: string;
  trainerName: string;
  code: string;
  category: 'HO' | 'RTM';
  status: 'Active' | 'Inactive';
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
  loading: boolean;
  
  addTrainer: (trainer: Omit<Trainer, 'id'>) => Promise<void>;
  updateTrainer: (id: string, updates: Partial<Trainer>) => Promise<void>;
  deleteTrainer: (id: string) => Promise<void>;
  
  addTeam: (team: Omit<Team, 'id'>) => Promise<void>;
  updateTeam: (id: string, updates: Partial<Team>) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;

  addCluster: (name: string) => Promise<void>;
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

// Initial bootstrap data (Fallback if DB empty)
const INITIAL_TRAINERS: Trainer[] = [
  { id: "SUNIL", trainerName: "Sunil", code: "SUN", category: "HO", status: "Active" },
  { id: "RUTUJA", trainerName: "Rutuja", code: "RUT", category: "HO", status: "Active" },
  { id: "VIVEKANAND", trainerName: "Vivekanand", code: "VIV", category: "HO", status: "Active" },
  { id: "SULEENA", trainerName: "Suleena", code: "SUL", category: "HO", status: "Active" },
  { id: "ROMY", trainerName: "Romy", code: "ROM", category: "HO", status: "Active" },
  { id: "MEIRAJ", trainerName: "Meiraj", code: "MEI", category: "HO", status: "Active" },
  { id: "TEJAS", trainerName: "Tejas", code: "TEJ", category: "HO", status: "Active" },
  { id: "PRAMOD", trainerName: "Pramod", code: "PRA", category: "RTM", status: "Active" },
  { id: "KAUSHIK", trainerName: "Kaushik", code: "KAU", category: "RTM", status: "Active" },
  { id: "PRAYAS", trainerName: "Prayas", code: "PRY", category: "RTM", status: "Active" },
  { id: "SREENATH", trainerName: "Sreenath", code: "SRE", category: "RTM", status: "Active" }
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
  const [loading, setLoading] = useState(true);

  // Sync with DB
  const loadMasterData = async () => {
    setLoading(true);
    try {
      const [tBD, tmBD, cBD] = await Promise.all([
        getCollection('trainers'),
        getCollection('teams'),
        getCollection('clusters')
      ]);

      setTrainers(tBD.length > 0 ? tBD as Trainer[] : INITIAL_TRAINERS);
      setTeams(tmBD.length > 0 ? tmBD as Team[] : INITIAL_TEAMS);
      setClusters(cBD.length > 0 ? cBD as Cluster[] : INITIAL_CLUSTERS);
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
  }, []);

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

  return (
    <MasterDataContext.Provider value={{
      clusters, trainers, teams, loading,
      addTrainer, updateTrainer, deleteTrainer,
      addTeam, updateTeam, deleteTeam,
      addCluster
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
