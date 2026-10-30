# Game Design Document — v1.0

## Vision
TACTICAL COMMAND is a browser-based, isometric 2.5D command strategy game. Players specify intent, priorities, teams and execution policies; operators independently move, observe, interact, communicate and react to immediate threats. The player may replan at significant contextual pauses. Tactical decisions are simulated abstractly; presentation synchronizes animation and audio to simulation events.

## Pillars
1. **Command, not micromanagement**: no manual aiming, firing, reloading or frame-by-frame control.
2. **Believable autonomy**: operators use perceived information, not omniscient world state.
3. **Explainable consequences**: outcomes and pauses identify causes; deterministic retry enables comparisons.
4. **Depth with simple controls**: map click + contextual menus, quick presets with optional advanced policy.
5. **Distinct persistent people**: capabilities, proficiencies, psychology and later training shape behavior.

## Two command layers
- **Havoc**: mission objectives, teams, overall priorities and global constraints.
- **Bravo 1**: autonomous in-world leader and local coordination, contextual team commands.
- The player can issue commands at either layer through one UI; Bravo 1 is never directly puppeteered.
- Command knowledge derives from briefing and communicated observations, not all hidden world state.

## Mission loop
BRIEFING -> PLANNING -> EXECUTING <-> PAUSED -> COMPLETED/FAILED -> DEBRIEF/RETRY. Pauses occur only at logical tick boundaries. Routine contacts and local reactions do not automatically pause. Default pause policy is BALANCED; GUIDED and EXPERT are later variants.

## Orders
MVP: MOVE, INSPECT, PROTECT, INTERACT, WAIT, REGROUP. Each order has target, priority, status, dependencies and optional execution-policy overrides. Operators maintain persistent intent while temporary reactions execute. Order statuses: QUEUED, ACTIVE, BLOCKED, COMPLETED, FAILED, CANCELLED. No more than five queued orders per operator in the first prototype.

## Per-order policies
Three independent dimensions: tempo (METHODICAL/NORMAL/URGENT), caution (STANDARD/HIGH/MAXIMUM), autonomy (RESTRICTED/ADAPTIVE/WIDE). Inheritance: mission -> team -> order; mandatory safety constraints always prevail. Quick presets may map to these dimensions but do not conflate urgency with force authorization. Rules for identifying threats, protecting civilians, surrender and cessation of force are hard constraints.

## Operator MVP variables (10)
Base: strength, perception, coordination, judgment, resilience. Proficiencies: sidearm, carbine, precision rifle. Dynamic: stress, fatigue. Later: stress sensitivity/recovery, leadership, communication, attention, initiative, discipline, relationships, training aptitude, additional equipment skills, health and injury recovery. Permanent attributes, trainable proficiencies, personality traits and dynamic state are separate concepts.

## Autonomous combat
Hybrid resolution: simulation resolves valid responses and outcomes in deterministic logical time; visual layer presents synchronized effects. No requirement for physically simulated projectiles. Operators may observe, warn, protect, disengage, respond, reload, recover, report and resume. Force is never selected solely because an entity has a hostile identity flag; evaluate observed current threat and hard constraints. Stop responding with force when threat ends or entity surrenders. Keep action resolution abstract and game-oriented.

## NPCs and knowledge
NPC identity and observable behavior are distinct. Behaviors include passive, cooperative, nervous, fleeing, threatening, hostile, surrendered, incapacitated. Operators maintain UNKNOWN/DETECTED/OBSERVED/IDENTIFIED/STALE knowledge states with provenance and timestamps. Information sharing occurs via events.

## Progression and replay
Persistent roster, proficiencies and psychological training are post-prototype milestones. Retry with same seed and initial state; alternative scenario variation uses a new seed. Replay requires seed, content and engine versions, initial roster/loadouts, commands by tick, and event log. Do not commit campaign consequences on a discarded retry.

## Out of scope for first playable
Campaign, training center, multi-floor maps, multiplayer, voice radio, procedural map generation, advanced ballistics, extensive weapon catalog, detailed injury model, server backend, LLM-controlled operators.

## Success criteria
Player can issue plans and watch mission run without additional input (success or failure); autonomous reactions happen without clicking targets; different policies can change decisions; player can replan after one meaningful pause; same seed+commands+versions yields identical state and event hashes; outcomes are explainable.
