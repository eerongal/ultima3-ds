import { describe, expect, it, vi } from 'vitest';
import { newWorld, savedCopy } from './helpers.ts';
import { PlayerOffset } from '../src/game/player.ts';
import { gearName } from '../src/game/cards.ts';
import { partyStatus, PartyStatusPublisher, type PartyPanelState, type PartyStatus } from '../src/ui/partyStatus.ts';

function panel(overrides: Partial<PartyPanelState> = {}): PartyPanelState {
  return {
    playing: true,
    paused: false,
    selectedMember: -1,
    highlighted: new Set(),
    flashing: new Set(),
    ...overrides,
  };
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('companion party snapshots', () => {
  it('copies the current log independently of party vitals and clears it on title screens', () => {
    const rows = ['South (x3)', '', 'Who?'];
    const world = newWorld();
    const snapshot = partyStatus(world, panel({ log: rows }));
    rows[0] = 'Changed';
    expect(snapshot.log).toEqual(['South (x3)', '', 'Who?']);
    expect(partyStatus(world, panel({ log: rows, playing: false })).log).toEqual([]);
  });
  it('preserves marching positions and empty slots instead of compacting selection indices', () => {
    const world = newWorld();
    world.party.setMemberRosterNumber(0, 4);
    world.party.setMemberRosterNumber(1, 0);
    const snapshot = partyStatus(world, panel({ selectedMember: 2 }));
    expect(snapshot.members.map((member) => member.position)).toEqual([0, 2, 3]);
    expect(snapshot.members[0].name).toBe(world.roster.get(3).name);
    expect(snapshot.members.find((member) => member.position === 2)?.selected).toBe(true);
  });

  it('reads current health, conditions, pooled supplies and zero mana without mutating a save', () => {
    const world = newWorld();
    const nonCaster = world.member(0);
    const caster = world.member(1);
    nonCaster.hitPoints = 7;
    nonCaster.status = 'P';
    caster.mana = 0;
    world.party.gold = 1234;
    world.party.food = 4321;
    const before = savedCopy(world);
    const snapshot = partyStatus(world, panel());
    expect(snapshot).toMatchObject({ version: 2, playing: true, paused: false, gold: 1234, food: 4321, hint: null });
    expect(snapshot.members[0]).toMatchObject({ hp: 7, maxHp: nonCaster.maxHitPoints, status: 'P', mana: null });
    expect(snapshot.members[1].mana).toBe(0);
    expect(snapshot.members[0].className).toBe('Thief');
    expect(savedCopy(world)).toEqual(before);
  });

  it('includes menu selection, combat highlighting and damage feedback independently of HP', () => {
    const snapshot = partyStatus(
      newWorld(),
      panel({
        selectedMember: 1,
        highlighted: new Set([2]),
        flashing: new Set([3]),
        paused: true,
      }),
    );
    expect(snapshot.paused).toBe(true);
    expect(snapshot.members[1].selected).toBe(true);
    expect(snapshot.members[2].active).toBe(true);
    expect(snapshot.members[3].flashing).toBe(true);
  });

  it('does not carry transient gameplay markers onto title/party-management screens', () => {
    const snapshot = partyStatus(
      newWorld(),
      panel({
        playing: false,
        selectedMember: 0,
        highlighted: new Set([0]),
        flashing: new Set([0]),
        line: 'weapon',
      }),
    );
    expect(snapshot.members[0]).toMatchObject({ selected: false, active: false, flashing: false, detail: '' });
  });

  it('preserves command-specific XP and equipment information in the companion cards', () => {
    const world = newWorld();
    const member = world.member(0);
    member.bytes[PlayerOffset.Level] = 2;
    member.bytes[PlayerOffset.Experience] = 45;
    expect(partyStatus(world, panel({ line: 'xp' })).members[0].detail).toBe('XP 245/300');
    expect(partyStatus(world, panel({ line: 'weapon' })).members[0].detail).toBe(
      gearName(world, true, member.bytes[PlayerOffset.WeaponReadied]),
    );
    expect(partyStatus(world, panel({ line: 'armour' })).members[0].detail).toBe(
      gearName(world, false, member.bytes[PlayerOffset.ArmourWorn]),
    );
    expect(partyStatus(world, panel()).members[0].detail).toBe('');
    member.bytes[PlayerOffset.Level] = 98;
    member.bytes[PlayerOffset.Experience] = 99;
    expect(partyStatus(world, panel({ line: 'xp' })).members[0].detail).toBe('XP 9899 MAX');
  });

  it('takes detached snapshots and resolves changed parties after load/new game', () => {
    const world = newWorld();
    const original = partyStatus(world, panel());
    world.member(0).status = 'D';
    world.member(0).hitPoints = 0;
    world.member(1).bytes[PlayerOffset.Level] = 1;
    expect(original.members[0].status).toBe('G');
    const changed = partyStatus(world, panel());
    expect(changed.members[0]).toMatchObject({ hp: 0, status: 'D' });
    expect(changed.members[1].levelDue).toBe(true);
    world.newGame();
    expect(partyStatus(world, panel()).members[0]).toMatchObject({ hp: 100, status: 'G' });
    for (let position = 0; position < 4; position++) world.party.setMemberRosterNumber(position, 0);
    expect(partyStatus(world, panel()).members).toEqual([]);
  });
});

describe('companion bridge delivery', () => {
  const snapshot = (): PartyStatus => partyStatus(newWorld(), panel());

  it('publishes the initial state and only changed snapshots afterward', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const publisher = new PartyStatusPublisher({ publish });
    const current = snapshot();
    publisher.update(current);
    await flush();
    publisher.update(structuredClone(current));
    expect(publish).toHaveBeenCalledTimes(1);
    publisher.update({ ...current, gold: current.gold + 1 });
    await flush();
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('delivers changed pins and progress, and clears them independently of party health', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const publisher = new PartyStatusPublisher({ publish });
    const world = newWorld();
    const hint = { id: 'quest:king', title: 'Lord British', progress: 'He awaits.', text: 'Walk into him.' };
    publisher.update(partyStatus(world, panel({ hint })));
    await flush();
    expect(publish).toHaveBeenLastCalledWith({ snapshot: partyStatus(world, panel({ hint })) });
    publisher.update(partyStatus(world, panel({ hint: { ...hint, progress: 'Audience had.' } })));
    await flush();
    expect(publish).toHaveBeenLastCalledWith({ snapshot: partyStatus(world, panel({ hint: { ...hint, progress: 'Audience had.' } })) });
    publisher.update(partyStatus(world, panel()));
    await flush();
    expect(publish).toHaveBeenLastCalledWith({ snapshot: partyStatus(world, panel()) });
    expect(publish).toHaveBeenCalledTimes(3);
  });

  it('waits for native acknowledgement and sends the latest frame after a slow call', async () => {
    let acknowledge!: () => void;
    const publish = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            acknowledge = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const publisher = new PartyStatusPublisher({ publish });
    const current = snapshot();
    publisher.update(current);
    publisher.update({ ...current, gold: 1 });
    publisher.update({ ...current, gold: 2 });
    expect(publish).toHaveBeenCalledTimes(1);
    acknowledge();
    await flush();
    publisher.update({ ...current, gold: 3 });
    await flush();
    expect(publish).toHaveBeenLastCalledWith({ snapshot: { ...current, gold: 3 } });
  });

  it('retries failed data with backoff, including synchronous plugin failures', async () => {
    let now = 0;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const publish = vi
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('bridge restarting');
        })
        .mockResolvedValue(undefined);
      const publisher = new PartyStatusPublisher({ publish }, () => now);
      const current = snapshot();
      publisher.update(current);
      await flush();
      publisher.update(current);
      expect(publish).toHaveBeenCalledTimes(1);
      now = 1000;
      publisher.update(current);
      await flush();
      publisher.update(current);
      expect(publish).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(info).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
      info.mockRestore();
    }
  });
});
