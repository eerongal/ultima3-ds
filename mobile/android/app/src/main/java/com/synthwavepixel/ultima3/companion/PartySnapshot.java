package com.synthwavepixel.ultima3.companion;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.List;
import java.util.ArrayList;
import java.util.Collections;

/** Immutable, versioned display data. It contains neither game commands nor save records. */
public final class PartySnapshot {
  public static final int VERSION = 2;
  public static final int CAPACITY = 4;

  public enum Condition {
    GOOD, POISONED, DEAD, ASHES;

    static Condition parse(String code) throws JSONException {
      switch (code) {
        case "G": return GOOD;
        case "P": return POISONED;
        case "D": return DEAD;
        case "A": return ASHES;
        default: throw new JSONException("Unknown party condition: " + code);
      }
    }
  }

  public static final class Member {
    public final int position;
    public final String name;
    public final String className;
    public final int hp;
    public final int maxHp;
    public final Integer mana;
    public final Condition condition;
    public final boolean levelDue;
    public final boolean selected;
    public final boolean active;
    public final boolean flashing;
    public final String detail;

    private Member(JSONObject data) throws JSONException {
      position = data.getInt("position");
      if (position < 0 || position >= CAPACITY) throw new JSONException("Invalid party position");
      name = data.getString("name");
      className = data.getString("className");
      hp = nonnegative(data, "hp");
      maxHp = nonnegative(data, "maxHp");
      if (!data.has("mana")) throw new JSONException("Missing mana");
      mana = data.isNull("mana") ? null : nonnegative(data, "mana");
      condition = Condition.parse(data.getString("status"));
      levelDue = data.getBoolean("levelDue");
      selected = data.getBoolean("selected");
      active = data.getBoolean("active");
      flashing = data.getBoolean("flashing");
      detail = data.has("detail") ? data.getString("detail") : "";
    }
  }

  public static final class Hint {
    public final String id;
    public final String title;
    public final String progress;
    public final String text;

    private Hint(JSONObject data) throws JSONException {
      id = data.getString("id");
      title = data.getString("title");
      progress = data.getString("progress");
      text = data.getString("text");
      if (id.isEmpty() || title.isEmpty() || text.isEmpty()) throw new JSONException("Incomplete pinned hint");
    }
  }

  public final boolean playing;
  public final boolean paused;
  public final int gold;
  public final int food;
  public final Hint hint;
  public final List<String> log;
  private static final int LOG_ROWS = 11;
  private static final int LOG_COLUMNS = 16;
  private final Member[] members = new Member[CAPACITY];

  private PartySnapshot(JSONObject data) throws JSONException {
    if (data.getInt("version") != VERSION) throw new JSONException("Unsupported party snapshot version");
    playing = data.getBoolean("playing");
    paused = data.getBoolean("paused");
    gold = nonnegative(data, "gold");
    food = nonnegative(data, "food");
    if (!data.has("hint")) throw new JSONException("Missing pinned hint field");
    hint = data.isNull("hint") ? null : new Hint(data.getJSONObject("hint"));
    log = readLog(data);
    JSONArray list = data.getJSONArray("members");
    if (list.length() > CAPACITY) throw new JSONException("Too many party members");
    for (int index = 0; index < list.length(); index++) {
      Member member = new Member(list.getJSONObject(index));
      if (members[member.position] != null) throw new JSONException("Duplicate party position");
      members[member.position] = member;
    }
  }

  public static PartySnapshot parse(JSONObject data) throws JSONException {
    if (data == null) throw new JSONException("Missing party snapshot");
    return new PartySnapshot(data);
  }

  public Member member(int position) {
    return members[position];
  }

  private static List<String> readLog(JSONObject data) throws JSONException {
    if (!data.has("log")) return Collections.emptyList();
    JSONArray rows = data.getJSONArray("log");
    if (rows.length() > LOG_ROWS) throw new JSONException("Too many message rows");
    List<String> result = new ArrayList<>();
    for (int index = 0; index < rows.length(); index++) {
      String line = rows.getString(index);
      if (line.length() > LOG_COLUMNS || line.indexOf('\n') >= 0) throw new JSONException("Invalid message row");
      result.add(line);
    }
    return Collections.unmodifiableList(result);
  }

  private static int nonnegative(JSONObject data, String field) throws JSONException {
    int value = data.getInt(field);
    if (value < 0) throw new JSONException("Negative party field: " + field);
    return value;
  }
}
