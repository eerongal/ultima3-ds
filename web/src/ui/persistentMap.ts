import type { World } from '../game/world.ts';
import { Location } from '../game/party.ts';
import { MapId } from '../data/resources.ts';
import { MAP_SIDE } from '../game/automap.ts';

export const MAP_ZOOMS = [1, 2, 4] as const;
export type MapZoom = (typeof MAP_ZOOMS)[number];
export const DEFAULT_MAP_ZOOM: MapZoom = 2;

export function validMapZoom(value: unknown): MapZoom {
  return MAP_ZOOMS.find((zoom) => zoom === value) ?? DEFAULT_MAP_ZOOM;
}

export interface MapWindow {
  left: number;
  top: number;
  side: number;
}

const wrap = (value: number): number => ((value % MAP_SIDE) + MAP_SIDE) % MAP_SIDE;

/** Full-world orientation at 1x; a party-centred, wrapping window when zoomed in. */
export function miniMapWindow(position: PersistentMapPosition, zoom: MapZoom): MapWindow {
  const side = MAP_SIDE / zoom;
  if (zoom === 1) return { left: 0, top: 0, side };
  return { left: wrap(position.x - side / 2), top: wrap(position.y - side / 2), side };
}

/** A visible landmark's coordinates relative to the window, preserving world-edge wrapping. */
export function miniMapPoint(window: MapWindow, x: number, y: number): { x: number; y: number } | null {
  const point = { x: wrap(x - window.left), y: wrap(y - window.top) };
  return point.x < window.side && point.y < window.side ? point : null;
}

/** Split a crop at world seams so Canvas can draw up to four source rectangles. Units are map squares. */
export function miniMapPieces(window: MapWindow): { sx: number; sy: number; dx: number; dy: number; width: number; height: number }[] {
  const axis = (start: number) => {
    const first = Math.min(window.side, MAP_SIDE - start);
    return [
      { source: start, offset: 0, length: first },
      ...(first < window.side ? [{ source: 0, offset: first, length: window.side - first }] : []),
    ];
  };
  return axis(window.left).flatMap((x) =>
    axis(window.top).map((y) => ({
      sx: x.source,
      sy: y.source,
      dx: x.offset,
      dy: y.offset,
      width: x.length,
      height: y.length,
    })),
  );
}

export interface PersistentMapPosition {
  id: number;
  x: number;
  y: number;
}

/** Combat keeps the exploration origin; interior/arena coordinates never become overworld coordinates. */
export function persistentMapPosition(world: World): PersistentMapPosition {
  const location = world.combat?.previousLocation ?? world.party.location;
  const outside = location === Location.Sosaria || location === Location.Ambrosia;
  return {
    id: location === Location.Ambrosia ? MapId.Ambrosia : MapId.Sosaria,
    x: outside ? world.x : world.party.surfaceX,
    y: outside ? world.y : world.party.surfaceY,
  };
}
