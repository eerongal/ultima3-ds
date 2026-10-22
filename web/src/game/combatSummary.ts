import type { World } from './world.ts';
import { monsterName } from './combat.ts';

/** Public encounter information only; no health, damage or other hidden monster statistics. */
export interface CombatSummary {
  name: string;
  remaining: number;
}

/** Battles contain one enemy type; HP > 0 is the engine's occupied/living slot rule. */
export function combatSummary(world: World): CombatSummary | null {
  const combat = world.combat;
  if (!combat) return null;
  const living = combat.monsters.filter((monster) => monster.hp > 0);
  return {
    name: monsterName(world, combat.monsterShape, combat.monsterVariant, living.length !== 1),
    remaining: living.length,
  };
}
