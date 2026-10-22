package com.synthwavepixel.ultima3.companion;

import android.content.Context;
import android.graphics.Color;
import android.widget.LinearLayout;
import com.synthwavepixel.ultima3.R;

/** A journal hint resolved by the game, with no commands or game state in this view. */
public final class HintPanel extends LinearLayout {
  private static final int TEXT = Color.WHITE;
  private static final int GAP_DP = 10;
  private final GameTextView heading;
  private final GameTextView title;
  private final GameTextView progress;
  private final GameTextView hint;

  public HintPanel(Context context) {
    super(context);
    setOrientation(VERTICAL);
    setFocusable(false);
    int padding = Math.round(GAP_DP * getResources().getDisplayMetrics().density);
    setPadding(padding, padding / 2, padding / 2, padding / 2);
    heading = text(14);
    heading.setText(R.string.hint_heading);
    addView(heading);
    title = text(13);
    addSection(title);
    progress = text(12);
    addSection(progress);
    hint = text(12);
    addSection(hint);
    render(null);
  }

  public void render(PartySnapshot.Hint pinned) {
    setText(title, pinned == null ? getContext().getString(R.string.hint_empty) : pinned.title);
    progress.setVisibility(pinned == null ? GONE : VISIBLE);
    setText(progress, pinned == null ? "" : pinned.progress);
    setText(hint, pinned == null ? getContext().getString(R.string.hint_instructions) : pinned.text);
  }

  public void applyTheme(CompanionTheme theme) {
    heading.applyTheme(theme);
    title.applyTheme(theme);
    progress.applyTheme(theme);
    hint.applyTheme(theme);
  }

  private void setText(GameTextView view, String value) {
    value = GameText.normalize(value);
    if (!value.contentEquals(view.getText())) view.setText(value);
  }

  private GameTextView text(int size) {
    GameTextView view = new GameTextView(getContext(), size);
    view.setTextSize(size);
    view.setTextColor(TEXT);
    view.setFocusable(false);
    return view;
  }

  private void addSection(GameTextView view) {
    LayoutParams layout = new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT);
    layout.topMargin = Math.round(GAP_DP * getResources().getDisplayMetrics().density);
    addView(view, layout);
  }
}
