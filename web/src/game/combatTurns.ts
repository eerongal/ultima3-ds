import type { World } from './world.ts';

export enum CombatPhase {
  Preparing = 'preparing',
  Party = 'party',
  Enemies = 'enemies',
}

/** Presentation metadata written by the combat loop; it never decides who acts. */
export interface CombatProgress {
  phase: CombatPhase;
  /** Current party member, or the next member being prepared; unused during the enemy phase. */
  member: number;
}

export interface CombatTurns {
  now: string;
  nextHeading: 'Up next' | 'Next round';
  next: string[];
  note: string | null;
}

function partyTurns(world: World, from: number): string[] {
  return Array.from({ length: world.party.size }, (_, member) => member)
    .filter((member) => member >= from && world.memberAlive(member))
    .map((member) => `${member + 1} ${world.member(member).name}`);
}

/** The pending sequence under current conditions, recalculated if a member dies/revives or time is negated. */
export function combatTurns(world: World): CombatTurns | null {
  const combat = world.combat;
  if (!combat) return null;
  if (!combat.monsters.some((monster) => monster.hp > 0)) return { now: 'Resolving', nextHeading: 'Up next', next: [], note: null };
  const progress = combat.progress ?? { phase: CombatPhase.Preparing, member: 0 };
  if (progress.phase === CombatPhase.Enemies) {
    return { now: 'Enemies act', nextHeading: 'Next round', next: partyTurns(world, 0), note: null };
  }
  const acting = progress.phase === CombatPhase.Party && world.memberAlive(progress.member);
  const now = acting ? `${progress.member + 1} ${world.member(progress.member).name}` : 'Preparing';
  const skipEnemies = world.timeNegate > 0 && !world.inExodusCastle();
  const pending = partyTurns(world, progress.member + (acting ? 1 : 0));
  if (!skipEnemies) pending.push('Enemies act');
  return {
    now,
    nextHeading: pending.length ? 'Up next' : 'Next round',
    next: pending.length ? pending : partyTurns(world, 0),
    note: skipEnemies ? 'Skip enemies' : null,
  };
}
