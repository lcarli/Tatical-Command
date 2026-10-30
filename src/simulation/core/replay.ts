import { canonical, CONTENT_VERSION, ENGINE_VERSION, hash, immutableCopy, isInteger, isRecord, PRNG_VERSION, SimulationError } from './determinism';
import { parseCommand, SimulationEngine } from './engine';
import type { CommandRecord, Phase, Snapshot, WorldDefinition } from './types';
import { parseWorld } from '../orders/validation';

export type ReplayData = Readonly<{
  engineVersion: string;
  contentVersion: string;
  prngVersion: string;
  seed: number;
  initialPhase: Phase;
  initialWorld: WorldDefinition;
  commands: readonly CommandRecord[];
  totalSteps: number;
  expectedStateHash: string;
  expectedEventHash: string;
  eventLog: readonly unknown[];
}>;

export function exportReplay(engine: SimulationEngine): ReplayData {
  return immutableCopy({
    engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, prngVersion: PRNG_VERSION,
    seed: engine.snapshot().seed, initialPhase: engine.initialPhase, initialWorld: engine.initialWorld,
    commands: engine.commandLog(), totalSteps: engine.stepCount(),
    expectedStateHash: engine.stateHash(), expectedEventHash: engine.eventHash(), eventLog: engine.eventLog(),
  });
}

export function parseReplay(value: unknown): ReplayData {
  if (!isRecord(value)) throw new SimulationError('INVALID_CONTENT', 'Replay must be a JSON object.');
  if (value['engineVersion'] !== ENGINE_VERSION || value['contentVersion'] !== CONTENT_VERSION || value['prngVersion'] !== PRNG_VERSION) {
    throw new SimulationError('VERSION_MISMATCH', 'Replay engine, content or PRNG version does not match.');
  }
  const initialPhase = value['initialPhase'];
  if (!isInteger(value['seed'], 0, 0xffffffff) || !isInteger(value['totalSteps'], 0, 10000)
    || !Array.isArray(value['commands']) || value['commands'].length > 5000
    || !Array.isArray(value['eventLog']) || value['eventLog'].length > 100000
    || typeof value['expectedStateHash'] !== 'string' || typeof value['expectedEventHash'] !== 'string'
    || (initialPhase !== 'PLANNING' && initialPhase !== 'EXECUTING' && initialPhase !== 'PAUSED' && initialPhase !== 'COMPLETED' && initialPhase !== 'FAILED')) {
    throw new SimulationError('INVALID_CONTENT', 'Replay metadata is malformed or exceeds prototype limits.');
  }
  const totalSteps = value['totalSteps'];
  let previousStep = -1;
  const commands: CommandRecord[] = value['commands'].map((entry: unknown) => {
    if (!isRecord(entry) || !isInteger(entry['submittedAtTick'], 0, 100000)
      || !isInteger(entry['submittedAtStep'], 0, totalSteps) || entry['submittedAtStep'] < previousStep) {
      throw new SimulationError('INVALID_CONTENT', 'Replay command submission order is invalid.');
    }
    previousStep = entry['submittedAtStep'];
    return { submittedAtTick: entry['submittedAtTick'], submittedAtStep: entry['submittedAtStep'], command: parseCommand(entry['command']) };
  });
  if (hash(value['eventLog']) !== value['expectedEventHash']) throw new SimulationError('REPLAY_MISMATCH', 'Replay event log does not match its recorded hash.');
  return immutableCopy({
    engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, prngVersion: PRNG_VERSION,
    seed: value['seed'], initialPhase, totalSteps, initialWorld: parseWorld(value['initialWorld']),
    expectedStateHash: value['expectedStateHash'], expectedEventHash: value['expectedEventHash'], commands, eventLog: value['eventLog'],
  });
}

export class ReplayPlayer {
  readonly data: ReplayData;
  readonly engine: SimulationEngine;
  private cursor = 0;
  private commandCursor = 0;
  verified = false;

  constructor(value: unknown) {
    this.data = parseReplay(value);
    this.engine = new SimulationEngine(this.data.seed, this.data.initialPhase, this.data.initialWorld);
    if (this.data.totalSteps === 0) this.finish();
  }

  get position(): number { return this.cursor; }
  get done(): boolean { return this.verified; }

  step(): Snapshot {
    if (this.verified) return this.engine.snapshot();
    this.submitAtCursor();
    this.engine.step();
    this.cursor += 1;
    if (this.cursor === this.data.totalSteps) this.finish();
    return this.engine.snapshot();
  }

  private submitAtCursor(): void {
    const records: CommandRecord[] = [];
    while (this.data.commands[this.commandCursor]?.submittedAtStep === this.cursor) {
      const record = this.data.commands[this.commandCursor];
      if (!record) break;
      if (record.submittedAtTick !== this.engine.snapshot().tick) throw new SimulationError('REPLAY_MISMATCH', 'Replay logical tick diverged before command submission.');
      records.push(record);
      this.commandCursor += 1;
    }
    this.engine.dispatchBatch(records.map((record) => record.command));
  }

  private finish(): void {
    this.submitAtCursor();
    if (this.commandCursor !== this.data.commands.length || this.engine.stateHash() !== this.data.expectedStateHash
      || this.engine.eventHash() !== this.data.expectedEventHash || canonical(this.engine.eventLog()) !== canonical(this.data.eventLog)) {
      throw new SimulationError('REPLAY_MISMATCH', 'Replayed state/events do not match the recorded run.');
    }
    this.verified = true;
  }
}
