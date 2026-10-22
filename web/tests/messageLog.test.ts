import { describe, expect, it, vi } from 'vitest';
import { firstUpperMessageRow, messageLines, MESSAGE_COLUMNS, MESSAGE_ROWS } from '../src/ui/messageLog.ts';
import { Screen } from '../src/ui/screen.ts';
import { Key } from '../src/game/io.ts';
import { newWorld } from './helpers.ts';

interface MessageState {
  textRows: string[][];
  cursorX: number;
  cursorY: number;
  upperMap: boolean;
  messagePrompts: number;
  prevTurn: unknown;
  frameShown: boolean;
  companionAvailable: boolean;
  upperPanelCovered(): boolean;
  redrawAll(): void;
}

/** Exercise the real message/prompt methods without a browser canvas or a running game. */
function harness(companion = true) {
  const screen = Object.create(Screen.prototype) as Screen;
  const draw = vi.fn();
  const nextKey = vi.fn<() => Promise<string>>();
  Object.assign(screen, {
    world: newWorld(),
    textRows: Array.from({ length: MESSAGE_ROWS }, () => Array<string>(MESSAGE_COLUMNS).fill(' ')),
    cursorX: 25,
    cursorY: 23,
    upperMap: companion,
    companionAvailable: companion,
    messagePrompts: 0,
    prevTurn: null,
    thisTurn: { texts: [], rows: [] },
    foldedThisTurn: 0,
    brokenThisTurn: false,
    linesSincePrompt: 0,
    frameShown: true,
    inputMode: 'keyboard',
    macro: [],
    highlighted: new Set<number>(),
    keyboard: { nextKey, nextKeyOrTimeout: nextKey },
    gfx: { drawUiPiece: vi.fn() },
    drawText: draw,
    black: vi.fn(),
    piece: vi.fn(),
    showWind: vi.fn(),
    showMoons: vi.fn(),
    updateStats: vi.fn(),
    paintCompanionPanel: vi.fn(),
    showMenuNow: vi.fn(),
  });
  return { screen, state: screen as unknown as MessageState, draw, nextKey };
}

describe('companion message log', () => {
  it('copies bounded rows, preserves prompt indentation/blank lines and leaves the source untouched', () => {
    const rows = ['ignored', ...Array.from({ length: MESSAGE_ROWS }, (_, i) => (i === 10 ? ' >Question?  ' : `Line ${i}  `))].map((row) => [
      ...row,
    ]);
    const before = structuredClone(rows);
    const snapshot = messageLines(rows, true);
    expect(snapshot).toHaveLength(MESSAGE_ROWS);
    expect(snapshot[0]).toBe('Line 0');
    expect(snapshot[10]).toBe(' >Question?');
    snapshot[0] = 'Changed';
    expect(rows).toEqual(before);
    expect(messageLines([[' ']], true)).toEqual(['']);
    expect(messageLines(rows, false)).toEqual([]);
  });

  it('keeps the full fallback log and reserves upper context only while answering a prompt', () => {
    expect(firstUpperMessageRow(false, false)).toBe(0);
    expect(firstUpperMessageRow(false, true)).toBe(0);
    expect(firstUpperMessageRow(true, false)).toBe(10);
    expect(firstUpperMessageRow(true, true)).toBe(5);
  });

  it('preserves repeated-action folding and existing counts through a visual redraw', () => {
    const { screen, state } = harness();
    screen.prompt();
    screen.print('South\n');
    screen.prompt();
    screen.print('South\n');
    screen.prompt();
    expect(messageLines(state.textRows, true).join('\n')).toContain('South (x2)');
    const rows = structuredClone(state.textRows);
    const previous = state.prevTurn;
    state.redrawAll();
    expect(state.textRows).toEqual(rows);
    expect(state.prevTurn).toBe(previous);
    screen.print('South\n');
    screen.prompt();
    expect(messageLines(state.textRows, true).join('\n')).toContain('South (x3)');
    screen.print('West\n');
    screen.prompt();
    expect(messageLines(state.textRows, true).join('\n')).toContain('West');
  });

  it('retains partial dialogue in the log while keeping old rows off the enlarged map', () => {
    const { screen, state, draw } = harness();
    screen.print('Lord British\nWelcome!');
    expect(messageLines(state.textRows, true).slice(-2)).toEqual([' Lord British', 'Welcome!']);
    expect(draw.mock.calls.every(([, , y]) => y === 23)).toBe(true);
    expect(messageLines(state.textRows, true)).not.toContain('(saved)');
  });

  it('shows question context during keyboard choices and restores the compact prompt after answering', async () => {
    const { screen, state, draw, nextKey } = harness();
    screen.print('Pay 100 gold?\n');
    let answer!: (key: string) => void;
    nextKey.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    const choice = screen.chooseOption(
      [
        { key: 'Y', label: 'Yes' },
        { key: 'N', label: 'No' },
      ],
      'none',
    );
    expect(state.messagePrompts).toBeGreaterThan(0);
    expect(draw.mock.calls.some(([, , y]) => y === 22)).toBe(true);
    answer('Y');
    expect(await choice).toBe('Y');
    expect(state.messagePrompts).toBe(0);
    expect(messageLines(state.textRows, true).join('\n')).toContain('Pay 100 gold?');
  });

  it('keeps typed input above and commits the answer to the same message buffer', async () => {
    const { screen, state, nextKey } = harness();
    screen.print('Name?\n');
    nextKey.mockResolvedValueOnce('A').mockResolvedValueOnce('v').mockResolvedValueOnce('a').mockResolvedValueOnce(Key.Enter);
    expect(await screen.inputText(8, false)).toBe('Ava');
    expect(messageLines(state.textRows, true).at(-1)).toBe('Ava');
    expect(state.messagePrompts).toBe(0);
  });

  it('restores prompt visibility after a failed input read and retains full history in fallback', async () => {
    const { screen, state, draw, nextKey } = harness(false);
    nextKey.mockRejectedValue(new Error('Input lost'));
    await expect(screen.waitKey()).rejects.toThrow('Input lost');
    expect(state.messagePrompts).toBe(0);
    expect(draw.mock.calls.some(([, , y]) => y === 13)).toBe(true);
  });

  it('preserves unfinished keyboard input when the companion disconnects', async () => {
    const { screen, state, nextKey } = harness();
    screen.print('Name?\n');
    let finish!: (key: string) => void;
    nextKey.mockResolvedValueOnce('A').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const reading = screen.inputText(8, false);
    await Promise.resolve();
    await Promise.resolve();
    expect(messageLines(state.textRows, true).at(-1)).toBe('A');
    state.companionAvailable = false;
    state.redrawAll();
    expect(messageLines(state.textRows, true).at(-1)).toBe('A');
    finish(Key.Enter);
    expect(await reading).toBe('A');
  });

  it('does not paint message context over a title screen', async () => {
    const { screen, state, draw, nextKey } = harness();
    state.frameShown = false;
    nextKey.mockResolvedValue(Key.Enter);
    expect(await screen.waitKey()).toBe(Key.Enter);
    expect(draw).not.toHaveBeenCalled();
    expect(state.messagePrompts).toBe(0);
  });

  it('defers layout changes behind menus in the enlarged map and prompt areas', () => {
    const { screen, state } = harness(false);
    Object.assign(screen, { menu: { x: 24, y: 14, width: 12, visibleRows: 2 } });
    expect(state.upperPanelCovered()).toBe(false);
    state.companionAvailable = true;
    expect(state.upperPanelCovered()).toBe(true);
    state.upperMap = true;
    expect(state.upperPanelCovered()).toBe(true);
    Object.assign(screen, { menu: { x: 24, y: 18, width: 12, visibleRows: 2 } });
    expect(state.upperPanelCovered()).toBe(false);
    state.companionAvailable = false;
    expect(state.upperPanelCovered()).toBe(true);
  });
});
