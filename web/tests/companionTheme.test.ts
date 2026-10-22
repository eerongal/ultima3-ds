import { describe, expect, it, vi } from 'vitest';
import { CompanionThemePublisher, type CompanionTheme, type NativeCompanionTheme } from '../src/ui/companionTheme.ts';
import type { GraphicsSet } from '../src/ui/graphics.ts';

const gfx = {} as GraphicsSet;
const artwork = (_gfx: GraphicsSet, name: string, scanlines: boolean): CompanionTheme => ({
  version: 1,
  name,
  font: 'font-png',
  frame: 'frame-png',
  scanlines,
  screenLines: 192,
  scanlineLevel: 0.65,
});
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('companion theme delivery', () => {
  it('encodes once per graphics set and sends only changed, acknowledged settings', async () => {
    const theme = vi.fn<NativeCompanionTheme['theme']>().mockResolvedValue(undefined);
    const encode = vi.fn(artwork);
    const publisher = new CompanionThemePublisher({ theme }, encode);
    publisher.update(gfx, 'Standard', false);
    await flush();
    publisher.update(gfx, 'Standard', false);
    publisher.update(gfx, 'Standard', true);
    await flush();
    publisher.update(gfx, 'Standard', true);
    expect(encode).toHaveBeenCalledTimes(1);
    expect(theme.mock.calls.map(([options]) => options.theme.scanlines)).toEqual([false, true]);
    publisher.update({} as GraphicsSet, 'Apple II Mono', true);
    await flush();
    expect(encode).toHaveBeenCalledTimes(2);
    expect(theme.mock.lastCall?.[0].theme.name).toBe('Apple II Mono');
  });

  it('does not queue settings behind a slow bridge, and sends the latest theme next', async () => {
    let resolve!: () => void;
    const theme = vi
      .fn<NativeCompanionTheme['theme']>()
      .mockImplementationOnce(() => new Promise<void>((done) => (resolve = done)))
      .mockResolvedValue(undefined);
    const encode = vi.fn(artwork);
    const publisher = new CompanionThemePublisher({ theme }, encode);
    publisher.update(gfx, 'Standard', false);
    publisher.update(gfx, 'Standard', true);
    expect(theme).toHaveBeenCalledTimes(1);
    resolve();
    await flush();
    publisher.update(gfx, 'Standard', true);
    await flush();
    expect(theme).toHaveBeenCalledTimes(2);
    expect(theme.mock.lastCall?.[0].theme.scanlines).toBe(true);
  });

  it('retries a rejected delivery with cached artwork and respects backoff', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const theme = vi.fn<NativeCompanionTheme['theme']>().mockRejectedValueOnce(new Error('Disconnected')).mockResolvedValue(undefined);
    const encode = vi.fn(artwork);
    let now = 0;
    const publisher = new CompanionThemePublisher({ theme }, encode, () => now);
    publisher.update(gfx, 'Standard', false);
    await flush();
    now = 999;
    publisher.update(gfx, 'Standard', false);
    expect(theme).toHaveBeenCalledTimes(1);
    now = 1000;
    publisher.update(gfx, 'Standard', true);
    await flush();
    expect(theme).toHaveBeenCalledTimes(2);
    expect(encode).toHaveBeenCalledTimes(1);
    expect(theme.mock.lastCall?.[0].theme.scanlines).toBe(true);
    vi.restoreAllMocks();
  });

  it('recovers from image encoding errors without publishing incomplete artwork', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const theme = vi.fn<NativeCompanionTheme['theme']>().mockResolvedValue(undefined);
    const encode = vi.fn(artwork).mockImplementationOnce(() => {
      throw new Error('Canvas unavailable');
    });
    let now = 0;
    const publisher = new CompanionThemePublisher({ theme }, encode, () => now);
    publisher.update(gfx, 'Standard', false);
    expect(theme).not.toHaveBeenCalled();
    publisher.update(gfx, 'Standard', false);
    expect(encode).toHaveBeenCalledTimes(1);
    now = 1000;
    publisher.update(gfx, 'Standard', false);
    await flush();
    expect(theme).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});
