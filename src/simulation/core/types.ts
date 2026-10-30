export type Phase = 'PLANNING' | 'EXECUTING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
export type Position = Readonly<{ x: number; y: number }>;
export type Grid = Readonly<{
  width: number;
  height: number;
  walls: readonly Position[];
}>;
export type ControlCommand = Readonly<{
  id: string;
  issuedAtTick: number;
  type: 'PAUSE' | 'RESUME';
}>;
export type Tempo = 'METHODICAL' | 'NORMAL' | 'URGENT';
export type Caution = 'STANDARD' | 'HIGH' | 'MAXIMUM';
export type Autonomy = 'RESTRICTED' | 'ADAPTIVE' | 'WIDE';
export type ExecutionPolicy = Readonly<{ tempo: Tempo; caution: Caution; autonomy: Autonomy }>;
export type OrderType = 'MOVE' | 'INSPECT' | 'PROTECT' | 'INTERACT' | 'WAIT' | 'REGROUP';
export type OrderStatus = 'QUEUED' | 'ACTIVE' | 'BLOCKED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type OrderTarget =
  | Readonly<{ kind: 'POSITION'; position: Position }>
  | Readonly<{ kind: 'ENTITY'; entityId: string }>
  | Readonly<{ kind: 'NONE' }>;
export type OrderInput = Readonly<{
  id: string;
  operatorId: string;
  type: OrderType;
  target: OrderTarget;
  priority: number;
  dependsOn: readonly string[];
  policy: Partial<ExecutionPolicy>;
}>;
export type TacticalOrder = OrderInput & Readonly<{
  status: OrderStatus;
  progress: number;
}>;
export type Operator = Readonly<{
  id: string;
  name: string;
  position: Position;
  attributes: Readonly<{
    strength: number; perception: number; coordination: number; judgment: number; resilience: number;
  }>;
  proficiencies: Readonly<{ sidearm: number; carbine: number; precisionRifle: number }>;
  stress: number;
  fatigue: number;
  ammo: number;
  reserveAmmo: number;
  action: AtomicAction | null;
  recovery: 'NONE' | 'REPORT' | 'RESUME';
  operational: boolean;
  movementProgress: number;
  policy: Partial<ExecutionPolicy>;
}>;
export type ReactionKind = 'OBSERVE' | 'WARN' | 'PROTECT' | 'DISENGAGE' | 'RESPOND' | 'RELOAD' | 'RECOVER' | 'REPORT' | 'RESUME';
export type AtomicAction = Readonly<{ kind: ReactionKind; targetId: string | null; startedAt: number; endsAt: number }>;
export type DecisionTrace = Readonly<{
  operatorId: string;
  tick: number;
  selected: string;
  reason: string;
  eligible: readonly Readonly<{ action: string; utility: number }>[];
  rejected: readonly Readonly<{ action: string; reason: string }>[];
}>;
export type WorldDefinition = Readonly<{
  grid: Grid;
  operators: readonly Operator[];
  policy: ExecutionPolicy;
  npcs: readonly NpcDefinition[];
  mission?: MissionDefinition;
}>;
export type MissionDefinition = Readonly<{
  id: 'blackwood';
  inspectTarget: Position;
  civilianId: string;
  minOperational: number;
}>;
export type DecisionPoint = Readonly<{
  id: string;
  kind: 'INTEL_CONFLICT' | 'BLOCKED_PLAN';
  reason: string;
  choices: readonly string[];
  tick: number;
}>;
export type MissionProgress = Readonly<{
  inspected: boolean;
  safeguarded: boolean;
  safeguardProgress: number;
  criticalPauseUsed: boolean;
  pendingDecision: DecisionPoint | null;
  outcomeReason: string | null;
}>;
export type Behavior = 'PASSIVE' | 'COOPERATIVE' | 'NERVOUS' | 'FLEEING' | 'THREATENING' | 'HOSTILE' | 'SURRENDERED' | 'INCAPACITATED';
export type NpcDefinition = Readonly<{
  id: string;
  position: Position;
  identity: 'CIVILIAN' | 'UNKNOWN';
  behavior: Behavior | 'SEEDED';
  script: readonly Readonly<{ atTick: number; behavior: Behavior; position?: Position }>[];
}>;
export type Npc = Omit<NpcDefinition, 'behavior'> & Readonly<{ behavior: Behavior }>;
export type KnowledgeLevel = 'DETECTED' | 'OBSERVED' | 'IDENTIFIED' | 'STALE';
export type Observation = Readonly<{
  entityId: string;
  position: Position;
  level: KnowledgeLevel;
  confidence: number;
  observedAt: number;
  sourceOperatorId: string;
  behavior: Behavior | null;
  identity: 'CIVILIAN' | 'UNKNOWN' | null;
}>;
export type OperatorKnowledge = Readonly<{ operatorId: string; observations: readonly Observation[] }>;
export type SimulationCommand = ControlCommand
  | Readonly<{ id: string; issuedAtTick: number; type: 'ISSUE_ORDER'; order: OrderInput }>
  | Readonly<{ id: string; issuedAtTick: number; type: 'CANCEL_ORDER'; orderId: string }>;
export type EventData =
  | Readonly<{ kind: 'PHASE_CHANGED'; phase: Phase }>
  | Readonly<{ kind: 'ORDER_CHANGED'; orderId: string; operatorId: string; status: OrderStatus; reason: string }>
  | Readonly<{ kind: 'MOVED'; operatorId: string; position: Position; durationTicks: number }>
  | Readonly<{ kind: 'DECISION'; operatorId: string; action: string; reason: string }>
  | Readonly<{ kind: 'MISSION_UPDATE'; reason: string }>
  | Readonly<{ kind: 'DECISION_POINT'; decision: DecisionPoint; reason: string }>;
export type KnowledgeEvent = Readonly<{ kind: 'RADIO_REPORT'; operatorId: string; entityId: string; level: KnowledgeLevel; reason: string }>;
export type ActionEvent = Readonly<{
  kind: 'ACTION_STARTED' | 'ACTION_ENDED' | 'WEAPON_FIRE' | 'IMPACT' | 'RELOAD' | 'REACTION' | 'INCAPACITATED';
  actorId: string;
  targetId: string | null;
  action: ReactionKind;
  durationTicks: number;
  reason: string;
}>;
export type SimulationEvent = (EventData | KnowledgeEvent | ActionEvent) & Readonly<{ id: string; tick: number }>;
export type Snapshot = Readonly<{
  schemaVersion: 1;
  tick: number;
  phase: Phase;
  seed: number;
  grid: Grid;
  operators: readonly Operator[];
  orders: readonly TacticalOrder[];
  policy: ExecutionPolicy;
  traces: readonly DecisionTrace[];
  npcs: readonly Npc[];
  knowledge: readonly OperatorKnowledge[];
  intel: readonly Observation[];
  mission: MissionProgress | null;
  events: readonly SimulationEvent[];
}>;
export type PlayerView = Omit<Snapshot, 'npcs' | 'knowledge'>;
export type CommandRecord = Readonly<{
  submittedAtTick: number;
  submittedAtStep: number;
  command: SimulationCommand;
}>;
