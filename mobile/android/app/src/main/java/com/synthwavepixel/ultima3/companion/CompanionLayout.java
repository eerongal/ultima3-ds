package com.synthwavepixel.ultima3.companion;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.widget.LinearLayout;
import android.view.View;
import android.graphics.Rect;

/** Scanlines cover the composed native panel, using the same physical-pixel rule as the game. */
public final class CompanionLayout extends LinearLayout {
  private CompanionTheme theme;
  private final Paint bands = new Paint();
  private static final int FRAME_DP = 8;
  private final int cell;
  private PartyPanel party;
  private GameFrame frame;
  private View messages;
  private boolean gameplay;

  public CompanionLayout(Context context) {
    super(context);
    cell = Math.round(FRAME_DP * getResources().getDisplayMetrics().density);
    setPadding(cell, cell, cell, cell);
    setBackgroundColor(android.graphics.Color.BLACK);
  }

  public void setPartyPanel(PartyPanel value, View messages) {
    party = value;
    this.messages = messages;
  }

  public void setGameplay(boolean value) {
    if (gameplay == value) return;
    gameplay = value;
    invalidate();
  }

  public void applyTheme(CompanionTheme value) {
    theme = value;
    frame = new GameFrame(value, cell);
    setBackground(frame);
    bands.setARGB(Math.round(255 * (1 - value.spec.scanlineLevel)), 0, 0, 0);
    invalidate();
  }

  @Override protected void dispatchDraw(Canvas canvas) {
    super.dispatchDraw(canvas);
    drawSharedBorders(canvas);
    if (theme == null || !theme.spec.scanlines) return;
    int pitch = Math.round((float) getHeight() / theme.spec.screenLines);
    if (pitch < 2) return;
    int dark = pitch / 2;
    for (int top = pitch - dark; top < getHeight(); top += pitch) {
      canvas.drawRect(0, top, getWidth(), Math.min(top + dark, getHeight()), bands);
    }
  }

  private void drawSharedBorders(Canvas canvas) {
    if (frame == null || !gameplay) return;
    frame.drawDivider(canvas);
    if (party == null) return;
    canvas.save();
    int logTop = messageTop();
    canvas.clipRect(0, cell, getWidth(), logTop);
    for (int top : party.ruleTops(this)) frame.drawPartyRule(canvas, top);
    canvas.restore();
    frame.drawPartyRule(canvas, logTop);
  }

  private int messageTop() {
    Rect rect = new Rect();
    messages.getDrawingRect(rect);
    offsetDescendantRectToMyCoords(messages, rect);
    return rect.top;
  }
}
