package com.synthwavepixel.ultima3.diagnostics;

import android.app.Presentation;
import android.content.Context;
import android.os.Bundle;
import android.view.Display;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.ScrollView;
import android.widget.LinearLayout;
import com.synthwavepixel.ultima3.companion.PartyPanel;
import com.synthwavepixel.ultima3.companion.PartySnapshot;
import com.synthwavepixel.ultima3.companion.HintPanel;
import com.synthwavepixel.ultima3.companion.CompanionTheme;
import com.synthwavepixel.ultima3.companion.CompanionLayout;
import com.synthwavepixel.ultima3.companion.MessageLogPanel;
import java.util.Objects;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/** A touchable, non-focusable companion: controller input stays with the game. */
final class ProbePresentation extends Presentation {
  private final Runnable onTap;
  private PartyPanel party;
  private HintPanel hint;
  private CompanionLayout content;
  private ScrollView hintScroll;
  private String hintId;
  private MessageLogPanel messages;
  private static final int PARTY_WEIGHT = 3;
  private static final int LOG_WEIGHT = 1;

  ProbePresentation(Context context, Display display, Runnable onTap) {
    super(context, display);
    this.onTap = onTap;
  }

  @Override protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    Window window = getWindow();
    window.addFlags(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE);
    window.setBackgroundDrawableResource(android.R.color.black);
    content = new CompanionLayout(getContext());
    content.setOrientation(LinearLayout.HORIZONTAL);
    party = new PartyPanel(getContext());
    hint = new HintPanel(getContext());
    party.setOnClickListener(view -> tapped());
    hint.setOnClickListener(view -> tapped());
    LinearLayout left = new LinearLayout(getContext());
    left.setOrientation(LinearLayout.VERTICAL);
    left.addView(scroll(party), section(PARTY_WEIGHT));
    messages = new MessageLogPanel(getContext());
    messages.onTap(this::tapped);
    left.addView(messages, section(LOG_WEIGHT));
    content.addView(left, column());
    hintScroll = scroll(hint);
    content.addView(hintScroll, column());
    content.setPartyPanel(party, messages);
    setContentView(content);
    hideSystemBars();
  }

  void applyTheme(CompanionTheme theme) {
    party.applyTheme(theme);
    hint.applyTheme(theme);
    messages.applyTheme(theme);
    content.applyTheme(theme);
  }

  void render(PartySnapshot snapshot) {
    if (party != null) party.render(snapshot);
    if (hint != null && snapshot != null) renderHint(snapshot.hint);
    if (messages != null && snapshot != null) messages.render(snapshot.log);
  }

  private void renderHint(PartySnapshot.Hint pinned) {
    String nextId = pinned == null ? null : pinned.id;
    hint.render(pinned);
    if (!Objects.equals(hintId, nextId)) hintScroll.scrollTo(0, 0);
    hintId = nextId;
  }

  private LinearLayout.LayoutParams column() {
    return new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1);
  }

  private LinearLayout.LayoutParams section(int weight) {
    return new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, weight);
  }

  private ScrollView scroll(View child) {
    ScrollView view = new ScrollView(getContext());
    view.setFillViewport(true);
    view.setFocusable(false);
    view.setVerticalScrollBarEnabled(false);
    view.addView(child);
    view.setOnScrollChangeListener((v, x, y, oldX, oldY) -> content.invalidate());
    return view;
  }

  private void tapped() {
    hideSystemBars();
    onTap.run();
  }

  private void hideSystemBars() {
    Window window = getWindow();
    WindowCompat.setDecorFitsSystemWindows(window, false);
    WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
    controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    controller.hide(WindowInsetsCompat.Type.systemBars());
  }
}
