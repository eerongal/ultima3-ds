package com.synthwavepixel.ultima3.diagnostics;

import android.app.Activity;
import android.content.Context;
import android.database.ContentObserver;
import android.hardware.display.DisplayManager;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.Display;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.WebView;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.json.JSONException;
import org.json.JSONTokener;
import com.synthwavepixel.ultima3.companion.PartySnapshot;
import com.synthwavepixel.ultima3.companion.CompanionTheme;

/** Native-only display spike. The companion never creates another game, audio player or save writer. */
public final class DualScreenProbe implements DisplayManager.DisplayListener {
  public interface AvailabilityListener {
    void changed(boolean available);
  }
  private static final String TAG = "U3DualScreen";
  private static final long UPDATE_MS = 1000;
  private static final String WEB_STATUS =
      "(() => { const u = window.u3; if (!u) return 'Game loading';"
      + " const pads = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean);"
      + " return 'Web focus: ' + document.hasFocus() + '\\nGame paused: ' + u.keyboard.paused"
      + " + '\\nGamepads: ' + pads.length + '\\nHeld buttons: '"
      + " + pads.reduce((n, p) => n + p.buttons.filter(b => b.pressed).length, 0); })()";

  private final Activity activity;
  private final WebView web;
  private final AvailabilityListener availabilityChanged;
  private final DisplayManager displays;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final ContentObserver thorModeObserver = new ContentObserver(handler) {
    @Override public void onChange(boolean selfChange) { reportAvailability(); }
  };
  private final boolean thorModeSupported = ThorDisplayPolicy.supports(android.os.Build.MANUFACTURER, android.os.Build.MODEL);
  private boolean watchingThorMode;
  private boolean modeReadFailed;
  private String lastThorMode;
  private final Runnable heartbeat = this::tick;
  private ProbePresentation presentation;
  private boolean running;
  private int taps;
  private PartySnapshot party;
  private CompanionTheme theme;
  private boolean lastAvailable;

  public DualScreenProbe(Activity activity, WebView web, AvailabilityListener availabilityChanged) {
    this.activity = activity;
    this.web = web;
    this.availabilityChanged = availabilityChanged;
    displays = (DisplayManager) activity.getSystemService(Context.DISPLAY_SERVICE);
  }

  public void start() {
    if (running) return;
    running = true;
    displays.registerDisplayListener(this, handler);
    watchThorMode();
    Log.i(TAG, "Probe started; " + android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL
        + "; Android " + android.os.Build.VERSION.RELEASE);
    refresh();
    handler.post(heartbeat);
  }

  public void stop() {
    if (!running) return;
    running = false;
    handler.removeCallbacks(heartbeat);
    displays.unregisterDisplayListener(this);
    if (watchingThorMode) activity.getContentResolver().unregisterContentObserver(thorModeObserver);
    watchingThorMode = false;
    closePresentation();
    Log.i(TAG, "Probe stopped");
  }

  public void lifecycle(String event) {
    Log.i(TAG, "Activity " + event);
  }

  public void updateParty(PartySnapshot snapshot) {
    if (party == null) Log.i(TAG, "Party companion received its first snapshot");
    party = snapshot;
    render();
  }

  public void updateTheme(CompanionTheme value) {
    theme = value;
    if (presentation != null) presentation.applyTheme(theme);
  }

  public void focusChanged(boolean focused) {
    lifecycle("focus=" + focused);
    // onStart/onResume can precede attaching the activity's window to a display.
    if (focused) refresh();
  }

  public void keyEvent(KeyEvent event) {
    if (event.getAction() != KeyEvent.ACTION_DOWN || event.getRepeatCount() != 0) return;
    Log.i(TAG, "Primary input: " + KeyEvent.keyCodeToString(event.getKeyCode()) + "; source=" + event.getSource()
        + "; device=" + event.getDeviceId());
    render();
  }

  public void refresh() {
    if (!running) return;
    Display host = web.getDisplay();
    if (host == null) {
      Log.w(TAG, "Game view has no attached display yet");
      return;
    }
    logDisplays(host.getDisplayId());
    List<Integer> eligible = new ArrayList<>();
    for (Display display : displays.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION)) {
      eligible.add(display.getDisplayId());
    }
    int current = presentation == null ? DisplaySelection.NONE : presentation.getDisplay().getDisplayId();
    int selected = DisplaySelection.choose(host.getDisplayId(), current, eligible);
    if (selected == current && presentation != null) {
      reportAvailability();
      return;
    }
    closePresentation();
    if (selected == DisplaySelection.NONE) {
      Log.w(TAG, "No eligible companion display; keeping the ordinary game layout");
      return;
    }
    showPresentation(selected);
  }

  private void logDisplays(int host) {
    Log.i(TAG, "Game display=" + host);
    for (Display display : displays.getDisplays()) {
      Log.i(TAG, "Display: " + display);
    }
  }

  private void showPresentation(int id) {
    Display target = displays.getDisplay(id);
    if (target == null) {
      Log.w(TAG, "Companion display disappeared before opening: " + id);
      return;
    }
    ProbePresentation next = new ProbePresentation(activity, target, this::tap);
    next.setOnDismissListener(dialog -> {
      if (presentation != next) return;
      presentation = null;
      reportAvailability();
      Log.w(TAG, "Companion dismissed by Android; retry on resume or display change");
    });
    try {
      next.show();
      presentation = next;
      if (theme != null) next.applyTheme(theme);
      Log.i(TAG, "Companion opened on display=" + id + "; window does not take input focus");
      render();
      reportAvailability();
    } catch (WindowManager.InvalidDisplayException | SecurityException error) {
      next.dismiss();
      Log.e(TAG, "Cannot open companion on display=" + id + "; game remains available", error);
    }
  }

  private void closePresentation() {
    ProbePresentation previous = presentation;
    presentation = null;
    if (previous == null) return;
    previous.dismiss();
    reportAvailability();
    Log.i(TAG, "Companion closed");
  }

  public boolean isAvailable() {
    return presentation != null && presentation.getDisplay().isValid()
        && presentation.getDisplay().getState() == Display.STATE_ON
        && readThorMode().allows(presentation.getDisplay().getDisplayId() == Display.DEFAULT_DISPLAY);
  }

  private void watchThorMode() {
    if (!thorModeSupported) return;
    try {
      activity.getContentResolver().registerContentObserver(Settings.System.getUriFor(ThorDisplayPolicy.SETTING), false, thorModeObserver);
      watchingThorMode = true;
    } catch (SecurityException error) {
      Log.w(TAG, "Cannot observe Thor screen mode; checking with the diagnostic heartbeat", error);
    }
  }

  private ThorDisplayPolicy.Mode readThorMode() {
    if (!thorModeSupported) return ThorDisplayPolicy.Mode.UNKNOWN;
    try {
      String raw = Settings.System.getString(activity.getContentResolver(), ThorDisplayPolicy.SETTING);
      ThorDisplayPolicy.Mode mode = ThorDisplayPolicy.Mode.parse(raw);
      if (!Objects.equals(lastThorMode, raw)) Log.i(TAG, "Thor screen mode=" + mode + "; setting=" + raw);
      if (mode == ThorDisplayPolicy.Mode.UNKNOWN && !Objects.equals(lastThorMode, raw)) Log.w(TAG, "Unrecognized Thor mode; using Android display state");
      lastThorMode = raw;
      modeReadFailed = false;
      return mode;
    } catch (SecurityException error) {
      if (!modeReadFailed) Log.w(TAG, "Cannot read Thor screen mode; using Android display state", error);
      modeReadFailed = true;
      return ThorDisplayPolicy.Mode.UNKNOWN;
    }
  }

  private void reportAvailability() {
    boolean available = isAvailable();
    if (lastAvailable == available) return;
    lastAvailable = available;
    Log.i(TAG, "Companion available=" + available + "; Android display state="
        + (presentation == null ? "no window" : presentation.getDisplay().getState()));
    availabilityChanged.changed(available);
  }

  private void tap() {
    taps++;
    Log.i(TAG, "Companion tap=" + taps + "; activity focus=" + activity.hasWindowFocus());
    readWebStatus();
    render();
  }

  private void tick() {
    if (!running) return;
    reportAvailability();
    handler.postDelayed(heartbeat, UPDATE_MS);
  }

  private void readWebStatus() {
    ProbePresentation expected = presentation;
    if (expected == null) return;
    web.evaluateJavascript(WEB_STATUS, result -> {
      if (!running || presentation != expected) return;
      try {
        Log.i(TAG, "Companion touch diagnostics: " + new JSONTokener(result).nextValue());
      } catch (JSONException error) {
        Log.w(TAG, "Could not read game diagnostics", error);
      }
    });
  }

  private void render() {
    if (presentation == null) return;
    presentation.render(party);
  }

  @Override
  public void onDisplayAdded(int id) {
    Log.i(TAG, "Display added=" + id);
    refresh();
  }

  @Override
  public void onDisplayChanged(int id) {
    Log.i(TAG, "Display changed=" + id);
    refresh();
  }

  @Override
  public void onDisplayRemoved(int id) {
    Log.i(TAG, "Display removed=" + id);
    refresh();
  }
}
