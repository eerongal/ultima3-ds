import { describe, expect, it, vi } from 'vitest';
import { newWorld, savedCopy } from './helpers.ts';
import { Location } from '../src/game/party.ts';
import { MapId, BASERES } from '../src/data/resources.ts';
import { MapValue } from '../src/game/tiles.ts';
import { loadArena } from '../src/game/combat.ts';
import { AutoMap } from '../src/game/automap.ts';
import { persistentMapPosition, miniMapWindow, miniMapPoint, miniMapPieces, validMapZoom } from '../src/ui/persistentMap.ts';
import { LiveMapArt, mapTerrain } from '../src/ui/mapArt.ts';
import type { GraphicsSet } from '../src/ui/graphics.ts';

describe('minimap zoom and wrapping', () => {
  it('defaults missing or invalid preferences to 2x and accepts only supported scales', () => {
    expect([undefined, null, '4', 0, 3, NaN].map(validMapZoom)).toEqual([2, 2, 2, 2, 2, 2]);
    expect([1, 2, 4].map(validMapZoom)).toEqual([1, 2, 4]);
  });

  it('keeps full-world orientation at 1x and centres smaller windows on the party', () => {
    const position = { id: MapId.Sosaria, x: 30, y: 40 };
    expect(miniMapWindow(position, 1)).toEqual({ left: 0, top: 0, side: 64 });
    expect(miniMapWindow(position, 2)).toEqual({ left: 14, top: 24, side: 32 });
    expect(miniMapWindow(position, 4)).toEqual({ left: 22, top: 32, side: 16 });
    expect(miniMapPoint(miniMapWindow(position, 4), 30, 40)).toEqual({ x: 8, y: 8 });
  });

  it('follows across the world seam and includes nearby landmarks on the opposite edge', () => {
    const window = miniMapWindow({ id: MapId.Sosaria, x: 0, y: 63 }, 2);
    expect(window).toEqual({ left: 48, top: 47, side: 32 });
    expect(miniMapPoint(window, 63, 0)).toEqual({ x: 15, y: 17 });
    expect(miniMapPoint(window, 0, 63)).toEqual({ x: 16, y: 16 });
    expect(miniMapPoint(window, 32, 32)).toBeNull();
    expect(miniMapWindow({ id: MapId.Sosaria, x: 1, y: 0 }, 2).left).toBe(49);
  });

  it.each([
    { x: 0, y: 0 },
    { x: 63, y: 25 },
    { x: 25, y: 63 },
    { x: 32, y: 32 },
  ])('covers each zoomed destination square exactly once at ($x,$y) with valid source coordinates', ({ x, y }) => {
    const window = miniMapWindow({ id: MapId.Sosaria, x, y }, 2);
    const covered = new Set<string>();
    const pieces = miniMapPieces(window);
    const visit = (piece: (typeof pieces)[number]) => {
      expect(piece.sx + piece.width).toBeLessThanOrEqual(64);
      expect(piece.sy + piece.height).toBeLessThanOrEqual(64);
      Array.from({ length: piece.width * piece.height }, (_, index) => {
        const dx = piece.dx + (index % piece.width);
        const dy = piece.dy + Math.floor(index / piece.width);
        const key = `${dx},${dy}`;
        expect(covered.has(key)).toBe(false);
        covered.add(key);
        expect(piece.sx + (index % piece.width)).toBe((window.left + dx) % 64);
        expect(piece.sy + Math.floor(index / piece.width)).toBe((window.top + dy) % 64);
      });
    };
    pieces.forEach(visit);
    expect(covered.size).toBe(window.side * window.side);
  });

  it('uses one crop for the full world and four crops where both edges wrap', () => {
    expect(miniMapPieces(miniMapWindow({ id: MapId.Ambrosia, x: 0, y: 0 }, 1))).toHaveLength(1);
    expect(miniMapPieces(miniMapWindow({ id: MapId.Ambrosia, x: 0, y: 0 }, 4))).toHaveLength(4);
  });
});

describe('the passive world map', () => {
  it('follows surface travel between Sosaria and Ambrosia without changing the game', () => {
    const world = newWorld();
    world.x = 17;
    world.y = 23;
    const before = savedCopy(world);
    expect(persistentMapPosition(world)).toEqual({ id: MapId.Sosaria, x: 17, y: 23 });
    expect(savedCopy(world)).toEqual(before);
    world.enterMap(MapId.Ambrosia);
    world.party.location = Location.Ambrosia;
    expect(persistentMapPosition(world)).toEqual({ id: MapId.Ambrosia, x: 17, y: 23 });
  });

  it('marks the entered place rather than town or dungeon coordinates', () => {
    const world = newWorld();
    world.party.surfaceX = 25;
    world.party.surfaceY = 19;
    world.enterMap(MapId.LordBritishCastle);
    world.party.location = Location.Castle;
    world.x = 32;
    world.y = 62;
    expect(persistentMapPosition(world)).toEqual({ id: MapId.Sosaria, x: 25, y: 19 });
    world.enterDungeon(MapId.FirstDungeon);
    world.party.location = Location.Dungeon;
    world.x = 1;
    world.y = 1;
    expect(persistentMapPosition(world)).toEqual({ id: MapId.Sosaria, x: 25, y: 19 });
  });

  it.each([Location.Sosaria, Location.Ambrosia, Location.Town, Location.Dungeon])(
    'keeps exploration origin during combat from location %i',
    (origin) => {
      const world = newWorld();
      if (origin === Location.Ambrosia) world.enterMap(MapId.Ambrosia);
      if (origin === Location.Town) world.enterMap(MapId.FirstTown);
      if (origin === Location.Dungeon) world.enterDungeon(MapId.FirstDungeon);
      world.party.location = origin;
      world.party.surfaceX = 25;
      world.party.surfaceY = 19;
      world.x = 3;
      world.y = 5;
      const expected = persistentMapPosition(world);
      world.combat = loadArena(world, BASERES + 4);
      world.combat.previousLocation = origin;
      world.party.location = Location.Combat;
      world.combat.members[0].x = 9;
      world.combat.members[0].y = 10;
      const notes = world.autoMap.toText();
      const moves = world.party.bytes.slice();
      expect(persistentMapPosition(world)).toEqual(expected);
      mapTerrain(world, expected.id);
      expect(world.autoMap.toText()).toBe(notes);
      expect(world.party.bytes).toEqual(moves);
    },
  );
});

describe('shared atlas terrain', () => {
  it('masks unexplored ground and displays terrain under creatures without revealing their identities', () => {
    const world = newWorld();
    world.surface.tiles.fill(MapValue.Grass);
    world.surface.monsters.bytes.fill(0);
    world.surface.monsters.setType(0, MapValue.Guard);
    world.surface.monsters.setPosition(0, 2, 3);
    world.surface.monsters.setTileUnder(0, MapValue.Forest);
    world.autoMap.markSquares(MapId.Sosaria, [[2, 3]]);
    const before = savedCopy(world);
    const data = mapTerrain(world, MapId.Sosaria);
    expect(data[3 * 64 + 2]).toBe((MapValue.Forest >> 2) * 2);
    expect(data[3 * 64 + 3]).toBe(-1);
    expect(data.filter((shape) => shape >= 0)).toHaveLength(1);
    expect(savedCopy(world)).toEqual(before);
  });

  it('uses the live surface even while the current map is an interior', () => {
    const world = newWorld();
    world.autoMap.markSquares(MapId.Sosaria, [[2, 3]]);
    world.surface.monsters.bytes.fill(0);
    world.surface.tiles[3 * 64 + 2] = MapValue.Chest;
    world.enterDungeon(MapId.FirstDungeon);
    expect(mapTerrain(world, MapId.Sosaria)[3 * 64 + 2]).toBe((MapValue.Chest >> 2) * 2);
  });
});

describe('live map artwork cache', () => {
  const gfx = {} as GraphicsSet;
  const painter = () => vi.fn((_world, _gfx, _id, pixels: number) => ({ width: pixels }) as HTMLCanvasElement);

  it('reuses the parchment background when discovery changes, and rebuilds it for a new zoom resolution', () => {
    const world = newWorld();
    const context = {
      createImageData: vi.fn((width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) })),
      putImageData: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      drawImage: vi.fn(),
      createRadialGradient: () => ({ addColorStop: vi.fn() }),
    };
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
    try {
      const graphics = { drawShape: vi.fn() } as unknown as GraphicsSet;
      const cache = new LiveMapArt();
      cache.read(world, graphics, MapId.Sosaria, 64, 0);
      world.autoMap.markSquares(MapId.Sosaria, [[2, 3]]);
      cache.read(world, graphics, MapId.Sosaria, 64, 300);
      expect(context.createImageData).toHaveBeenCalledOnce();
      cache.read(world, graphics, MapId.Sosaria, 128, 301);
      expect(context.createImageData).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reuses the chart through movement, repeated frames and unobserved terrain changes', () => {
    const world = newWorld();
    const paint = painter();
    const cache = new LiveMapArt(paint);
    const art = cache.read(world, gfx, MapId.Sosaria, 352, 0);
    world.x++;
    world.surface.tiles[0] = MapValue.Chest;
    expect(cache.read(world, gfx, MapId.Sosaria, 352, 20)).toBe(art);
    expect(cache.read(world, gfx, MapId.Sosaria, 352, 500)).toBe(art);
    expect(paint).toHaveBeenCalledOnce();
  });

  it('repaints newly discovered or changed visible ground and cleared notes', () => {
    const world = newWorld();
    world.surface.monsters.bytes.fill(0);
    const paint = painter();
    const cache = new LiveMapArt(paint);
    cache.read(world, gfx, MapId.Sosaria, 352, 0);
    world.autoMap.markSquares(MapId.Sosaria, [[2, 3]]);
    cache.read(world, gfx, MapId.Sosaria, 352, 300);
    world.surface.tiles[3 * 64 + 2] = MapValue.Chest;
    cache.read(world, gfx, MapId.Sosaria, 352, 600);
    world.autoMap.clear();
    cache.read(world, gfx, MapId.Sosaria, 352, 900);
    expect(paint).toHaveBeenCalledTimes(4);
  });

  it('immediately repaints changed graphics, maps, dimensions and loaded game objects', () => {
    const world = newWorld();
    const paint = painter();
    const cache = new LiveMapArt(paint);
    cache.read(world, gfx, MapId.Sosaria, 352, 0);
    const nextGfx = {} as GraphicsSet;
    cache.read(world, nextGfx, MapId.Sosaria, 352, 1);
    cache.read(world, nextGfx, MapId.Ambrosia, 352, 2);
    cache.read(world, nextGfx, MapId.Ambrosia, 704, 3);
    world.newGame();
    cache.read(world, nextGfx, MapId.Ambrosia, 704, 4);
    world.autoMap = new AutoMap();
    cache.read(world, nextGfx, MapId.Ambrosia, 704, 5);
    expect(paint).toHaveBeenCalledTimes(6);
  });
});
