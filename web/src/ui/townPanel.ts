import { MAP_SIDE } from '../game/automap.ts';
import { TownMarkKind, type TownMark } from '../game/townMap.ts';
import type { GraphicsSet } from './graphics.ts';

const SYMBOLS: Record<TownMarkKind, string> = {
  [TownMarkKind.Pub]: 'P',
  [TownMarkKind.Food]: 'F',
  [TownMarkKind.Healer]: 'H',
  [TownMarkKind.Weapons]: 'W',
  [TownMarkKind.Armour]: 'A',
  [TownMarkKind.Guild]: 'G',
  [TownMarkKind.Oracle]: 'O',
  [TownMarkKind.Horses]: 'R',
  [TownMarkKind.Talk]: '?',
};

/** Five rows fit beside a one-line result and command line. Longer output/questions temporarily replace the key. */
export const TOWN_KEY = ['P Pub   F Food', 'H Heal  W Arms', 'A Armor G Guild', 'O Oracle R Horse', '? Talk  [] You'] as const;
const SYMBOL_CELLS = 0.5;
const SYMBOL_PADDING = 1;

function symbolAxis(position: number, start: number, side: number, size: number): number {
  const centre = start + ((position + 0.5) * side) / MAP_SIDE;
  return Math.round(Math.max(start, Math.min(start + side - size, centre - size / 2)));
}

export function paintTownMarks(
  ctx: CanvasRenderingContext2D,
  gfx: GraphicsSet,
  marks: readonly TownMark[],
  bounds: { left: number; top: number; side: number; cell: number },
): void {
  const size = Math.max(1, Math.round(bounds.cell * SYMBOL_CELLS));
  for (const mark of marks) {
    const x = symbolAxis(mark.x, bounds.left, bounds.side, size);
    const y = symbolAxis(mark.y, bounds.top, bounds.side, size);
    ctx.fillStyle = '#000';
    ctx.fillRect(x - SYMBOL_PADDING, y - SYMBOL_PADDING, size + SYMBOL_PADDING * 2, size + SYMBOL_PADDING * 2);
    gfx.drawGlyph(ctx, SYMBOLS[mark.kind], x, y, size);
  }
}
