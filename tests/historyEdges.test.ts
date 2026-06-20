import { describe, it, expect } from 'vitest';
import { createDefaultCompany, applyCompanyDerived, type Company, type CompanyEvent } from '../src/core/company';
import {
  seedEdgesFromHistory,
  seedEdgesFromRivalries,
  companyGraphClimate,
  wireCompanyRelationships,
} from '../src/core/historyEdges';
import { generatePopulation } from '../src/core/employee';
import { generateEmployeePersona } from '../src/core/populationPersona';
import { DEFAULT_DEPARTMENTS, DEFAULT_RELATIONSHIP_TYPES, DEFAULT_STYLE } from '../src/data/defaults';
import type { CharacterProfile } from '../src/core/profile';

/** A fresh cast: `n` personas per department id. */
function castFor(deptIds: string[], n: number): CharacterProfile[] {
  return deptIds.flatMap((id) =>
    generatePopulation(n, id, DEFAULT_STYLE, `cast-${id}`).employees.map((e) => {
      e.metadata.department = id;
      return generateEmployeePersona(e);
    }),
  );
}

function company(history: CompanyEvent[], factionalism = 50): Company {
  const c = createDefaultCompany('acme', 'Acme');
  c.history = history;
  c.climate.factionalism = { value: factionalism, authored: true };
  return c;
}

const event = (over: Partial<CompanyEvent> & Pick<CompanyEvent, 'id' | 'kind'>): CompanyEvent => ({
  title: over.id, description: '', when: 'recent', magnitude: 80, visibility: 'public', involvedDepartments: [], ...over,
});

const deptOf = (cast: CharacterProfile[]) => new Map(cast.map((p) => [p.agentId, p.identity.department]));

describe('F0.6 — seed edges from formative events (S0.6.2)', () => {
  it('a layoff leaves resentment (rival) edges within the team it hit', () => {
    const cast = castFor(['engineering', 'sales'], 6);
    const edges = seedEdgesFromHistory(company([event({ id: 'lay', kind: 'layoff', involvedDepartments: ['Engineering'] })]), cast, DEFAULT_DEPARTMENTS, 'S1');
    const dept = deptOf(cast);
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) {
      expect(e.relationshipType).toBe('rival');
      expect(e.tags).toContain('history:lay');
      expect(dept.get(e.sourceAgentId)).toBe('engineering'); // attached to the involved dept
      expect(dept.get(e.targetAgentId)).toBe('engineering');
    }
  });

  it('a merger leaves us-vs-them rivalry across departments', () => {
    const cast = castFor(['engineering', 'sales', 'finance'], 6);
    const edges = seedEdgesFromHistory(company([event({ id: 'mrg', kind: 'merger' })]), cast, DEFAULT_DEPARTMENTS, 'S1');
    const dept = deptOf(cast);
    expect(edges.length).toBeGreaterThan(0);
    expect(edges.every((e) => e.relationshipType === 'rival')).toBe(true);
    expect(edges.some((e) => dept.get(e.sourceAgentId) !== dept.get(e.targetAgentId))).toBe(true);
  });

  it('a win leaves alliances; buried events are secret, public ones are not', () => {
    const cast = castFor(['sales'], 8);
    const win = seedEdgesFromHistory(company([event({ id: 'q', kind: 'record_quarter', involvedDepartments: ['Sales'] })]), cast, DEFAULT_DEPARTMENTS, 'S1');
    expect(win.every((e) => e.relationshipType === 'ally')).toBe(true);
    expect(win.every((e) => !e.secret)).toBe(true);
    const buried = seedEdgesFromHistory(company([event({ id: 's', kind: 'scandal', visibility: 'buried', involvedDepartments: ['Sales'] })]), cast, DEFAULT_DEPARTMENTS, 'S1');
    expect(buried.every((e) => e.secret)).toBe(true);
  });

  it('higher-magnitude events seed more edges, deterministically', () => {
    const cast = castFor(['engineering'], 10);
    const big = seedEdgesFromHistory(company([event({ id: 'b', kind: 'layoff', magnitude: 100, involvedDepartments: ['Engineering'] })]), cast, DEFAULT_DEPARTMENTS, 'S1');
    const small = seedEdgesFromHistory(company([event({ id: 'b', kind: 'layoff', magnitude: 25, involvedDepartments: ['Engineering'] })]), cast, DEFAULT_DEPARTMENTS, 'S1');
    expect(big.length).toBeGreaterThan(small.length);
    expect(seedEdgesFromHistory(company([event({ id: 'b', kind: 'layoff', involvedDepartments: ['Engineering'] })]), cast, DEFAULT_DEPARTMENTS, 'S1')).toEqual(
      seedEdgesFromHistory(company([event({ id: 'b', kind: 'layoff', involvedDepartments: ['Engineering'] })]), cast, DEFAULT_DEPARTMENTS, 'S1'),
    );
  });
});

describe('F0.6 — rivalry edges + climate (S0.6.1)', () => {
  it('companyGraphClimate exposes the factionalism aggregate', () => {
    expect(companyGraphClimate(company([], 73)).factionalism).toBe(73);
  });

  it('department rivalries seed cross-department rival edges', () => {
    const cast = castFor(['engineering', 'sales'], 6);
    const edges = seedEdgesFromRivalries([{ a: 'engineering', b: 'sales', strength: 90 }], cast, 'S1');
    const dept = deptOf(cast);
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) {
      expect(e.relationshipType).toBe('rival');
      expect(dept.get(e.sourceAgentId)).not.toBe(dept.get(e.targetAgentId));
    }
  });

  it('higher factionalism skews the wired graph toward inter-department rivalry', () => {
    const interRival = (faction: number): number => {
      const cast = castFor(['engineering', 'sales'], 12);
      wireCompanyRelationships(company([], faction), cast, DEFAULT_DEPARTMENTS, [], {
        seed: 'S1', relationshipTypes: DEFAULT_RELATIONSHIP_TYPES, interDensity: 0.6,
      });
      const dept = deptOf(cast);
      return cast.reduce(
        (n, p) => n + p.relationships.filter((r) => r.relationshipType === 'rival' && dept.get(r.targetAgentId) !== p.identity.department).length,
        0,
      );
    };
    expect(interRival(95)).toBeGreaterThan(interRival(5));
  });
});

describe('F0.6 — history is legible in the graph (S0.6.3)', () => {
  it('a different history produces a different graph; the same one reproduces', () => {
    const base = company([event({ id: 'lay', kind: 'layoff', involvedDepartments: ['Engineering'] })], 60);
    const other = company([event({ id: 'lay', kind: 'layoff', involvedDepartments: ['Sales'] })], 60);
    const wire = (c: Company) => {
      const cast = castFor(['engineering', 'sales'], 8);
      wireCompanyRelationships(c, cast, DEFAULT_DEPARTMENTS, [], { seed: 'S1', relationshipTypes: DEFAULT_RELATIONSHIP_TYPES });
      return JSON.stringify(cast.map((p) => p.relationships.map((r) => [r.relationshipType, r.tags.join()])));
    };
    expect(wire(base)).not.toBe(wire(other));
    expect(wire(base)).toBe(wire(base));
  });
});
