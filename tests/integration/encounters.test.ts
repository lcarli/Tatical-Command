import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/simulation';
import type { Behavior, NpcDefinition } from '../../src/simulation/core/types';
import { chooseResponse } from '../../src/simulation/combat/reactions';
import { operator, order, world } from '../fixtures/world';

function encounter(behavior: Behavior, script: NpcDefinition['script'] = [], seed = 1, ammo = 6, reserveAmmo = 12) {
  const engine = new SimulationEngine(seed, 'PLANNING', {
    ...world(), operators: [{ ...operator(), ammo, reserveAmmo }],
    npcs: [{ id: 'contact', identity: 'UNKNOWN', position: { x: 2, y: 0 }, behavior, script }],
  });
  engine.dispatch({ id: 'intent', issuedAtTick: 0, type: 'ISSUE_ORDER', order: order({ target: { kind: 'POSITION', position: { x: 0, y: 6 } } }) });
  engine.dispatch({ id: 'start', issuedAtTick: 0, type: 'RESUME' });
  return engine;
}

describe('abstract autonomous encounters', () => {
  it('warns automatically, retains intent and resumes after surrender', () => {
    const engine = encounter('THREATENING', [{ atTick: 5, behavior: 'SURRENDERED' }]);
    for (let tick = 0; tick < 50; tick += 1) engine.step();
    expect(engine.eventLog().some((event) => event.kind === 'ACTION_STARTED' && event.action === 'WARN')).toBe(true);
    expect(engine.eventLog().some((event) => event.kind === 'ACTION_STARTED' && event.action === 'RESUME')).toBe(true);
    expect(engine.eventLog().some((event) => event.kind === 'WEAPON_FIRE')).toBe(false);
    expect(engine.snapshot().orders[0]?.status).toBe('COMPLETED');
  });

  it.each(['PASSIVE', 'NERVOUS', 'COOPERATIVE', 'FLEEING', 'SURRENDERED', 'INCAPACITATED'] as const)('never uses force solely on %s identity/behavior', (behavior) => {
    const engine = encounter(behavior);
    for (let tick = 0; tick < 20; tick += 1) engine.step();
    expect(engine.eventLog().some((event) => event.kind === 'WEAPON_FIRE')).toBe(false);
  });

  it('cancels a pending response when the contact surrenders before resolution', () => {
    const engine = encounter('HOSTILE', [{ atTick: 4, behavior: 'SURRENDERED' }]);
    for (let tick = 0; tick < 20; tick += 1) engine.step();
    expect(engine.eventLog().some((event) => event.kind === 'ACTION_STARTED' && event.action === 'RESPOND')).toBe(true);
    expect(engine.eventLog().some((event) => event.kind === 'WEAPON_FIRE')).toBe(false);
    expect(engine.eventLog().some((event) => event.kind === 'ACTION_ENDED' && event.reason.includes('cancelled'))).toBe(true);
    expect(engine.snapshot().operators[0]?.ammo).toBe(6);
  });

  it('revalidates cessation within one tick between multiple operators', () => {
    const engine = new SimulationEngine(1, 'PLANNING', {
      ...world(), npcs: [{ id: 'contact', position: { x: 2, y: 1 }, identity: 'UNKNOWN', behavior: 'HOSTILE', script: [] }],
    });
    engine.dispatch({ id: 'start', issuedAtTick: 0, type: 'RESUME' });
    for (let tick = 0; tick < 30; tick += 1) engine.step();
    const events = engine.eventLog();
    const ended = events.findIndex((event) => event.kind === 'INCAPACITATED' && event.targetId === 'contact');
    expect(ended).toBeGreaterThan(-1);
    expect(events.slice(ended + 1).some((event) => event.kind === 'WEAPON_FIRE')).toBe(false);
  });

  it('reloads from bounded reserves and never makes resources negative', () => {
    const engine = encounter('HOSTILE', [], 4, 0, 2);
    for (let tick = 0; tick < 80; tick += 1) {
      const state = engine.step();
      expect(state.operators.every((entry) => entry.ammo >= 0 && entry.ammo <= 6 && entry.reserveAmmo >= 0
        && entry.stress >= 0 && entry.stress <= 100 && entry.fatigue >= 0 && entry.fatigue <= 100)).toBe(true);
    }
    expect(engine.eventLog().some((event) => event.kind === 'RELOAD')).toBe(true);
    expect(engine.snapshot().operators[0]?.reserveAmmo).toBe(0);
  });

  it('filters prohibited responses before utility even with urgent policy', () => {
    const engine = encounter('SURRENDERED');
    for (let tick = 0; tick < 4; tick += 1) engine.step();
    const state = engine.snapshot();
    const subject = state.operators[0]!;
    const observation = state.knowledge[0]!.observations[0]!;
    const trace = chooseResponse(state, subject, observation, { tempo: 'URGENT', caution: 'STANDARD', autonomy: 'WIDE' });
    expect(trace.eligible.some((entry) => entry.action === 'RESPOND')).toBe(false);
    expect(trace.rejected.some((entry) => entry.action === 'RESPOND')).toBe(true);
  });

  it('produces the same timed events and hashes for the same seed', () => {
    const a = encounter('HOSTILE');
    const b = encounter('HOSTILE');
    for (let tick = 0; tick < 50; tick += 1) { a.step(); b.step(); }
    expect(a.stateHash()).toBe(b.stateHash());
    expect(a.eventHash()).toBe(b.eventHash());
    expect(a.eventLog().filter((event) => 'action' in event && 'durationTicks' in event).every((event) => event.durationTicks > 0)).toBe(true);
  });
});
