/** Small, read-only snapshots for a companion display. No game, input or save ownership crosses the bridge. */
import type { World } from '../game/world.ts';
import { hasMagic } from '../game/context.ts';
import { levelUpDue, PlayerOffset, type PlayerRecord, type StatusLetter } from '../game/player.ts';
import { gearName } from '../game/cards.ts';
import type { PinnedHint } from './pinnedHint.ts';

export const PARTY_STATUS_VERSION = 2;
const PARTY_POSITIONS = [0, 1, 2, 3] as const;
const RETRY_MS = 1000;
const EXPERIENCE_PER_LEVEL = 100;
const MAX_EXPERIENCE = 9899;

export type PartyPanelLine = 'hp' | 'xp' | 'weapon' | 'armour';

/** The same contextual second line on the original boxes and the companion's party cards. */
export function memberPanelDetail(world: World, member: PlayerRecord, line: PartyPanelLine): string {
  if (line === 'hp') return '';
  if (line !== 'xp') {
    const weapon = line === 'weapon';
    return gearName(world, weapon, member.bytes[weapon ? PlayerOffset.WeaponReadied : PlayerOffset.ArmourWorn]);
  }
  const xp = (member.level - 1) * EXPERIENCE_PER_LEVEL + member.experience;
  const next = xp >= MAX_EXPERIENCE ? ' MAX' : `/${member.level * EXPERIENCE_PER_LEVEL}`;
  return `XP ${xp}${next}`;
}

export interface PartyMemberStatus {
  position: number;
  name: string;
  className: string;
  hp: number;
  maxHp: number;
  mana: number | null;
  status: StatusLetter;
  levelDue: boolean;
  selected: boolean;
  active: boolean;
  flashing: boolean;
  detail: string;
}

export interface PartyStatus {
  version: typeof PARTY_STATUS_VERSION;
  playing: boolean;
  paused: boolean;
  gold: number;
  food: number;
  members: PartyMemberStatus[];
  hint: PinnedHint | null;
  log: string[];
}

export interface PartyPanelState {
  playing: boolean;
  paused: boolean;
  selectedMember: number;
  highlighted: ReadonlySet<number>;
  flashing: ReadonlySet<number>;
  hint?: PinnedHint | null;
  line?: PartyPanelLine;
  log?: readonly string[];
}

export function partyStatus(world: World, panel: PartyPanelState): PartyStatus {
  const careers = String.fromCharCode(...world.resources.misc.careerTable);
  const members = PARTY_POSITIONS.flatMap((position): PartyMemberStatus[] => {
    const slot = world.party.memberSlot(position);
    if (slot < 0) return [];
    const member = world.roster.get(slot);
    return [
      {
        position,
        name: member.name,
        className: world.resources.strings.Classes[careers.indexOf(member.classLetter)] ?? member.classLetter,
        hp: member.hitPoints,
        maxHp: member.maxHitPoints,
        mana: hasMagic(world, member) ? member.mana : null,
        status: member.status,
        levelDue: levelUpDue(member),
        selected: panel.playing && panel.selectedMember === position,
        active: panel.playing && panel.highlighted.has(position),
        flashing: panel.playing && panel.flashing.has(position),
        detail: panel.playing ? memberPanelDetail(world, member, panel.line ?? 'hp') : '',
      },
    ];
  });
  return {
    version: PARTY_STATUS_VERSION,
    playing: panel.playing,
    paused: panel.paused,
    gold: world.party.gold,
    food: world.party.food,
    members,
    hint: panel.hint ?? null,
    log: panel.playing ? [...(panel.log ?? [])] : [],
  };
}

/** The app's own Capacitor plugin; absent in ordinary release/browser builds. */
export interface NativePartyStatus {
  publish(options: { snapshot: PartyStatus }): Promise<void>;
}

/** Only changed, acknowledged snapshots are remembered. Slow or failed calls cannot pile up. */
export class PartyStatusPublisher {
  private acknowledged = '';
  private inFlight = false;
  private retryAt = 0;
  private failed = false;

  constructor(
    private readonly native: NativePartyStatus,
    private readonly now: () => number = () => performance.now(),
  ) {}

  update(snapshot: PartyStatus): void {
    if (this.inFlight || this.now() < this.retryAt) return;
    const signature = JSON.stringify(snapshot);
    if (signature === this.acknowledged) return;
    this.inFlight = true;
    void this.publish(snapshot, signature);
  }

  private async publish(snapshot: PartyStatus, signature: string): Promise<void> {
    try {
      await this.native.publish({ snapshot });
      this.acknowledged = signature;
      if (this.failed) console.info('Party status: companion bridge recovered');
      this.failed = false;
    } catch (error) {
      if (!this.failed) console.warn('Party status: companion bridge unavailable; retrying', error);
      this.failed = true;
      this.retryAt = this.now() + RETRY_MS;
    } finally {
      this.inFlight = false;
    }
  }
}
