package com.synthwavepixel.ultima3.diagnostics;

import static org.junit.Assert.*;
import org.junit.Test;
import com.synthwavepixel.ultima3.diagnostics.ThorDisplayPolicy.Mode;

public class ThorDisplayPolicyTest {
  @Test
  public void recognizesTheVerifiedVendorModesAndUnknownValues() {
    assertEquals(Mode.DUAL, Mode.parse("0"));
    assertEquals(Mode.TOP_ONLY, Mode.parse("1"));
    assertEquals(Mode.BOTTOM_ONLY, Mode.parse("2"));
    assertEquals(Mode.UNKNOWN, Mode.parse(null));
    assertEquals(Mode.UNKNOWN, Mode.parse("9"));
  }

  @Test
  public void topOnlyExcludesTheSecondaryPanelAndBottomOnlyExcludesThePrimary() {
    assertTrue(Mode.TOP_ONLY.allows(true));
    assertFalse(Mode.TOP_ONLY.allows(false));
    assertFalse(Mode.BOTTOM_ONLY.allows(true));
    assertTrue(Mode.BOTTOM_ONLY.allows(false));
  }

  @Test
  public void dualOrUnknownModesLeaveAndroidAvailabilityInControl() {
    assertTrue(Mode.DUAL.allows(true));
    assertTrue(Mode.DUAL.allows(false));
    assertTrue(Mode.UNKNOWN.allows(true));
    assertTrue(Mode.UNKNOWN.allows(false));
  }

  @Test
  public void doesNotInterpretThorSettingsOnOtherHardware() {
    assertTrue(ThorDisplayPolicy.supports("AYN", "AYN Thor"));
    assertFalse(ThorDisplayPolicy.supports("AYN", "Odin 3"));
    assertFalse(ThorDisplayPolicy.supports("Anbernic", "RG DS"));
    assertFalse(ThorDisplayPolicy.supports(null, null));
  }
}
