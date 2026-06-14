import { describe, it, expect } from 'vitest';
import { LAYOUT_TEMPLATES } from '../src/core/layout';
import { MOODS } from '../src/core/types';
import { DEFAULT_CAST, DEFAULT_PROPS } from '../src/data/defaults';
import { PROP_TEMPLATES } from '../src/props/templates';

/**
 * Tool ↔ game integration contracts.
 *
 * These mirror what the consuming game (The-Water-Cooler, epic 28 "Sprite Office
 * Runtime Integration") binds against — see SPRITE_INTEGRATION.md. The game side
 * resolves sim state into sprites by *string id*: agent id → layer-atlas family,
 * social-state label → mood overlay, location id → layout room, interaction
 * anchor → prop. If either side renames one of those ids, the binding silently
 * falls back instead of erroring. These tests are the tripwire that the tool
 * half drifted; update BOTH repos together when a contract genuinely changes.
 */

// Sim LocationIds bind to these layout room ids (SpriteToolkitOfficeBinder
// DefaultLocationMap). Every generated office must contain them or some sim
// location resolves to nothing.
const SIM_BOUND_ROOMS = ['manager-office', 'break-room', 'hallway', 'cubicle-farm', 'conference-room'];

// Sim AgentIds (Phase2 scenario fixture). Must equal recipe ids 1:1 so the
// exported layer-atlas family matches the agent the game spawns.
const SIM_AGENT_IDS = ['janice', 'carl', 'linda', 'manager'];

// Sim ShortTermSocialStateLabel, lowercased — the mood overlay names.
const SIM_MOOD_NAMES = ['normal', 'curious', 'suspicious', 'defensive', 'hostile', 'confused'];

// Sim interaction anchors that need a *physical* prop counterpart (the rest are
// navigation waypoints that resolve to location bounds, not props) → the tool
// prop template id the binder's AnchorTemplateMap points at.
const SIM_PROP_TEMPLATES = ['water-cooler', 'coffee-machine', 'printer', 'mail-station', 'supply-cabinet', 'door', 'desk'];

describe('tool ↔ game integration contracts', () => {
  it('every layout template contains the rooms the sim binds locations to', () => {
    for (const template of LAYOUT_TEMPLATES) {
      const roomIds = template.rooms.map((room) => room.id);
      for (const required of SIM_BOUND_ROOMS) {
        expect(roomIds, `template "${template.id}" is missing sim-bound room "${required}"`).toContain(required);
      }
    }
  });

  it('default cast ids equal the sim agent ids exactly', () => {
    expect([...DEFAULT_CAST.map((recipe) => recipe.id)].sort()).toEqual([...SIM_AGENT_IDS].sort());
  });

  it('mood overlay names are a 1:1 match with the sim social-state labels', () => {
    expect([...MOODS].sort()).toEqual([...SIM_MOOD_NAMES].sort());
  });

  it('every physical sim anchor has a matching prop template and a default instance', () => {
    const templateIds = PROP_TEMPLATES.map((template) => template.id);
    const instanceTemplateIds = DEFAULT_PROPS.map((prop) => prop.templateId);
    for (const id of SIM_PROP_TEMPLATES) {
      expect(templateIds, `missing prop template "${id}"`).toContain(id);
      expect(instanceTemplateIds, `no default instance exports prop "${id}"`).toContain(id);
    }
  });
});
