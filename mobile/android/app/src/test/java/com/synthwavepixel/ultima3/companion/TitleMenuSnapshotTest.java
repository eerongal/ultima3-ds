package com.synthwavepixel.ultima3.companion;

import static org.junit.Assert.*;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.junit.Test;

public class TitleMenuSnapshotTest {
  private JSONObject menu() throws JSONException {
    return new JSONObject().put("id", 3).put("title", "Options").put("cursor", 1)
        .put("items", new JSONArray().put(item("Journey onward", false)).put(item("Settings", true)));
  }

  private JSONObject item(String label, boolean disabled) throws JSONException {
    return new JSONObject().put("label", label).put("disabled", disabled);
  }

  @Test public void copiesChoicesAndSelectionWithoutKeepingMutableJson() throws JSONException {
    JSONObject data = menu();
    TitleMenuSnapshot parsed = new TitleMenuSnapshot(data);
    data.getJSONArray("items").getJSONObject(0).put("label", "Changed");
    assertEquals(3, parsed.id);
    assertEquals(1, parsed.cursor);
    assertEquals("Journey onward", parsed.items.get(0).label);
    assertTrue(parsed.items.get(1).disabled);
    assertThrows(UnsupportedOperationException.class, () -> parsed.items.clear());
  }

  @Test public void rejectsInvalidSessionsAndSelections() throws JSONException {
    assertThrows(JSONException.class, () -> new TitleMenuSnapshot(menu().put("id", 0)));
    assertThrows(JSONException.class, () -> new TitleMenuSnapshot(menu().put("cursor", -1)));
    assertThrows(JSONException.class, () -> new TitleMenuSnapshot(menu().put("cursor", 2)));
    assertThrows(JSONException.class, () -> new TitleMenuSnapshot(menu().put("items", new JSONArray())));
    JSONArray many = new JSONArray();
    for (int index = 0; index < 9; index++) many.put(item("Choice", false));
    assertThrows(JSONException.class, () -> new TitleMenuSnapshot(menu().put("items", many)));
  }

  @Test public void rejectsMalformedLabels() throws JSONException {
    assertThrows(JSONException.class, () -> new TitleMenuSnapshot(menu().put("items", new JSONArray().put(item("", false)))));
    assertThrows(JSONException.class, () -> new TitleMenuSnapshot(menu().put("items", new JSONArray().put(item("x".repeat(81), false)))));
  }
}
