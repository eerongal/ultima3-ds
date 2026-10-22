import { describe, expect, it } from 'vitest';
import { FakeIO, newWorld, savedCopy } from './helpers.ts';
import { combatSummary } from '../src/game/combatSummary.ts';
import { loadArena, chooseArena, damageMonster } from '../src/game/combat.ts';
import { Location } from '../src/game/party.ts';
import { MapValue } from '../src/game/tiles.ts';
import { MapId } from '../src/data/resources.ts';
import { companionView, CompanionView } from '../src/ui/companionView.ts';

function battle(count = 3) {
  const world = newWorld();
  const combat = loadArena(world, 404);
  combat.monsterShape = MapValue.Orc >> 1;
  combat.monsters.slice(0, count).forEach((monster) => Object.assign(monster, { hp: 20, shape: MapValue.Orc >> 1 }));
  world.combat = combat;
  world.party.location = Location.Combat;
  return { world, combat };
}

describe('read-only combat summary', () => {
  it('is absent outside combat, even with a stale combat location byte', () => {
    const world = newWorld();
    expect(combatSummary(world)).toBeNull();
    world.party.location = Location.Combat;
    expect(combatSummary(world)).toBeNull();
  });

  it('uses living occupied slots rather than arena capacity, party HP or a cached opening count', () => {
    const { world, combat } = battle();
    const before = savedCopy(world);
    const state = structuredClone(combat);
    expect(combatSummary(world)).toEqual({ name: 'Orcs', remaining: 3 });
    expect(savedCopy(world)).toEqual(before);
    expect(combat).toEqual(state);
    combat.monsters[0].hp = 0;
    expect(combatSummary(world)?.remaining).toBe(2);
    combat.monsters[1].hp = 0;
    combat.monsters[2].hp = 1;
    expect(combatSummary(world)).toEqual({ name: 'Orc', remaining: 1 });
  });

  it('tracks kills through the real damage function and exposes zero without claiming victory', () => {
    const { world, combat } = battle(2);
    const io = new FakeIO(world.resources);
    damageMonster(world, io, 0, 1, 0);
    expect(combatSummary(world)?.remaining).toBe(2);
    damageMonster(world, io, 0, 100, 0);
    expect(combatSummary(world)?.remaining).toBe(1);
    damageMonster(world, io, 1, 100, 0);
    expect(combatSummary(world)).toEqual({ name: 'Orcs', remaining: 0 });
    expect(world.combat).toBe(combat);
  });

  it.each([
    { variant: 1, singular: 'Goblin', plural: 'Goblins', portrait: 162 },
    { variant: 2, singular: 'Troll', plural: 'Trolls', portrait: 164 },
  ])('uses the real $singular variant identity', ({ variant, singular, plural, portrait }) => {
    const { world, combat } = battle(2);
    combat.monsterVariant = variant;
    combat.monsters.forEach((monster) => (monster.shape = portrait));
    expect(combatSummary(world)).toEqual({ name: plural, remaining: 2 });
    combat.monsters[0].hp = 0;
    expect(combatSummary(world)?.name).toBe(singular);
  });

  it('uses the actual boarding encounter instead of the overworld pirate ship name', () => {
    const { world, combat } = battle(2);
    combat.monsterShape = chooseArena(world, MapValue.Pirate >> 1).monsterShape;
    combat.monsters.forEach((monster) => (monster.shape = combat.monsterShape));
    expect(combatSummary(world)).toEqual({ name: 'Thieves', remaining: 2 });
  });

  it('handles a lone named opponent and all eight occupied slots without exposing hidden statistics', () => {
    const { world, combat } = battle(1);
    combat.monsterShape = MapValue.LordBritish >> 1;
    combat.monsters[0].shape = combat.monsterShape;
    expect(combatSummary(world)).toEqual({ name: 'Lord British', remaining: 1 });
    const guards = battle(8);
    guards.combat.monsterShape = MapValue.Guard >> 1;
    guards.combat.monsters.forEach((monster) => (monster.shape = MapValue.Guard >> 1));
    expect(combatSummary(guards.world)).toEqual({ name: 'Guards', remaining: 8 });
  });

  it.each([
    { location: Location.Sosaria, map: MapId.Sosaria, restored: CompanionView.WorldMap },
    { location: Location.Ambrosia, map: MapId.Ambrosia, restored: CompanionView.WorldMap },
    { location: Location.Town, map: MapId.FirstTown, restored: CompanionView.TownMap },
    { location: Location.Castle, map: MapId.LordBritishCastle, restored: CompanionView.TownMap },
    { location: Location.Castle, map: MapId.ExodusCastle, restored: CompanionView.TownMap },
    { location: Location.Dungeon, map: MapId.FirstDungeon, restored: CompanionView.DungeonMap },
  ])('overrides location $location during a fight and restores its existing context afterward', ({ location, map, restored }) => {
    const { world, combat } = battle();
    if (location === Location.Dungeon) world.enterDungeon(map);
    else world.enterMap(map);
    combat.previousLocation = location;
    world.party.location = Location.Combat;
    const before = savedCopy(world);
    expect(companionView(world, true)).toBe(CompanionView.Combat);
    expect(companionView(world, false)).toBe(CompanionView.Status);
    combatSummary(world);
    expect(savedCopy(world)).toEqual(before);
    world.combat = null;
    world.party.location = location;
    expect(companionView(world, true)).toBe(restored);
  });
});
