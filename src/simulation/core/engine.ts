import { compareIds, canonical, CONTENT_VERSION, createPrng, ENGINE_VERSION, hash, immutableCopy, isInteger, isRecord, PRNG_VERSION, SimulationError } from './determinism';
import type { CommandRecord, Phase, SimulationCommand, SimulationEvent, Snapshot, WorldDefinition } from './types';
import { DEFAULT_POLICY } from '../orders/policy';
import { parseOrder, validateOrder, validateWorld, validId } from '../orders/validation';
import { advanceOrders, changeOrder, unfinished } from '../orders/planner';
import { emit } from './events';
import { advanceNpcs } from '../world/npcs';
import { senseAndCommunicate } from '../perception/knowledge';
import { advanceReactions } from '../combat/reactions';
import { evaluateMission } from '../objectives/blackwood';

export const SIMULATION_TICK_MS = 100;

export function parseCommand(value: unknown): SimulationCommand {
  if (!isRecord(value) || typeof value['id'] !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value['id'])
    || !isInteger(value['issuedAtTick'], 0, Number.MAX_SAFE_INTEGER)
    || !['PAUSE', 'RESUME', 'ISSUE_ORDER', 'CANCEL_ORDER'].includes(String(value['type']))) {
    throw new SimulationError('INVALID_COMMAND', 'Expected a valid command id, logical tick and command type.');
  }
  const base = { id: value['id'], issuedAtTick: value['issuedAtTick'] };
  if (value['type'] === 'ISSUE_ORDER') return { ...base, type: 'ISSUE_ORDER', order: parseOrder(value['order']) };
  if (value['type'] === 'CANCEL_ORDER' && validId(value['orderId'])) return { ...base, type: 'CANCEL_ORDER', orderId: value['orderId'] };
  if (value['type'] === 'PAUSE' || value['type'] === 'RESUME') return { ...base, type: value['type'] };
  throw new SimulationError('INVALID_COMMAND', 'Cancellation requires a valid order id.');
}

export class SimulationEngine {
  private state: Snapshot;
  private readonly random;
  private pending: SimulationCommand[] = [];
  private records: CommandRecord[] = [];
  private commandIds = new Set<string>();
  private steps = 0;
  readonly initialWorld: WorldDefinition;
  readonly initialPhase: Phase;

  constructor(seed: number, initialPhase: Phase = 'PLANNING', world: WorldDefinition = {
    grid: { width: 10, height: 10, walls: [] }, operators: [], policy: DEFAULT_POLICY, npcs: [],
  }) {
    validateWorld(world);
    const definition = immutableCopy(world);
    this.initialWorld = definition;
    this.initialPhase = initialPhase;
    this.random = createPrng(seed);
    this.state = {
      schemaVersion: 1, tick: 0, phase: initialPhase, seed,
      grid: definition.grid, operators: definition.operators, policy: definition.policy,
      npcs: [...definition.npcs].sort((a, b) => compareIds(a.id, b.id)).map((npc) => ({
        ...npc, behavior: npc.behavior === 'SEEDED' ? (['PASSIVE', 'NERVOUS', 'COOPERATIVE'] as const)[this.random.next() % 3]! : npc.behavior,
      })),
      knowledge: definition.operators.map((operator) => ({ operatorId: operator.id, observations: [] })),
      intel: [], events: [], orders: [], traces: [],
      mission: definition.mission ? { inspected: false, safeguarded: false, safeguardProgress: 0, criticalPauseUsed: false, pendingDecision: null, outcomeReason: null } : null,
    };
  }

  dispatch(value: unknown): void {
    const command = parseCommand(value);
    if (this.terminal() || command.issuedAtTick < this.state.tick || this.commandIds.has(command.id)) {
      throw new SimulationError('INVALID_COMMAND', 'Mission ended, command is in the past, or id is duplicated.');
    }
    if (this.state.phase !== 'EXECUTING' && command.issuedAtTick !== this.state.tick) {
      throw new SimulationError('INVALID_COMMAND', 'Commands submitted while stopped must target the current tick.');
    }
    const reserved = this.pending.flatMap((entry) => entry.type === 'ISSUE_ORDER' ? [entry.order] : []);
    if (command.type === 'ISSUE_ORDER') validateOrder(command.order, this.state, reserved);
    if (command.type === 'CANCEL_ORDER') {
      const available = this.state.orders.some((order) => order.id === command.orderId && unfinished(order))
        || this.pending.some((entry) => entry.type === 'ISSUE_ORDER' && entry.order.id === command.orderId
          && (entry.issuedAtTick < command.issuedAtTick || (entry.issuedAtTick === command.issuedAtTick && compareIds(entry.id, command.id) < 0)));
      if (!available) throw new SimulationError('INVALID_COMMAND', 'Cancellation requires an unfinished order available at its scheduled tick.');
    }
    this.commandIds.add(command.id);
    this.pending.push(command);
    this.pending.sort((a, b) => a.issuedAtTick - b.issuedAtTick || compareIds(a.id, b.id));
    this.records.push({ submittedAtTick: this.state.tick, submittedAtStep: this.steps, command });
  }

  dispatchBatch(values: readonly unknown[]): void {
    const pending = [...this.pending];
    const records = [...this.records];
    const commandIds = new Set(this.commandIds);
    try {
      for (const value of values) this.dispatch(value);
    } catch (error) {
      this.pending = pending;
      this.records = records;
      this.commandIds = commandIds;
      throw error;
    }
  }

  step(): Snapshot {
    if (this.terminal()) return this.snapshot();
    this.steps += 1;
    const due = this.pending.filter((command) => command.issuedAtTick === this.state.tick);
    this.pending = this.pending.filter((command) => command.issuedAtTick > this.state.tick);
    for (const command of due) {
      if (command.type === 'ISSUE_ORDER') {
        this.state = emit({
          ...this.state,
          orders: [...this.state.orders, { ...command.order, status: 'QUEUED', progress: 0 }],
        }, { kind: 'ORDER_CHANGED', orderId: command.order.id, operatorId: command.order.operatorId, status: 'QUEUED', reason: 'Validated order accepted.' });
        continue;
      }
      if (command.type === 'CANCEL_ORDER') {
        const order = this.state.orders.find((entry) => entry.id === command.orderId);
        if (order && unfinished(order)) this.state = changeOrder(this.state, order, 'CANCELLED', 'Cancelled by command.');
        continue;
      }
      const phase = command.type === 'PAUSE' ? 'PAUSED' : 'EXECUTING';
      if (command.type === 'RESUME' && this.state.mission?.pendingDecision) {
        this.state = emit({
          ...this.state, mission: { ...this.state.mission, pendingDecision: null },
        }, { kind: 'MISSION_UPDATE', reason: 'Command resumed after reviewing the critical decision.' });
      }
      if (phase !== this.state.phase) {
        this.state = { ...this.state, phase };
        this.emitPhase();
      }
    }
    if (this.state.phase === 'EXECUTING') {
      this.state = { ...this.state, tick: this.state.tick + 1 };
      this.state = advanceNpcs(this.state);
      this.state = senseAndCommunicate(this.state);
      this.state = advanceReactions(this.state, () => this.random.next());
      this.state = advanceOrders(this.state);
      this.state = evaluateMission(this.state, this.initialWorld.mission);
    }
    return this.snapshot();
  }

  snapshot(): Snapshot {
    return immutableCopy(this.state);
  }

  eventLog(): readonly SimulationEvent[] {
    return this.snapshot().events;
  }

  commandLog(): readonly CommandRecord[] {
    return immutableCopy(this.records);
  }

  stepCount(): number {
    return this.steps;
  }

  serialize(): string {
    return canonical({
      engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, prngVersion: PRNG_VERSION,
      state: this.state, prngState: this.random.state(), pending: this.pending,
      missionDefinition: this.initialWorld.mission ?? null,
      commandIds: [...this.commandIds].sort(compareIds),
    });
  }

  stateHash(): string {
    return hash(JSON.parse(this.serialize()));
  }

  eventHash(): string {
    return hash(this.state.events);
  }

  private terminal(): boolean {
    return this.state.phase === 'COMPLETED' || this.state.phase === 'FAILED';
  }

  private emitPhase(): void {
    const event: SimulationEvent = {
      id: `event-${this.state.events.length}`, tick: this.state.tick,
      kind: 'PHASE_CHANGED', phase: this.state.phase,
    };
    this.state = { ...this.state, events: [...this.state.events, event] };
  }
}
