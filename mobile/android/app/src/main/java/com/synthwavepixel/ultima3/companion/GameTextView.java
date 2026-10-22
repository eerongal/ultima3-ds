package com.synthwavepixel.ultima3.companion;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorMatrixColorFilter;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.RectF;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ReplacementSpan;
import android.text.style.ForegroundColorSpan;
import android.text.style.ScaleXSpan;
import android.util.TypedValue;
import android.widget.TextView;

/** Android still lays out/wraps/accesses the text; each square glyph comes from the game's bitmap sheet. */
public final class GameTextView extends androidx.appcompat.widget.AppCompatTextView {
  private CompanionTheme theme;
  private CharSequence source = "";
  private boolean inverted;
  private static final int DEFAULT_SIZE_SP = 12;
  private static final int LINE_GAP_DP = 3;

  public GameTextView(Context context) { this(context, DEFAULT_SIZE_SP); }

  public GameTextView(Context context, int sizeSp) {
    super(context);
    setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp);
    setTextColor(Color.WHITE);
    setFocusable(false);
    setIncludeFontPadding(false);
    setLineSpacing(LINE_GAP_DP * getResources().getDisplayMetrics().density, 1);
  }

  @Override public void setText(CharSequence text, TextView.BufferType type) {
    source = normalized(text);
    super.setText(theme == null ? source : bitmapText(source), type);
  }

  private CharSequence normalized(CharSequence text) {
    if (text == null) return "";
    if (text instanceof Spanned) return text;
    return GameText.normalize(text.toString());
  }

  public void applyTheme(CompanionTheme value) {
    theme = value;
    setText(source);
  }

  public void setInverted(boolean value) {
    if (inverted == value) return;
    inverted = value;
    setText(source);
  }

  private CharSequence bitmapText(CharSequence text) {
    SpannableStringBuilder result = new SpannableStringBuilder(text);
    for (int start = 0; start < text.length();) {
      int end = wordEnd(text, start);
      addWord(result, start, end);
      start = end;
    }
    return result;
  }

  private int wordEnd(CharSequence text, int start) {
    int width = getWidth() - getPaddingLeft() - getPaddingRight();
    int maxChars = width > 0 ? Math.max(1, width / Math.round(getTextSize())) : Integer.MAX_VALUE;
    return GameText.wordEnd(text, start, maxChars);
  }

  private void addWord(SpannableStringBuilder text, int start, int end) {
    if (text.charAt(start) == '\n') return;
    if (text.charAt(start) == ' ') {
      float scale = Math.round(getTextSize()) / Math.max(1, getPaint().measureText(" "));
      text.setSpan(new ScaleXSpan(scale), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
      return;
    }
    ForegroundColorSpan[] colours = text.getSpans(start, end, ForegroundColorSpan.class);
    int colour = colours.length == 0 ? getCurrentTextColor() : colours[colours.length - 1].getForegroundColor();
    text.setSpan(new Word(text.subSequence(start, end).toString(), colour), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
  }

  @Override protected void onSizeChanged(int width, int height, int oldWidth, int oldHeight) {
    super.onSizeChanged(width, height, oldWidth, oldHeight);
    if (theme != null && width != oldWidth) setText(source);
  }

  private final class Word extends ReplacementSpan {
    private final String characters;
    private final Rect sourceRect = new Rect();
    private final RectF destination = new RectF();
    private final Paint bitmapPaint = new Paint();

    Word(String characters, int colour) {
      this.characters = characters;
      tint(theme.classic() ? Color.WHITE : colour);
    }

    @Override public int getSize(Paint paint, CharSequence text, int start, int end, Paint.FontMetricsInt metrics) {
      int cell = Math.round(paint.getTextSize());
      if (metrics != null) {
        metrics.top = metrics.ascent = -cell;
        metrics.bottom = metrics.descent = 0;
      }
      return cell * characters.length();
    }

    @Override public void draw(Canvas canvas, CharSequence text, int start, int end, float x, int top, int y, int bottom, Paint paint) {
      float cell = Math.round(paint.getTextSize());
      for (int index = 0; index < characters.length(); index++) drawGlyph(canvas, index, x + index * cell, y, cell);
    }

    private void drawGlyph(Canvas canvas, int index, float x, int y, float cell) {
      int code = characters.charAt(index) - ' ';
      if (code < 0 || code >= CompanionTheme.GLYPHS) code = '?' - ' ';
      int width = theme.font.getWidth() / CompanionTheme.GLYPHS;
      sourceRect.set(code * width, 0, (code + 1) * width, theme.font.getHeight());
      destination.set(x, y - cell, x + cell, y);
      canvas.drawBitmap(theme.font, sourceRect, destination, bitmapPaint);
    }

    private void tint(int colour) {
      float sign = inverted ? -1 : 1;
      float offset = inverted ? 255 : 0;
      bitmapPaint.setColorFilter(new ColorMatrixColorFilter(new float[] {
          sign * Color.red(colour) / 255, 0, 0, 0, offset,
          0, sign * Color.green(colour) / 255, 0, 0, offset,
          0, 0, sign * Color.blue(colour) / 255, 0, offset,
          0, 0, 0, 1, 0 }));
    }
  }
}
