package com.synthwavepixel.ultima3.companion;

import android.content.Context;
import android.graphics.Color;
import android.view.Gravity;
import android.widget.LinearLayout;
import com.synthwavepixel.ultima3.R;
import java.util.ArrayList;
import java.util.List;

/** A touchable mirror of the main title choices. Controller focus stays with the WebView. */
public final class TitleMenuPanel extends LinearLayout {
  private static final int PADDING_DP = 20;
  private static final int ROW_PADDING_DP = 8;
  private static final int HEADING_SP = 18;
  private static final int CHOICE_SP = 16;
  private static final int HELP_SP = 12;
  private final TitleMenuSnapshot.SelectionListener selected;
  private final List<GameTextView> textViews = new ArrayList<>();
  private CompanionTheme theme;
  private TitleMenuSnapshot current;
  private int session;

  public TitleMenuPanel(Context context) { this(context, (id, index) -> {}); }

  public TitleMenuPanel(Context context, TitleMenuSnapshot.SelectionListener selected) {
    super(context);
    this.selected = selected;
    setOrientation(VERTICAL);
    setGravity(Gravity.CENTER_VERTICAL);
    setFocusable(false);
    int padding = dp(PADDING_DP);
    setPadding(padding, padding, padding, padding);
    render(null);
  }

  public void render(TitleMenuSnapshot menu) {
    current = menu;
    int nextSession = menu == null ? 0 : menu.id;
    if (session == nextSession && getChildCount() > 0) {
      updateChoices();
      return;
    }
    session = nextSession;
    removeAllViews();
    textViews.clear();
    addText(menu == null ? getContext().getString(R.string.app_name) : menu.title, HEADING_SP);
    if (menu == null) {
      addText(getContext().getString(R.string.title_menu_guidance), HELP_SP);
      return;
    }
    for (int index = 0; index < menu.items.size(); index++) addChoice(index);
    addText(getContext().getString(R.string.title_menu_controls), HELP_SP);
    updateChoices();
  }

  public void applyTheme(CompanionTheme value) {
    theme = value;
    for (GameTextView view : textViews) view.applyTheme(value);
  }

  private void addChoice(int index) {
    GameTextView view = addText(current.items.get(index).label, CHOICE_SP);
    int id = current.id;
    view.setOnClickListener(ignored -> {
      if (current == null || current.id != id || current.items.get(index).disabled) return;
      selected.select(id, index);
    });
  }

  private void updateChoices() {
    if (current == null) return;
    for (int index = 0; index < current.items.size(); index++) updateChoice(index);
  }

  private void updateChoice(int index) {
    TitleMenuSnapshot.Item item = current.items.get(index);
    GameTextView view = textViews.get(index + 1);
    view.setEnabled(!item.disabled);
    view.setTextColor(item.disabled ? Color.GRAY : Color.WHITE);
    view.setText(getContext().getString(R.string.title_menu_choice, current.cursor == index ? ">" : " ", item.label));
    view.setInverted(current.cursor == index);
  }

  private GameTextView addText(String text, int size) {
    GameTextView view = new GameTextView(getContext(), size);
    view.setGravity(Gravity.CENTER);
    view.setPadding(0, dp(ROW_PADDING_DP), 0, dp(ROW_PADDING_DP));
    view.setText(text);
    if (theme != null) view.applyTheme(theme);
    textViews.add(view);
    addView(view, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT));
    return view;
  }

  private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
