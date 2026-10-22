package com.synthwavepixel.ultima3.diagnostics;

/** The Thor shortcut changes this vendor setting without reliably changing Android Display state. */
public final class ThorDisplayPolicy {
  public static final String SETTING = "dual_screen_display_mode";

  public enum Mode {
    DUAL("0"), TOP_ONLY("1"), BOTTOM_ONLY("2"), UNKNOWN("");
    private final String code;

    Mode(String code) { this.code = code; }

    public static Mode parse(String code) {
      for (Mode mode : values()) if (mode.code.equals(code)) return mode;
      return UNKNOWN;
    }

    public boolean allows(boolean primaryDisplay) {
      if (this == TOP_ONLY) return primaryDisplay;
      if (this == BOTTOM_ONLY) return !primaryDisplay;
      return true;
    }
  }

  private ThorDisplayPolicy() {}

  /** Limit this firmware-specific interpretation to the hardware whose setting/roles were verified. */
  public static boolean supports(String manufacturer, String model) {
    return "AYN".equalsIgnoreCase(manufacturer) && "AYN Thor".equalsIgnoreCase(model);
  }
}
