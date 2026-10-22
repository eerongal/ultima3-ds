import { describe, expect, it } from 'vitest';
import { CompanionTitleMenu } from '../src/ui/companionTitleMenu.ts';
import { applyMenuKey, layoutMenu } from '../src/ui/menus.ts';
import { Key } from '../src/game/io.ts';
import { partyStatus } from '../src/ui/partyStatus.ts';
import { newWorld } from './helpers.ts';

const options = [
  { key: 'J', label: 'Journey onward' },
  { key: 'S', label: 'Settings' },
  { key: 'Q', label: 'Quit', disabled: true },
];

function setup() {
  const companion = new CompanionTitleMenu();
  const menu = layoutMenu(
    'Options',
    options.map((option) => option.label),
  );
  companion.begin(menu, options);
  return { companion, menu, id: companion.snapshot()!.id };
}

describe('companion title menu', () => {
  it('follows the game cursor and uses the same confirmation action for a touched choice', () => {
    const { companion, menu, id } = setup();
    applyMenuKey(menu, options, options, Key.Down);
    expect(companion.snapshot()).toMatchObject({ cursor: 1, title: 'Options' });
    expect(companion.select({ id, index: 0 })).toBe(true);
    expect(applyMenuKey(menu, options, options, Key.Enter)).toEqual({ kind: 'choose', index: 0 });
    expect(companion.snapshot()!.items.every((item) => item.disabled)).toBe(true);
    expect(companion.select({ id, index: 1 })).toBe(false);
  });

  it('rejects stale sessions, disabled choices and invalid indices without changing selection', () => {
    const { companion, menu, id } = setup();
    for (const index of [-1, options.length, 0.5, NaN, 2]) expect(companion.select({ id, index })).toBe(false);
    companion.close();
    expect(companion.snapshot()).toBeNull();
    expect(companion.select({ id, index: 0 })).toBe(false);
    companion.begin(menu, options);
    expect(companion.select({ id, index: 0 })).toBe(false);
    expect(menu.cursor).toBe(0);
    expect(companion.select({ id: companion.snapshot()!.id, index: 1 })).toBe(true);
  });

  it('publishes the title choices outside gameplay and removes them when play starts', () => {
    const { companion } = setup();
    const world = newWorld();
    const state = {
      paused: false,
      selectedMember: -1,
      highlighted: new Set<number>(),
      flashing: new Set<number>(),
      menu: companion.snapshot(),
    };
    expect(partyStatus(world, { ...state, playing: false }).menu?.title).toBe('Options');
    expect(partyStatus(world, { ...state, playing: true }).menu).toBeNull();
  });
});
