import type { CombatSummary } from '../game/combatSummary.ts';
import type { CombatTurns } from '../game/combatTurns.ts';
import type { GraphicsSet } from './graphics.ts';
import { wrapText } from './menus.ts';

const NOW_ROW = 0;
const ACTOR_ROW = 1;
const NEXT_HEADING_ROW = 4;
const NEXT_ROW = 5;
const NEXT_ROWS = 5;
const NOTE_ROW = 11;
const ENEMY_ROW = 12;
const COUNT_ROW = 14;

interface CombatPanelBounds {
  left: number;
  top: number;
  side: number;
  cell: number;
}

function centredLine(ctx: CanvasRenderingContext2D, gfx: GraphicsSet, text: string, row: number, bounds: CombatPanelBounds): void {
  const columns = Math.floor(bounds.side / bounds.cell);
  const line = wrapText(text, columns, 1)[0] ?? '';
  const left = bounds.left + (bounds.side - line.length * bounds.cell) / 2;
  for (let index = 0; index < line.length; index++) {
    gfx.drawGlyph(ctx, line[index], left + index * bounds.cell, bounds.top + row * bounds.cell, bounds.cell);
  }
}

/** The caller clears/clips the companion panel; the combat loop owns all scheduling. */
export function paintCombatPanel(
  ctx: CanvasRenderingContext2D,
  gfx: GraphicsSet,
  summary: CombatSummary,
  turns: CombatTurns,
  bounds: CombatPanelBounds,
): void {
  const line = (text: string, row: number) => centredLine(ctx, gfx, text, row, bounds);
  line('Now', NOW_ROW);
  line(turns.now, ACTOR_ROW);
  line(turns.nextHeading, NEXT_HEADING_ROW);
  turns.next.slice(0, NEXT_ROWS).forEach((text, index) => line(text, NEXT_ROW + index));
  if (turns.note) line(turns.note, NOTE_ROW);
  line(summary.name, ENEMY_ROW);
  line(`Remaining: ${summary.remaining}`, COUNT_ROW);
}
