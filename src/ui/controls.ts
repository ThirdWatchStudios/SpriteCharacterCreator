/**
 * Higher-level UI widgets shared across panels. `dom.ts` stays the tiny
 * framework-free primitive layer (el/button/select/…); this module holds the
 * composite controls that were previously copy-pasted between panels
 * (tag editors, collapsible sections, palette grids, export-scale selects).
 */
import { store } from '../state';
import { button, colorInput, el, labeled, select, slider } from './dom';

/** Short unique-ish id with a readable prefix. */
export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- form fields ------------------------------------------------------------

/** 0–100 (or any min/max) slider bound to a getter/setter. */
export function num(
  label: string,
  value: number,
  onInput: (v: number) => void,
  min = 0,
  max = 100,
): HTMLElement {
  return labeled(label, slider(value, min, max, 1, onInput));
}

export function textField(label: string, value: string, onInput: (v: string) => void): HTMLElement {
  return labeled(
    label,
    el('input', { type: 'text', value, onInput: (e: Event) => onInput((e.target as HTMLInputElement).value) }),
  );
}

export function textArea(label: string, value: string, onInput: (v: string) => void): HTMLElement {
  return labeled(
    label,
    el('textarea', { rows: 2, value, onInput: (e: Event) => onInput((e.target as HTMLTextAreaElement).value) }),
  );
}

/** Optional integer field — empty clears it (for partial/optional values). */
export function optNum(label: string, value: number | undefined, set: (v: number | undefined) => void): HTMLElement {
  return labeled(
    label,
    el('input', {
      type: 'number',
      value: value === undefined ? '' : String(value),
      onInput: (e: Event) => {
        const raw = (e.target as HTMLInputElement).value;
        set(raw === '' ? undefined : Number(raw));
      },
    }),
  );
}

// --- tag editor -------------------------------------------------------------

/** Removable chips plus an add box backed by a suggestion datalist. */
export function tagEditor(tags: string[], onChange: (next: string[]) => void, suggestions: string[]): HTMLElement {
  const wrap = el('div', { className: 'tag-editor' });
  const chips = el('div', { className: 'tag-chips' });
  for (const tag of tags) {
    chips.append(
      el('span', { className: 'tag-chip' }, tag, button('×', () => onChange(tags.filter((t) => t !== tag)), 'tag-remove')),
    );
  }
  const listId = uid('dl');
  const input = el('input', {
    type: 'text',
    placeholder: '+ add…',
    list: listId,
    onKeydown: (e: Event) => {
      if ((e as KeyboardEvent).key !== 'Enter') return;
      const v = (e.target as HTMLInputElement).value.trim();
      if (v && !tags.includes(v)) onChange([...tags, v]);
    },
  });
  const datalist = el('datalist', { id: listId }, ...suggestions.map((s) => el('option', { value: s })));
  wrap.append(chips, el('div', { className: 'tag-add' }, input, datalist));
  return wrap;
}

// --- collapsible section ----------------------------------------------------

/** Collapsed editor sections, by title (transient; persists across re-renders). */
const collapsedSections = new Set<string>();

/**
 * A titled, collapsible editor section. Click the heading to fold it; the
 * collapsed/expanded state is remembered across re-renders (keyed by title).
 * CSS lives under `.persona-section` / `.section-head` / `.section-body`.
 */
export function collapsibleSection(title: string, ...children: Array<Node | null | undefined>): HTMLElement {
  const body = el('div', { className: 'section-body' }, ...(children.filter(Boolean) as Node[]));
  const sec = el(
    'section',
    { className: `persona-section ${collapsedSections.has(title) ? 'collapsed' : ''}` },
    el(
      'h3',
      {
        className: 'section-head',
        onClick: () => {
          const isCollapsed = sec.classList.toggle('collapsed');
          if (isCollapsed) collapsedSections.add(title);
          else collapsedSections.delete(title);
        },
      },
      title,
    ),
    body,
  );
  return sec;
}

// --- palette grid -----------------------------------------------------------

/** Shared labels for the prop/tile palette tokens. */
export const PROP_PALETTE_LABELS = {
  primary: 'Primary',
  secondary: 'Secondary',
  accent: 'Accent',
} as const;

/**
 * A grid of color swatches for a palette object. `labels` maps each token to a
 * display name; `onChange` receives the token and the new hex value.
 */
export function paletteGrid<T extends string>(
  palette: Record<T, string>,
  labels: Record<T, string>,
  onChange: (token: T, value: string) => void,
): HTMLElement {
  const box = el('div', { className: 'palette-grid' });
  for (const token of Object.keys(labels) as T[]) {
    box.append(
      el(
        'span',
        { className: 'palette-cell' },
        colorInput(palette[token], (v) => onChange(token, v)),
        el('span', { className: 'palette-label' }, labels[token]),
      ),
    );
  }
  return box;
}

// --- export scale -----------------------------------------------------------

/** The shared 1x/2x/4x export-scale select, bound to `store.ui.exportScale`. */
export function exportScaleSelect(): HTMLSelectElement {
  return select(
    [1, 2, 4].map((s) => ({ value: String(s), label: `${s}x (${store.state.style.render.baseSize * s}px)` })),
    String(store.ui.exportScale),
    (v) => (store.ui.exportScale = Number(v)),
  );
}

// --- entity list item -------------------------------------------------------

/** A selectable list row with an optional thumbnail and a name. */
export function listItem(opts: {
  selected: boolean;
  name: string;
  onClick: () => void;
  thumb?: HTMLElement;
  trailing?: Node | null;
}): HTMLButtonElement {
  return el(
    'button',
    { className: `entity-item ${opts.selected ? 'selected' : ''}`, onClick: opts.onClick },
    ...(opts.thumb ? [opts.thumb] : []),
    el('span', { className: 'entity-name' }, opts.name),
    ...(opts.trailing ? [opts.trailing] : []),
  );
}
