import type { ActionEvent, EventData, KnowledgeEvent, Snapshot } from './types';

export function emit(state: Snapshot, data: EventData | KnowledgeEvent | ActionEvent): Snapshot {
  return {
    ...state,
    events: [...state.events, { ...data, id: `event-${state.events.length}`, tick: state.tick }],
  };
}
