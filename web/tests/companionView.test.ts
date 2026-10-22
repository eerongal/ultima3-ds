import { describe, expect, it, vi } from 'vitest';
import { newWorld, savedCopy } from './helpers.ts';
import { CompanionView, companionView, dungeonViewMode } from '../src/ui/companionView.ts';
import { fitDungeonLevel } from '../src/ui/dungeonPanel.ts';
import { Screen } from '../src/ui/screen.ts';
import { Location } from '../src/game/party.ts';
import { MapId } from '../src/data/resources.ts';
import { DungeonCell } from '../src/game/world.ts';
import type { MapMode } from '../src/game/automap.ts';

function dungeon() {
  const world = newWorld();
  world.enterDungeon(MapId.FirstDungeon);
  world.party.location = Location.Dungeon;
  world.x = world.y = 1;
  return world;
}

interface DungeonScreen {
  upperMap: boolean;
  overlayShown: boolean;
  paintViewport(): void;
  paintDungeonPanel(): void;
  paintAutoMap(
    at: (x: number, y: number) => number,
    from: [number, number],
    size: [number, number],
    to: [number, number],
    party: [number, number],
    square?: number,
  ): void;
}

function harness(world = dungeon()) {
  const screen = Object.create(Screen.prototype) as Screen;
  const autoMap = vi.fn();
  const restoreText = vi.fn();
  Object.assign(screen, {
    world,
    upperMap: true,
    overlayShown: false,
    cell: 32,
    dungeonRenderer: null,
    ctx: { drawImage: vi.fn(), fillRect: vi.fn() },
    gfx: { drawUiPiece: vi.fn() },
    paintAutoMap: autoMap,
    black: vi.fn(),
    paintCompanionTitle: vi.fn(),
    redrawTextArea: restoreText,
    drawMember: vi.fn(),
    livingLeader: () => 0,
    secretDoor: () => ({}),
  });
  return { screen, state: screen as unknown as DungeonScreen, autoMap, restoreText, world };
}

describe('companion exploration context', () => {
  it('selects a dungeon level only for actual dungeon exploration with an active companion', () => {
    const world = dungeon();
    expect(companionView(world, true)).toBe(CompanionView.DungeonMap);
    expect(companionView(world, false)).toBe(CompanionView.Status);
    world.combat = { previousLocation: Location.Dungeon } as NonNullable<typeof world.combat>;
    expect(companionView(world, true)).toBe(CompanionView.Combat);
  });

  it.each([Location.Sosaria, Location.Ambrosia, Location.Town, Location.Castle, Location.Combat])(
    'retains the existing map for location %s in this first slice',
    (location) => {
      const world = newWorld();
      world.party.location = location;
      expect(companionView(world, true)).toBe(CompanionView.WorldMap);
    },
  );

  it.each<MapMode>(['off', 'small', 'full'])('keeps the saved %s preference intact while automatically showing first person', (mode) => {
    const world = dungeon();
    world.mapMode = mode;
    const before = savedCopy(world);
    expect(dungeonViewMode(world, true)).toBe('off');
    expect(dungeonViewMode(world, false)).toBe(mode);
    expect(world.mapMode).toBe(mode);
    expect(savedCopy(world)).toEqual(before);
  });
});

describe('side-by-side dungeon rendering', () => {
  it.each([
    { cols: 16, rows: 16 },
    { cols: 17, rows: 17 },
    { cols: 17, rows: 16 },
  ])('fits a $cols by $rows level inside the right panel', (level) => {
    const bounds = { left: 768, top: 32, side: 480 };
    const fit = fitDungeonLevel(level, bounds);
    expect(Number.isInteger(fit.square)).toBe(true);
    expect(fit.left).toBeGreaterThanOrEqual(bounds.left);
    expect(fit.top).toBeGreaterThanOrEqual(bounds.top);
    expect(fit.left + level.cols * fit.square).toBeLessThanOrEqual(bounds.left + bounds.side);
    expect(fit.top + level.rows * fit.square).toBeLessThanOrEqual(bounds.top + bounds.side);
  });

  it('suppresses both legacy overlays in dual-screen mode and restores the saved view on fallback', () => {
    const { state, world, autoMap, restoreText } = harness();
    for (const mode of ['small', 'full'] as const) {
      world.mapMode = mode;
      state.upperMap = false;
      state.paintViewport();
      expect(state.overlayShown).toBe(true);
      autoMap.mockClear();
      state.upperMap = true;
      state.paintViewport();
      expect(state.overlayShown).toBe(false);
      expect(autoMap).not.toHaveBeenCalled();
      expect(world.mapMode).toBe(mode);
    }
    expect(restoreText).toHaveBeenCalledTimes(2);
  });

  it('uses the current explored level without changing discovery or save data', () => {
    const { state, world, autoMap } = harness();
    world.dungeon.torch = 40;
    const before = savedCopy(world);
    const notes = world.autoMap.toText();
    state.paintDungeonPanel();
    expect(autoMap).toHaveBeenCalledTimes(1);
    const args = autoMap.mock.calls[0] as Parameters<DungeonScreen['paintAutoMap']>;
    expect(args[0](1, 1)).toBe(-1);
    expect(args[5]).toBeLessThanOrEqual(30);
    expect(world.autoMap.toText()).toBe(notes);
    expect(savedCopy(world)).toEqual(before);
    world.dungeon.torch = 0;
    state.paintDungeonPanel();
    const dark = autoMap.mock.calls[1] as Parameters<DungeonScreen['paintAutoMap']>;
    expect(dark[0](1, 1)).not.toBe(-1);
    expect(world.autoMap.toText()).toBe(notes);
  });

  it('scales dungeon pieces, subtle secret doors and the party together without painting unseen cells', () => {
    const { screen, state, world } = harness();
    world.putXYDng(DungeonCell.SecretDoor, 0, 0);
    const paint = Screen.prototype as unknown as DungeonScreen;
    const ctx = { fillRect: vi.fn(), drawImage: vi.fn() };
    const party = vi.fn();
    const pieces = vi.fn();
    Object.assign(screen, { ctx, drawMember: party, gfx: { drawUiPiece: pieces } });
    paint.paintAutoMap.call(state, (x, y) => (x === 0 && y === 0 ? 0 : -1), [0, 0], [2, 2], [768, 32], [0, 0], 28);
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 768, 32, 28, 28);
    expect(party).toHaveBeenCalledWith(0, 768, 32, 28);
    expect(pieces).not.toHaveBeenCalled();
  });
});
