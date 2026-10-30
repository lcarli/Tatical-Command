import { blackwoodWorld, SEARCH_ROOM, TARGET_ROOM } from '../content/missions/blackwood';
import { SimulationEngine, SimulationError } from '../simulation';
import type { Autonomy, Caution, OrderInput, PlayerView, SimulationCommand, Tempo, WorldDefinition } from '../simulation/core/types';
import { unfinished } from '../simulation/orders/planner';
import { playerView } from '../simulation/perception/knowledge';

export class GameSession {
  readonly engine: SimulationEngine;
  private sequence = 0;

  constructor(readonly seed = 42, world: WorldDefinition = blackwoodWorld()) {
    this.engine = new SimulationEngine(seed, 'PLANNING', world);
  }

  nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${String(this.sequence).padStart(6, '0')}`;
  }

  view(): PlayerView {
    return playerView(this.engine.snapshot());
  }

  issue(order: Omit<OrderInput, 'id'>): void {
    this.issueMany([order]);
  }

  issueMany(orders: readonly Omit<OrderInput, 'id'>[]): void {
    const stopped = this.view().phase !== 'EXECUTING';
    this.engine.dispatchBatch(orders.map((order) => ({
      id: this.nextId('command'), issuedAtTick: this.view().tick, type: 'ISSUE_ORDER',
      order: { ...order, id: this.nextId('order') },
    })));
    if (stopped) this.engine.step();
  }

  control(type: 'PAUSE' | 'RESUME'): void {
    this.send({ id: this.nextId('command'), issuedAtTick: this.view().tick, type });
  }

  cancel(orderId: string): void {
    this.send({ id: this.nextId('command'), issuedAtTick: this.view().tick, type: 'CANCEL_ORDER', orderId });
  }

  initialPlan(autonomy: Autonomy, tempo: Tempo, caution: Caution = 'STANDARD'): void {
    if (this.view().phase !== 'PLANNING' || this.view().orders.length > 0) {
      throw new SimulationError('INVALID_COMMAND', 'Sample plan is available only before any orders are queued.');
    }
    this.issueMany([
      { operatorId: 'bravo-1', type: 'INSPECT', target: { kind: 'POSITION', position: TARGET_ROOM }, priority: 60, dependsOn: [], policy: { autonomy, tempo, caution } },
      { operatorId: 'bravo-2', type: 'INSPECT', target: { kind: 'POSITION', position: SEARCH_ROOM }, priority: 70, dependsOn: [], policy: { autonomy, tempo, caution } },
      { operatorId: 'bravo-3', type: 'MOVE', target: { kind: 'POSITION', position: { x: 3, y: 6 } }, priority: 40, dependsOn: [], policy: { autonomy, tempo, caution } },
    ]);
  }

  prioritizeCivilian(): void {
    const state = this.view();
    const observation = state.intel.find((entry) => entry.identity === 'CIVILIAN' && entry.level === 'IDENTIFIED');
    const protector = state.operators.find((entry) => entry.id === observation?.sourceOperatorId && entry.operational);
    if (state.phase !== 'PAUSED' || !observation || !protector) throw new SimulationError('INVALID_COMMAND', 'A paused mission and an identified civilian report are required.');
    for (const order of state.orders.filter((entry) => entry.operatorId === protector.id && unfinished(entry))) this.cancel(order.id);
    this.issue({
      operatorId: protector.id, type: 'PROTECT', target: { kind: 'ENTITY', entityId: observation.entityId },
      priority: 100, dependsOn: [], policy: { tempo: 'URGENT', caution: 'HIGH', autonomy: 'ADAPTIVE' },
    });
    this.control('RESUME');
  }

  advance(): PlayerView {
    this.engine.step();
    return this.view();
  }

  private send(command: SimulationCommand): void {
    const stopped = this.view().phase !== 'EXECUTING';
    this.engine.dispatch(command);
    if (stopped) this.engine.step();
  }
}
