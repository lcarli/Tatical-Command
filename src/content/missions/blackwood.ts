import type { Operator, WorldDefinition } from '../../simulation/core/types';
import { DEFAULT_POLICY } from '../../simulation/orders/policy';

function operator(id: string, name: string, x: number, perception: number, strength: number, resilience: number): Operator {
  return {
    id, name, position: { x, y: 8 },
    attributes: { strength, perception, coordination: 60, judgment: 65, resilience },
    proficiencies: { sidearm: 55, carbine: 65, precisionRifle: 45 },
    stress: 0, fatigue: 0, ammo: 6, reserveAmmo: 12, action: null, recovery: 'NONE',
    operational: true, movementProgress: 0, policy: {},
  };
}

export const TARGET_ROOM = { x: 7, y: 2 } as const;
export const SEARCH_ROOM = { x: 6, y: 6 } as const;

export function blackwoodWorld(): WorldDefinition {
  return {
    grid: {
      width: 10, height: 10,
      walls: [
        ...Array.from({ length: 10 }, (_, x) => ({ x, y: 0 })),
        ...Array.from({ length: 10 }, (_, x) => ({ x, y: 9 })),
        ...Array.from({ length: 8 }, (_, index) => ({ x: 0, y: index + 1 })),
        ...Array.from({ length: 8 }, (_, index) => ({ x: 9, y: index + 1 })),
        ...[1, 2, 4, 5, 6, 8].map((y) => ({ x: 4, y })),
        { x: 6, y: 4 }, { x: 7, y: 4 }, { x: 8, y: 4 },
      ],
    },
    operators: [
      operator('bravo-1', 'Bravo 1', 1, 60, 55, 65),
      operator('bravo-2', 'Bravo 2', 2, 85, 45, 40),
      operator('bravo-3', 'Bravo 3', 3, 45, 85, 60),
    ],
    policy: DEFAULT_POLICY,
    npcs: [{
      id: 'civilian', identity: 'CIVILIAN', position: { x: 7, y: 6 },
      behavior: 'SEEDED', script: [],
    }],
    mission: { id: 'blackwood', inspectTarget: TARGET_ROOM, civilianId: 'civilian', minOperational: 2 },
  };
}
