package com.synthwavepixel.ultima3.companion;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

/** The exact font and UI sheets loaded by the primary renderer, retained across presentation recreation. */
public final class CompanionTheme {
  public static final int GLYPHS = 96;
  public static final int UI_COLUMNS = 16;
  private static final int UI_ROWS = 3;
  private static final int MAX_BITMAP_PIXELS = 4 * 1024 * 1024;
  public final ThemeSpec spec;
  public final Bitmap font;
  public final Bitmap frame;

  public CompanionTheme(ThemeSpec spec) {
    this.spec = spec;
    font = decode(spec.font);
    frame = decode(spec.frame);
    if (font.getWidth() % GLYPHS != 0 || frame.getWidth() % UI_COLUMNS != 0
        || frame.getHeight() != frame.getWidth() / UI_COLUMNS * UI_ROWS) {
      throw new IllegalArgumentException("Invalid font/frame sheet dimensions");
    }
  }

  public boolean classic() { return !"Standard".equals(spec.name); }

  private static Bitmap decode(String encoded) {
    byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
    BitmapFactory.Options options = new BitmapFactory.Options();
    options.inJustDecodeBounds = true;
    BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
    if (options.outWidth < 1 || options.outHeight < 1 || (long) options.outWidth * options.outHeight > MAX_BITMAP_PIXELS) {
      throw new IllegalArgumentException("Invalid theme bitmap dimensions");
    }
    options.inJustDecodeBounds = false;
    Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
    if (bitmap == null) throw new IllegalArgumentException("Cannot decode theme bitmap");
    return bitmap;
  }
}
