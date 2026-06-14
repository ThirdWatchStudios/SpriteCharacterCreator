import { downloadBlob, downloadJson, exportAllZip } from '../core/exporter';
import { migrateProject } from '../core/migrations';
import { defaultProject } from '../data/defaults';
import { store } from '../state';
import { button, clear, el } from './dom';
import { renderCharacterControls, renderCharacterList, renderCharacterPreview } from './characterPanel';
import { renderPersonaControls, renderPersonaPreview } from './personaPanel';
import { renderScenarioControls, renderScenarioList, renderScenarioPreview } from './scenarioPanel';
import { renderEmployeeControls, renderEmployeeList, renderEmployeePreview } from './employeePanel';
import { renderPropControls, renderPropList, renderPropPreview } from './propPanel';
import { renderSceneControls, renderSceneList, renderScenePreview } from './scenePanel';
import { renderStyleControls, renderStylePreview } from './stylePanel';
import { renderTileControls, renderTileList, renderTilePreview } from './tilePanel';

/**
 * Two-level navigation: top-level groups, each with sub-tabs. The leaf id (sub
 * `id`) is what `store.ui.tab` holds and what `render()` dispatches on, so the
 * per-panel rendering is unchanged — only the grouping is new.
 */
type Leaf = typeof store.ui.tab;
interface NavGroup {
  id: string;
  label: string;
  subs: Array<{ id: Leaf; label: string }>;
}

const NAV: NavGroup[] = [
  {
    id: 'cast',
    label: 'Cast',
    subs: [
      { id: 'characters', label: 'Appearance' },
      { id: 'persona', label: 'Persona' },
      { id: 'employees', label: 'Generate' },
    ],
  },
  {
    id: 'assets',
    label: 'Assets',
    subs: [
      { id: 'props', label: 'Props' },
      { id: 'tiles', label: 'Walls & Floors' },
      { id: 'style', label: 'Style' },
    ],
  },
  {
    id: 'scenario',
    label: 'Scenario',
    subs: [
      { id: 'scenario', label: 'Scenario' },
      { id: 'scene', label: 'Office' },
    ],
  },
];

function groupForLeaf(leaf: Leaf): NavGroup {
  return NAV.find((g) => g.subs.some((s) => s.id === leaf)) ?? NAV[0];
}

export function mountApp(root: HTMLElement): void {
  const tabBar = el('nav', { className: 'tabs' });
  const subtabBar = el('nav', { className: 'subtabs' });
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
    el('h1', {}, 'Terrarium'),
    el('span', { className: 'subtitle' }, 'The Water Cooler scenario studio'),
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
  root.append(header, subtabBar, main);

  function goToGroup(group: NavGroup): void {
    const remembered = store.ui.lastSubByGroup[group.id];
    const target = group.subs.find((s) => s.id === remembered)?.id ?? group.subs[0].id;
    store.mutateUi((ui) => {
      ui.tab = target;
      ui.lastSubByGroup[group.id] = target;
    });
  }

  function goToSub(group: NavGroup, leaf: Leaf): void {
    store.mutateUi((ui) => {
      ui.tab = leaf;
      ui.lastSubByGroup[group.id] = leaf;
    });
  }

  function renderTabs(): void {
    const activeGroup = groupForLeaf(store.ui.tab);

    clear(tabBar);
    for (const group of NAV) {
      tabBar.append(
        el(
          'button',
          {
            className: `tab ${group.id === activeGroup.id ? 'active' : ''}`,
            onClick: () => goToGroup(group),
          },
          group.label,
        ),
      );
    }

    clear(subtabBar);
    for (const sub of activeGroup.subs) {
      subtabBar.append(
        el(
          'button',
          {
            className: `subtab ${store.ui.tab === sub.id ? 'active' : ''}`,
            onClick: () => goToSub(activeGroup, sub.id),
          },
          sub.label,
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
    } else if (tab === 'persona') {
      // Persona is authored per selected character, so reuse the character list.
      renderCharacterList(sidebar);
      renderPersonaPreview(preview);
      if (kind === 'structure') renderPersonaControls(controls);
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
    } else if (tab === 'scenario') {
      renderScenarioList(sidebar);
      renderScenarioPreview(preview);
      if (kind === 'structure') renderScenarioControls(controls);
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
