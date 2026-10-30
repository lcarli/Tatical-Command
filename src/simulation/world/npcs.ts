import type { Snapshot } from '../core/types';

export function advanceNpcs(state: Snapshot): Snapshot {
  return {
    ...state,
    npcs: state.npcs.map((npc) => {
      if (npc.behavior === 'INCAPACITATED' || npc.behavior === 'SURRENDERED') return npc;
      const change = npc.script.find((entry) => entry.atTick === state.tick);
      return change ? { ...npc, behavior: change.behavior, position: change.position ?? npc.position } : npc;
    }),
  };
}
