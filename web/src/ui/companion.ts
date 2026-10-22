import type { NativePartyStatus } from './partyStatus.ts';
import type { NativeCompanionTheme } from './companionTheme.ts';

export interface CompanionAvailability {
  available: boolean;
}

export interface NativeCompanion extends NativePartyStatus, NativeCompanionTheme {
  availability(): Promise<CompanionAvailability>;
  addListener(event: 'availabilityChanged', listener: (state: CompanionAvailability) => void): Promise<{ remove(): Promise<void> }>;
}

/** Subscribe before querying so a display transition during startup cannot leave the layout stale. */
export async function watchCompanion(native: NativeCompanion, changed: (available: boolean) => void): Promise<void> {
  let revision = 0;
  try {
    await native.addListener('availabilityChanged', (state) => {
      revision++;
      changed(state.available);
    });
    const queriedAt = revision;
    const initial = await native.availability();
    if (queriedAt === revision) changed(initial.available);
  } catch (error) {
    changed(false);
    console.warn('Companion layout: availability unavailable; keeping upper-screen status', error);
  }
}
