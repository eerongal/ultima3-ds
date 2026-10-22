import type { World } from '../game/world.ts';
import { journalEntry } from '../game/journal.ts';

export const PINNED_HINT_KEY = 'ultima3.pinnedJournalHint';
const REFRESH_MS = 250;

export interface PinnedHint {
  id: string;
  title: string;
  progress: string;
  text: string;
}

export interface PinStore {
  read(): string | null;
  write(id: string | null): void;
}

const localPins: PinStore = {
  read: () => localStorage.getItem(PINNED_HINT_KEY),
  write: (id) => {
    if (id === null) localStorage.removeItem(PINNED_HINT_KEY);
    else localStorage.setItem(PINNED_HINT_KEY, id);
  },
};

/** A local UI preference, resolved from the current journal rather than a saved row or stale hint card. */
export class PinnedJournalHint {
  private currentId: string | null = null;
  private cached: PinnedHint | null = null;
  private checkedAt = -Infinity;
  private journal: World['journal'] | null = null;

  constructor(
    private readonly world: World,
    private readonly store: PinStore = localPins,
    private readonly now: () => number = () => performance.now(),
  ) {
    try {
      this.currentId = store.read();
    } catch (error) {
      console.warn('Journal pin: could not read preference', error);
    }
  }

  get id(): string | null {
    return this.currentId;
  }

  toggle(id: string): void {
    if (!journalEntry(this.world, id)) {
      console.warn(`Journal pin: entry unavailable (${id})`);
      return;
    }
    this.currentId = this.currentId === id ? null : id;
    this.checkedAt = -Infinity;
    this.cached = null;
    this.remember();
    console.info(this.currentId ? `Journal pin: selected ${this.currentId}` : 'Journal pin: cleared');
  }

  read(): PinnedHint | null {
    if (this.currentId === null) return null;
    if (this.journal === this.world.journal && this.now() - this.checkedAt < REFRESH_MS) return this.cached;
    this.journal = this.world.journal;
    this.checkedAt = this.now();
    const line = journalEntry(this.world, this.currentId);
    if (!line) {
      console.warn(`Journal pin: removed unavailable entry (${this.currentId})`);
      this.currentId = null;
      this.cached = null;
      this.remember();
      return null;
    }
    this.cached = { id: line.id, title: line.name, progress: line.about, text: line.hint };
    return this.cached;
  }

  private remember(): void {
    try {
      this.store.write(this.currentId);
    } catch (error) {
      console.warn('Journal pin: could not save preference', error);
    }
  }
}
