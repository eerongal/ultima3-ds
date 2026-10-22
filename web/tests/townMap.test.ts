import { describe, expect, it, vi } from 'vitest';
import { newWorld, savedCopy } from './helpers.ts';
import { MapId } from '../src/data/resources.ts';
import { Location } from '../src/game/party.ts';
import { MapValue } from '../src/game/tiles.ts';
import { isSettlementMap, townMarks, TownMarkKind } from '../src/game/townMap.ts';
import { companionView, CompanionView } from '../src/ui/companionView.ts';
import { mapTerrain, LiveMapArt } from '../src/ui/mapArt.ts';
import { paintTownMarks, TOWN_KEY } from '../src/ui/townPanel.ts';
import { Screen } from '../src/ui/screen.ts';
import type { GraphicsSet } from '../src/ui/graphics.ts';

function town(id: number = MapId.FirstTown) {
  const world = newWorld();
  world.enterMap(id);
  world.party.location = id < MapId.FirstTown ? Location.Castle : Location.Town;
  world.x = 1;
  world.y = 32;
  return world;
}

describe('town companion context', () => {
  it('selects entered towns and castles, with fallback and combat retaining their existing layouts', () => {
    const world = town();
    expect(companionView(world, true)).toBe(CompanionView.TownMap);
    expect(companionView(world, false)).toBe(CompanionView.Status);
    world.combat = { previousLocation: Location.Town } as NonNullable<typeof world.combat>;
    expect(companionView(world, true)).toBe(CompanionView.Combat);
    expect(townMarks(world)).toEqual([]);
    world.combat = null;
    world.enterMap(MapId.LordBritishCastle);
    world.party.location = Location.Castle;
    expect(companionView(world, true)).toBe(CompanionView.TownMap);
    expect(isSettlementMap(world)).toBe(true);
    expect(townMarks(world).length).toBeGreaterThan(0);
  });

  it.each(Array.from({ length: MapId.FirstDungeon - MapId.LordBritishCastle }, (_, i) => MapId.LordBritishCastle + i))(
    'uses the settlement panel and immediate markers in map %i without discovering terrain or changing game state',
    (id) => {
      const world = town(id);
      const before = savedCopy(world);
      const notes = world.autoMap.toText();
      const marks = townMarks(world);
      expect(isSettlementMap(world)).toBe(true);
      expect(companionView(world, true)).toBe(CompanionView.TownMap);
      expect(companionView(world, false)).toBe(CompanionView.Status);
      if (id >= MapId.FirstTown) expect(marks.some((mark) => mark.kind !== TownMarkKind.Talk)).toBe(true);
      expect(marks.some((mark) => mark.kind === TownMarkKind.Talk)).toBe(true);
      expect(marks.every(({ x, y }) => x >= 0 && y >= 0 && x < 64 && y < 64)).toBe(true);
      expect(mapTerrain(world, id).every((shape) => shape === -1)).toBe(true);
      expect(world.autoMap.toText()).toBe(notes);
      expect(savedCopy(world)).toEqual(before);
    },
  );

  it('marks Lord British at his audience square independently of dialogue indices and nearby jesters', () => {
    const world = town(MapId.LordBritishCastle);
    const king = 31;
    expect(world.monsters.type(king)).toBe(MapValue.LordBritish);
    expect(townMarks(world)).toContainEqual({ kind: TownMarkKind.Talk, x: 32, y: 14 });
    world.monsters.setHp(king, 0);
    world.current.talk.fill(0);
    expect(townMarks(world).filter((mark) => mark.kind === TownMarkKind.Talk)).toEqual([{ kind: TownMarkKind.Talk, x: 32, y: 14 }]);
    world.monsters.setPosition(king, 40, 40);
    expect(townMarks(world).filter((mark) => mark.kind === TownMarkKind.Talk)).toEqual([{ kind: TownMarkKind.Talk, x: 40, y: 40 }]);
    world.monsters.clear(king);
    expect(townMarks(world).filter((mark) => mark.kind === TownMarkKind.Talk)).toEqual([]);
  });

  it.each([MapId.LordBritishCastle, MapId.ExodusCastle])('returns from combat to the local castle map for %i', (id) => {
    const world = town(id);
    world.combat = { previousLocation: Location.Castle } as NonNullable<typeof world.combat>;
    expect(companionView(world, true)).toBe(CompanionView.Combat);
    expect(townMarks(world)).toEqual([]);
    world.combat = null;
    expect(companionView(world, true)).toBe(CompanionView.TownMap);
  });

  it.each([MapId.Sosaria, MapId.Ambrosia])('keeps continent %i out of the settlement layout even with a stale location flag', (id) => {
    const world = town(id);
    expect(companionView(world, true)).toBe(CompanionView.WorldMap);
    expect(isSettlementMap(world)).toBe(false);
    expect(townMarks(world)).toEqual([]);
  });

  it('uses actual customer rows for shop types and does not treat a clue-giving merchant as a shop', () => {
    const marks = townMarks(town());
    expect(marks).toContainEqual({ kind: TownMarkKind.Pub, x: 17, y: 16 });
    expect(marks).toContainEqual({ kind: TownMarkKind.Weapons, x: 39, y: 19 });
    expect(marks).toContainEqual({ kind: TownMarkKind.Armour, x: 50, y: 20 });
    expect(marks).toContainEqual({ kind: TownMarkKind.Food, x: 48, y: 49 });
    expect(marks).toContainEqual({ kind: TownMarkKind.Talk, x: 12, y: 51 });
    expect(marks.filter((mark) => mark.kind !== TownMarkKind.Talk)).toHaveLength(4);
    expect(marks).toContainEqual({ kind: TownMarkKind.Talk, x: 15, y: 16 }); // Dupre
  });

  it('groups adjacent identical counters while keeping different services distinct', () => {
    const marks = townMarks(town(410)); // Fawn's three healer counters
    expect(marks.filter((mark) => mark.kind === TownMarkKind.Healer)).toHaveLength(1);
    expect(marks.some((mark) => mark.kind === TownMarkKind.Guild)).toBe(true);
    expect(marks.some((mark) => mark.kind === TownMarkKind.Pub)).toBe(true);
    const dawn = townMarks(town(408));
    expect(dawn.filter((mark) => mark.kind === TownMarkKind.Horses)).toHaveLength(1);
    expect(dawn.some((mark) => mark.kind === TownMarkKind.Oracle)).toBe(true);
  });

  it('tracks people moving or disappearing without changing notes; nearby guards without dialogue are omitted', () => {
    const world = town();
    const notes = world.autoMap.toText();
    world.monsters.setPosition(13, 55, 60); // Dupre
    expect(townMarks(world)).toContainEqual({ kind: TownMarkKind.Talk, x: 55, y: 60 });
    world.monsters.clear(13);
    expect(townMarks(world)).not.toContainEqual({ kind: TownMarkKind.Talk, x: 55, y: 60 });
    expect(townMarks(world)).not.toContainEqual({ kind: TownMarkKind.Talk, x: 7, y: 30 });
    expect(world.autoMap.toText()).toBe(notes);
  });

  it('retains a shop when an NPC occupies its approach and removes it when the counter disappears', () => {
    const world = town();
    world.monsters.setType(0, MapValue.Guard);
    world.monsters.setPosition(0, 17, 16);
    world.monsters.setTileUnder(0, MapValue.Floor);
    world.putXYVal(MapValue.Guard, 17, 16);
    expect(townMarks(world)).toContainEqual({ kind: TownMarkKind.Pub, x: 17, y: 16 });
    world.putXYVal(MapValue.Floor, 17, 15);
    expect(townMarks(world).some((mark) => mark.kind === TownMarkKind.Pub)).toBe(false);
  });
});

describe('town map presentation', () => {
  it('paints distinct theme glyphs within the map bounds, with a key that fits the lower five rows', () => {
    const ctx = { fillRect: vi.fn() } as unknown as CanvasRenderingContext2D;
    const glyph = vi.fn<GraphicsSet['drawGlyph']>();
    const gfx = { drawGlyph: glyph } as unknown as GraphicsSet;
    const marks = Object.values(TownMarkKind).map((kind, i) => ({ kind, x: i % 2 ? 63 : 0, y: i % 2 ? 63 : 0 }));
    paintTownMarks(ctx, gfx, marks, { left: 768, top: 32, side: 480, cell: 32 });
    expect(new Set(glyph.mock.calls.map(([, ch]) => ch)).size).toBe(marks.length);
    expect(glyph.mock.calls.every(([, , x, y, size]) => x >= 768 && y >= 32 && x + size <= 1248 && y + size <= 512)).toBe(true);
    expect(TOWN_KEY).toHaveLength(5);
    expect(TOWN_KEY.every((line) => line.length <= 16)).toBe(true);
  });

  it('reuses masked town artwork for marker-only travel and repaints newly explored terrain', () => {
    const world = town();
    const gfx = {} as GraphicsSet;
    const paint = vi.fn((_world, _gfx, _id, pixels: number) => ({ width: pixels }) as HTMLCanvasElement);
    const cache = new LiveMapArt(paint);
    cache.read(world, gfx, world.current.id, 480, 0);
    world.monsters.setPosition(13, 20, 21);
    cache.read(world, gfx, world.current.id, 480, 300);
    expect(paint).toHaveBeenCalledOnce();
    world.autoMap.markSquares(world.current.id, [[20, 21]]);
    cache.read(world, gfx, world.current.id, 480, 600);
    expect(paint).toHaveBeenCalledTimes(2);
    expect(mapTerrain(world, world.current.id).filter((shape) => shape >= 0)).toHaveLength(1);
  });

  it('gives question context priority over the key and defers painting behind menus covering the key', () => {
    const screen = Object.create(Screen.prototype) as Screen;
    const draw = vi.fn<Screen['drawText']>();
    Object.assign(screen, {
      world: town(),
      upperMap: true,
      companionAvailable: true,
      companionViewState: CompanionView.TownMap,
      messagePrompts: 0,
      menu: null,
      drawText: draw,
      textRows: [Array<string>(16).fill(' ')],
      thisTurn: { texts: [], rows: [] },
      prevTurn: null,
      black: vi.fn(),
    });
    const state = screen as unknown as { paintTownKey(): void; upperPanelCovered(): boolean; messagePrompts: number; menu: unknown };
    state.paintTownKey();
    expect(draw.mock.calls.map(([text]) => text)).toEqual([...TOWN_KEY]);
    draw.mockClear();
    state.messagePrompts = 1;
    state.paintTownKey();
    expect(draw).not.toHaveBeenCalled();
    state.messagePrompts = 0;
    state.menu = { x: 24, y: 18, width: 10, visibleRows: 2 };
    expect(state.upperPanelCovered()).toBe(true);
    state.menu = { x: 2, y: 2, width: 12, visibleRows: 5 };
    expect(state.upperPanelCovered()).toBe(false);
  });

  it.each([MapId.FirstTown, MapId.LordBritishCastle, MapId.ExodusCastle])(
    'draws the current whole settlement %i independently of overworld zoom and keeps the party above location markers',
    (id) => {
      const world = town(id);
      const screen = Object.create(Screen.prototype) as Screen;
      const read = vi.fn(() => ({}));
      const ctx = {
        drawImage: vi.fn(),
        save: vi.fn(),
        beginPath: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        fillRect: vi.fn(),
        restore: vi.fn(),
      };
      const party = vi.fn();
      Object.assign(screen, {
        world,
        cell: 32,
        mapZoom: 4,
        ctx,
        liveMapArt: { read },
        black: vi.fn(),
        paintCompanionTitle: vi.fn(),
        gfx: { drawGlyph: vi.fn() },
        paintMapParty: party,
      });
      const state = screen as unknown as { paintTownPanel(time: number): void };
      const before = savedCopy(world);
      state.paintTownPanel(100);
      expect(read).toHaveBeenCalledWith(world, expect.anything(), id, 480, 100);
      expect(party).toHaveBeenCalledWith({ left: 0, top: 0, side: 64 }, world.x, world.y, 768, 32, 7.5, 100);
      expect(ctx.clip).toHaveBeenCalledOnce();
      expect(savedCopy(world)).toEqual(before);
    },
  );

  it('keeps the key out of the message log and clears it when leaving town', () => {
    const world = town();
    const screen = Object.create(Screen.prototype) as Screen;
    const draw = vi.fn<Screen['drawText']>();
    const black = vi.fn();
    const rows = Array.from({ length: 11 }, () => Array<string>(16).fill(' '));
    Object.assign(screen, {
      world,
      drawText: draw,
      black,
      upperMap: true,
      messagePrompts: 0,
      textRows: rows,
      thisTurn: { texts: [], rows: [] },
      prevTurn: null,
      companionViewState: CompanionView.TownMap,
    });
    const state = screen as unknown as { redrawTextArea(): void; companionViewState: CompanionView };
    state.redrawTextArea();
    expect(draw.mock.calls.some(([line]) => line === TOWN_KEY[0])).toBe(true);
    expect(rows.every((row) => row.join('') === ' '.repeat(16))).toBe(true);
    draw.mockClear();
    state.companionViewState = CompanionView.WorldMap;
    state.redrawTextArea();
    expect(draw.mock.calls).toHaveLength(2);
    expect(black).toHaveBeenLastCalledWith(24, 17, 16, 7);
  });
});
