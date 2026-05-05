/**
 * Trainer Engine
 * ⚠️ DO NOT IMPORT IN COMPONENTS — USE HOOKS ONLY
 */
import { normalizeTrainingType } from './normalizationEngine';

export interface Trainer {
  id: string;
  name: string;
  category: 'HO' | 'RTM';
  avatarUrl: string | null;
}


export const TRAINERS: Trainer[] = [
  { id: "SUNIL", name: "Sunil", category: "HO", avatarUrl: null },
  { id: "RUTUJA", name: "Rutuja", category: "HO", avatarUrl: null },
  { id: "VIVEKANAND", name: "Vivekanand", category: "HO", avatarUrl: null },
  { id: "SULEENA", name: "Suleena", category: "HO", avatarUrl: null },
  { id: "ROMY", name: "Romy", category: "HO", avatarUrl: null },
  { id: "MEIRAJ", name: "Meiraj", category: "HO", avatarUrl: null },
  { id: "TEJAS", name: "Tejas", category: "HO", avatarUrl: null },

  { id: "PRAMOD", name: "Pramod", category: "RTM", avatarUrl: null },
  { id: "KAUSHIK", name: "Kaushik", category: "RTM", avatarUrl: null },
  { id: "PRAYAS", name: "Prayas", category: "RTM", avatarUrl: null },
  { id: "SREENATH", name: "Sreenath", category: "RTM", avatarUrl: null }
];

const RTM_ALLOWED_TYPES = ["IP", "Pre_AP", "Capsule", "Refresher"];

export const getAvailableTrainers = (selectedTrainingType: string, trainers: Trainer[] = TRAINERS): Trainer[] => {
  if (!selectedTrainingType) return trainers;

  const normalized = normalizeTrainingType(selectedTrainingType);

  const filtered = trainers.filter(trainer => {
    // HO trainers can conduct all trainings
    if (trainer.category === "HO") return true;

    // RTM trainers limited to specific trainings
    if (trainer.category === "RTM") {
      return RTM_ALLOWED_TYPES.includes(normalized);
    }

    return false;
  });

  // Safeguard: if empty, return HO trainers
  if (filtered.length === 0) {
    return trainers.filter(t => t.category === "HO");
  }

  return filtered;
};

