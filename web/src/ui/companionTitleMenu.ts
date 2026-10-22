import type { MenuOption } from '../game/io.ts';
import type { MenuWindow } from './menus.ts';

export interface CompanionMenuSelection {
  id: number;
  index: number;
}

export interface CompanionMenu {
  id: number;
  title: string;
  cursor: number;
  items: { label: string; disabled: boolean }[];
}

/** The game owns the menu; the companion can only select an item from its current session. */
export class CompanionTitleMenu {
  private revision = 0;
  private current: { id: number; window: MenuWindow; options: MenuOption[]; selected: boolean } | null = null;

  get open(): boolean {
    return this.current !== null;
  }

  begin(window: MenuWindow, options: MenuOption[]): void {
    this.current = { id: ++this.revision, window, options, selected: false };
  }

  close(): void {
    this.current = null;
  }

  snapshot(): CompanionMenu | null {
    const current = this.current;
    if (!current) return null;
    return {
      id: current.id,
      title: current.window.title,
      cursor: current.window.cursor,
      items: current.options.map((option) => ({ label: option.label, disabled: current.selected || !!option.disabled })),
    };
  }

  select(selection: CompanionMenuSelection): boolean {
    const current = this.current;
    if (!current || current.selected || selection.id !== current.id || !Number.isInteger(selection.index)) return false;
    const option = current.options[selection.index];
    if (!option || option.disabled) return false;
    current.selected = true;
    current.window.cursor = selection.index;
    return true;
  }
}
