package com.synthwavepixel.ultima3.diagnostics;

import static org.junit.Assert.assertEquals;

import java.util.Arrays;
import java.util.Collections;
import org.junit.Test;

public class DisplaySelectionTest {
  private static final int GAME = 7;
  private static final int LOWER = 12;
  private static final int EXTERNAL = 25;

  @Test
  public void noCompanionOnSingleDisplay() {
    assertEquals(DisplaySelection.NONE,
        DisplaySelection.choose(GAME, DisplaySelection.NONE, Collections.singletonList(GAME)));
    assertEquals(DisplaySelection.NONE,
        DisplaySelection.choose(GAME, LOWER, Collections.emptyList()));
  }

  @Test
  public void choosesEligibleDisplayWithoutAssumingZeroOrOne() {
    assertEquals(LOWER,
        DisplaySelection.choose(GAME, DisplaySelection.NONE, Arrays.asList(GAME, LOWER, EXTERNAL)));
  }

  @Test
  public void preservesSelectionWhenSystemPreferenceChanges() {
    assertEquals(LOWER,
        DisplaySelection.choose(GAME, LOWER, Arrays.asList(EXTERNAL, LOWER)));
  }

  @Test
  public void fallsBackWhenSelectedDisplayIsRemoved() {
    assertEquals(EXTERNAL,
        DisplaySelection.choose(GAME, LOWER, Collections.singletonList(EXTERNAL)));
  }

  @Test
  public void neverKeepsCompanionOverGameAfterHostMoves() {
    assertEquals(EXTERNAL,
        DisplaySelection.choose(LOWER, LOWER, Arrays.asList(LOWER, EXTERNAL)));
  }
}
