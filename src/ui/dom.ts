/** Tiny DOM helpers — enough structure that panels stay readable without a framework. */

type Attrs = Record<string, string | number | boolean | EventListener>;
type Child = Node | string | null | undefined;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'className') {
      node.className = String(value);
    } else if (typeof value === 'boolean') {
      if (value) node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (child == null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

export function labeled(label: string, control: HTMLElement): HTMLElement {
  return el('label', { className: 'field' }, el('span', { className: 'field-label' }, label), control);
}

export function slider(
  value: number,
  min: number,
  max: number,
  step: number,
  onInput: (v: number) => void,
): HTMLElement {
  const readout = el('span', { className: 'slider-value' }, formatNum(value));
  const input = el('input', {
    type: 'range',
    min,
    max,
    step,
    value,
    onInput: (e: Event) => {
      const v = Number((e.target as HTMLInputElement).value);
      readout.textContent = formatNum(v);
      onInput(v);
    },
  });
  return el('span', { className: 'slider-row' }, input, readout);
}

function formatNum(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function colorInput(value: string, onInput: (v: string) => void): HTMLElement {
  return el('input', {
    type: 'color',
    value,
    className: 'color-input',
    onInput: (e: Event) => onInput((e.target as HTMLInputElement).value),
  });
}

export function select(
  options: Array<{ value: string; label: string }>,
  value: string,
  onChange: (v: string) => void,
): HTMLSelectElement {
  const node = el(
    'select',
    { onChange: (e: Event) => onChange((e.target as HTMLSelectElement).value) },
    ...options.map((o) =>
      el('option', o.value === value ? { value: o.value, selected: true } : { value: o.value }, o.label),
    ),
  );
  return node;
}

export function button(label: string, onClick: () => void, className = ''): HTMLButtonElement {
  return el('button', { className: `btn ${className}`.trim(), onClick }, label);
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}
