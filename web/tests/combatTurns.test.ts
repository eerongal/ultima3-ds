import { describe, expect, it, vi } from 'vitest';
import { FakeIO, newWorld, savedCopy } from './helpers.ts';
import { combatSummary } from '../src/game/combatSummary.ts';
import { combat as runCombat, loadArena } from '../src/game/combat.ts';
import { combatTurns, CombatPhase } from '../src/game/combatTurns.ts';
import { Location } from '../src/game/party.ts';
import { MapValue } from '../src/game/tiles.ts';
import { MapId } from '../src/data/resources.ts';
import { paintCombatPanel } from '../src/ui/combatPanel.ts';
import { Screen } from '../src/ui/screen.ts';
import type { GraphicsSet } from '../src/ui/graphics.ts';

function battle() {
  const world = newWorld();
  const combat = loadArena(world, 404);
  combat.monsterShape = MapValue.Orc >> 1;
  combat.monsters.slice(0, 3).forEach((monster) => Object.assign(monster, { hp: 20, shape: MapValue.Orc >> 1 }));
  world.combat = combat;
  world.party.location = Location.Combat;
  return { world, combat };
}

function memberLabel(world: ReturnType<typeof newWorld>, member: number) {
  return `${member + 1} ${world.member(member).name}`;
}

describe('actual combat turn flow', () => {
  it('shows the current member, remaining living party, then enemies without changing state', () => {
    const { world, combat } = battle();
    combat.progress = { phase: CombatPhase.Party, member: 1 };
    const before = savedCopy(world);
    const metadata = structuredClone(combat);
    expect(combatTurns(world)).toEqual({
      now: memberLabel(world, 1),
      nextHeading: 'Up next',
      next: [memberLabel(world, 2), memberLabel(world, 3), 'Enemies act'],
      note: null,
    });
    expect(savedCopy(world)).toEqual(before);
    expect(combat).toEqual(metadata);
  });

  it('omits dead/empty slots and re-adds a revived member if their turn is still ahead', () => {
    const { world, combat } = battle();
    combat.progress = { phase: CombatPhase.Party, member: 0 };
    world.member(1).status = 'D';
    world.party.setMemberRosterNumber(2, 0);
    expect(combatTurns(world)?.next).toEqual([memberLabel(world, 3), 'Enemies act']);
    world.member(1).status = 'G';
    expect(combatTurns(world)?.next).toEqual([memberLabel(world, 1), memberLabel(world, 3), 'Enemies act']);
  });

  it('labels enemy actions explicitly instead of treating stale activeMember as current', () => {
    const { world, combat } = battle();
    combat.activeMember = 3;
    combat.progress = { phase: CombatPhase.Enemies, member: -1 };
    expect(combatTurns(world)).toEqual({
      now: 'Enemies act',
      nextHeading: 'Next round',
      next: [0, 1, 2, 3].map((member) => memberLabel(world, member)),
      note: null,
    });
  });

  it('skips the enemy phase under time negation and labels the next round correctly', () => {
    const { world, combat } = battle();
    world.timeNegate = 1;
    combat.progress = { phase: CombatPhase.Party, member: 1 };
    expect(combatTurns(world)?.next).toEqual([memberLabel(world, 2), memberLabel(world, 3)]);
    expect(combatTurns(world)?.note).toBe('Skip enemies');
    combat.progress.member = 3;
    expect(combatTurns(world)?.nextHeading).toBe('Next round');
    expect(combatTurns(world)?.next).toEqual([0, 1, 2, 3].map((member) => memberLabel(world, member)));
  });

  it('respects the existing Exodus rule that prevents time negation', () => {
    const { world, combat } = battle();
    combat.previousLocation = Location.Castle;
    world.party.surfaceX = world.resources.misc.locationX[1];
    world.timeNegate = 2;
    combat.progress = { phase: CombatPhase.Party, member: 3 };
    expect(combatTurns(world)?.next).toEqual(['Enemies act']);
    expect(combatTurns(world)?.note).toBeNull();
  });

  it('shows preparation for old snapshots and resolution at zero without declaring victory', () => {
    const { world, combat } = battle();
    delete combat.progress;
    combat.activeMember = 3;
    expect(combatTurns(world)?.now).toBe('Preparing');
    expect(combatTurns(world)?.next).toEqual([...[0, 1, 2, 3].map((member) => memberLabel(world, member)), 'Enemies act']);
    combat.monsters.forEach((monster) => (monster.hp = 0));
    expect(combatTurns(world)).toEqual({ now: 'Resolving', nextHeading: 'Up next', next: [], note: null });
    world.combat = null;
    expect(combatTurns(world)).toBeNull();
  });

  it.each([0, 1])('observes actual engine phases through a complete encounter with timeNegate=%i', async (timeNegate) => {
    const world = newWorld();
    world.enterMap(MapId.FirstTown);
    world.party.location = Location.Town;
    world.current.tiles.fill(MapValue.Grass);
    world.monsters.bytes.fill(0);
    world.x = world.y = 32;
    world.timeNegate = timeNegate;
    const io = new FakeIO(world.resources);
    const members: number[] = [];
    let enemiesSeen = false;
    io.redrawMap = () => {
      enemiesSeen ||= world.combat?.progress?.phase === CombatPhase.Enemies;
    };
    io.waitCommand = async () => {
      const state = world.combat!;
      expect(state.progress?.phase).toBe(CombatPhase.Party);
      expect(state.progress?.member).toBe(state.activeMember);
      expect(combatTurns(world)?.now).toBe(memberLabel(world, state.activeMember));
      members.push(state.activeMember);
      if (members.length === 5) state.monsters.forEach((monster) => (monster.hp = 0));
      if (members.length > 5) throw new Error('Unexpected extra turn');
      return ' ';
    };
    await runCombat(world, io, MapValue.Orc >> 1, 0);
    expect(members).toEqual([0, 1, 2, 3, 0]);
    expect(enemiesSeen).toBe(timeNegate === 0);
    expect(world.combat).toBeNull();
    expect(world.party.location).toBe(Location.Town);
    expect(io.output).toContain('VICTORY');
  });
});

describe('combat turn panel presentation', () => {
  it('fits the current actor, five pending rows and compact enemy footer inside the panel', () => {
    const { world } = battle();
    const glyph = vi.fn<GraphicsSet['drawGlyph']>();
    const gfx = { drawGlyph: glyph } as unknown as GraphicsSet;
    paintCombatPanel({} as CanvasRenderingContext2D, gfx, combatSummary(world)!, combatTurns(world)!, {
      left: 768,
      top: 32,
      side: 480,
      cell: 32,
    });
    expect(glyph.mock.calls.every(([, , x, y, size]) => x >= 768 && y >= 32 && x + size <= 1248 && y + size <= 512)).toBe(true);
    expect(
      glyph.mock.calls
        .filter(([, , , y]) => y === 480)
        .map(([, ch]) => ch)
        .join(''),
    ).toBe('Remaining: 3');
    expect(
      glyph.mock.calls
        .filter(([, , , y]) => y === 320)
        .map(([, ch]) => ch)
        .join(''),
    ).toBe('Enemies act');
  });

  it('updates through the real Screen painter and keeps prompts/messages untouched', () => {
    const { world, combat } = battle();
    const screen = Object.create(Screen.prototype) as Screen;
    const black = vi.fn();
    const glyph = vi.fn<GraphicsSet['drawGlyph']>();
    const ctx = { save: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(), restore: vi.fn() };
    const textRows = [['T', 'e', 's', 't']];
    Object.assign(screen, { world, cell: 32, ctx, gfx: { drawGlyph: glyph }, black, paintCompanionTitle: vi.fn(), textRows });
    const state = screen as unknown as { paintCombatPanel(): void };
    const before = savedCopy(world);
    state.paintCombatPanel();
    expect(savedCopy(world)).toEqual(before);
    combat.monsters.forEach((monster) => (monster.hp = 0));
    state.paintCombatPanel();
    expect(black).toHaveBeenCalledTimes(2);
    expect(black).toHaveBeenLastCalledWith(24, 1, 15, 15);
    expect(textRows).toEqual([['T', 'e', 's', 't']]);
    expect(glyph.mock.calls.at(-1)?.[1]).toBe('0');
  });

  it('bounds long names without allowing them to cover the count or frame', () => {
    const glyph = vi.fn<GraphicsSet['drawGlyph']>();
    const gfx = { drawGlyph: glyph } as unknown as GraphicsSet;
    paintCombatPanel(
      {} as CanvasRenderingContext2D,
      gfx,
      { name: 'A remarkably long encounter name', remaining: 0 },
      { now: 'A very long character name', nextHeading: 'Up next', next: [], note: null },
      { left: 768, top: 32, side: 480, cell: 32 },
    );
    expect(glyph.mock.calls.every(([, , x, , size]) => x >= 768 && x + size <= 1248)).toBe(true);
    expect(glyph.mock.calls.at(-1)?.[1]).toBe('0');
  });
});
