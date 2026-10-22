import type { WholeLevel } from '../game/dungeonLayout.ts';

export interface DungeonPanelBounds {
  left: number;
  top: number;
  side: number;
}

/** Fit the complete explored level, including seam walls, without fractional-size source cells or cropping. */
export function fitDungeonLevel(
  level: Pick<WholeLevel, 'cols' | 'rows'>,
  bounds: DungeonPanelBounds,
): {
  left: number;
  top: number;
  square: number;
} {
  const square = Math.floor(bounds.side / Math.max(level.cols, level.rows));
  return {
    left: bounds.left + Math.floor((bounds.side - level.cols * square) / 2),
    top: bounds.top + Math.floor((bounds.side - level.rows * square) / 2),
    square,
  };
}
