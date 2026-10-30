import type { Operator, OrderInput, WorldDefinition } from '../../src/simulation/core/types';
import { DEFAULT_POLICY } from '../../src/simulation/orders/policy';

export function operator(id = 'bravo-1', x = 0, y = 0): Operator {
  return {
    id, name: id, position: { x, y },
    attributes: { strength: 50, perception: 60, coordination: 60, judgment: 60, resilience: 60 },
    proficiencies: { sidearm: 50, carbine: 60, precisionRifle: 50 },
    stress: 0, fatigue: 0, ammo: 6, reserveAmmo: 12, action: null, recovery: 'NONE', operational: true, movementProgress: 0, policy: {},
  };
}

export function world(): WorldDefinition {
  return {
    grid: { width: 10, height: 10, walls: [] },
    operators: [operator(), operator('bravo-2', 0, 2), operator('bravo-3', 0, 4)],
    policy: DEFAULT_POLICY,
    npcs: [],
  };
}

export function order(overrides: Partial<OrderInput> = {}): OrderInput {
  return {
    id: 'order-1', operatorId: 'bravo-1', type: 'MOVE',
    target: { kind: 'POSITION', position: { x: 4, y: 0 } },
    priority: 50, dependsOn: [], policy: {}, ...overrides,
  };
}
