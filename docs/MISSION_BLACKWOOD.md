# Operation Blackwood — First playable

## Narrative premise
Small office annex with uncertain occupancy. The team must inspect a target room and locate/protect a civilian while minimizing harm. No procedural real-world tactics are modeled.

## Map
Prototype: 10x10 logical grid, two rooms and a corridor, one blocked alternate passage, one entrance. Isometric cutaway visuals. All positions are fictional game tiles.

## Entities
Three autonomous operators: Bravo 1 (leader, balanced), Bravo 2 (high perception, lower resilience), Bravo 3 (higher strength, lower perception). One NPC with scripted initial seed-dependent behavior and one possible ambiguous contact. No more than one abstract confrontation in the prototype.

## Objectives
1. Inspect target area.
2. Locate and safeguard civilian.

Mandatory success condition: end mission with at least two operational team
members. This is a safety condition, not a third assignable objective.

## Critical decision
A route becomes blocked or new civilian intel conflicts with an assigned objective. Pause once to let player reroute/reprioritize, or let autonomy resolve if policy allows. The mission can still finish (or fail) if player never intervenes.

## First-playable interaction
Briefing -> select operator -> click tile/target -> choose order -> choose preset/advanced policy -> queue orders -> execute -> observe automatic movement/reactions -> contextual pause -> edit -> resume -> debrief -> retry same seed.

## Demonstration fixtures
- Same seed, identical commands: same events and final state.
- Same seed, different orders: demonstrably different paths/decisions/outcomes.
- Same plan, different policy: at least one observable decision difference in a controlled fixture.
- Unknown entity: cannot be identified by operators before perception/communication.
- Surrendered NPC: force action disallowed.

## Placeholder visuals
Use simple color-coded shapes/sprites and clear status labels. Do not delay gameplay tests for final art.

## Prototype objective evaluation
Inspection requires a completed INSPECT order at room A. Safeguarding requires
an operational operator adjacent to the civilian with a current identified,
non-threatening observation for three consecutive ticks. Protection must still
hold when both objectives complete. A PROTECT order can approach an identified
contact; the sample search intent also secures the civilian by reaching area B.

The first confirmed civilian radio report while inspection remains outstanding
creates one contextual decision. WIDE autonomy records the reason and continues;
ADAPTIVE/RESTRICTED pauses for command. No pause is emitted after mission end.
An unrecoverable blocked plan uses the same one-decision budget; resuming it
without a valid reroute fails with an explanation. The mission also fails when
all assigned intents finish without achieving the objectives, the civilian is
incapacitated, or fewer than two operators remain operational. There is no timer
or invented deadline.

These are explicit prototype evaluation rules, not final balance or proof that
the player experience is fun.
