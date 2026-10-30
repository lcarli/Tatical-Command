import { isInteger, isRecord, SimulationError } from '../core/determinism';
import type { ExecutionPolicy, OrderInput, OrderTarget, OrderType, Snapshot, WorldDefinition } from '../core/types';
import { inGrid, positionKey, walkable } from '../world/grid';

const orderTypes: readonly string[] = ['MOVE', 'INSPECT', 'PROTECT', 'INTERACT', 'WAIT', 'REGROUP'];
export const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);

export function parsePolicy(value: unknown): Partial<ExecutionPolicy> {
  if (!isRecord(value) || Object.keys(value).some((key) => !['tempo', 'caution', 'autonomy'].includes(key))) {
    throw new SimulationError('INVALID_COMMAND', 'Policy must contain only tempo, caution and autonomy.');
  }
  const result: { tempo?: ExecutionPolicy['tempo']; caution?: ExecutionPolicy['caution']; autonomy?: ExecutionPolicy['autonomy'] } = {};
  if ('tempo' in value) {
    if (value['tempo'] !== 'METHODICAL' && value['tempo'] !== 'NORMAL' && value['tempo'] !== 'URGENT') throw new SimulationError('INVALID_COMMAND', 'Invalid tempo.');
    result.tempo = value['tempo'];
  }
  if ('caution' in value) {
    if (value['caution'] !== 'STANDARD' && value['caution'] !== 'HIGH' && value['caution'] !== 'MAXIMUM') throw new SimulationError('INVALID_COMMAND', 'Invalid caution.');
    result.caution = value['caution'];
  }
  if ('autonomy' in value) {
    if (value['autonomy'] !== 'RESTRICTED' && value['autonomy'] !== 'ADAPTIVE' && value['autonomy'] !== 'WIDE') throw new SimulationError('INVALID_COMMAND', 'Invalid autonomy.');
    result.autonomy = value['autonomy'];
  }
  return result;
}

export function parseOrder(value: unknown): OrderInput {
  if (!isRecord(value) || !validId(value['id']) || !validId(value['operatorId'])
    || !orderTypes.includes(String(value['type'])) || !isInteger(value['priority'], 0, 100)
    || !Array.isArray(value['dependsOn']) || !value['dependsOn'].every(validId)
    || new Set(value['dependsOn']).size !== value['dependsOn'].length || !isRecord(value['target'])) {
    throw new SimulationError('INVALID_COMMAND', 'Invalid order fields.');
  }
  const target = value['target'];
  let parsedTarget: OrderTarget;
  if (target['kind'] === 'NONE') {
    parsedTarget = { kind: 'NONE' };
  } else if (target['kind'] === 'ENTITY' && validId(target['entityId'])) {
    parsedTarget = { kind: 'ENTITY', entityId: target['entityId'] };
  } else if (target['kind'] === 'POSITION' && isRecord(target['position'])
    && isInteger(target['position']['x'], 0, 99) && isInteger(target['position']['y'], 0, 99)) {
    parsedTarget = { kind: 'POSITION', position: { x: target['position']['x'], y: target['position']['y'] } };
  } else {
    throw new SimulationError('INVALID_COMMAND', 'Invalid order target.');
  }
  const type = value['type'] as OrderType;
  const expected = type === 'WAIT' || type === 'REGROUP' ? 'NONE' : type === 'PROTECT' ? 'ENTITY' : 'POSITION';
  if (parsedTarget.kind !== expected) throw new SimulationError('INVALID_COMMAND', `${type} requires a ${expected} target.`);
  return {
    id: value['id'], operatorId: value['operatorId'], type, target: parsedTarget,
    priority: value['priority'], dependsOn: [...value['dependsOn']], policy: parsePolicy(value['policy']),
  };
}

export function validateOrder(order: OrderInput, state: Snapshot, reserved: readonly OrderInput[]): void {
  const existing = [...state.orders, ...reserved];
  if (!state.operators.some((operator) => operator.id === order.operatorId && operator.operational)) {
    throw new SimulationError('INVALID_COMMAND', 'Order requires an operational operator.');
  }
  if (existing.some((entry) => entry.id === order.id)) throw new SimulationError('INVALID_COMMAND', 'Duplicate order id.');
  if (existing.filter((entry) => entry.operatorId === order.operatorId && (!('status' in entry)
    || !['COMPLETED', 'CANCELLED', 'FAILED'].includes(String(entry.status)))).length >= 5) {
    throw new SimulationError('INVALID_COMMAND', 'An operator may have at most five unfinished orders.');
  }
  if (order.dependsOn.some((id) => !existing.some((entry) => entry.id === id))) {
    throw new SimulationError('INVALID_COMMAND', 'Dependencies must reference previously accepted orders.');
  }
  if (order.target.kind === 'POSITION' && !walkable(state.grid, order.target.position)) {
    throw new SimulationError('INVALID_COMMAND', 'Target must be a walkable grid tile.');
  }
  if (order.target.kind === 'ENTITY') {
    const entityId = order.target.entityId;
    if (!state.intel.some((entry) => entry.entityId === entityId)) throw new SimulationError('INVALID_COMMAND', 'Entity orders require communicated intel.');
  }
}

export function validateWorld(world: WorldDefinition): void {
  if (!isInteger(world.grid.width, 1, 100) || !isInteger(world.grid.height, 1, 100)
    || world.grid.walls.some((position) => !inGrid(world.grid, position))
    || new Set(world.grid.walls.map(positionKey)).size !== world.grid.walls.length) {
    throw new SimulationError('INVALID_CONTENT', 'Invalid map dimensions or walls.');
  }
  const positions = new Set<string>();
  const ids = new Set<string>();
  for (const operator of world.operators) {
    if (!validId(operator.id) || ids.has(operator.id) || positions.has(positionKey(operator.position))
      || !walkable(world.grid, operator.position) || !operator.name || typeof operator.operational !== 'boolean'
      || !isInteger(operator.ammo, 0, 6) || !isInteger(operator.reserveAmmo, 0, 100) || !isInteger(operator.movementProgress, 0, 100)
      || operator.action !== null || operator.recovery !== 'NONE'
      || [operator.stress, operator.fatigue, ...Object.values(operator.attributes), ...Object.values(operator.proficiencies)].some((value) => !isInteger(value, 0, 100))) {
      throw new SimulationError('INVALID_CONTENT', 'Invalid operator, attributes or starting position.');
    }
    parsePolicy(operator.policy);
    ids.add(operator.id);
    positions.add(positionKey(operator.position));
  }
  const policy = parsePolicy(world.policy);
  if (!policy.tempo || !policy.caution || !policy.autonomy) throw new SimulationError('INVALID_CONTENT', 'Mission policy must specify all dimensions.');
  for (const npc of world.npcs) {
    if (!validId(npc.id) || ids.has(npc.id) || !walkable(world.grid, npc.position)
      || !['CIVILIAN', 'UNKNOWN'].includes(npc.identity)
      || !['SEEDED', 'PASSIVE', 'COOPERATIVE', 'NERVOUS', 'FLEEING', 'THREATENING', 'HOSTILE', 'SURRENDERED', 'INCAPACITATED'].includes(npc.behavior)
      || npc.script.some((entry, index) => !isInteger(entry.atTick, 1, 100000) || (index > 0 && entry.atTick <= (npc.script[index - 1]?.atTick ?? 0))
        || !['PASSIVE', 'COOPERATIVE', 'NERVOUS', 'FLEEING', 'THREATENING', 'HOSTILE', 'SURRENDERED', 'INCAPACITATED'].includes(entry.behavior)
        || (entry.position && !walkable(world.grid, entry.position)))) {
      throw new SimulationError('INVALID_CONTENT', 'Invalid NPC definition or script.');
    }
    ids.add(npc.id);
  }
  if (world.mission && (world.mission.id !== 'blackwood' || !walkable(world.grid, world.mission.inspectTarget)
    || !world.npcs.some((npc) => npc.id === world.mission?.civilianId && npc.identity === 'CIVILIAN')
    || !isInteger(world.mission.minOperational, 1, world.operators.length))) {
    throw new SimulationError('INVALID_CONTENT', 'Invalid mission objectives or team safety condition.');
  }
}

const isPosition = (value: unknown): boolean => isRecord(value) && isInteger(value['x'], 0, 99) && isInteger(value['y'], 0, 99);

function isWorldStructure(value: unknown): value is WorldDefinition {
  if (!isRecord(value) || !isRecord(value['grid']) || !isRecord(value['policy'])
    || !isInteger(value['grid']['width'], 1, 100) || !isInteger(value['grid']['height'], 1, 100)
    || !Array.isArray(value['grid']['walls']) || value['grid']['walls'].length > 10000 || !value['grid']['walls'].every(isPosition)
    || !Array.isArray(value['operators']) || value['operators'].length > 10
    || !Array.isArray(value['npcs']) || value['npcs'].length > 10) return false;
  for (const operator of value['operators']) {
    if (!isRecord(operator)) return false;
    const attributes = operator['attributes'];
    const proficiencies = operator['proficiencies'];
    if (!validId(operator['id']) || typeof operator['name'] !== 'string'
      || !isPosition(operator['position']) || !isRecord(operator['policy'])
      || !isRecord(attributes) || !isRecord(proficiencies)
      || !['strength', 'perception', 'coordination', 'judgment', 'resilience'].every((key) => isInteger(attributes[key], 0, 100))
      || !['sidearm', 'carbine', 'precisionRifle'].every((key) => isInteger(proficiencies[key], 0, 100))
      || !isInteger(operator['stress'], 0, 100) || !isInteger(operator['fatigue'], 0, 100)
      || !isInteger(operator['ammo'], 0, 6) || !isInteger(operator['reserveAmmo'], 0, 100)
      || typeof operator['operational'] !== 'boolean' || !isInteger(operator['movementProgress'], 0, 100)
      || operator['action'] !== null || operator['recovery'] !== 'NONE') return false;
  }
  for (const npc of value['npcs']) {
    if (!isRecord(npc) || !validId(npc['id']) || !isPosition(npc['position']) || typeof npc['identity'] !== 'string'
      || typeof npc['behavior'] !== 'string' || !Array.isArray(npc['script']) || npc['script'].length > 1000
      || !npc['script'].every((entry: unknown) => isRecord(entry) && isInteger(entry['atTick'], 1, 100000)
        && typeof entry['behavior'] === 'string' && (!('position' in entry) || isPosition(entry['position'])))) return false;
  }
  const mission = value['mission'];
  return mission === undefined || (isRecord(mission) && mission['id'] === 'blackwood' && isPosition(mission['inspectTarget'])
    && validId(mission['civilianId']) && isInteger(mission['minOperational'], 1, 10));
}

export function parseWorld(value: unknown): WorldDefinition {
  if (!isWorldStructure(value)) throw new SimulationError('INVALID_CONTENT', 'Malformed initial world in replay.');
  validateWorld(value);
  return value;
}
