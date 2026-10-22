package com.synthwavepixel.ultima3.companion;

import org.json.JSONException;
import org.json.JSONObject;

/** Validated wire data; decoding bitmaps happens only after size/format checks. */
public final class ThemeSpec {
  public static final int VERSION = 1;
  private static final int MAX_IMAGE_CHARS = 1024 * 1024;
  private static final String PNG_PREFIX = "data:image/png;base64,";
  public final String name;
  public final String font;
  public final String frame;
  public final boolean scanlines;
  public final int screenLines;
  public final float scanlineLevel;

  public ThemeSpec(JSONObject data) throws JSONException {
    if (data == null || data.getInt("version") != VERSION) throw new JSONException("Unsupported companion theme");
    name = data.getString("name");
    if (name.isEmpty() || name.length() > 64) throw new JSONException("Invalid theme name");
    font = image(data, "font");
    frame = image(data, "frame");
    scanlines = data.getBoolean("scanlines");
    screenLines = data.getInt("screenLines");
    double level = data.getDouble("scanlineLevel");
    if (screenLines < 1 || screenLines > 1080 || !Double.isFinite(level) || level < 0 || level > 1) {
      throw new JSONException("Invalid scanline settings");
    }
    scanlineLevel = (float) level;
  }

  private static String image(JSONObject data, String key) throws JSONException {
    String value = data.getString(key);
    if (!value.startsWith(PNG_PREFIX) || value.length() <= PNG_PREFIX.length() || value.length() > MAX_IMAGE_CHARS) {
      throw new JSONException("Invalid theme image: " + key);
    }
    return value.substring(PNG_PREFIX.length());
  }
}
