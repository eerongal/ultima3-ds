# Android dual-screen companion

The Android release and debug builds run the game on one display and a native
companion on another. One WebView owns gameplay, input, audio and saves; the
companion receives display snapshots and can select a current title-menu item.
Gameplay input stays on the main display. The companion uses the selected bitmap
font, frame artwork and scanline settings.

## Current behavior

At the title screen, the companion shows the main menu instead of party details
or a pinned hint. Physical controls and lower-screen touch select the same game
menu. Disabling the companion restores the upper menu without resetting its
selection. Settings, party organization and other title submenus remain on the
upper screen, with guidance below; gameplay restores the party/hint layout.
Menu selections carry a session ID and are rejected when stale, repeated,
disabled, or received outside the waiting title menu.

During gameplay, the companion shows party status and recent messages in the left column, with a
pinned journal hint in the right column. These areas scroll independently.
Character selection, current-turn feedback, conditions and damage feedback are
preserved. The message panel mirrors the existing transient message buffer,
including repeated-action counts; it is not a session archive.

With the companion available, the main display uses its right column for context:

| Context            | Right panel                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Sosaria / Ambrosia | Explored world minimap, with 1×/2×/4× zoom                                                  |
| Town / Castle      | Whole-settlement map; terrain remains discovery-gated, shop/talk markers appear immediately |
| Dungeon            | Explored whole level beside the first-person view                                           |
| Combat             | Now / Up next turn list, with an enemy name and remaining-count footer                      |

The world zoom defaults to 2× and is remembered under **Pause → Visuals →
Minimap zoom**. Towns, castles and dungeons use a fixed whole-area scale. Dungeon maps
retain the existing darkness, discovery, wrapping and subtle secret-door rules.
The saved dungeon-view preference remains available for single-screen fallback.

The settlement panel covers all twelve town/castle maps: Lord British's castle,
Exodus's castle, Britain, Moon, Yew, East and West Montor, Grey, Dawn, Devil
Guard, Fawn and Death Gulch. Sosaria and Ambrosia retain their overworld panels;
Ambrosia's shrines are encounters on that continent, with no separate town map.

The town-style key identifies pubs, food, healing, weapons, armour, guilds, oracles,
horses and townspeople with dialogue. Adjacent markers of the same kind are
grouped; moving people update their markers. Individual NPC names and interactive
location details are deferred. Lord British's audience uses a talk marker at his
exact square even without a normal dialogue index; nearby conversations cannot
displace it. The modal atlas retains its original rules.

Combat retains the engine's fixed party-then-enemies sequence. The turn list
omits dead/empty slots and updates for revival and time negation, including the
existing Exodus exception. Enemy actions have their own phase so the last party
member is not mistaken for the current actor. Zero enemies shows Resolving;
the engine still decides when the fight ends. Hidden enemy statistics are not
exposed.

The main display keeps the latest output block plus its command line visible:
a one-line result (including movement) uses two rows; longer output expands up
to six rows below the context panel. Dialogue and dungeon writing remain there
at the next command wait without requiring a question or confirmation. This is
the latest turn's output, with no heuristic importance filter or timed dismissal;
the lower Messages panel retains the full eleven-row buffer.

Active questions and text input also expand the upper text area. Longer output
and questions temporarily replace the town key; a subsequent one-line result
restores it. Context cards cover and restore the adjacent panel. When
the companion becomes unavailable, the original upper character boxes and full
message window return, including unfinished input. Repainting waits behind
overlapping menus.

Open Journal, highlight an entry, then press **X on the controller** or **P on a
keyboard** to pin its hint. Repeat on the same entry to unpin. Only the stable
entry ID is stored locally, separately from exported saves; current journal
progress determines the displayed hint. Invalid pins clear with a warning.

## Device compatibility

The display path uses Android's
[DisplayManager presentation category](https://developer.android.com/reference/android/hardware/display/DisplayManager#DISPLAY_CATEGORY_PRESENTATION)
and [Presentation windows](https://developer.android.com/reference/android/app/Presentation).
It is not gated on a device-brand allowlist and does not hard-code display IDs
or pixel resolutions. It excludes the game display, keeps its current eligible
companion display when possible, and otherwise uses Android's first eligible
candidate. The presentation uses its own display context/density and does not
take keyboard focus.

Other devices can work if their firmware exposes a separate, accessible,
presentation-capable display and allows a window there. Two physical screens
alone are not sufficient: firmware may expose one combined display, omit the
presentation flag, restrict windows, or implement screen toggles differently.
Other devices remain unverified; layout, touch/controller focus, sleep/lid
behavior and performance require hardware checks.

The only device-specific behavior is the AYN Thor screen-mode workaround.
That firmware can report the lower display ON after its shortcut selects
top-only mode. On verified AYN Thor hardware only, the app also observes
`Settings.System.dual_screen_display_mode`. Other models use ordinary Android
display/window availability. Similar vendor behavior elsewhere may need another
narrowly scoped policy.

Launch the main activity on the intended gameplay screen. There is no screen
picker or automatic upper/lower role assignment. A desktop-style external
presentation display can also qualify. No eligible display leaves the ordinary
game layout available.

## Build and install

Dual-screen support is enabled in **release and debug builds**. The release
app retains package `com.synthwavepixel.ultima3` and its existing saves. The
debug app remains **Ultima III DS PoC**, package
`com.synthwavepixel.ultima3.dualscreenpoc`, with separate storage. Saves and
settings are not copied between the apps automatically. The native
`dual_screen_companion` resource enables the feature; display availability
automatically selects the companion or ordinary layout. There is no runtime
enable switch.

Use Node 22, JDK 21 and an Android SDK with platform 35 and the build tools
requested by Gradle. Set `JAVA_HOME` and `ANDROID_HOME` appropriately.

```powershell
cd web
npm ci
cd ../mobile
npm ci
npm run bundle
npx cap sync android
npm run apk
adb install -r dist/Ultima-III-<version>-android.apk
adb shell am start -n com.synthwavepixel.ultima3/com.synthwavepixel.ultima3.MainActivity
```

For a separate development install, run `:app:assembleDebug` from
`mobile/android/` and install `app/build/outputs/apk/debug/app-debug.apk`.
Native release checks are `:app:testReleaseUnitTest :app:lintRelease`;
the corresponding Debug tasks verify the development variant.

Local Node 22.15 requires `NODE_OPTIONS=--experimental-strip-types` for the
existing build's direct TypeScript tool. Restricted environments may need a
writable TEMP/TMP directory. Local tooling in `mobile/.tools/`, output in
`mobile/dist/`, generated assets and build caches are ignored by Git. Keep the
same debug signing key when updating the test app to retain its storage.

## Validation and remaining work

As of October 22, 2026, the latest check has 495 passing web tests and 30
passing Android unit tests. The web run excludes `web/tests/steamArt.test.ts`,
which has four pre-existing Windows failures (Unix paths, symlink permissions and permission-mode
expectations). Web type checking/lint/formatting, production bundling, Android
assembly and release resource processing pass. Android lint reports zero errors
and 18 existing warnings. Both variants enable the companion resource.

Physical validation covers the AYN Thor on Android 13. The owner confirmed party,
hint, message, minimap, dungeon and town readability; lower touch/controller
focus; lid close/open; the vendor screen-toggle fallback; and the revised combat
turn panel's readability/usefulness. Controlled paused fixtures checked context
changes, graphics themes, discovery preservation, cards, prompts, damage/status
snapshots, counts and turn phases. Web tests also exercise complete controlled
combat loops with and without time negation. Some ADB captures omit static text
that is visible on the physical device.

The signed release APK was also installed fresh on the Thor under its normal
package without copying PoC data. Release unit tests pass, the APK is
non-debuggable, and both variants package the enabled companion resource.
Release startup delivered theme/status snapshots, lower touch retained WebView
focus, and screen-toggle plus Home/reopen checks restored the companion.

The title-menu release update was checked with lower-screen touch, upper-screen
submenu navigation, key navigation/confirmation after touch, and top-only/dual
switching with the same selection preserved. Captures show the upper title
without its menu and the matching lower menu without party/hint content.

Before claiming support on another handheld, check:

1. Secondary-display discovery and correct screen placement.
2. Controller input after lower touch/scroll, Back and unfinished text entry.
3. Home/resume, lid/sleep, screen disable/enable and companion recreation.
4. Readability and scrolling at that device's actual density and screen size.
5. Ordinary travel, shopping, dungeon navigation, a full battle and save/load.

Backlog: other-device validation, screen-role selection, smaller-screen tuning,
named/selectable settlement locations and richer enemy information.
Release builds retain ordinary single-screen fallback when no companion is available.

For lifecycle, selection, input-focus and fallback diagnostics:

```powershell
adb logcat -v time -s U3DualScreen:I U3PartyStatus:I AndroidRuntime:E
```

The native display lifecycle currently lives under `diagnostics/`; those classes
also own the live companion window and are required at runtime. Bridge/snapshot
and theme code live under `companion/`. Regression tests are under
`mobile/android/app/src/test/` and `web/tests/`.
