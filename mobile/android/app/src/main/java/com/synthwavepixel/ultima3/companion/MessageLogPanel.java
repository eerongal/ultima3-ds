package com.synthwavepixel.ultima3.companion;

import android.content.Context;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.view.ViewTreeObserver;
import com.synthwavepixel.ultima3.R;
import java.util.List;
import java.util.Collections;

/** Recent output from the authoritative message buffer; reviewing it never moves focus or issues commands. */
public final class MessageLogPanel extends LinearLayout {
  private static final int PADDING_DP = 4;
  private static final int FRAME_DP = 8;
  private static final int HEADING_SP = 12;
  private static final int MESSAGE_SP = 10;
  private final GameTextView heading;
  private final GameTextView text;
  private final ScrollView scroll;
  private List<String> rendered = Collections.emptyList();
  private boolean followLatest = true;
  private boolean updating;
  private final ViewTreeObserver.OnPreDrawListener followOnDraw = this::finishUpdate;

  public MessageLogPanel(Context context) {
    super(context);
    setOrientation(VERTICAL);
    setFocusable(false);
    int padding = dp(PADDING_DP);
    setPadding(padding, dp(FRAME_DP + PADDING_DP), padding + dp(FRAME_DP / 2), padding);
    heading = new GameTextView(context, HEADING_SP);
    heading.setText(R.string.message_log_heading);
    addView(heading);
    text = new GameTextView(context, MESSAGE_SP);
    scroll = new ScrollView(context);
    scroll.setFocusable(false);
    scroll.setVerticalScrollBarEnabled(false);
    scroll.addView(text);
    scroll.setOnScrollChangeListener((view, x, y, oldX, oldY) -> {
      if (!updating) followLatest = atBottom();
    });
    LayoutParams body = new LayoutParams(LayoutParams.MATCH_PARENT, 0, 1);
    body.topMargin = padding;
    addView(scroll, body);
  }

  public void applyTheme(CompanionTheme theme) {
    heading.applyTheme(theme);
    text.applyTheme(theme);
  }

  public void onTap(Runnable action) { text.setOnClickListener(view -> action.run()); }

  public void render(List<String> rows) {
    if (rendered.equals(rows)) return;
    rendered = rows;
    if (empty(rows)) followLatest = true;
    if (!updating) text.getViewTreeObserver().addOnPreDrawListener(followOnDraw);
    updating = true;
    text.setText(android.text.TextUtils.join("\n", rows));
  }

  private boolean finishUpdate() {
    text.getViewTreeObserver().removeOnPreDrawListener(followOnDraw);
    if (followLatest) scroll.scrollTo(0, Math.max(0, text.getHeight() - scroll.getHeight()));
    updating = false;
    return true;
  }

  @Override protected void onDetachedFromWindow() {
    text.getViewTreeObserver().removeOnPreDrawListener(followOnDraw);
    updating = false;
    super.onDetachedFromWindow();
  }

  private boolean atBottom() {
    return scroll.getScrollY() + scroll.getHeight() >= text.getHeight() - dp(1);
  }

  private boolean empty(List<String> rows) {
    for (String row : rows) if (!row.trim().isEmpty()) return false;
    return true;
  }

  private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
