# Initial data contracts (TypeScript design)

```ts
type Id = string;
type Tick = number;
type Position = { x: number; y: number };
type MissionPhase = 'BRIEFING'|'PLANNING'|'EXECUTING'|'PAUSED'|'COMPLETED'|'FAILED';
type OrderType = 'MOVE'|'INSPECT'|'PROTECT'|'INTERACT'|'WAIT'|'REGROUP';
type OrderStatus = 'QUEUED'|'ACTIVE'|'BLOCKED'|'COMPLETED'|'FAILED'|'CANCELLED';
type Tempo = 'METHODICAL'|'NORMAL'|'URGENT';
type Caution = 'STANDARD'|'HIGH'|'MAXIMUM';
type Autonomy = 'RESTRICTED'|'ADAPTIVE'|'WIDE';
type ExecutionPolicy = { tempo: Tempo; caution: Caution; autonomy: Autonomy };
type BaseAttributes = { strength:number; perception:number; coordination:number; judgment:number; resilience:number };
type Proficiencies = { sidearm:number; carbine:number; precisionRifle:number };
type DynamicState = { stress:number; fatigue:number; integrity:number; operational:'ACTIVE'|'INCAPACITATED' };
type Operator = { id:Id; name:string; position:Position; attributes:BaseAttributes; proficiencies:Proficiencies; state:DynamicState; equipmentIds:Id[]; teamId:Id };
type TacticalOrder = { id:Id; operatorIds:Id[]; type:OrderType; targetId?:Id; targetPosition?:Position; priority:number; status:OrderStatus; dependsOn?:Id[]; policy?:Partial<ExecutionPolicy> };
type KnowledgeLevel = 'UNKNOWN'|'DETECTED'|'OBSERVED'|'IDENTIFIED'|'STALE';
type Observation = { entityId:Id; level:KnowledgeLevel; observedAt:Tick; sourceOperatorId:Id; confidence:number; observedBehavior?:string };
type SimulationCommand =
  | { id:Id; issuedAtTick:Tick; type:'ISSUE_ORDER'; order:TacticalOrder }
  | { id:Id; issuedAtTick:Tick; type:'CANCEL_ORDER'; orderId:Id }
  | { id:Id; issuedAtTick:Tick; type:'RESUME' }
  | { id:Id; issuedAtTick:Tick; type:'PAUSE' };
type SimulationEvent = { id:Id; tick:Tick; kind:string; severity:'INFO'|'IMPORTANT'|'CRITICAL'; actorId?:Id; targetId?:Id; durationTicks?:number; data?:Record<string,string|number|boolean|null> };
type DecisionTrace = { tick:Tick; operatorId:Id; selected:string; eligible:{ action:string; utility:number }[]; rejected:{ action:string; reason:string }[] };
type DecisionPoint = { id:Id; tick:Tick; eventIds:Id[]; operatorIds:Id[]; choices:string[] };
type Snapshot = { schemaVersion:1; tick:Tick; phase:MissionPhase; operators:readonly Operator[]; events:readonly SimulationEvent[]; pendingDecisions:readonly DecisionPoint[] };
interface SimulationEngine {
  initialize(missionId:Id, seed:number): Snapshot;
  dispatch(command:SimulationCommand):void;
  step():Snapshot;
  snapshot():Snapshot;
  eventLog():readonly SimulationEvent[];
  serialize():string;
}
```

**Contract notes:** These are starting types, not implementation. Add discriminated event unions, runtime validation, explicit team/default policy schemas, NPC definitions, canonical serialization, error types, equipment definitions and versioned migrations as tasks require. Validate all numeric ranges at content/command boundaries. Avoid `any` and untyped payloads.
