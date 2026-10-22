package com.synthwavepixel.ultima3.diagnostics;

import java.util.List;

/** Prefer the current eligible companion display; never present over the game itself. */
public final class DisplaySelection {
  public static final int NONE = -1;

  private DisplaySelection() {}

  public static int choose(int host, int current, List<Integer> eligible) {
    if (current != host && eligible.contains(current)) return current;
    for (int candidate : eligible) {
      if (candidate == host) continue;
      return candidate;
    }
    return NONE;
  }
}
