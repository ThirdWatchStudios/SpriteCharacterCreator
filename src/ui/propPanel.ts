import type { PropPaletteToken } from '../core/types';
import { composeProp } from '../core/compositor';
import { downloadBlob, downloadJson, propAtlas, propPng } from '../core/exporter';
import { PROP_TEMPLATES } from '../props/templates';
import { store } from '../state';
import { button, clear, colorInput, el, labeled, select, slider } from './dom';
import { setPreviewSvg } from './renderPreview';

const PALETTE_LABELS: Record<PropPaletteToken, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  accent: 'Accent',
};

function defaultParams(templateId: string): Record<string, number> {
  const template = PROP_TEMPLATES.find((t) => t.id === templateId)!;
  return Object.fromEntries(template.params.map((p) => [p.key, p.default]));
}

export function renderPropList(container: HTMLElement): void {
  clear(container);
  const list = el('div', { className: 'entity-list' });
  for (const prop of store.state.props) {
    const selected = prop.id === store.ui.selectedPropId;
    const thumb = el('span', { className: 'thumb checker' });
    thumb.innerHTML = composeProp(prop, store.state.style, 40);
    list.append(
      el(
        'button',
        {
          className: `entity-item ${selected ? 'selected' : ''}`,
          onClick: () => store.mutateUi((ui) => (ui.selectedPropId = prop.id)),
        },
        thumb,
        el('span', { className: 'entity-name' }, prop.name),
      ),
    );
  }

  const templateSelect = select(
    PROP_TEMPLATES.map((t) => ({ value: t.id, label: t.label })),
    PROP_TEMPLATES[0].id,
    () => {},
  );
  container.append(
    list,
    el(
      'div',
      { className: 'list-actions' },
      templateSelect,
      button('+ Add prop', () => {
        const templateId = templateSelect.value;
        const template = PROP_TEMPLATES.find((t) => t.id === templateId)!;
        const prop = {
          id: `prop-${Date.now().toString(36)}`,
          name: template.label,
          templateId,
          params: defaultParams(templateId),
          palette: { primary: '#5F5E5A', secondary: '#B4B2A9', accent: '#378ADD' },
        };
        store.mutate((s) => s.props.push(prop), 'data');
        store.mutateUi((ui) => (ui.selectedPropId = prop.id));
      }, 'primary'),
    ),
  );
}

export function renderPropPreview(container: HTMLElement): void {
  clear(container);
  const prop = store.selectedProp;
  if (!prop) {
    container.append(el('p', { className: 'hint' }, 'Select or add a prop.'));
    return;
  }
  const hero = el('div', {
    className: `preview-hero checker${store.state.style.render.pixelScale > 1 ? ' pixelated-preview' : ''}`,
  });
  setPreviewSvg(hero, composeProp(prop, store.state.style, 224), store.state.style, 224);
  container.append(hero);
}

export function renderPropControls(container: HTMLElement): void {
  clear(container);
  const prop = store.selectedProp;
  if (!prop) return;
  const template = PROP_TEMPLATES.find((t) => t.id === prop.templateId);
  if (!template) return;

  container.append(
    labeled(
      'Name',
      el('input', {
        type: 'text',
        value: prop.name,
        onInput: (e: Event) => store.mutate(() => (prop.name = (e.target as HTMLInputElement).value), 'data'),
      }),
    ),
    labeled(
      'Projection',
      el(
        'span',
        { className: `projection-badge ${template.projection}` },
        template.projection === 'plan' ? 'Plan (top-down, rotatable)' : 'Elevation (front, y-sorted)',
      ),
    ),
    labeled(
      'Placement',
      el(
        'span',
        { className: `projection-badge ${template.placement ?? 'floor'}` },
        (template.placement ?? 'floor') === 'wall-slot' ? 'Wall slot' : 'Floor cell',
      ),
    ),
  );

  for (const param of template.params) {
    container.append(
      labeled(
        param.label,
        slider(prop.params[param.key] ?? param.default, param.min, param.max, param.step, (v) =>
          store.mutate(() => (prop.params[param.key] = v), 'data'),
        ),
      ),
    );
  }

  const paletteBox = el('div', { className: 'palette-grid' });
  for (const token of Object.keys(PALETTE_LABELS) as PropPaletteToken[]) {
    paletteBox.append(
      el(
        'span',
        { className: 'palette-cell' },
        colorInput(prop.palette[token], (v) => store.mutate(() => (prop.palette[token] = v), 'data')),
        el('span', { className: 'palette-label' }, PALETTE_LABELS[token]),
      ),
    );
  }
  container.append(labeled('Palette', paletteBox));

  container.append(
    el(
      'div',
      { className: 'btn-row' },
      button('Duplicate', () =>
        store.mutate((s) => {
          const copy = structuredClone(prop);
          copy.id = `prop-${Date.now().toString(36)}`;
          copy.name = `${prop.name} copy`;
          s.props.push(copy);
          store.ui.selectedPropId = copy.id;
        }, 'structure'),
      ),
      button('Delete', () => {
        if (!confirm(`Delete ${prop.name}?`)) return;
        store.mutate((s) => {
          s.props = s.props.filter((p) => p.id !== prop.id);
          store.ui.selectedPropId = s.props[0]?.id ?? '';
        }, 'structure');
      }, 'danger'),
    ),
  );

  const scaleSelect = select(
    [1, 2, 4].map((s) => ({ value: String(s), label: `${s}x (${store.state.style.render.baseSize * s}px)` })),
    String(store.ui.exportScale),
    (v) => (store.ui.exportScale = Number(v)),
  );
  container.append(
    el('h3', {}, 'Export'),
    labeled('Scale', scaleSelect),
    el(
      'div',
      { className: 'btn-row' },
      button('Sprite PNG', async () => {
        const blob = await propPng(prop, store.state.style, store.ui.exportScale);
        downloadBlob(`${prop.name.toLowerCase().replace(/\s+/g, '-')}@${store.ui.exportScale}x.png`, blob);
      }, 'primary'),
      button('Atlas JSON', () =>
        downloadJson(
          `${prop.name.toLowerCase().replace(/\s+/g, '-')}-atlas@${store.ui.exportScale}x.json`,
          propAtlas(prop, store.state.style, store.ui.exportScale),
        ),
      ),
      button('Prop JSON', () => downloadJson(`${prop.name.toLowerCase().replace(/\s+/g, '-')}.json`, prop)),
    ),
  );
}
