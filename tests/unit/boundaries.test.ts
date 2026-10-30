import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/simulation';
import { parseWorld } from '../../src/simulation/orders/validation';
import { world, order } from '../fixtures/world';

describe('engine boundaries', () => {
  it('rejects a team command batch atomically', () => {
    const engine = new SimulationEngine(1, 'PLANNING', world());
    const hash = engine.stateHash();
    expect(() => engine.dispatchBatch([
      { id: 'a', issuedAtTick: 0, type: 'ISSUE_ORDER', order: order() },
      { id: 'b', issuedAtTick: 0, type: 'ISSUE_ORDER', order: order({ id: 'bad', operatorId: 'missing' }) },
    ])).toThrow(/operational/);
    expect(engine.stateHash()).toBe(hash);
    expect(engine.commandLog()).toEqual([]);
  });

  it('does not retain mutable content references', () => {
    const definition = world();
    const engine = new SimulationEngine(1, 'PLANNING', definition);
    const hash = engine.stateHash();
    expect(Object.isFrozen(engine.initialWorld.operators)).toBe(true);
    expect(engine.stateHash()).toBe(hash);
  });

  it('rejects malformed or out-of-range content before initialization', () => {
    expect(() => parseWorld({ ...world(), operators: [{ attributes: {} }] })).toThrow(/Malformed/);
    expect(() => parseWorld({ ...world(), grid: { width: 10, height: 10, walls: [{ x: 10, y: 1 }] } })).toThrow(/walls/);
    expect(() => new SimulationEngine(1, 'PLANNING', { ...world(), operators: world().operators.map((entry) => ({ ...entry, stress: 101 })) })).toThrow(/Invalid operator/);
  });

  it('rejects cancellations scheduled before the target order exists', () => {
    const engine = new SimulationEngine(1, 'EXECUTING', world());
    engine.dispatch({ id: 'later', issuedAtTick: 10, type: 'ISSUE_ORDER', order: order() });
    expect(() => engine.dispatch({ id: 'earlier', issuedAtTick: 0, type: 'CANCEL_ORDER', orderId: 'order-1' })).toThrow(/scheduled tick/);
  });
});
