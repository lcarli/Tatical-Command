import type { Observation } from '../simulation/core/types';

export const CHARACTER_TEXTURES: Readonly<Record<string, string>> = {
  'bravo-1': 'bravo-1-idle',
  'bravo-2': 'bravo-2-idle',
  'bravo-3': 'bravo-3-idle',
};

// Identity artwork must never reveal more than current player-visible intel.
export function contactTexture(intel: Observation): string | null {
  return intel.level === 'IDENTIFIED' && intel.identity === 'CIVILIAN'
    ? 'civilian-idle' : null;
}
