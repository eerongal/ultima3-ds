package com.synthwavepixel.ultima3.companion;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.drawable.Drawable;

/** Repeat the primary UI's corner/edge pieces; bitmap filtering stays off for crisp pixels. */
public final class GameFrame extends Drawable {
  private enum Piece {
    TOP_LEFT(0), TOP_TEE(1), TOP_RIGHT(2), LEFT_TEE(3), RIGHT_TEE(5), BOTTOM_LEFT(6), BOTTOM_TEE(7), BOTTOM_RIGHT(8), HORIZONTAL(9), VERTICAL(10);
    final int column;
    Piece(int column) { this.column = column; }
  }
  private final CompanionTheme theme;
  private final int cell;
  private final Paint paint = new Paint();

  public GameFrame(CompanionTheme theme, int cell) {
    this.theme = theme;
    this.cell = cell;
  }

  @Override public void draw(Canvas canvas) {
    Rect bounds = getBounds();
    paint.setColor(Color.BLACK);
    canvas.drawRect(bounds, paint);
    if (theme == null) return;
    piece(canvas, Piece.TOP_LEFT, bounds.left, bounds.top, cell, cell);
    piece(canvas, Piece.TOP_RIGHT, bounds.right - cell, bounds.top, cell, cell);
    piece(canvas, Piece.BOTTOM_LEFT, bounds.left, bounds.bottom - cell, cell, cell);
    piece(canvas, Piece.BOTTOM_RIGHT, bounds.right - cell, bounds.bottom - cell, cell, cell);
    for (int x = bounds.left + cell; x < bounds.right - cell; x += cell) horizontal(canvas, x, bounds);
    for (int y = bounds.top + cell; y < bounds.bottom - cell; y += cell) vertical(canvas, y, bounds);
  }

  private void horizontal(Canvas canvas, int x, Rect bounds) {
    int width = Math.min(cell, bounds.right - cell - x);
    piece(canvas, Piece.HORIZONTAL, x, bounds.top, width, cell);
    piece(canvas, Piece.HORIZONTAL, x, bounds.bottom - cell, width, cell);
  }

  private void vertical(Canvas canvas, int y, Rect bounds) {
    int height = Math.min(cell, bounds.bottom - cell - y);
    piece(canvas, Piece.VERTICAL, bounds.left, y, cell, height);
    piece(canvas, Piece.VERTICAL, bounds.right - cell, y, cell, height);
  }

  public void drawDivider(Canvas canvas) {
    Rect bounds = getBounds();
    int x = bounds.centerX() - cell / 2;
    for (int y = bounds.top + cell; y < bounds.bottom - cell; y += cell) {
      piece(canvas, Piece.VERTICAL, x, y, cell, Math.min(cell, bounds.bottom - cell - y));
    }
    piece(canvas, Piece.TOP_TEE, x, bounds.top, cell, cell);
    piece(canvas, Piece.BOTTOM_TEE, x, bounds.bottom - cell, cell, cell);
  }

  public void drawPartyRule(Canvas canvas, int top) {
    Rect bounds = getBounds();
    int right = bounds.centerX() - cell / 2;
    for (int x = bounds.left + cell; x < right; x += cell) {
      piece(canvas, Piece.HORIZONTAL, x, top, Math.min(cell, right - x), cell);
    }
    piece(canvas, Piece.LEFT_TEE, bounds.left, top, cell, cell);
    piece(canvas, Piece.RIGHT_TEE, right, top, cell, cell);
  }

  private void piece(Canvas canvas, Piece piece, int x, int y, int width, int height) {
    int size = theme.frame.getWidth() / CompanionTheme.UI_COLUMNS;
    Rect source = new Rect(piece.column * size, 0, (piece.column + 1) * size, size);
    canvas.drawBitmap(theme.frame, source, new RectF(x, y, x + width, y + height), paint);
  }

  @Override public void setAlpha(int alpha) { paint.setAlpha(alpha); }
  @Override public void setColorFilter(ColorFilter filter) { paint.setColorFilter(filter); }
  @Override public int getOpacity() { return PixelFormat.OPAQUE; }
}
