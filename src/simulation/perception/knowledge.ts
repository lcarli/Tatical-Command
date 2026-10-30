import { compareIds } from '../core/determinism';
import { emit } from '../core/events';
import type { Grid, Observation, Operator, PlayerView, Position, Snapshot } from '../core/types';
import { distance, samePosition } from '../world/grid';

export const STALE_AFTER_TICKS = 10;
export const RADIO_INTERVAL_TICKS = 5;

export function hasLineOfSight(grid: Grid, from: Position, to: Position): boolean {
  const blocked = (x: number, y: number) => grid.walls.some((wall) => wall.x === x && wall.y === y);
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - x);
  const dy = Math.abs(to.y - y);
  const sx = x < to.x ? 1 : -1;
  const sy = y < to.y ? 1 : -1;
  let error = dx - dy;
  while (x !== to.x || y !== to.y) {
    const twice = 2 * error;
    const stepX = twice > -dy;
    const stepY = twice < dx;
    if (stepX && stepY && (blocked(x + sx, y) || blocked(x, y + sy))) return false;
    if (stepX) { error -= dy; x += sx; }
    if (stepY) { error += dx; y += sy; }
    if (blocked(x, y)) return false;
  }
  return true;
}

export function sensingRange(operator: Operator): number {
  return Math.max(2, 3 + Math.floor(operator.attributes.perception / 25) - Math.floor(operator.stress / 50));
}

export function ageObservation(observation: Observation, tick: number): Observation {
  return tick - observation.observedAt >= STALE_AFTER_TICKS ? { ...observation, level: 'STALE' } : observation;
}

function better(a: Observation, b: Observation): Observation {
  return a.observedAt > b.observedAt || (a.observedAt === b.observedAt
    && (a.confidence > b.confidence || (a.confidence === b.confidence && compareIds(a.sourceOperatorId, b.sourceOperatorId) < 0))) ? a : b;
}

export function senseAndCommunicate(initial: Snapshot): Snapshot {
  let state = initial;
  const knowledge = state.operators.map((operator) => {
    const observations = new Map((state.knowledge.find((entry) => entry.operatorId === operator.id)?.observations ?? [])
      .map((observation) => [observation.entityId, ageObservation(observation, state.tick)]));
    if (operator.operational) {
      for (const npc of [...state.npcs].sort((a, b) => compareIds(a.id, b.id))) {
        if (distance(operator.position, npc.position) > sensingRange(operator) || !hasLineOfSight(state.grid, operator.position, npc.position)) continue;
        const previous = observations.get(npc.id);
        const confidence = Math.min(100, (previous?.level === 'STALE' ? 0 : previous?.confidence ?? 0)
          + 15 + Math.floor(operator.attributes.perception / 10));
        const level = confidence >= 80 ? 'IDENTIFIED' : confidence >= 50 ? 'OBSERVED' : 'DETECTED';
        observations.set(npc.id, {
          entityId: npc.id, position: npc.position, level, confidence, observedAt: state.tick,
          sourceOperatorId: operator.id, behavior: confidence >= 50 ? npc.behavior : null,
          identity: confidence >= 80 ? npc.identity : null,
        });
      }
    }
    return { operatorId: operator.id, observations: [...observations.values()].sort((a, b) => compareIds(a.entityId, b.entityId)) };
  });
  let intel = state.intel.map((observation) => ageObservation(observation, state.tick));
  if (state.tick % RADIO_INTERVAL_TICKS === 0) {
    const reports = new Map<string, Observation>();
    for (const entry of knowledge) {
      if (!state.operators.some((operator) => operator.id === entry.operatorId && operator.operational)) continue;
      for (const observation of entry.observations) {
        const existing = reports.get(observation.entityId);
        reports.set(observation.entityId, existing ? better(observation, existing) : observation);
      }
    }
    for (const report of [...reports.values()].sort((a, b) => compareIds(a.entityId, b.entityId))) {
      const previous = intel.find((entry) => entry.entityId === report.entityId);
      if (!previous || report.observedAt >= previous.observedAt) {
        intel = [...intel.filter((entry) => entry.entityId !== report.entityId), report].sort((a, b) => compareIds(a.entityId, b.entityId));
        if (!previous || previous.level !== report.level || previous.behavior !== report.behavior || !samePosition(previous.position, report.position)) {
          state = emit(state, { kind: 'RADIO_REPORT', operatorId: report.sourceOperatorId, entityId: report.entityId, level: report.level, reason: 'Observation communicated; no hidden world identity transmitted.' });
        }
      }
    }
    for (const entry of knowledge) {
      const merged = new Map(entry.observations.map((observation) => [observation.entityId, observation]));
      for (const report of reports.values()) {
        const existing = merged.get(report.entityId);
        merged.set(report.entityId, existing ? better(report, existing) : report);
      }
      entry.observations = [...merged.values()].sort((a, b) => compareIds(a.entityId, b.entityId));
    }
  }
  return { ...state, knowledge, intel };
}

export function playerView(snapshot: Snapshot): PlayerView {
  const { npcs, knowledge, ...visible } = snapshot;
  void npcs;
  void knowledge;
  const reported = (id: string | null): boolean => id === null || snapshot.operators.some((operator) => operator.id === id) || snapshot.intel.some((entry) => entry.entityId === id);
  return {
    ...visible,
    operators: visible.operators.map((operator) => operator.action && !reported(operator.action.targetId)
      ? { ...operator, action: { ...operator.action, targetId: null } } : operator),
    events: visible.events.filter((event) => !('actorId' in event) || (reported(event.actorId) && reported(event.targetId))),
  };
}
