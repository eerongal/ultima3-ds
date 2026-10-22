import type { World } from '../game/world.ts';
import { MAP_SIDE } from '../game/automap.ts';
import { isLandValue } from '../game/worldMap.ts';
import { MapId } from '../data/resources.ts';
import type { GraphicsSet } from './graphics.ts';
import { drawChart } from './chart.ts';

const UNSEEN = -1;
const REFRESH_MS = 250;

/** Ground shapes under the discovery mask; creatures and unexplored terrain are never exposed. */
export function mapTerrain(world: World, id: number): Int16Array {
  const state = id === MapId.Sosaria ? world.surface : id === world.current.id ? world.current : world.loadMapState(id);
  return Int16Array.from({ length: MAP_SIDE * MAP_SIDE }, (_, index) => {
    const x = index % MAP_SIDE;
    const y = Math.floor(index / MAP_SIDE);
    if (!world.autoMap.squareSeen(id, x, y)) return UNSEEN;
    const someone = state.monsters.at(x, y);
    const value = someone >= 0 ? state.monsters.tileUnder(someone) : state.tiles[index];
    return (value >> 2) * 2;
  });
}

/** Shared terrain artwork for the modal atlas and the passive upper-screen map. */
export function drawMapArt(
  world: World,
  gfx: GraphicsSet,
  id: number,
  pixels: number,
  terrain = mapTerrain(world, id),
  background?: HTMLCanvasElement,
): HTMLCanvasElement {
  const art = document.createElement('canvas');
  art.width = art.height = Math.round(pixels);
  const ctx = art.getContext('2d')!;
  const square = art.width / MAP_SIDE;
  if (background) ctx.drawImage(background, 0, 0);
  else if (id === MapId.Sosaria) {
    const raw = world.resources.maps.get(id);
    drawChart(ctx, square, (x, y) => !!raw && isLandValue(raw[1 + y * MAP_SIDE + x]));
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, art.width, art.height);
  }
  terrain.forEach((shape, index) => {
    if (shape === UNSEEN) return;
    gfx.drawShape(ctx, shape, (index % MAP_SIDE) * square, Math.floor(index / MAP_SIDE) * square, square);
  });
  return art;
}

/** Keep the immutable parchment separate so zoomed terrain updates do not regenerate millions of grain pixels. */
function cachedMapPainter(): typeof drawMapArt {
  let background: HTMLCanvasElement | undefined;
  let source: Uint8Array | undefined;
  return (world, gfx, id, pixels, terrain) => {
    if (id !== MapId.Sosaria) return drawMapArt(world, gfx, id, pixels, terrain);
    const raw = world.resources.maps.get(id);
    if (!background || background.width !== Math.round(pixels) || source !== raw) {
      background = document.createElement('canvas');
      background.width = background.height = Math.round(pixels);
      drawChart(background.getContext('2d')!, background.width / MAP_SIDE, (x, y) => !!raw && isLandValue(raw[1 + y * MAP_SIDE + x]));
      source = raw;
    }
    return drawMapArt(world, gfx, id, pixels, terrain, background);
  };
}

/** Expensive chart/tile painting happens only when the visible terrain or appearance changes. */
export class LiveMapArt {
  private checkedAt = -Infinity;
  private terrain: Int16Array | null = null;
  private art: HTMLCanvasElement | null = null;
  private id = -1;
  private gfx: GraphicsSet | null = null;
  private surface: World['surface'] | null = null;
  private current: World['current'] | null = null;
  private notes: World['autoMap'] | null = null;

  constructor(private readonly paint = cachedMapPainter()) {}

  read(world: World, gfx: GraphicsSet, id: number, pixels: number, time: number): HTMLCanvasElement {
    const replaced =
      this.id !== id ||
      this.gfx !== gfx ||
      this.art?.width !== Math.round(pixels) ||
      this.surface !== world.surface ||
      this.current !== world.current ||
      this.notes !== world.autoMap;
    if (!replaced && time - this.checkedAt < REFRESH_MS) return this.art!;
    this.checkedAt = time;
    const terrain = mapTerrain(world, id);
    const changed = !this.terrain || terrain.some((shape, index) => shape !== this.terrain![index]);
    if (replaced || changed) this.art = this.paint(world, gfx, id, pixels, terrain);
    this.id = id;
    this.gfx = gfx;
    this.surface = world.surface;
    this.current = world.current;
    this.notes = world.autoMap;
    this.terrain = terrain;
    return this.art!;
  }
}
