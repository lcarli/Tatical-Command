import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/simulation';
import type { NpcDefinition } from '../../src/simulation/core/types';
import { hasLineOfSight, playerView } from '../../src/simulation/perception/knowledge';
import { order, world } from '../fixtures/world';

const npc: NpcDefinition = { id: 'contact', identity: 'CIVILIAN', position: { x: 2, y: 0 }, behavior: 'SEEDED', script: [] };
function start(definition = { ...world(), npcs: [npc] }) {
  const engine = new SimulationEngine(42, 'PLANNING', definition);
  engine.dispatch({ id: 'start', issuedAtTick: 0, type: 'RESUME' });
  return engine;
}

describe('knowledge and NPCs', () => {
  it('keeps occluded NPC identity and position out of all knowledge and player view', () => {
    const definition = { ...world(), grid: { width: 10, height: 10, walls: Array.from({ length: 10 }, (_, y) => ({ x: 1, y })) }, npcs: [npc] };
    const engine = start(definition);
    for (let tick = 0; tick < 10; tick += 1) engine.step();
    expect(engine.snapshot().knowledge.every((entry) => entry.observations.length === 0)).toBe(true);
    expect(playerView(engine.snapshot()).intel).toEqual([]);
    expect('npcs' in playerView(engine.snapshot())).toBe(false);
    expect('knowledge' in playerView(engine.snapshot())).toBe(false);
    expect(() => engine.dispatch({ id: 'protect', issuedAtTick: 10, type: 'ISSUE_ORDER', order: order({ type: 'PROTECT', target: { kind: 'ENTITY', entityId: 'contact' } }) })).toThrow(/communicated/);
  });

  it('progresses detection before identity and communicates provenance', () => {
    const engine = start();
    const first = engine.step().knowledge[0]?.observations[0];
    expect(first?.level).toBe('DETECTED');
    expect(first?.identity).toBeNull();
    expect(first?.behavior).toBeNull();
    for (let tick = 1; tick < 5; tick += 1) engine.step();
    expect(engine.snapshot().intel[0]).toMatchObject({ entityId: 'contact', level: 'IDENTIFIED', identity: 'CIVILIAN', sourceOperatorId: 'bravo-1', observedAt: 5 });
    expect(engine.eventLog().some((event) => event.kind === 'RADIO_REPORT')).toBe(true);
  });

  it('marks lost observations stale without refreshing timestamps through radio', () => {
    const engine = start({ ...world(), npcs: [{ ...npc, script: [{ atTick: 6, behavior: 'FLEEING', position: { x: 9, y: 9 } }] }] });
    for (let tick = 0; tick < 16; tick += 1) engine.step();
    expect(engine.snapshot().intel[0]).toMatchObject({ observedAt: 5, level: 'STALE', position: { x: 2, y: 0 } });
    expect(engine.snapshot().knowledge.every((entry) => entry.observations[0]?.level === 'STALE')).toBe(true);
  });

  it('reproduces seeded behavior and preserves observations independently from world truth', () => {
    const a = start();
    const b = start();
    for (let tick = 0; tick < 20; tick += 1) { a.step(); b.step(); }
    expect(a.stateHash()).toBe(b.stateHash());
    expect(Object.isFrozen(a.snapshot().knowledge[0]?.observations)).toBe(true);
  });

  it('safeguards an identified contact using knowledge rather than an entity lookup in the planner', () => {
    const engine = start();
    for (let tick = 0; tick < 5; tick += 1) engine.step();
    engine.dispatch({ id: 'protect', issuedAtTick: 5, type: 'ISSUE_ORDER', order: order({ type: 'PROTECT', target: { kind: 'ENTITY', entityId: 'contact' } }) });
    for (let tick = 0; tick < 20; tick += 1) engine.step();
    expect(engine.snapshot().orders[0]?.status).toBe('COMPLETED');
    expect(engine.snapshot().operators[0]?.position).toEqual({ x: 1, y: 0 });
  });

  it('blocks diagonal sight around closed corners', () => {
    expect(hasLineOfSight({ width: 3, height: 3, walls: [{ x: 1, y: 0 }] }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(false);
  });
});
