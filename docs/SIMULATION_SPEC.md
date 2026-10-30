# Simulation & AI Specification — v1.0

## World truth vs knowledge
WorldState stores actual entities and geometry. Each operator's KnowledgeState stores observations with timestamp, source, uncertainty and expiry. Player-visible intel is briefing + received communications. AI cannot query hidden entity identity to decide a response.

## Perception
Visibility requires line-of-sight and range, adjusted by light, occlusion, movement, perception and stress. Use deterministic confidence bands for MVP; detected is not automatically identified. Uncertainty can persist and observations become stale.

## Decision model
1. Keep persistent order intent.
2. Generate candidate actions from current state and observations.
3. Apply preconditions and mandatory safety constraints; prohibited candidates are removed.
4. Score remaining actions by objective alignment, priority, estimated risk, effort, skills, policy, stress/fatigue and autonomy.
5. Select highest utility with stable tie-breaking and seeded stochasticity only where explicitly specified.
6. Apply hysteresis/cooldowns and interrupt rules to avoid thrashing.
7. Log decision reason and rejected actions for debug.

## Example provisional scoring (not balance truth)
`utility = objectiveFit*0.35 + priority*0.20 + skillFit*0.15 - risk*policyRiskWeight - effort*0.10`. Use normalized integers and explicit clamps. Never use utility to override mandatory restrictions.

## Psychology MVP
Stress increases on adverse events and decreases during safe periods. Resilience attenuates performance penalties. Fatigue increases with exertion and equipment burden. Effects are bounded and should be tested with controlled scenario distributions. Later extend stress sensitivity, recovery, composure and confidence; training changes proficiencies and coping, not fundamental personality identity.

## Equipment/proficiency
Equipment has abstract handling, mobility burden, range band, capacity and noise. Strength changes equipment burden and fatigue, not a universal weapon permission gate. Proficiency affects consistency and handling; no realistic ballistic calibration is needed.

## Combat event lifecycle
Contact -> observed assessment -> eligible response -> timed action -> abstract resolution -> state updates -> report/resume. Response actions include OBSERVE, WARN, PROTECT, DISENGAGE, RESPOND, RELOAD, RECOVER, REPORT, RESUME. Surrender and cessation of threat invalidate further force. Civilian protection is a hard constraint.

## Combat presentation
Emit logical events (`ACTION_STARTED`, `WEAPON_FIRE`, `IMPACT`, `RELOAD`, `REACTION`, `ACTION_ENDED`, `INCAPACITATED`) with tick and duration. Phaser maps events to animations/sounds. Do not let visuals change hit/miss outcomes. On pause, both logical time and playback time freeze.

## Pause policy
Routine contacts and allowed automatic responses do not pause. Pause for objective-critical new intel, conflicting priorities, blocked plans with no allowed recovery, or critical safety dilemmas. Aggregate simultaneous events; present actionable alternatives. Manual pause always available. Resolve at tick boundaries; no pause after terminal state.

## Invariants
- No force against surrendered/incapacitated entities or without qualifying observed current threat.
- No action uses undiscovered world knowledge.
- One operator has at most one active atomic action.
- No negative ammo, energy or state values outside defined ranges.
- Interrupted order intent is retained unless cancelled/failed.
- Same inputs + versions produce identical canonical state/event hashes.
- Completed/failed missions do not continue ticking.

## Implemented prototype constants
All values below are provisional fixture/balance values, not real-world models.
Normal movement takes 2 ticks per tile, methodical 3 and urgent 1; maximum caution
and high fatigue each add a tick. WAIT takes 5 ticks, INSPECT/INTERACT 3.
Movement uses stable four-neighbor A* with operator occupancy and perceived
contact occupancy; collision resolution cannot overlap a hidden contact.

Sensing range is an integer perception band reduced by stress. Repeated visible
observations increase confidence; 50 is OBSERVED and 80 is IDENTIFIED. Observations
become STALE after 10 ticks without refresh. Radio broadcasts every 5 ticks and
retains the original observation timestamp/source instead of inventing freshness.
Light variations and richer environmental sensing are not modeled in this map.

Threat reactions use separate, timed atomic actions; they suspend orders without
deleting them. Current perceived THREATENING/HOSTILE behavior is necessary for a
force candidate. Surrender, incapacitation, missing current observation, known
civilian risk and empty resources remove prohibited response candidates before
utility scoring. Resolution revalidates the target because another actor may
have ended the threat during the tick. Warnings can yield surrender or escalation
using the seeded PRNG. REPORT/RESUME follow a temporary reaction.

Response takes 3 ticks, warning 2, reload 4. Abstract capacity is 6 with 12 initial
reserve units. Stress/fatigue are clamped to 0–100; resilience attenuates the
stress penalty during abstract response resolution. Equipment catalog, injury
detail and full proficiency balance remain outside this proof.

Replay JSON includes versions, seed, initial world/roster/resources, command
submission step and logical tick, complete event log and expected hashes.
Recording submission steps preserves edits made while logical time is paused.
Playback has no authority to alter the original run; incompatible versions,
malformed files and hash mismatches fail explicitly. Prototype import limits are
5 MB in the UI, 10,000 execution steps and 5,000 commands.
