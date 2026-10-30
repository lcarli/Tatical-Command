import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/simulation';
import { resolvePolicy } from '../../src/simulation/orders/policy';
import { findPath } from '../../src/simulation/world/grid';
import { order, world } from '../fixtures/world';

function run(engine: SimulationEngine, ticks = 40) {
  engine.dispatch({ id: 'start', issuedAtTick: 0, type: 'RESUME' });
  for (let tick = 0; tick < ticks; tick += 1) engine.step();
  return engine.snapshot();
}

describe('orders and autonomy', () => {
  it('lets three operators finish independent inspect intents without intervention', () => {
    const engine = new SimulationEngine(1, 'PLANNING', world());
    for (let index = 0; index < 3; index += 1) {
      engine.dispatch({
        id: `cmd-${index}`, issuedAtTick: 0, type: 'ISSUE_ORDER',
        order: order({ id: `order-${index}`, operatorId: `bravo-${index + 1}`, type: 'INSPECT', target: { kind: 'POSITION', position: { x: 5, y: index * 2 } } }),
      });
    }
    const state = run(engine);
    expect(state.orders.map((entry) => entry.status)).toEqual(['COMPLETED', 'COMPLETED', 'COMPLETED']);
    expect(state.traces).toHaveLength(3);
    expect(state.events.filter((event) => event.kind === 'DECISION')).toHaveLength(6);
  });

  it('applies inheritance and makes tempo visibly change movement timing', () => {
    expect(resolvePolicy(world().policy, { caution: 'HIGH' }, { tempo: 'URGENT' })).toEqual({ tempo: 'URGENT', caution: 'HIGH', autonomy: 'ADAPTIVE' });
    const counts = (tempo: 'URGENT' | 'METHODICAL') => {
      const engine = new SimulationEngine(1, 'PLANNING', world());
      engine.dispatch({ id: 'move', issuedAtTick: 0, type: 'ISSUE_ORDER', order: order({ policy: { tempo } }) });
      return run(engine, 4).operators[0]?.position.x;
    };
    expect(counts('URGENT')).toBe(4);
    expect(counts('METHODICAL')).toBe(1);
  });

  it('keeps intent blocked and resumes it when a blocking operator moves', () => {
    const definition = world();
    const engine = new SimulationEngine(1, 'PLANNING', {
      ...definition, grid: { width: 4, height: 1, walls: [] },
      operators: [{ ...definition.operators[0]!, position: { x: 0, y: 0 } }, { ...definition.operators[1]!, position: { x: 1, y: 0 } }],
    });
    engine.dispatch({ id: 'move', issuedAtTick: 0, type: 'ISSUE_ORDER', order: order({ target: { kind: 'POSITION', position: { x: 2, y: 0 } } }) });
    expect(run(engine, 2).orders[0]?.status).toBe('BLOCKED');
    engine.dispatch({ id: 'clear', issuedAtTick: 2, type: 'ISSUE_ORDER', order: order({ id: 'clear', operatorId: 'bravo-2', target: { kind: 'POSITION', position: { x: 3, y: 0 } }, policy: { tempo: 'URGENT' } }) });
    for (let tick = 0; tick < 12; tick += 1) engine.step();
    expect(engine.snapshot().orders[0]?.status).toBe('COMPLETED');
  });

  it('honors dependencies and propagates cancellation', () => {
    const engine = new SimulationEngine(1, 'PLANNING', world());
    engine.dispatch({ id: 'a', issuedAtTick: 0, type: 'ISSUE_ORDER', order: order({ type: 'WAIT', target: { kind: 'NONE' } }) });
    engine.dispatch({ id: 'b', issuedAtTick: 0, type: 'ISSUE_ORDER', order: order({ id: 'dependent', dependsOn: ['order-1'] }) });
    engine.step();
    engine.dispatch({ id: 'cancel', issuedAtTick: 0, type: 'CANCEL_ORDER', orderId: 'order-1' });
    const state = run(engine, 1);
    expect(state.orders.map((entry) => entry.status)).toEqual(['CANCELLED', 'FAILED']);
  });

  it('validates queue caps, dependencies, policies and walkable targets', () => {
    const engine = new SimulationEngine(1, 'PLANNING', world());
    for (let i = 0; i < 5; i += 1) engine.dispatch({ id: `c-${i}`, issuedAtTick: 0, type: 'ISSUE_ORDER', order: order({ id: `o-${i}` }) });
    expect(() => engine.dispatch({ id: 'sixth', issuedAtTick: 0, type: 'ISSUE_ORDER', order: order() })).toThrow(/five/);
    const other = new SimulationEngine(1, 'PLANNING', world());
    expect(() => other.dispatch({ id: 'bad', issuedAtTick: 0, type: 'ISSUE_ORDER', order: order({ dependsOn: ['missing'] }) })).toThrow(/Dependencies/);
    expect(() => other.dispatch({ id: 'bad', issuedAtTick: 0, type: 'ISSUE_ORDER', order: { ...order(), policy: { force: true } } })).toThrow(/Policy/);
  });

  it('finds stable non-diagonal paths and respects walls and occupancy', () => {
    const grid = { width: 3, height: 3, walls: [{ x: 1, y: 1 }] };
    expect(findPath(grid, { x: 0, y: 1 }, { x: 2, y: 1 })).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 },
    ]);
    expect(findPath(grid, { x: 0, y: 0 }, { x: 2, y: 0 }, [{ x: 1, y: 0 }, { x: 0, y: 1 }])).toBeNull();
  });

  it('selects by priority, completes interaction and wait, and regroups after a dependency', () => {
    const engine = new SimulationEngine(1, 'PLANNING', world());
    engine.dispatch({ id: 'a', issuedAtTick: 0, type: 'ISSUE_ORDER', order: order({ id: 'wait', type: 'WAIT', target: { kind: 'NONE' }, priority: 10 }) });
    engine.dispatch({ id: 'b', issuedAtTick: 0, type: 'ISSUE_ORDER', order: order({ id: 'interact', type: 'INTERACT', target: { kind: 'POSITION', position: { x: 2, y: 0 } }, priority: 90 }) });
    engine.dispatch({ id: 'c', issuedAtTick: 0, type: 'ISSUE_ORDER', order: order({ id: 'regroup', operatorId: 'bravo-2', type: 'REGROUP', target: { kind: 'NONE' }, dependsOn: ['interact'] }) });
    engine.dispatch({ id: 'start', issuedAtTick: 0, type: 'RESUME' });
    const first = engine.step();
    expect(first.orders.find((entry) => entry.id === 'interact')?.status).toBe('ACTIVE');
    expect(first.orders.find((entry) => entry.id === 'wait')?.status).toBe('QUEUED');
    for (let tick = 0; tick < 30; tick += 1) engine.step();
    expect(engine.snapshot().orders.every((entry) => entry.status === 'COMPLETED')).toBe(true);
    const leader = engine.snapshot().operators[0]!;
    const member = engine.snapshot().operators[1]!;
    expect(Math.abs(leader.position.x - member.position.x) + Math.abs(leader.position.y - member.position.y)).toBeLessThanOrEqual(1);
  });
});
