import { afterEach, describe, expect, it, vi } from 'vitest';
import { newWorld, savedCopy } from './helpers.ts';
import { emptyJournal, hearClue, journalEntry, journalTop, type JournalLine } from '../src/game/journal.ts';
import { restore } from '../src/game/save.ts';
import { PinnedJournalHint, type PinStore } from '../src/ui/pinnedHint.ts';

function memoryStore(initial: string | null = null): PinStore {
  let value = initial;
  return {
    read: () => value,
    write: (id) => {
      value = id;
    },
  };
}

const allLines = (lines: JournalLine[]): JournalLine[] => lines.flatMap((line) => [line, ...allLines(line.open?.lines ?? [])]);
afterEach(() => vi.restoreAllMocks());

describe('journal subjects', () => {
  it('assigns unique stable IDs, including entries revealed later', () => {
    const world = newWorld();
    const before = allLines(journalTop(world));
    world.journal.ambrosia = true;
    hearClue(world, 'LCB Towne#3');
    const after = allLines(journalTop(world));
    expect(new Set(after.map((line) => line.id)).size).toBe(after.length);
    expect(after.map((line) => line.id)).toEqual(expect.arrayContaining(before.map((line) => line.id)));
    expect(journalEntry(world, 'quest:exotics')?.name).toBe('Exotic arms');
  });

  it('respects discovery rules and never mutates journal or save data while resolving', () => {
    const world = newWorld();
    const before = savedCopy(world);
    expect(journalEntry(world, 'quest:exotics')?.name).toBe('Mystery...');
    expect(journalEntry(world, 'shrine:0')).toBeNull();
    expect(journalEntry(world, 'unknown')).toBeNull();
    expect(savedCopy(world)).toEqual(before);
    world.journal.ambrosia = true;
    expect(journalEntry(world, 'shrine:0')).not.toBeNull();
  });
});

describe('pinned journal hints', () => {
  it('pins, replaces, unpins and restores the selected subject as a local UI preference', () => {
    const world = newWorld();
    const before = savedCopy(world);
    const store = memoryStore();
    const pin = new PinnedJournalHint(world, store);
    expect(pin.read()).toBeNull();
    pin.toggle('quest:king');
    expect(pin.read()).toMatchObject({ id: 'quest:king', title: 'Lord British' });
    expect(new PinnedJournalHint(world, store).read()).toEqual(pin.read());
    pin.toggle('quest:exodus');
    expect(pin.read()?.id).toBe('quest:exodus');
    pin.toggle('quest:exodus');
    expect(pin.read()).toBeNull();
    expect(store.read()).toBeNull();
    expect(savedCopy(world)).toEqual(before);
  });

  it('refreshes progress without changing the pin, including mystery entries becoming known', () => {
    const world = newWorld();
    let now = 0;
    const pin = new PinnedJournalHint(world, memoryStore(), () => now);
    pin.toggle('quest:exotics');
    expect(pin.read()?.title).toBe('Mystery...');
    hearClue(world, 'LCB Towne#3');
    now = 300;
    expect(pin.read()?.title).toBe('Exotic arms');
    pin.toggle('quest:king');
    expect(pin.read()?.progress).toContain('He awaits');
    world.journal.lordBritish = true;
    now = 600;
    expect(pin.read()?.progress).toContain('Audience had');
    expect(pin.id).toBe('quest:king');
  });

  it('resolves immediately against restored, imported and new games instead of retaining old progress', () => {
    const world = newWorld();
    const freshSave = savedCopy(world);
    world.journal.lordBritish = true;
    const pin = new PinnedJournalHint(world, memoryStore('quest:king'), () => 0);
    expect(pin.read()?.progress).toContain('Audience had');
    expect(restore(world, freshSave)).toBe(true);
    expect(pin.read()?.progress).toContain('He awaits');
    world.journal = { ...emptyJournal(), lordBritish: true };
    expect(pin.read()?.progress).toContain('Audience had');
    world.newGame();
    expect(pin.read()?.progress).toContain('He awaits');
  });

  it('clears a pin when a replacement game no longer exposes its subject', () => {
    const world = newWorld();
    world.journal.ambrosia = true;
    const store = memoryStore('shrine:0');
    const pin = new PinnedJournalHint(world, store, () => 0);
    expect(pin.read()).not.toBeNull();
    world.newGame();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(pin.read()).toBeNull();
    expect(pin.id).toBeNull();
    expect(store.read()).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('clears obsolete preferences and rejects unavailable entries without replacing a valid pin', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const world = newWorld();
    const store = memoryStore('old:id');
    const pin = new PinnedJournalHint(world, store);
    expect(pin.read()).toBeNull();
    expect(store.read()).toBeNull();
    pin.toggle('quest:king');
    pin.toggle('shrine:0');
    expect(pin.read()?.id).toBe('quest:king');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('keeps pinning functional if preference storage is unavailable and logs the failure', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const denied = () => {
      throw new Error('storage denied');
    };
    const pin = new PinnedJournalHint(newWorld(), { read: denied, write: denied });
    pin.toggle('quest:king');
    expect(pin.read()?.id).toBe('quest:king');
    pin.toggle('quest:king');
    expect(pin.read()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(3);
  });
});
