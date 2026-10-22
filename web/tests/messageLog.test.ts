import { describe, expect, it, vi } from 'vitest';
import { firstUpperMessageRow, messageLines, MESSAGE_COLUMNS, MESSAGE_ROWS } from '../src/ui/messageLog.ts';
import { Screen } from '../src/ui/screen.ts';
import { Key } from '../src/game/io.ts';
import { FakeIO, newWorld } from './helpers.ts';
import { talkTo } from '../src/game/interact.ts';
import { runDungeon } from '../src/game/dungeon.ts';
import { DungeonCell } from '../src/game/world.ts';
import { Location } from '../src/game/party.ts';
import { MapValue } from '../src/game/tiles.ts';
import { MapId } from '../src/data/resources.ts';
import { TOWN_KEY } from '../src/ui/townPanel.ts';
import { CompanionView } from '../src/ui/companionView.ts';

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
  readonly firstMessageRow: number;
}

/** Exercise the real message/prompt methods without a browser canvas or a running game. */
function harness(companion = true) {
  const screen = Object.create(Screen.prototype) as Screen;
  const world = newWorld();
  const painted = new Map<string, string>();
  const draw = vi.fn((text: string, x: number, y: number) => {
    [...text].forEach((ch, index) => painted.set(`${x + index}:${y}`, ch));
  });
  const nextKey = vi.fn<() => Promise<string>>();
  Object.assign(screen, {
    world,
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
    black: vi.fn((x: number, y: number, width: number, height: number) => {
      for (let row = y; row < y + height; row++) draw(' '.repeat(width), x, row);
    }),
    piece: vi.fn(),
    showWind: vi.fn(),
    showMoons: vi.fn(),
    updateStats: vi.fn(),
    paintCompanionPanel: vi.fn(),
    showMenuNow: vi.fn(),
  });
  const upperLines = () =>
    Array.from({ length: MESSAGE_ROWS }, (_, row) =>
      Array.from({ length: MESSAGE_COLUMNS }, (_, col) => painted.get(`${24 + col}:${13 + row}`) ?? ' ')
        .join('')
        .trimEnd(),
    );
  return { screen, world, state: screen as unknown as MessageState, draw, nextKey, upperLines };
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

  it('keeps the full fallback log and bounds the latest upper output block independently of questions', () => {
    expect(firstUpperMessageRow(false, false)).toBe(0);
    expect(firstUpperMessageRow(false, true)).toBe(0);
    expect(firstUpperMessageRow(true, false)).toBe(9);
    expect(firstUpperMessageRow(true, true)).toBe(5);
    expect(firstUpperMessageRow(true, false, 7)).toBe(7);
    expect(firstUpperMessageRow(true, false, 0)).toBe(5);
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

  it('retains partial dialogue above while keeping old rows off the enlarged map', () => {
    const { screen, state, draw } = harness();
    screen.print('Lord British\nWelcome!');
    expect(messageLines(state.textRows, true).slice(-2)).toEqual([' Lord British', 'Welcome!']);
    expect(draw.mock.calls.some(([text, , y]) => y === 22 && text.includes('Lord British'))).toBe(true);
    expect(messageLines(state.textRows, true)).not.toContain('(saved)');
  });

  it('keeps the latest direction and folded count visible after the command prompt clears its line', () => {
    const { screen, upperLines } = harness();
    screen.prompt();
    screen.print('South\n');
    screen.prompt();
    expect(upperLines().at(-2)?.trim()).toBe('South');
    expect(upperLines().at(-1)).toBe('');
    screen.print('South\n');
    screen.prompt();
    expect(upperLines().at(-2)?.trim()).toBe('South (x2)');
    screen.print('West\n');
    screen.prompt();
    expect(upperLines().at(-2)?.trim()).toBe('West');
  });

  it('shows actual NPC dialogue without an input prompt, then restores the town key on the next short result', async () => {
    const { screen, world, state, upperLines } = harness();
    world.enterMap(MapId.FirstTown);
    world.party.location = Location.Town;
    Object.assign(screen, { companionViewState: CompanionView.TownMap });
    world.monsters.setType(0, MapValue.Merchant);
    world.monsters.setHp(0, 3);
    screen.prompt();
    await talkTo(world, screen, 0, 0);
    screen.prompt();
    expect(state.messagePrompts).toBe(0);
    expect(upperLines().join('\n')).toContain('ONLY WITH EXOTIC\nARMS CAN YOU WIN');
    expect(upperLines().join('\n')).toContain('Journal updated');
    expect(upperLines().join('\n')).not.toContain(TOWN_KEY[0]);
    expect(state.firstMessageRow).toBeGreaterThanOrEqual(5);
    screen.print('West\n');
    screen.prompt();
    expect(upperLines().join('\n')).toContain(TOWN_KEY.join('\n'));
    expect(upperLines().at(-2)?.trim()).toBe('West');
    expect(upperLines().join('\n')).not.toContain('ARMS CAN YOU WIN');
    expect(messageLines(state.textRows, true).join('\n')).toContain('ARMS CAN YOU WIN');
  });

  it('keeps actual dungeon writing visible at the next command wait without pausing the game to classify it', async () => {
    const { screen, world, upperLines } = harness();
    world.enterDungeon(415);
    world.dungeon.level = 1;
    world.x = 1;
    world.y = 1;
    world.putXYDng(DungeonCell.Writing, world.x, world.y);
    const io = new FakeIO(world.resources);
    io.print = (text) => screen.print(text);
    io.printMessage = (number) => screen.printMessage(number);
    io.prompt = () => screen.prompt();
    let commands = 0;
    io.waitCommand = async () => {
      if (commands++ === 0) return Key.Space;
      expect(upperLines().join('\n')).toContain('<INSERT> CARDS\nINTO EXODUS!');
      world.done = true;
      return Key.Space;
    };
    await runDungeon(world, io);
    expect(commands).toBe(2);
  });

  it('bounds long output below the context panel while retaining the larger lower-screen buffer', () => {
    const { screen, state, upperLines } = harness();
    screen.print(Array.from({ length: 15 }, (_, index) => `Line ${index}\n`).join(''));
    screen.prompt();
    expect(state.firstMessageRow).toBe(5);
    expect(upperLines().slice(5)).toEqual(['Line 10', 'Line 11', 'Line 12', 'Line 13', 'Line 14', '']);
    expect(messageLines(state.textRows, true)).toHaveLength(MESSAGE_ROWS);
    expect(messageLines(state.textRows, true)).toContain('Line 5');
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
