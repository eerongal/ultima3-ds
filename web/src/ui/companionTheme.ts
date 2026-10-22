import type { GraphicsSet } from './graphics.ts';
import { SCANLINE_LEVEL, SCREEN_LINES } from './scanlines.ts';
const RETRY_MS = 1000;

/** Small, immutable drawing assets, sent only when visual settings change. */
export interface CompanionTheme {
  version: 1;
  name: string;
  font: string;
  frame: string;
  scanlines: boolean;
  screenLines: number;
  scanlineLevel: number;
}

export interface NativeCompanionTheme {
  theme(options: { theme: CompanionTheme }): Promise<void>;
}

interface ThemeState {
  gfx: GraphicsSet;
  name: string;
  scanlines: boolean;
}

function png(image: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d')!.drawImage(image, 0, 0);
  return canvas.toDataURL('image/png');
}

export function companionTheme(gfx: GraphicsSet, name: string, scanlines: boolean): CompanionTheme {
  return { version: 1, name, font: png(gfx.font), frame: png(gfx.ui), scanlines, screenLines: SCREEN_LINES, scanlineLevel: SCANLINE_LEVEL };
}

/** Latest settings win even if a previous bridge call is slow; failures retry without encoding every frame. */
export class CompanionThemePublisher {
  private assets: { gfx: GraphicsSet; theme: CompanionTheme } | null = null;
  private acknowledged: ThemeState | null = null;
  private inFlight = false;
  private retryAt = 0;
  private failed = false;

  constructor(
    private readonly native: NativeCompanionTheme,
    private readonly encode = companionTheme,
    private readonly now = () => performance.now(),
  ) {}

  update(gfx: GraphicsSet, name: string, scanlines: boolean): void {
    if (this.inFlight || this.now() < this.retryAt) return;
    if (this.acknowledged?.gfx === gfx && this.acknowledged.name === name && this.acknowledged.scanlines === scanlines) return;
    try {
      if (this.assets?.gfx !== gfx) this.assets = { gfx, theme: this.encode(gfx, name, scanlines) };
      const theme = { ...this.assets.theme, name, scanlines };
      this.inFlight = true;
      void this.publish(theme, { gfx, name, scanlines });
    } catch (error) {
      this.retry(error);
    }
  }

  private retry(error: unknown): void {
    if (!this.failed) console.warn('Companion theme: cannot update artwork; retrying', error);
    this.failed = true;
    this.retryAt = this.now() + RETRY_MS;
  }

  private async publish(theme: CompanionTheme, state: ThemeState): Promise<void> {
    try {
      await this.native.theme({ theme });
      this.acknowledged = state;
      console.info(`Companion theme: ${theme.name}; scanlines ${theme.scanlines ? 'on' : 'off'}`);
      this.failed = false;
    } catch (error) {
      this.retry(error);
    } finally {
      this.inFlight = false;
    }
  }
}
