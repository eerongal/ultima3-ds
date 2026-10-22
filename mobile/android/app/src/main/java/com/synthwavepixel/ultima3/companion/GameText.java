package com.synthwavepixel.ultima3.companion;

/** Typography shared by all companion text; bitmap sheets contain ASCII, not Android's Unicode glyphs. */
public final class GameText {
  private GameText() {}

  public static String normalize(String value) {
    return value.replace('\u2014', '-').replace('\u2013', '-').replace('\u00b7', '|')
        .replace('\u2018', '\'').replace('\u2019', '\'').replace('\u201c', '"').replace('\u201d', '"')
        .replace("\u2026", "...").replace('\u00d7', 'x');
  }

  /** Keep ordinary words together, splitting only tokens wider than the available column. */
  public static int wordEnd(CharSequence text, int start, int maxChars) {
    if (Character.isWhitespace(text.charAt(start))) return start + 1;
    int end = start + 1;
    while (end < text.length() && end - start < Math.max(1, maxChars) && !Character.isWhitespace(text.charAt(end))) end++;
    return end;
  }
}
