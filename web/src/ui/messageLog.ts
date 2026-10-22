/** The original message window remains authoritative, including repeated-turn folding and pending input. */
export const MESSAGE_COLUMNS = 16;
export const MESSAGE_ROWS = 11;
const MAX_UPPER_MESSAGE_ROWS = 6;
const COMPACT_MESSAGE_ROWS = 2;

export function messageLines(rows: readonly (readonly string[])[], playing: boolean): string[] {
  if (!playing) return [];
  return rows.slice(-MESSAGE_ROWS).map((row) => row.slice(0, MESSAGE_COLUMNS).join('').trimEnd());
}

/** Show the latest output block plus the command line, expanding for questions without covering the map. */
export function firstUpperMessageRow(companion: boolean, answering: boolean, firstOutputRow = MESSAGE_ROWS - COMPACT_MESSAGE_ROWS): number {
  if (!companion) return 0;
  const expanded = MESSAGE_ROWS - MAX_UPPER_MESSAGE_ROWS;
  if (answering) return expanded;
  return Math.max(expanded, Math.min(MESSAGE_ROWS - COMPACT_MESSAGE_ROWS, firstOutputRow));
}
