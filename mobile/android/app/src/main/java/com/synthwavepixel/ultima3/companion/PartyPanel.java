package com.synthwavepixel.ultima3.companion;

import android.content.Context;
import android.graphics.Color;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.widget.LinearLayout;
import com.synthwavepixel.ultima3.R;
import java.util.ArrayList;
import java.util.List;
import android.text.TextUtils;
import android.view.ViewGroup;
import android.graphics.Rect;

/** Read-only party cards; touching this panel never takes keyboard/gamepad focus. */
public final class PartyPanel extends LinearLayout {
  private static final int TEXT = Color.WHITE;
  private static final int DIM = Color.rgb(176, 176, 176);
  private static final int ASHES = Color.rgb(96, 96, 96);
  private static final int GREEN = Color.rgb(64, 255, 64);
  private static final int RED = Color.rgb(255, 64, 64);
  private static final int GOLD = Color.rgb(255, 224, 64);
  private static final int BLUE = Color.rgb(96, 160, 255);
  private static final int PADDING_DP = 4;
  private static final int FRAME_DP = 8;
  private static final int GAP_DP = 2;
  private static final int NAME_SP = 12;
  private static final float CRITICAL_HP_FRACTION = 0.1f;
  private static final float LOW_HP_FRACTION = 0.25f;

  private final GameTextView heading;
  private final GameTextView supplies;
  private final GameTextView[] cards = new GameTextView[PartySnapshot.CAPACITY];
  private PartySnapshot rendered;

  public PartyPanel(Context context) {
    super(context);
    setOrientation(VERTICAL);
    setFocusable(false);
    heading = text(14);
    heading.setPadding(dp(PADDING_DP), dp(PADDING_DP), dp(PADDING_DP), 0);
    heading.setText(R.string.party_loading);
    addView(heading);
    supplies = text(NAME_SP);
    supplies.setPadding(dp(PADDING_DP), 0, dp(PADDING_DP), dp(PADDING_DP));
    addView(supplies);
    for (int position = 0; position < cards.length; position++) addCard(position);
  }

  public void render(PartySnapshot snapshot) {
    if (snapshot == null || snapshot == rendered) return;
    rendered = snapshot;
    heading.setText(snapshot.paused ? R.string.party_paused : snapshot.playing ? R.string.party_title : R.string.party_menu);
    supplies.setText(label(R.string.party_supplies, snapshot.gold, snapshot.food));
    for (int position = 0; position < cards.length; position++) renderCard(position, snapshot.member(position));
  }

  public void applyTheme(CompanionTheme value) {
    heading.applyTheme(value);
    supplies.applyTheme(value);
    for (GameTextView card : cards) card.applyTheme(value);
    PartySnapshot snapshot = rendered;
    rendered = null;
    if (snapshot != null) render(snapshot);
    else for (int position = 0; position < cards.length; position++) renderCard(position, null);
  }

  private GameTextView text(int size) {
    GameTextView view = new GameTextView(getContext(), size);
    view.setTextColor(TEXT);
    view.setTextSize(size);
    view.setFocusable(false);
    return view;
  }

  private void addCard(int position) {
    GameTextView card = text(NAME_SP);
    int padding = dp(PADDING_DP);
    card.setPadding(padding, dp(FRAME_DP + GAP_DP), padding + dp(FRAME_DP / 2), padding);
    LayoutParams layout = new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT);
    cards[position] = card;
    addView(card, layout);
    renderCard(position, null);
  }

  private void renderCard(int position, PartySnapshot.Member member) {
    GameTextView card = cards[position];
    boolean inverted = member != null && (member.active ^ member.flashing);
    card.setInverted(inverted);
    card.setBackgroundColor(inverted ? Color.WHITE : Color.BLACK);
    if (member == null) {
      card.setText(label(R.string.party_empty_slot, position + 1));
      card.setTextColor(DIM);
      return;
    }
    SpannableStringBuilder content = new SpannableStringBuilder();
    String name = label(R.string.party_member_name, position + 1, member.name, member.className);
    append(content, member.selected ? "> " + name : name, conditionColour(member));
    append(content, conditionLabel(member.condition) + "\n", conditionColour(member));
    appendVitals(content, member);
    append(content, badges(member), conditionColour(member));
    if (content.charAt(content.length() - 1) == '\n') content.delete(content.length() - 1, content.length());
    card.setText(content);
  }

  public int[] ruleTops(ViewGroup ancestor) {
    int[] tops = new int[cards.length];
    for (int index = 0; index < cards.length; index++) tops[index] = ruleTop(ancestor, cards[index]);
    return tops;
  }

  private int ruleTop(ViewGroup ancestor, GameTextView card) {
    Rect rect = new Rect();
    card.getDrawingRect(rect);
    ancestor.offsetDescendantRectToMyCoords(card, rect);
    return rect.top;
  }

  private void appendVitals(SpannableStringBuilder content, PartySnapshot.Member member) {
    if (!member.detail.isEmpty()) {
      append(content, member.detail + "\n", conditionColour(member));
      return;
    }
    append(content, label(R.string.party_health, member.hp, member.maxHp), healthColour(member));
    boolean gone = member.condition == PartySnapshot.Condition.DEAD || member.condition == PartySnapshot.Condition.ASHES;
    append(content, label(R.string.party_mana, member.mana == null ? label(R.string.party_no_mana) : member.mana), gone ? conditionColour(member) : TEXT);
  }

  private String badges(PartySnapshot.Member member) {
    List<String> result = new ArrayList<>();
    if (member.levelDue) result.add(label(R.string.party_level_due));
    if (member.selected) result.add(label(R.string.party_selected));
    if (member.active) result.add(label(R.string.party_current_turn));
    return TextUtils.join(" | ", result);
  }

  private String conditionLabel(PartySnapshot.Condition condition) {
    switch (condition) {
      case POISONED: return label(R.string.party_poisoned);
      case DEAD: return label(R.string.party_dead);
      case ASHES: return label(R.string.party_ashes);
      default: return label(R.string.party_good);
    }
  }

  private int conditionColour(PartySnapshot.Member member) {
    switch (member.condition) {
      case POISONED: return GREEN;
      case DEAD: return DIM;
      case ASHES: return ASHES;
      default: return member.levelDue ? BLUE : TEXT;
    }
  }

  private int healthColour(PartySnapshot.Member member) {
    if (member.condition == PartySnapshot.Condition.DEAD || member.condition == PartySnapshot.Condition.ASHES) return conditionColour(member);
    if (member.hp < member.maxHp * CRITICAL_HP_FRACTION) return RED;
    if (member.hp < member.maxHp * LOW_HP_FRACTION) return GOLD;
    return TEXT;
  }

  private void append(SpannableStringBuilder builder, String value, int colour) {
    if (value.isEmpty()) return;
    int start = builder.length();
    builder.append(GameText.normalize(value));
    builder.setSpan(new ForegroundColorSpan(colour), start, builder.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
  }

  private int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }

  private String label(int resource, Object... args) {
    return getContext().getString(resource, args);
  }
}
