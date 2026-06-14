import { downloadBlob, downloadJson, exportAllZip } from '../core/exporter';
import { migrateProject } from '../core/migrations';
import { defaultProject } from '../data/defaults';
import { store } from '../state';
import { button, clear, el } from './dom';
import { renderCharacterControls, renderCharacterList, renderCharacterPreview } from './characterPanel';
import { renderEmployeeControls, renderEmployeeList, renderEmployeePreview } from './employeePanel';
import { renderPropControls, renderPropList, renderPropPreview } from './propPanel';
import { renderSceneControls, renderSceneList, renderScenePreview } from './scenePanel';
import { renderStyleControls, renderStylePreview } from './stylePanel';
import { renderTileControls, renderTileList, renderTilePreview } from './tilePanel';

const TABS = [
  { id: 'characters', label: 'Characters' },
  { id: 'props', label: 'Props' },
  { id: 'tiles', label: 'Walls & Floors' },
  { id: 'scene', label: 'Scene' },
  { id: 'employees', label: 'Employees' },
  { id: 'style', label: 'Style' },
] as const;

export function mountApp(root: HTMLElement): void {
  const tabBar = el('nav', { className: 'tabs' });
  const sidebar = el('aside', { className: 'sidebar' });
  const preview = el('section', { className: 'preview' });
  const controls = el('section', { className: 'controls' });

  const exportAllBtn = button('Export all (zip)', async () => {
    exportAllBtn.disabled = true;
    exportAllBtn.classList.add('busy');
    const setBusy = (text: string) => {
      exportAllBtn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${text}`;
    };
    setBusy('Rendering…');
    try {
      const blob = await exportAllZip(store.state, (doneCount, total, label) => {
        const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
        setBusy(label === 'zipping' ? 'Zipping…' : `Rendering… ${pct}%`);
      });
      downloadBlob('water-cooler-sprites.zip', blob);
    } finally {
      exportAllBtn.disabled = false;
      exportAllBtn.classList.remove('busy');
      exportAllBtn.textContent = 'Export all (zip)';
    }
  }, 'primary');

  const importInput = el('input', {
    type: 'file',
    accept: 'application/json',
    className: 'hidden-input',
    onChange: async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const migrated = migrateProject(JSON.parse(await file.text()));
        if (!migrated) throw new Error('not a project file');
        store.replaceProject(migrated);
      } catch {
        alert('Could not import: not a valid project JSON.');
      }
      (e.target as HTMLInputElement).value = '';
    },
  });

  const header = el(
    'header',
    { className: 'topbar' },
    el('h1', {}, 'Third Watch Sprite Studio'),
    el('span', { className: 'subtitle' }, 'The Water Cooler'),
    tabBar,
    el(
      'div',
      { className: 'topbar-actions' },
      button('Import project', () => importInput.click()),
      button('Export project JSON', () => downloadJson('water-cooler-project.json', store.state)),
      button('Reset all', () => {
        if (!confirm('Reset everything to the default cast, props, and style?')) return;
        store.replaceProject(defaultProject());
      }, 'danger'),
      exportAllBtn,
      importInput,
    ),
  );

  const main = el('main', { className: 'layout' }, sidebar, preview, controls);
  root.append(header, main);

  function renderTabs(): void {
    clear(tabBar);
    for (const tab of TABS) {
      tabBar.append(
        el(
          'button',
          {
            className: `tab ${store.ui.tab === tab.id ? 'active' : ''}`,
            onClick: () => store.mutateUi((ui) => (ui.tab = tab.id)),
          },
          tab.label,
        ),
      );
    }
  }

  function render(kind: 'structure' | 'data'): void {
    renderTabs();
    const tab = store.ui.tab;
    main.classList.toggle('no-sidebar', tab === 'style');

    if (tab === 'characters') {
      renderCharacterList(sidebar);
      renderCharacterPreview(preview);
      if (kind === 'structure') renderCharacterControls(controls);
    } else if (tab === 'props') {
      renderPropList(sidebar);
      renderPropPreview(preview);
      if (kind === 'structure') renderPropControls(controls);
    } else if (tab === 'tiles') {
      renderTileList(sidebar);
      renderTilePreview(preview);
      if (kind === 'structure') renderTileControls(controls);
    } else if (tab === 'scene') {
      renderSceneList(sidebar);
      renderScenePreview(preview);
      if (kind === 'structure') renderSceneControls(controls);
    } else if (tab === 'employees') {
      renderEmployeeList(sidebar);
      renderEmployeePreview(preview);
      if (kind === 'structure') renderEmployeeControls(controls);
    } else {
      clear(sidebar);
      renderStylePreview(preview);
      if (kind === 'structure') renderStyleControls(controls);
    }
  }

  store.subscribe(render);
  render('structure');
}
