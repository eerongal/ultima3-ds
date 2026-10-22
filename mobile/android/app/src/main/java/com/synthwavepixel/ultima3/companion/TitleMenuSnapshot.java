package com.synthwavepixel.ultima3.companion;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Display choices only; the WebView validates every selection against its current menu session. */
public final class TitleMenuSnapshot {
  public interface SelectionListener { void select(int id, int index); }
  private static final int MAX_ITEMS = 8;
  private static final int MAX_LABEL = 80;
  public final int id;
  public final String title;
  public final int cursor;
  public final List<Item> items;

  public static final class Item {
    public final String label;
    public final boolean disabled;

    private Item(JSONObject data) throws JSONException {
      label = data.getString("label");
      disabled = data.getBoolean("disabled");
      if (label.isEmpty() || label.length() > MAX_LABEL) throw new JSONException("Invalid title menu label");
    }
  }

  public TitleMenuSnapshot(JSONObject data) throws JSONException {
    id = data.getInt("id");
    title = data.getString("title");
    cursor = data.getInt("cursor");
    JSONArray list = data.getJSONArray("items");
    if (id < 1 || title.length() > MAX_LABEL || list.length() < 1 || list.length() > MAX_ITEMS) {
      throw new JSONException("Invalid title menu");
    }
    if (cursor < 0 || cursor >= list.length()) throw new JSONException("Invalid title menu cursor");
    List<Item> copy = new ArrayList<>();
    for (int index = 0; index < list.length(); index++) copy.add(new Item(list.getJSONObject(index)));
    items = Collections.unmodifiableList(copy);
  }
}
