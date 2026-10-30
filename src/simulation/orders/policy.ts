import type { ExecutionPolicy, Operator } from '../core/types';

export const DEFAULT_POLICY: ExecutionPolicy = { tempo: 'NORMAL', caution: 'STANDARD', autonomy: 'ADAPTIVE' };
export const ACTION_TICKS = { WAIT: 5, INSPECT: 3, INTERACT: 3 } as const;

export function resolvePolicy(mission: ExecutionPolicy, team: Partial<ExecutionPolicy>, order: Partial<ExecutionPolicy>): ExecutionPolicy {
  return { ...mission, ...team, ...order };
}

export function movementTicks(policy: ExecutionPolicy, operator: Operator): number {
  const tempo = { METHODICAL: 3, NORMAL: 2, URGENT: 1 }[policy.tempo];
  return tempo + (policy.caution === 'MAXIMUM' ? 1 : 0) + (operator.fatigue >= 80 ? 1 : 0);
}
