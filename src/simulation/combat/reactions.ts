import { compareIds } from '../core/determinism';
import { emit } from '../core/events';
import type { AtomicAction, DecisionTrace, ExecutionPolicy, Observation, Operator, ReactionKind, Snapshot } from '../core/types';
import { replaceOperator, unfinished } from '../orders/planner';
import { resolvePolicy } from '../orders/policy';
import { hasLineOfSight, sensingRange } from '../perception/knowledge';
import { distance, walkable } from '../world/grid';

export const REACTION_TICKS: Readonly<Record<ReactionKind, number>> = {
  OBSERVE: 1, WARN: 2, PROTECT: 2, DISENGAGE: 2, RESPOND: 3,
  RELOAD: 4, RECOVER: 3, REPORT: 1, RESUME: 1,
};
export const CAPACITY = 6;
const clamp = (value: number) => Math.max(0, Math.min(100, value));
export const immediateThreat = (behavior: Observation['behavior']): boolean => behavior === 'THREATENING' || behavior === 'HOSTILE';

export function qualifyingThreat(state: Snapshot, operator: Operator, observation: Observation): boolean {
  return immediateThreat(observation.behavior) && observation.level !== 'DETECTED' && observation.level !== 'STALE'
    && observation.observedAt === state.tick && distance(operator.position, observation.position) <= sensingRange(operator)
    && hasLineOfSight(state.grid, operator.position, observation.position);
}

type ResponseDecision = DecisionTrace & Readonly<{
  selected: ReactionKind;
  eligible: readonly Readonly<{ action: ReactionKind; utility: number }>[];
}>;

export function chooseResponse(state: Snapshot, operator: Operator, observation: Observation, policy: ExecutionPolicy): ResponseDecision {
  const eligible: { action: ReactionKind; utility: number }[] = [];
  const rejected: { action: string; reason: string }[] = [];
  const qualifies = qualifyingThreat(state, operator, observation);
  const observations = state.knowledge.find((entry) => entry.operatorId === operator.id)?.observations ?? [];
  const civilianRisk = observations.some((entry) => entry.entityId !== observation.entityId && entry.level !== 'STALE'
    && entry.identity === 'CIVILIAN' && distance(entry.position, observation.position) <= 1);
  const reject = (action: ReactionKind, reason: string) => rejected.push({ action, reason });
  if (!qualifies) reject('RESPOND', 'No qualifying observed current threat; urgency cannot authorize force.');
  else if (civilianRisk) reject('RESPOND', 'Known civilian is inside the abstract response area.');
  else if (operator.ammo === 0) reject('RESPOND', 'No ammunition.');
  else eligible.push({ action: 'RESPOND', utility: (observation.behavior === 'HOSTILE' ? 100 : 55) + Math.floor(operator.attributes.judgment / 10) - Math.floor(operator.stress / 10) });
  if (qualifies && observation.behavior === 'THREATENING') eligible.push({ action: 'WARN', utility: 85 + Math.floor(operator.attributes.judgment / 10) });
  if (qualifies) {
    eligible.push({ action: 'DISENGAGE', utility: policy.caution === 'MAXIMUM' ? 120 : 40 });
    eligible.push({ action: 'PROTECT', utility: policy.autonomy === 'RESTRICTED' ? 110 : 30 });
    if (operator.ammo === 0 && operator.reserveAmmo > 0) eligible.push({ action: 'RELOAD', utility: policy.caution === 'MAXIMUM' ? 90 : 115 });
    if (operator.ammo === 0 && operator.reserveAmmo === 0) {
      reject('RELOAD', 'No reserve ammunition.');
      eligible.push({ action: 'DISENGAGE', utility: 130 });
    }
  } else {
    eligible.push({ action: 'OBSERVE', utility: 10 });
  }
  eligible.sort((a, b) => b.utility - a.utility || compareIds(a.action, b.action));
  const selected = eligible[0]?.action ?? 'OBSERVE';
  return {
    operatorId: operator.id, tick: state.tick, selected,
    reason: `${selected}: observed behavior, safety filter, resources and policy evaluated before utility.`,
    eligible, rejected,
  };
}

function logTrace(state: Snapshot, trace: DecisionTrace): Snapshot {
  return emit({
    ...state,
    traces: [...state.traces.filter((entry) => entry.operatorId !== trace.operatorId), trace].sort((a, b) => compareIds(a.operatorId, b.operatorId)),
  }, { kind: 'DECISION', operatorId: trace.operatorId, action: trace.selected, reason: trace.reason });
}

function begin(state: Snapshot, operator: Operator, kind: ReactionKind, targetId: string | null): Snapshot {
  const action: AtomicAction = { kind, targetId, startedAt: state.tick, endsAt: state.tick + REACTION_TICKS[kind] };
  return emit(replaceOperator(state, { ...operator, action, recovery: 'NONE', movementProgress: 0 }), {
    kind: 'ACTION_STARTED', actorId: operator.id, targetId, action: kind, durationTicks: REACTION_TICKS[kind],
    reason: 'Temporary reaction; original order retained.',
  });
}

function finish(initial: Snapshot, operator: Operator, action: AtomicAction, nextRandom: () => number): Snapshot {
  let state = initial;
  let updated = { ...operator, action: null, recovery: action.kind === 'REPORT' ? 'RESUME' as const : action.kind === 'RESUME' ? 'NONE' as const : 'REPORT' as const };
  let reason = 'Reaction complete; persistent intent preserved.';
  const npc = state.npcs.find((entry) => entry.id === action.targetId);
  const event = (kind: 'WEAPON_FIRE' | 'IMPACT' | 'RELOAD' | 'REACTION' | 'INCAPACITATED', detail: string) => {
    state = emit(state, { kind, actorId: operator.id, targetId: action.targetId, action: action.kind, durationTicks: REACTION_TICKS[action.kind], reason: detail });
  };
  if (action.kind === 'WARN' && npc && immediateThreat(npc.behavior)) {
    const complies = nextRandom() % 100 < 55 + Math.floor(operator.attributes.judgment / 4);
    state = { ...state, npcs: state.npcs.map((entry) => entry.id === npc.id ? { ...entry, behavior: complies ? 'SURRENDERED' : 'HOSTILE' } : entry) };
    event('REACTION', complies ? 'Observed contact surrendered after warning.' : 'Observed contact escalated after warning.');
  }
  if (action.kind === 'RESPOND' && npc) {
    updated = { ...updated, ammo: Math.max(0, operator.ammo - 1), stress: clamp(operator.stress + 8) };
    const penalty = Math.floor(operator.stress * (100 - operator.attributes.resilience) / 250);
    const chance = Math.max(15, Math.min(90, 35 + Math.floor(operator.proficiencies.carbine / 2) + Math.floor(operator.attributes.coordination / 5) - penalty));
    const hit = nextRandom() % 100 < chance;
    event('WEAPON_FIRE', 'Abstract response resolved from a permitted action.');
    event('IMPACT', hit ? 'Abstract response ended the immediate threat.' : 'Abstract response had no incapacitating effect.');
    if (hit) {
      state = { ...state, npcs: state.npcs.map((entry) => entry.id === npc.id ? { ...entry, behavior: 'INCAPACITATED' } : entry) };
      event('INCAPACITATED', 'Contact incapacitated; further force prohibited.');
    }
  }
  if (action.kind === 'RELOAD') {
    const transferred = Math.min(CAPACITY - operator.ammo, operator.reserveAmmo);
    updated = { ...updated, ammo: operator.ammo + transferred, reserveAmmo: operator.reserveAmmo - transferred };
    event('RELOAD', 'Reserve resources transferred into abstract capacity.');
  }
  const known = state.knowledge.find((entry) => entry.operatorId === operator.id)?.observations.find((entry) => entry.entityId === action.targetId);
  if (action.kind === 'DISENGAGE' && known) {
    const choices = [[0, -1], [-1, 0], [1, 0], [0, 1]].map(([dx = 0, dy = 0]) => ({ x: operator.position.x + dx, y: operator.position.y + dy }))
      .filter((position) => walkable(state.grid, position) && !state.operators.some((entry) => entry.id !== operator.id && distance(entry.position, position) === 0)
        && !state.knowledge.find((entry) => entry.operatorId === operator.id)?.observations.some((entry) => distance(entry.position, position) === 0))
      .sort((a, b) => distance(b, known.position) - distance(a, known.position) || a.y - b.y || a.x - b.x);
    const destination = choices[0];
    if (destination && distance(destination, known.position) > distance(operator.position, known.position)) {
      updated = { ...updated, position: destination, fatigue: clamp(operator.fatigue + 1) };
      state = emit(state, { kind: 'MOVED', operatorId: operator.id, position: destination, durationTicks: REACTION_TICKS.DISENGAGE });
    } else reason = 'No safer adjacent tile; holding protection without discarding intent.';
  }
  if (action.kind === 'RECOVER') updated = { ...updated, stress: clamp(operator.stress - 10), fatigue: clamp(operator.fatigue - 5) };
  state = replaceOperator(state, updated);
  return emit(state, { kind: 'ACTION_ENDED', actorId: operator.id, targetId: action.targetId, action: action.kind, durationTicks: REACTION_TICKS[action.kind], reason });
}

export function advanceReactions(initial: Snapshot, nextRandom: () => number): Snapshot {
  let state = initial;
  for (const id of initial.operators.map((entry) => entry.id).sort(compareIds)) {
    const operator = state.operators.find((entry) => entry.id === id);
    if (!operator?.operational) continue;
    const observations = state.knowledge.find((entry) => entry.operatorId === id)?.observations ?? [];
    if (operator.action) {
      const action = operator.action;
      const observation = observations.find((entry) => entry.entityId === action.targetId);
      const actual = state.npcs.find((entry) => entry.id === action.targetId);
      // Revalidate at resolution too: another actor may have ended the threat this tick.
      const policy = resolvePolicy(state.policy, operator.policy, {});
      if (action.kind === 'RESPOND' && (!observation || !chooseResponse(state, operator, observation, policy).eligible.some((entry) => entry.action === 'RESPOND')
        || !actual || !immediateThreat(actual.behavior) || operator.ammo === 0)) {
        state = emit(replaceOperator(state, { ...operator, action: null, recovery: 'REPORT' }), {
          kind: 'ACTION_ENDED', actorId: id, targetId: action.targetId, action: action.kind,
          durationTicks: state.tick - action.startedAt, reason: 'Force cancelled: threat ended, observation lost or resources invalid.',
        });
      } else if (state.tick >= action.endsAt) {
        state = finish(state, operator, action, nextRandom);
      }
      continue;
    }
    const contact = observations.filter((entry) => qualifyingThreat(state, operator, entry))
      .sort((a, b) => Number(b.behavior === 'HOSTILE') - Number(a.behavior === 'HOSTILE') || distance(operator.position, a.position) - distance(operator.position, b.position) || compareIds(a.entityId, b.entityId))[0];
    if (contact) {
      const active = state.orders.find((order) => order.operatorId === id && unfinished(order) && order.status === 'ACTIVE')
        ?? state.orders.filter((order) => order.operatorId === id && unfinished(order)).sort((a, b) => b.priority - a.priority || compareIds(a.id, b.id))[0];
      const policy = resolvePolicy(state.policy, operator.policy, active?.policy ?? {});
      const trace = chooseResponse(state, operator, contact, policy);
      state = logTrace(state, trace);
      state = begin(state, operator, trace.selected, contact.entityId);
    } else if (operator.recovery !== 'NONE') {
      state = begin(state, operator, operator.recovery, null);
    } else if (operator.stress >= 80) {
      state = begin(state, operator, 'RECOVER', null);
    } else if (state.tick % 5 === 0) {
      const recovered = { ...operator, stress: clamp(operator.stress - 1), fatigue: clamp(operator.fatigue - (state.tick % 10 === 0 ? 1 : 0)) };
      state = replaceOperator(state, recovered);
    }
  }
  if (state.tick % 8 === 0) {
    for (const npc of state.npcs.filter((entry) => entry.behavior === 'HOSTILE').sort((a, b) => compareIds(a.id, b.id))) {
      const target = state.operators.filter((entry) => entry.operational && distance(entry.position, npc.position) <= 4 && hasLineOfSight(state.grid, npc.position, entry.position))
        .sort((a, b) => distance(a.position, npc.position) - distance(b.position, npc.position) || compareIds(a.id, b.id))[0];
      if (!target) continue;
      const incapacitated = nextRandom() % 100 < 12;
      state = replaceOperator(state, { ...target, stress: clamp(target.stress + 15), operational: !incapacitated, action: incapacitated ? null : target.action });
      state = emit(state, { kind: incapacitated ? 'INCAPACITATED' : 'REACTION', actorId: npc.id, targetId: target.id, action: 'RESPOND', durationTicks: 8, reason: incapacitated ? 'Operator incapacitated by abstract encounter.' : 'Operator stress increased during abstract encounter.' });
    }
  }
  return state;
}
