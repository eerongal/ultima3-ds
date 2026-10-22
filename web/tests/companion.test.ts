import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchCompanion, type CompanionAvailability, type NativeCompanion } from '../src/ui/companion.ts';

afterEach(() => vi.restoreAllMocks());

function bridge() {
  let listener: (state: CompanionAvailability) => void = () => {};
  const native: NativeCompanion = {
    theme: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined),
    availability: vi.fn().mockResolvedValue({ available: false }),
    addListener: vi.fn().mockImplementation(async (_event: string, callback: (state: CompanionAvailability) => void) => {
      listener = callback;
      return { remove: vi.fn().mockResolvedValue(undefined) };
    }),
  };
  return { native, emit: (available: boolean) => listener({ available }) };
}

describe('companion layout availability', () => {
  it('starts with native availability and follows disconnect/reconnect events', async () => {
    const { native, emit } = bridge();
    const changed = vi.fn();
    await watchCompanion(native, changed);
    emit(true);
    emit(false);
    emit(true);
    expect(changed.mock.calls).toEqual([[false], [true], [false], [true]]);
  });

  it('does not overwrite a newer display event with a stale startup response', async () => {
    const { native, emit } = bridge();
    let resolve!: (state: CompanionAvailability) => void;
    native.availability = () =>
      new Promise((done) => {
        resolve = done;
      });
    const changed = vi.fn();
    const watching = watchCompanion(native, changed);
    await Promise.resolve();
    emit(true);
    resolve({ available: false });
    await watching;
    expect(changed.mock.calls).toEqual([[true]]);
  });

  it.each(['addListener', 'availability'] as const)('keeps upper-screen status if %s fails', async (method) => {
    const { native } = bridge();
    native[method] = vi.fn().mockRejectedValue(new Error('bridge unavailable'));
    const changed = vi.fn();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await watchCompanion(native, changed);
    expect(changed).toHaveBeenLastCalledWith(false);
    expect(warning).toHaveBeenCalledOnce();
  });
});
