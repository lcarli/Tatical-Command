export const ENGINE_VERSION = '0.1.0';
export const CONTENT_VERSION = 'blackwood-0.1.0';
export const PRNG_VERSION = 'xorshift32-v1';

export class SimulationError extends Error {
  constructor(
    public readonly code: 'INVALID_COMMAND' | 'INVALID_CONTENT' | 'VERSION_MISMATCH' | 'REPLAY_MISMATCH',
    message: string,
  ) {
    super(message);
    this.name = 'SimulationError';
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

export function createPrng(seed: number) {
  if (!isInteger(seed, 0, 0xffffffff)) {
    throw new SimulationError('INVALID_CONTENT', 'Seed must be an unsigned 32-bit integer.');
  }
  let state = seed === 0 ? 0x6d2b79f5 : seed;
  return {
    next(): number {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state;
    },
    state: (): number => state,
  };
}

export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry: unknown) => canonical(entry)).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value).sort(compareIds).map(
      (key) => `${JSON.stringify(key)}:${canonical(value[key])}`,
    ).join(',')}}`;
  }
  throw new SimulationError('INVALID_CONTENT', 'State contains a non-serializable value.');
}

export function hash(value: unknown): string {
  let result = 0x811c9dc5;
  const text = canonical(value);
  for (let index = 0; index < text.length; index += 1) {
    result = Math.imul(result ^ text.charCodeAt(index), 0x01000193) >>> 0;
  }
  return result.toString(16).padStart(8, '0');
}

export function immutableCopy<T>(value: T): T {
  const copy: T = JSON.parse(canonical(value));
  const freeze = (entry: unknown): void => {
    if (Array.isArray(entry)) {
      entry.forEach(freeze);
      Object.freeze(entry);
    } else if (isRecord(entry)) {
      Object.values(entry).forEach(freeze);
      Object.freeze(entry);
    }
  };
  freeze(copy);
  return copy;
}
