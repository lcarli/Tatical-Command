import { describe, expect, it } from 'vitest';
import { contactTexture } from '../../src/game/characterArt';
import type { Observation } from '../../src/simulation/core/types';

const observation: Observation = {
  entityId: 'contact', position: { x: 3, y: 3 }, level: 'IDENTIFIED',
  identity: 'CIVILIAN', behavior: 'COOPERATIVE', confidence: 100,
  observedAt: 5, sourceOperatorId: 'bravo-1',
};

describe('player-visible contact artwork', () => {
  it('shows civilian artwork only for current identified civilian intel', () => {
    expect(contactTexture(observation)).toBe('civilian-idle');
    for (const level of ['DETECTED', 'OBSERVED', 'STALE'] as const) {
      expect(contactTexture({ ...observation, level })).toBeNull();
    }
    for (const identity of ['UNKNOWN', null] as const) {
      expect(contactTexture({ ...observation, identity })).toBeNull();
    }
  });
});
