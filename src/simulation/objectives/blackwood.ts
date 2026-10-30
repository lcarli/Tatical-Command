import { emit } from '../core/events';
import type { MissionDefinition, Snapshot } from '../core/types';
import { unfinished } from '../orders/planner';
import { resolvePolicy } from '../orders/policy';
import { distance, samePosition } from '../world/grid';

export const SAFEGUARD_TICKS = 3;

function endMission(state: Snapshot, phase: 'COMPLETED' | 'FAILED', reason: string): Snapshot {
  if (!state.mission) return state;
  state = { ...state, phase, mission: { ...state.mission, pendingDecision: null, outcomeReason: reason } };
  state = emit(state, { kind: 'MISSION_UPDATE', reason });
  return emit(state, { kind: 'PHASE_CHANGED', phase });
}

export function evaluateMission(initial: Snapshot, definition: MissionDefinition | undefined): Snapshot {
  if (!definition || !initial.mission) return initial;
  let state = initial;
  const progress = initial.mission;
  if (state.operators.filter((operator) => operator.operational).length < definition.minOperational) {
    return endMission(state, 'FAILED', 'Fewer than two team members remain operational.');
  }
  const civilian = state.npcs.find((npc) => npc.id === definition.civilianId);
  if (!civilian || civilian.behavior === 'INCAPACITATED') return endMission(state, 'FAILED', 'The civilian could not be safeguarded.');
  const inspected = progress.inspected || state.orders.some((order) => order.type === 'INSPECT' && order.status === 'COMPLETED'
    && order.target.kind === 'POSITION' && samePosition(order.target.position, definition.inspectTarget));
  const protectedNow = state.operators.some((operator) => operator.operational && distance(operator.position, civilian.position) <= 1
    && state.knowledge.find((entry) => entry.operatorId === operator.id)?.observations.some((observation) => observation.entityId === civilian.id
      && observation.level === 'IDENTIFIED' && observation.identity === 'CIVILIAN' && observation.observedAt === state.tick
      && observation.behavior !== 'HOSTILE' && observation.behavior !== 'THREATENING' && observation.behavior !== 'INCAPACITATED'));
  const safeguardProgress = protectedNow ? Math.min(SAFEGUARD_TICKS, progress.safeguardProgress + 1) : 0;
  const safeguarded = safeguardProgress >= SAFEGUARD_TICKS;
  state = { ...state, mission: { ...progress, inspected, safeguarded, safeguardProgress } };
  if (inspected !== progress.inspected) state = emit(state, { kind: 'MISSION_UPDATE', reason: 'Objective A complete: target area inspected.' });
  if (safeguarded !== progress.safeguarded) state = emit(state, { kind: 'MISSION_UPDATE', reason: safeguarded ? 'Objective B secured: identified civilian under nearby protection.' : 'Civilian protection lost; objective B must be secured again.' });
  if (inspected && safeguarded) return endMission(state, 'COMPLETED', 'Target area inspected, civilian safeguarded, team safety condition satisfied.');

  const unfinishedOrders = state.orders.filter(unfinished);
  const blocked = unfinishedOrders.length > 0 && unfinishedOrders.every((order) => order.status === 'BLOCKED')
    && state.operators.every((operator) => operator.action === null && operator.recovery === 'NONE');
  const criticalIntel = state.intel.some((observation) => observation.entityId === civilian.id && observation.level === 'IDENTIFIED') && !inspected;
  if (!progress.criticalPauseUsed && (blocked || criticalIntel)) {
    const wide = !blocked && unfinishedOrders.some((order) => {
      const operator = state.operators.find((entry) => entry.id === order.operatorId);
      return operator && resolvePolicy(state.policy, operator.policy, order.policy).autonomy === 'WIDE';
    });
    const decision = {
      id: 'blackwood-decision', kind: blocked ? 'BLOCKED_PLAN' as const : 'INTEL_CONFLICT' as const,
      reason: blocked ? 'All remaining intents are blocked without an available route.' : 'Civilian location confirmed while the inspection objective remains outstanding.',
      choices: ['Continue current plan', 'Prioritize civilian and replan'],
      tick: state.tick,
    };
    if (state.mission) state = { ...state, mission: { ...state.mission, criticalPauseUsed: true, pendingDecision: wide ? null : decision } };
    state = emit(state, { kind: 'DECISION_POINT', decision, reason: wide ? 'Wide autonomy: continue the existing plan without interrupting command.' : decision.reason });
    if (!wide) {
      state = { ...state, phase: 'PAUSED' };
      return emit(state, { kind: 'PHASE_CHANGED', phase: 'PAUSED' });
    }
  }
  if (blocked && progress.criticalPauseUsed) return endMission(state, 'FAILED', 'Plan remains blocked after the command decision; reroute was required.');
  if (state.orders.length === 0 || (unfinishedOrders.length === 0 && !protectedNow)) {
    return endMission(state, 'FAILED', 'Assigned intents ended before both mission objectives were achieved.');
  }
  if (unfinishedOrders.length === 0 && protectedNow && !inspected) {
    return endMission(state, 'FAILED', 'Civilian reached, but no remaining intent inspects the target area.');
  }
  return state;
}
