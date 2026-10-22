package com.synthwavepixel.ultima3.companion;

import static org.junit.Assert.*;
import org.json.JSONException;
import org.json.JSONObject;
import org.junit.Test;

public class ThemeSpecTest {
  private JSONObject data() throws JSONException {
    return new JSONObject().put("version", 1).put("name", "Standard")
        .put("font", "data:image/png;base64,Zm9udA==").put("frame", "data:image/png;base64,ZnJhbWU=")
        .put("scanlines", true).put("screenLines", 192).put("scanlineLevel", 0.65);
  }

  @Test public void copiesValidatedThemeData() throws JSONException {
    JSONObject source = data();
    ThemeSpec spec = new ThemeSpec(source);
    source.put("name", "Changed");
    assertEquals("Standard", spec.name);
    assertEquals("Zm9udA==", spec.font);
    assertTrue(spec.scanlines);
    assertEquals(192, spec.screenLines);
    assertEquals(0.65f, spec.scanlineLevel, 0.001f);
  }

  @Test public void rejectsMissingUnsupportedOrUnboundedImages() throws JSONException {
    assertThrows(JSONException.class, () -> new ThemeSpec(null));
    assertThrows(JSONException.class, () -> new ThemeSpec(data().put("version", 2)));
    assertThrows(JSONException.class, () -> new ThemeSpec(data().put("font", "https://example.com/image.png")));
    assertThrows(JSONException.class, () -> new ThemeSpec(data().put("frame", "data:image/png;base64,")));
    assertThrows(JSONException.class, () -> new ThemeSpec(data().put("font", "data:image/png;base64," + "a".repeat(1024 * 1024))));
  }

  @Test public void rejectsInvalidScanlinesAndNames() throws JSONException {
    assertThrows(JSONException.class, () -> new ThemeSpec(data().put("screenLines", 0)));
    assertThrows(JSONException.class, () -> new ThemeSpec(data().put("scanlineLevel", 1.1)));
    assertThrows(JSONException.class, () -> new ThemeSpec(data().put("name", "")));
  }

  @Test public void normalizesPunctuationForTheBitmapFontWithoutLosingLineBreaks() {
    assertEquals("Party - Paused | 2x\n'Quest' \"hint\"...", GameText.normalize("Party — Paused · 2×\n‘Quest’ “hint”…"));
    assertEquals("HP 0 / 100    MP -", GameText.normalize("HP 0 / 100    MP —"));
  }

  @Test public void keepsWordsAndNumbersTogetherButSplitsOversizedTokens() {
    assertEquals(6, GameText.wordEnd("Found, not yet entered.", 0, 20));
    assertEquals(9, GameText.wordEnd("Food: 548", 6, 20));
    assertEquals(1, GameText.wordEnd("\nNext", 0, 20));
    assertEquals(5, GameText.wordEnd("longtoken", 0, 5));
    assertEquals(1, GameText.wordEnd("longtoken", 0, 0));
  }
}
