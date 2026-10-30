import { describe, expect, it } from 'vitest';
import { GameSession } from '../../src/app/session';
import { SimulationEngine } from '../../src/simulation';
import { exportReplay, ReplayPlayer } from '../../src/simulation/core/replay';
import { blackwoodWorld } from '../../src/content/missions/blackwood';
import { order } from '../fixtures/world';

function finish(session: GameSession, resumePauses = false) {
  for (let frame = 0; frame < 250; frame += 1) {
    const state = session.advance();
    if (state.phase === 'COMPLETED' || state.phase === 'FAILED') return state;
    if (state.phase === 'PAUSED' && resumePauses) session.control('RESUME');
  }
  throw new Error('Mission did not reach a terminal state in the fixture budget.');
}

function planned(autonomy: 'ADAPTIVE' | 'WIDE' = 'WIDE', tempo: 'NORMAL' | 'URGENT' | 'METHODICAL' = 'NORMAL') {
  const session = new GameSession(42);
  session.initialPlan(autonomy, tempo);
  session.control('RESUME');
  return session;
}

describe('Blackwood playable proof', () => {
  it('completes both objectives autonomously with wide autonomy and freezes the terminal state', () => {
    const session = planned();
    const state = finish(session);
    expect(state.phase).toBe('COMPLETED');
    expect(state.mission).toMatchObject({ inspected: true, safeguarded: true, pendingDecision: null });
    const hash = session.engine.stateHash();
    session.advance();
    expect(session.engine.stateHash()).toBe(hash);
  });

  it('pauses once on critical intel, permits replanning and resumes to completion', () => {
    const session = planned('ADAPTIVE');
    for (let frame = 0; frame < 80 && session.view().phase !== 'PAUSED'; frame += 1) session.advance();
    expect(session.view().phase).toBe('PAUSED');
    expect(session.view().mission?.pendingDecision?.kind).toBe('INTEL_CONFLICT');
    const before = session.engine.stateHash();
    const pausedTick = session.view().tick;
    session.advance();
    expect(session.engine.stateHash()).toBe(before);
    expect(session.view().tick).toBe(pausedTick);
    for (const entry of session.view().orders.filter((entry) => entry.operatorId === 'bravo-2' && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(entry.status))) session.cancel(entry.id);
    session.issue({ ...order({ type: 'PROTECT', operatorId: 'bravo-2', target: { kind: 'ENTITY', entityId: 'civilian' }, priority: 100 }) });
    session.control('RESUME');
    expect(finish(session).phase).toBe('COMPLETED');
    expect(session.view().events.filter((event) => event.kind === 'DECISION_POINT')).toHaveLength(1);
  });

  it('fails explainably when the initial plan has no intents', () => {
    const session = new GameSession();
    session.control('RESUME');
    expect(session.view().phase).toBe('FAILED');
    expect(session.view().mission?.outcomeReason).toMatch(/intents/);
  });

  it('matches exact retry and replay state/events including pause/replan command admission', () => {
    const original = planned('ADAPTIVE');
    finish(original, true);
    const retry = planned('ADAPTIVE');
    finish(retry, true);
    expect(retry.engine.stateHash()).toBe(original.engine.stateHash());
    const replay = new ReplayPlayer(JSON.parse(JSON.stringify(exportReplay(original.engine))));
    for (let step = 0; step < replay.data.totalSteps; step += 1) replay.step();
    expect(replay.verified).toBe(true);
    expect(replay.engine.stateHash()).toBe(original.engine.stateHash());
    expect(replay.engine.eventHash()).toBe(original.engine.eventHash());
  });

  it('shows different paths for different plans and timings for different policies', () => {
    const normal = planned();
    finish(normal);
    const urgent = planned('WIDE', 'URGENT');
    finish(urgent);
    expect(urgent.view().tick).toBeLessThan(normal.view().tick);
    const alternative = new GameSession();
    alternative.issueMany([
      { ...order({ id: 'ignored', operatorId: 'bravo-1', type: 'INSPECT', target: { kind: 'POSITION', position: { x: 7, y: 2 } }, policy: { autonomy: 'WIDE' } }) },
      { ...order({ id: 'ignored', operatorId: 'bravo-2', type: 'INSPECT', target: { kind: 'POSITION', position: { x: 7, y: 7 } }, policy: { autonomy: 'WIDE' } }) },
    ]);
    finishAfterStart(alternative);
    const paths = (session: GameSession) => session.view().events.filter((event) => event.kind === 'MOVED' && event.operatorId === 'bravo-2');
    expect(paths(alternative)).not.toEqual(paths(normal));
  });

  it('fails immediately when the team safety condition is lost', () => {
    const definition = blackwoodWorld();
    const engine = new SimulationEngine(1, 'PLANNING', {
      ...definition, operators: definition.operators.map((entry, index) => ({ ...entry, operational: index === 0 })),
    });
    engine.dispatch({ id: 'start', issuedAtTick: 0, type: 'RESUME' });
    expect(engine.step().phase).toBe('FAILED');
    expect(engine.snapshot().mission?.outcomeReason).toMatch(/operational/);
  });

  it('fails fast for incompatible or tampered replay files and malformed worlds', () => {
    const session = planned();
    finish(session);
    const data = exportReplay(session.engine);
    expect(() => new ReplayPlayer({ ...data, engineVersion: 'other' })).toThrow(/version/);
    expect(() => new ReplayPlayer({ ...data, eventLog: [] })).toThrow(/hash/);
    expect(() => new ReplayPlayer({ ...data, initialWorld: { operators: [] } })).toThrow(/Malformed/);
    const corrupt = new ReplayPlayer({ ...data, expectedStateHash: 'invalid' });
    expect(() => { while (!corrupt.done) corrupt.step(); }).toThrow(/do not match/);
  });
});

function finishAfterStart(session: GameSession) {
  session.control('RESUME');
  return finish(session);
}
