import { describe, expect, it } from 'vitest';
import { SIMULATION_TICK_MS } from '../../src/simulation';

describe('headless simulation entry', () => {
  it('imports under Node without browser globals and exposes the fixed tick', () => {
    expect('window' in globalThis).toBe(false);
    expect('document' in globalThis).toBe(false);
    expect(SIMULATION_TICK_MS).toBe(100);
  });
});
