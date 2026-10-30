import { compareIds } from '../core/determinism';
import { emit } from '../core/events';
import type { Operator, OrderStatus, Position, Snapshot, TacticalOrder } from '../core/types';
import { distance, findPath, walkable } from '../world/grid';
import { ACTION_TICKS, movementTicks, resolvePolicy } from './policy';

export const unfinished = (order: TacticalOrder): boolean => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(order.status);

export function changeOrder(state: Snapshot, order: TacticalOrder, status: OrderStatus, reason: string): Snapshot {
  if (order.status === status) return state;
  return emit({
    ...state,
    orders: state.orders.map((entry) => entry.id === order.id ? { ...entry, status } : entry),
  }, { kind: 'ORDER_CHANGED', orderId: order.id, operatorId: order.operatorId, status, reason });
}

export function traceDecision(state: Snapshot, operatorId: string, selected: string, reason: string, utility: number): Snapshot {
  const previous = state.traces.find((trace) => trace.operatorId === operatorId);
  if (previous?.selected === selected && previous.reason === reason) return state;
  const trace = { operatorId, tick: state.tick, selected, reason, eligible: [{ action: selected, utility }], rejected: [] };
  return emit({ ...state, traces: [...state.traces.filter((entry) => entry.operatorId !== operatorId), trace].sort((a, b) => compareIds(a.operatorId, b.operatorId)) },
    { kind: 'DECISION', operatorId, action: selected, reason });
}

export function replaceOperator(state: Snapshot, operator: Operator): Snapshot {
  return { ...state, operators: state.operators.map((entry) => entry.id === operator.id ? operator : entry) };
}

function occupiedPositions(state: Snapshot, operatorId: string): readonly Position[] {
  const knownContacts = state.knowledge.find((entry) => entry.operatorId === operatorId)?.observations
    .filter((entry) => entry.level !== 'STALE').map((entry) => entry.position) ?? [];
  return [...state.operators.filter((entry) => entry.id !== operatorId).map((entry) => entry.position), ...knownContacts];
}

function approachPosition(state: Snapshot, operator: Operator, target: Position): Position | undefined {
  if (distance(operator.position, target) <= 1) return operator.position;
  const occupied = occupiedPositions(state, operator.id);
  return [[0, -1], [-1, 0], [1, 0], [0, 1]]
    .map(([dx = 0, dy = 0]) => ({ x: target.x + dx, y: target.y + dy }))
    .filter((position) => walkable(state.grid, position) && !occupied.some((entry) => distance(entry, position) === 0))
    .map((position) => ({ position, path: findPath(state.grid, operator.position, position, occupied) }))
    .filter((option) => option.path !== null)
    .sort((a, b) => (a.path?.length ?? 0) - (b.path?.length ?? 0) || a.position.y - b.position.y || a.position.x - b.position.x)[0]?.position;
}

export function advanceOrders(initial: Snapshot): Snapshot {
  let state = initial;
  for (const id of initial.operators.map((operator) => operator.id).sort(compareIds)) {
    const operator = state.operators.find((entry) => entry.id === id);
    if (!operator) continue;
    if (!operator.operational) {
      for (const order of state.orders.filter((entry) => entry.operatorId === id && unfinished(entry))) {
        state = changeOrder(state, order, 'FAILED', 'Assigned operator is incapacitated.');
      }
      continue;
    }
    if (operator.action || operator.recovery !== 'NONE') continue;
    const orders = state.orders.filter((order) => order.operatorId === id && unfinished(order));
    for (const order of orders) {
      if (order.dependsOn.some((dependency) => state.orders.some((entry) => entry.id === dependency && ['FAILED', 'CANCELLED'].includes(entry.status)))) {
        state = changeOrder(state, order, 'FAILED', 'A required order failed or was cancelled.');
      }
    }
    const eligible = state.orders.filter((order) => order.operatorId === id && unfinished(order)
      && order.dependsOn.every((dependency) => state.orders.some((entry) => entry.id === dependency && entry.status === 'COMPLETED')));
    eligible.sort((a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') || b.priority - a.priority || compareIds(a.id, b.id));
    const order = eligible[0];
    if (!order) continue;
    const policy = resolvePolicy(state.policy, operator.policy, order.policy);
    let target: Position | undefined;
    if (order.target.kind === 'POSITION') target = order.target.position;
    const leader = state.operators.find((entry) => entry.id === 'bravo-1' && entry.operational);
    if (order.type === 'REGROUP' && leader) target = approachPosition(state, operator, leader.position);
    if (order.type === 'PROTECT') {
      const observation = state.knowledge.find((entry) => entry.operatorId === id)?.observations.find(
        (entry) => order.target.kind === 'ENTITY' && entry.entityId === order.target.entityId,
      );
      if (!observation || observation.level !== 'IDENTIFIED' || observation.behavior === 'THREATENING'
        || observation.behavior === 'HOSTILE' || observation.behavior === 'INCAPACITATED') {
        state = changeOrder(state, order, 'BLOCKED', 'Requires current identified, non-threatening contact.');
        continue;
      }
      if (distance(operator.position, observation.position) <= 1) {
        state = changeOrder(state, order, 'COMPLETED', 'Reached and safeguarded identified contact.');
        state = traceDecision(state, id, 'PROTECT', 'Known contact reached without force.', order.priority);
        continue;
      }
      target = approachPosition(state, operator, observation.position);
    }
    const reached = order.type === 'WAIT' || (order.type === 'REGROUP'
      ? leader && distance(operator.position, leader.position) <= 1
      : target && distance(operator.position, target) === 0);
    if (reached) {
      const required = order.type === 'WAIT' ? ACTION_TICKS.WAIT : order.type === 'INSPECT' || order.type === 'INTERACT' ? ACTION_TICKS[order.type] : 0;
      const progress = order.progress + 1;
      state = { ...state, orders: state.orders.map((entry) => entry.id === order.id ? { ...entry, progress } : entry) };
      state = traceDecision(state, id, order.type, `Executing ${order.type.toLowerCase()} intent.`, order.priority);
      state = changeOrder(state, order, progress >= required ? 'COMPLETED' : 'ACTIVE', progress >= required ? 'Intent fulfilled.' : 'Timed action in progress.');
      continue;
    }
    if (!target) {
      state = changeOrder(state, order, 'BLOCKED', 'No reachable known target.');
      continue;
    }
    const path = findPath(state.grid, operator.position, target, occupiedPositions(state, id));
    const next = path?.[0];
    if (!next) {
      state = changeOrder(state, order, 'BLOCKED', 'No available path; waiting for a valid route.');
      continue;
    }
    state = changeOrder(state, order, 'ACTIVE', 'A valid route is available.');
    state = traceDecision(state, id, 'MOVE', `${policy.tempo.toLowerCase()} movement toward ${order.type.toLowerCase()} intent.`, order.priority);
    const durationTicks = movementTicks(policy, operator);
    const movementProgress = operator.movementProgress + 1;
    if (movementProgress >= durationTicks) {
      // Physics prevents overlap even before a contact has been identified.
      if (state.npcs.some((npc) => distance(npc.position, next) === 0)) {
        state = changeOrder(state, order, 'BLOCKED', 'Movement obstructed at the next tile; intent retained.');
        continue;
      }
      state = replaceOperator(state, { ...operator, position: next, movementProgress: 0, fatigue: Math.min(100, operator.fatigue + (policy.tempo === 'URGENT' ? 2 : 1)) });
      state = emit(state, { kind: 'MOVED', operatorId: id, position: next, durationTicks });
    } else {
      state = replaceOperator(state, { ...operator, movementProgress });
    }
  }
  return state;
}
