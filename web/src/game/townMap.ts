import type { World } from './world.ts';
import { MapId } from '../data/resources.ts';
import { Location } from './party.ts';
import { MAP_SIDE } from './automap.ts';
import { MapValue } from './tiles.ts';
import { MONSTER_SLOTS } from './monsterTable.ts';
import { counterWithMerchant } from './commands.ts';
import { speech } from './talk.ts';

export enum TownMarkKind {
  Pub = 'pub',
  Food = 'food',
  Healer = 'healer',
  Weapons = 'weapons',
  Armour = 'armour',
  Guild = 'guild',
  Oracle = 'oracle',
  Horses = 'horses',
  Talk = 'talk',
}

export interface TownMark {
  kind: TownMarkKind;
  x: number;
  y: number;
}

/** Transact dispatches by the customer's row & 7, not the merchant's row or dialogue. */
const SHOP_ROW_MASK = 0x07;
const SHOP_KINDS = [
  TownMarkKind.Pub,
  TownMarkKind.Food,
  TownMarkKind.Healer,
  TownMarkKind.Weapons,
  TownMarkKind.Armour,
  TownMarkKind.Guild,
  TownMarkKind.Oracle,
  TownMarkKind.Horses,
] as const;
/** Mark each shop's straight-on counter frontage, rather than diagonal transaction side effects. */
const APPROACHES = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;
const COUNTER_DISTANCE = 2;
const GROUP_DISTANCE = 3;

export function isTownMap(world: World): boolean {
  return (
    world.party.location === Location.Town &&
    world.current.id >= MapId.FirstTown &&
    world.current.id < MapId.FirstDungeon &&
    world.current.size === MAP_SIDE
  );
}

function inside(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_SIDE && y < MAP_SIDE;
}

/** Ignore a person temporarily occupying the customer's square when identifying a fixed shop. */
function standingRoom(world: World, x: number, y: number): boolean {
  const person = world.monsters.at(x, y);
  // A second merchant behind the same counter is staff, not a customer approach.
  if (person >= 0 && world.monsters.type(person) === MapValue.Merchant) return false;
  const value = person < 0 ? world.getXYVal(x, y) : world.monsters.tileUnder(person);
  return value >= MapValue.Grass && value < MapValue.Whirlpool && value !== MapValue.Mountains;
}

function shopMarks(world: World, index: number): TownMark[] {
  if (world.monsters.type(index) !== MapValue.Merchant) return [];
  const [mx, my] = [world.monsters.x(index), world.monsters.y(index)];
  return APPROACHES.flatMap(([dx, dy]) => {
    const [x, y] = [mx + COUNTER_DISTANCE * dx, my + COUNTER_DISTANCE * dy];
    if (!inside(x, y) || !standingRoom(world, x, y)) return [];
    if (!counterWithMerchant(world, mx + dx, my + dy, -dx, -dy)) return [];
    return [{ kind: SHOP_KINDS[y & SHOP_ROW_MASK], x, y }];
  });
}

function personMark(world: World, index: number): TownMark[] {
  const person = world.monsters.talkIndex(index);
  if (!person || !speech(world.current.talk, person).trim()) return [];
  return [{ kind: TownMarkKind.Talk, x: world.monsters.x(index), y: world.monsters.y(index) }];
}

/** Live locations are intentionally independent of discovery; drawing them never records exploration. */
export function townMarks(world: World): TownMark[] {
  if (world.combat || !isTownMap(world)) return [];
  const marks: TownMark[] = [];
  for (let index = 0; index < MONSTER_SLOTS; index++) {
    if (!world.monsters.type(index)) continue;
    const shops = shopMarks(world, index);
    const candidates = shops.length ? shops : personMark(world, index);
    appendDistinctMarks(marks, candidates);
  }
  return marks;
}

/** One symbol represents adjacent counters or a close group saying the same kind of thing. */
function appendDistinctMarks(marks: TownMark[], candidates: TownMark[]): void {
  for (const mark of candidates) {
    if (!inside(mark.x, mark.y)) continue;
    const grouped = marks.some((other) => other.kind === mark.kind && Math.hypot(other.x - mark.x, other.y - mark.y) <= GROUP_DISTANCE);
    if (!grouped) marks.push(mark);
  }
}
