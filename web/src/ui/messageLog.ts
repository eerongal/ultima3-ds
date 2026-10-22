/** The original message window remains authoritative, including repeated-turn folding and pending input. */
export const MESSAGE_COLUMNS = 16;
export const MESSAGE_ROWS = 11;
export const ACTIVE_PROMPT_ROWS = 6;

export function messageLines(rows: readonly (readonly string[])[], playing: boolean): string[] {
  if (!playing) return [];
  return rows.slice(-MESSAGE_ROWS).map((row) => row.slice(0, MESSAGE_COLUMNS).join('').trimEnd());
}

/** Keep the current command line above; while answering a question, include its recent context. */
export function firstUpperMessageRow(companion: boolean, answering: boolean): number {
  if (!companion) return 0;
  return MESSAGE_ROWS - (answering ? ACTIVE_PROMPT_ROWS : 1);
}
