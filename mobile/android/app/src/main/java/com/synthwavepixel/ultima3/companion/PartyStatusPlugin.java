package com.synthwavepixel.ultima3.companion;

import android.app.Activity;
import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;

/** Companion display data, availability and session-scoped title-menu selections. */
@CapacitorPlugin(name = "PartyStatus")
public class PartyStatusPlugin extends Plugin {
  private static final String TAG = "U3PartyStatus";

  public interface Host {
    void acceptPartyStatus(PartySnapshot snapshot);
    void acceptCompanionTheme(CompanionTheme theme);
    boolean isCompanionAvailable();
  }

  @PluginMethod
  public void availability(PluginCall call) {
    getActivity().runOnUiThread(() -> {
      Activity activity = getActivity();
      boolean available = activity instanceof Host && ((Host) activity).isCompanionAvailable();
      call.resolve(new JSObject().put("available", available));
    });
  }

  public void availabilityChanged(boolean available) {
    notifyListeners("availabilityChanged", new JSObject().put("available", available));
  }

  public void menuSelected(int id, int index) {
    Log.i(TAG, "Title menu selection; session=" + id + "; item=" + index);
    notifyListeners("menuSelected", new JSObject().put("id", id).put("index", index));
  }

  @PluginMethod
  public void theme(PluginCall call) {
    try {
      CompanionTheme theme = new CompanionTheme(new ThemeSpec(call.getObject("theme")));
      getActivity().runOnUiThread(() -> deliverTheme(call, theme));
    } catch (JSONException | IllegalArgumentException error) {
      Log.w(TAG, "Rejected invalid companion theme", error);
      call.reject("Invalid companion theme", error);
    }
  }

  private void deliverTheme(PluginCall call, CompanionTheme theme) {
    Activity activity = getActivity();
    if (!(activity instanceof Host)) {
      Log.e(TAG, "Activity cannot receive companion theme");
      call.reject("Party display is unavailable");
      return;
    }
    ((Host) activity).acceptCompanionTheme(theme);
    Log.i(TAG, "Companion theme=" + theme.spec.name + "; scanlines=" + theme.spec.scanlines);
    call.resolve();
  }

  @PluginMethod
  public void publish(PluginCall call) {
    try {
      PartySnapshot snapshot = PartySnapshot.parse(call.getObject("snapshot"));
      getActivity().runOnUiThread(() -> deliver(call, snapshot));
    } catch (JSONException error) {
      Log.w(TAG, "Rejected invalid party snapshot", error);
      call.reject("Invalid party snapshot", error);
    }
  }

  private void deliver(PluginCall call, PartySnapshot snapshot) {
    Activity activity = getActivity();
    if (!(activity instanceof Host)) {
      Log.e(TAG, "Activity cannot receive party status");
      call.reject("Party display is unavailable");
      return;
    }
    ((Host) activity).acceptPartyStatus(snapshot);
    call.resolve();
  }
}
