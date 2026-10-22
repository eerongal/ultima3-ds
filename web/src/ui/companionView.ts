import type { World } from '../game/world.ts';
import { Location } from '../game/party.ts';
import type { MapMode } from '../game/automap.ts';
import { isSettlementMap } from '../game/townMap.ts';

export enum CompanionView {
  Status = 'status',
  WorldMap = 'world-map',
  DungeonMap = 'dungeon-map',
  TownMap = 'town-map',
  Combat = 'combat',
}

/** Combat arenas never inherit the dungeon exploration layout from their origin. */
export function companionView(world: World, enabled: boolean): CompanionView {
  if (!enabled) return CompanionView.Status;
  if (world.combat) return CompanionView.Combat;
  if (world.party.location === Location.Dungeon) return CompanionView.DungeonMap;
  if (isSettlementMap(world)) return CompanionView.TownMap;
  return CompanionView.WorldMap;
}

/** The automatic two-screen layout leaves the user's saved single-screen view preference untouched. */
export function dungeonViewMode(world: World, companion: boolean): MapMode {
  return companionView(world, companion) === CompanionView.DungeonMap ? 'off' : world.mapMode;
}
