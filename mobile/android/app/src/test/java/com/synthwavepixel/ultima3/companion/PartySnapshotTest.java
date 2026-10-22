package com.synthwavepixel.ultima3.companion;

import static org.junit.Assert.*;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.junit.Test;

public class PartySnapshotTest {
  @Test public void copiesTheMessageLogAndSupportsEarlierSchemaTwoClients() throws JSONException {
    JSONArray rows = new JSONArray().put("South (x3)").put("").put(" Who?");
    PartySnapshot parsed = PartySnapshot.parse(snapshot().put("log", rows));
    rows.put(0, "Changed");
    assertEquals("South (x3)", parsed.log.get(0));
    assertEquals("", parsed.log.get(1));
    assertEquals(" Who?", parsed.log.get(2));
    assertThrows(UnsupportedOperationException.class, () -> parsed.log.add("Changed"));
    assertTrue(PartySnapshot.parse(snapshot()).log.isEmpty());
  }

  @Test public void rejectsUnboundedOrMalformedMessageRows() throws JSONException {
    JSONArray tooMany = new JSONArray();
    for (int row = 0; row < 12; row++) tooMany.put("line");
    assertThrows(JSONException.class, () -> PartySnapshot.parse(snapshot().put("log", tooMany)));
    assertThrows(JSONException.class, () -> PartySnapshot.parse(snapshot().put("log", new JSONArray().put("12345678901234567"))));
    assertThrows(JSONException.class, () -> PartySnapshot.parse(snapshot().put("log", new JSONArray().put("two\nrows"))));
    assertThrows(JSONException.class, () -> PartySnapshot.parse(snapshot().put("log", JSONObject.NULL)));
  }
  private JSONObject member(int position) throws JSONException {
    return new JSONObject().put("position", position).put("name", "Test member").put("className", "Cleric")
        .put("hp", 7).put("maxHp", 100).put("mana", 0).put("status", "P").put("levelDue", false)
        .put("selected", true).put("active", false).put("flashing", true);
  }

  private JSONObject snapshot(JSONObject... members) throws JSONException {
    JSONArray list = new JSONArray();
    for (JSONObject member : members) list.put(member);
    return new JSONObject().put("version", PartySnapshot.VERSION).put("playing", true).put("paused", false)
        .put("gold", 600).put("food", 599).put("members", list).put("hint", JSONObject.NULL);
  }

  @Test
  public void preservesEmptyPositionsAndZeroMana() throws JSONException {
    PartySnapshot data = PartySnapshot.parse(snapshot(member(1), member(3)));
    assertNull(data.member(0));
    assertNull(data.member(2));
    assertEquals(Integer.valueOf(0), data.member(1).mana);
    assertEquals(PartySnapshot.Condition.POISONED, data.member(1).condition);
    assertTrue(data.member(1).selected);
    assertTrue(data.member(1).flashing);
    assertEquals(600, data.gold);
  }

  @Test
  public void distinguishesNonCasterFromCasterWithNoMana() throws JSONException {
    PartySnapshot data = PartySnapshot.parse(snapshot(member(0).put("mana", JSONObject.NULL), member(1)));
    assertNull(data.member(0).mana);
    assertEquals(Integer.valueOf(0), data.member(1).mana);
  }

  @Test
  public void copiesValuesInsteadOfRetainingMutableJson() throws JSONException {
    JSONObject source = member(0);
    PartySnapshot data = PartySnapshot.parse(snapshot(source));
    source.put("hp", 99).put("name", "Changed");
    assertEquals(7, data.member(0).hp);
    assertEquals("Test member", data.member(0).name);
  }

  @Test
  public void representsAnEmptyPartyAndAllConditions() throws JSONException {
    assertNull(PartySnapshot.parse(snapshot()).member(0));
    PartySnapshot data = PartySnapshot.parse(snapshot(member(0).put("status", "G"), member(1).put("status", "D"),
        member(2).put("status", "A")));
    assertEquals(PartySnapshot.Condition.GOOD, data.member(0).condition);
    assertEquals(PartySnapshot.Condition.DEAD, data.member(1).condition);
    assertEquals(PartySnapshot.Condition.ASHES, data.member(2).condition);
  }

  @Test
  public void rejectsUnknownVersionAndMissingData() throws JSONException {
    assertThrows(JSONException.class, () -> PartySnapshot.parse(snapshot().put("version", PartySnapshot.VERSION + 1)));
    assertThrows(JSONException.class, () -> PartySnapshot.parse(null));
  }

  @Test
  public void rejectsDuplicateOrOutOfBoundsPositions() throws JSONException {
    assertThrows(JSONException.class, () -> PartySnapshot.parse(snapshot(member(0), member(0))));
    assertThrows(JSONException.class, () -> PartySnapshot.parse(snapshot(member(-1))));
    assertThrows(JSONException.class, () -> PartySnapshot.parse(snapshot(member(PartySnapshot.CAPACITY))));
  }

  @Test
  public void rejectsInvalidConditionsAndNegativeVitals() throws JSONException {
    assertThrows(JSONException.class, () -> PartySnapshot.parse(snapshot(member(0).put("status", "unknown"))));
    assertThrows(JSONException.class, () -> PartySnapshot.parse(snapshot(member(0).put("hp", -1))));
    assertThrows(JSONException.class, () -> PartySnapshot.parse(snapshot(member(0).put("mana", -1))));
    assertThrows(JSONException.class, () -> PartySnapshot.parse(snapshot().put("food", -1)));
  }

  private JSONObject hint() throws JSONException {
    return new JSONObject().put("id", "quest:king").put("title", "Lord British")
        .put("progress", "He awaits.").put("text", "Walk into him.");
  }

  @Test
  public void copiesPinnedHintAndAcceptsUnpinnedState() throws JSONException {
    assertNull(PartySnapshot.parse(snapshot()).hint);
    JSONObject source = hint();
    PartySnapshot data = PartySnapshot.parse(snapshot().put("hint", source));
    source.put("title", "Changed").put("text", "Changed");
    assertEquals("quest:king", data.hint.id);
    assertEquals("Lord British", data.hint.title);
    assertEquals("He awaits.", data.hint.progress);
    assertEquals("Walk into him.", data.hint.text);
  }

  @Test
  public void rejectsIncompleteHintAndPreviousSchema() throws JSONException {
    JSONObject noHint = snapshot();
    noHint.remove("hint");
    assertThrows(JSONException.class, () -> PartySnapshot.parse(noHint));
    assertThrows(JSONException.class, () -> PartySnapshot.parse(snapshot().put("version", 1)));
    assertThrows(JSONException.class, () -> PartySnapshot.parse(snapshot().put("hint", hint().put("id", ""))));
    assertThrows(JSONException.class, () -> PartySnapshot.parse(snapshot().put("hint", hint().put("text", JSONObject.NULL))));
    JSONObject noProgress = hint();
    noProgress.remove("progress");
    assertThrows(JSONException.class, () -> PartySnapshot.parse(snapshot().put("hint", noProgress)));
  }

  @Test
  public void copiesOptionalContextDetailAndAcceptsEarlierVersionTwoMembers() throws JSONException {
    assertEquals("", PartySnapshot.parse(snapshot(member(0))).member(0).detail);
    JSONObject source = member(0).put("detail", "XP 245/300");
    PartySnapshot data = PartySnapshot.parse(snapshot(source));
    source.put("detail", "Changed");
    assertEquals("XP 245/300", data.member(0).detail);
    assertThrows(JSONException.class, () -> PartySnapshot.parse(snapshot(member(0).put("detail", JSONObject.NULL))));
  }
}
