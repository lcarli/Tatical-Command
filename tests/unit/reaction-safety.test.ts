import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/simulation';
import { advanceReactions, chooseResponse } from '../../src/simulation/combat/reactions';
import { operator, world } from '../fixtures/world';

describe('reaction safety and psychology', () => {
  function observed(resilience = 60) {
    const engine = new SimulationEngine(1, 'PLANNING', {
      ...world(),
      operators: [{ ...operator(), attributes: { ...operator().attributes, resilience } }],
      npcs: [{ id: 'threat', identity: 'UNKNOWN', position: { x: 2, y: 0 }, behavior: 'HOSTILE', script: [] }],
    });
    engine.dispatch({ id: 'start', issuedAtTick: 0, type: 'RESUME' });
    for (let tick = 0; tick < 3; tick += 1) engine.step();
    const snapshot = engine.snapshot();
    return { ...snapshot, operators: snapshot.operators.map((entry) => ({ ...entry, stress: 90 })) };
  }

  it('attenuates stress performance penalties using resilience in a controlled resolution', () => {
    const resolve = (resilience: number) => {
      const state = observed(resilience);
      const endsAt = state.operators[0]?.action?.endsAt;
      if (!endsAt) throw new Error('Expected a pending response.');
      return advanceReactions({
        ...state, tick: endsAt,
        knowledge: state.knowledge.map((entry) => ({ ...entry, observations: entry.observations.map((observation) => ({ ...observation, observedAt: endsAt })) })),
      }, () => 60);
    };
    expect(resolve(0).npcs[0]?.behavior).toBe('HOSTILE');
    expect(resolve(100).npcs[0]?.behavior).toBe('INCAPACITATED');
  });

  it('rejects force before scoring when another known civilian is nearby', () => {
    const state = observed();
    const source = state.knowledge[0]?.observations[0];
    const subject = state.operators[0];
    if (!source || !subject) throw new Error('Missing fixture observation.');
    const knowledge = [{ operatorId: subject.id, observations: [source, { ...source, entityId: 'bystander', position: { x: 2, y: 1 }, identity: 'CIVILIAN' as const }] }];
    const trace = chooseResponse({ ...state, knowledge }, subject, source, state.policy);
    expect(trace.eligible.some((entry) => entry.action === 'RESPOND')).toBe(false);
    expect(trace.rejected.some((entry) => entry.reason.includes('civilian'))).toBe(true);
  });

  it('never responds to an occluded hostile entity using hidden truth', () => {
    const definition = world();
    const engine = new SimulationEngine(1, 'EXECUTING', {
      ...definition, grid: { width: 10, height: 10, walls: Array.from({ length: 10 }, (_, y) => ({ x: 1, y })) },
      npcs: [{ id: 'hidden', position: { x: 2, y: 0 }, identity: 'UNKNOWN', behavior: 'HOSTILE', script: [] }],
    });
    for (let tick = 0; tick < 20; tick += 1) engine.step();
    expect(engine.eventLog().some((event) => event.kind === 'ACTION_STARTED' && event.action === 'RESPOND')).toBe(false);
  });
});
