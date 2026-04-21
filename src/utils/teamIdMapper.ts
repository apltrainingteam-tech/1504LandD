import { Team } from '../context/MasterDataContext';

/**
 * Maps a team code or team name to its stable teamId.
 * Used during data loading and migration.
 */
export function getTeamId(teamReference: string | undefined, masterTeams: Team[]): string {
  if (!teamReference) return 'UNKNOWN';
  
  // Normalize
  const ref = teamReference.trim().toUpperCase();
  
  // 1. Try to find by code
  const byCode = masterTeams.find(t => t.code.toUpperCase() === ref);
  if (byCode) return byCode.id;
  
  // 2. Try to find by name
  const byName = masterTeams.find(t => t.teamName.toUpperCase() === ref);
  if (byName) return byName.id;
  
  // 3. Try to find by id itself (if it's already an ID)
  const byId = masterTeams.find(t => t.id.toUpperCase() === ref);
  if (byId) return byId.id;

  return 'UNKNOWN';
}

/**
 * Returns the best display code for a teamId.
 */
export function getTeamCode(teamId: string | undefined, masterTeams: Team[]): string {
  if (!teamId) return '—';
  const team = masterTeams.find(t => t.id === teamId);
  return team ? team.code : teamId;
}

/**
 * Returns the full team name for a teamId.
 */
export function getTeamName(teamId: string | undefined, masterTeams: Team[]): string {
  if (!teamId) return '—';
  const team = masterTeams.find(t => t.id === teamId);
  return team ? team.teamName : teamId;
}
