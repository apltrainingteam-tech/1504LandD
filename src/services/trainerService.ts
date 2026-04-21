import { normalizeTrainingType } from './reportService';

export interface Trainer {
  id: string;
  trainerName: string;
  category: 'HO' | 'RTM';
}

export const TRAINERS: Trainer[] = [
  { id: "SUNIL", trainerName: "Sunil", category: "HO" },
  { id: "RUTUJA", trainerName: "Rutuja", category: "HO" },
  { id: "VIVEKANAND", trainerName: "Vivekanand", category: "HO" },
  { id: "SULEENA", trainerName: "Suleena", category: "HO" },
  { id: "ROMY", trainerName: "Romy", category: "HO" },
  { id: "MEIRAJ", trainerName: "Meiraj", category: "HO" },
  { id: "TEJAS", trainerName: "Tejas", category: "HO" },

  { id: "PRAMOD", trainerName: "Pramod", category: "RTM" },
  { id: "KAUSHIK", trainerName: "Kaushik", category: "RTM" },
  { id: "PRAYAS", trainerName: "Prayas", category: "RTM" },
  { id: "SREENATH", trainerName: "Sreenath", category: "RTM" }
];

const RTM_ALLOWED_TYPES = ["IP", "Pre_AP", "Capsule", "Refresher"];

export function getAvailableTrainers(selectedTrainingType: string, trainers: Trainer[] = TRAINERS): Trainer[] {
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
}
