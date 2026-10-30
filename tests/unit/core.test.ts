import { describe, expect, it } from 'vitest';
import { SimulationEngine, SimulationError } from '../../src/simulation';
import { canonical, createPrng } from '../../src/simulation/core/determinism';
import { coreTrace } from '../fixtures/core-trace';

describe('deterministic core', () => {
  it('replays the golden control trace at fixed logical ticks', () => {
    const engine = new SimulationEngine(1);
    engine.dispatch({ id: 'start', issuedAtTick: 0, type: 'RESUME' });
    engine.step();
    engine.dispatch({ id: 'pause', issuedAtTick: 2, type: 'PAUSE' });
    engine.step();
    engine.step();
    expect(engine.snapshot().tick).toBe(2);
    expect(engine.eventLog()).toEqual(coreTrace);
  });
  it('uses the versioned xorshift32 golden sequence', () => {
    const rng = createPrng(1);
    expect(Array.from({ length: 5 }, () => rng.next())).toEqual([
      270369, 67634689, 2647435461, 307599695, 2398689233,
    ]);
  });

  it('matches state and event hashes across runs with stable command ordering', () => {
    const run = (reverse: boolean) => {
      const engine = new SimulationEngine(42);
      const commands = [
        { id: 'a', issuedAtTick: 0, type: 'RESUME' },
        { id: 'b', issuedAtTick: 0, type: 'PAUSE' },
      ];
      for (const command of reverse ? commands.reverse() : commands) engine.dispatch(command);
      engine.step();
      return { state: engine.stateHash(), events: engine.eventHash(), phase: engine.snapshot().phase };
    };
    expect(run(false)).toEqual(run(true));
    expect(run(false).phase).toBe('PAUSED');
  });

  it('rejects invalid input without changing the engine', () => {
    const engine = new SimulationEngine(1);
    for (const input of [null, {}, { id: 'x', issuedAtTick: -1, type: 'RESUME' }, { id: 'x', issuedAtTick: 0, type: 'FIRE' }]) {
      const before = engine.stateHash();
      expect(() => engine.dispatch(input)).toThrow(SimulationError);
      expect(engine.stateHash()).toBe(before);
    }
    engine.dispatch({ id: 'x', issuedAtTick: 0, type: 'RESUME' });
    expect(() => engine.dispatch({ id: 'x', issuedAtTick: 0, type: 'RESUME' })).toThrow(SimulationError);
  });

  it('freezes snapshots and stops at terminal phases', () => {
    for (const phase of ['COMPLETED', 'FAILED'] as const) {
      const engine = new SimulationEngine(1, phase);
      const before = engine.stateHash();
      expect(engine.step().tick).toBe(0);
      expect(engine.stateHash()).toBe(before);
      expect(Object.isFrozen(engine.snapshot().grid.walls)).toBe(true);
      expect(() => engine.dispatch({ id: 'x', issuedAtTick: 0, type: 'RESUME' })).toThrow(SimulationError);
    }
  });

  it('canonicalizes object keys and rejects unsupported values', () => {
    expect(canonical({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(() => canonical({ x: undefined })).toThrow(SimulationError);
    expect(() => createPrng(-1)).toThrow(SimulationError);
  });
});
