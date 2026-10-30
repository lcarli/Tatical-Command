import { useEffect, useState } from 'react';
import { GameSession } from '../app/session';
import { GameViewport } from '../game/GameViewport';
import type { Autonomy, Caution, OrderInput, OrderType, PlayerView, Position, SimulationEvent, Tempo } from '../simulation/core/types';
import { SimulationError } from '../simulation';
import { findPath, walkable } from '../simulation/world/grid';
import { unfinished } from '../simulation/orders/planner';
import { SEARCH_ROOM, TARGET_ROOM } from '../content/missions/blackwood';
import { exportReplay, ReplayPlayer } from '../simulation/core/replay';
import { playerView } from '../simulation/perception/knowledge';

function eventText(event: SimulationEvent): string {
  if (event.kind === 'PHASE_CHANGED') return event.phase;
  if (event.kind === 'MOVED') return `${event.operatorId} moved to ${event.position.x},${event.position.y}`;
  if (event.kind === 'RADIO_REPORT') return `${event.operatorId}: ${event.entityId} / ${event.level}`;
  if (event.kind === 'ORDER_CHANGED') return `${event.operatorId}: ${event.status} — ${event.reason}`;
  if (event.kind === 'DECISION') return `${event.operatorId}: ${event.reason}`;
  if (event.kind === 'MISSION_UPDATE' || event.kind === 'DECISION_POINT') return event.reason;
  return `${event.actorId}: ${event.action} — ${event.reason}`;
}

export function App() {
  const [session, setSession] = useState(() => new GameSession());
  const [view, setView] = useState<PlayerView>(() => session.view());
  const [selected, setSelected] = useState('bravo-1');
  const [scope, setScope] = useState('BRAVO');
  const [type, setType] = useState<OrderType>('MOVE');
  const [target, setTarget] = useState<Position>(TARGET_ROOM);
  const [tempo, setTempo] = useState<Tempo>('NORMAL');
  const [caution, setCaution] = useState<Caution>('STANDARD');
  const [autonomy, setAutonomy] = useState<Autonomy>('ADAPTIVE');
  const [priority, setPriority] = useState(50);
  const [dependency, setDependency] = useState('');
  const [error, setError] = useState('');
  const [seedInput, setSeedInput] = useState('42');
  const [speed, setSpeed] = useState(1);
  const [replay, setReplay] = useState<ReplayPlayer | null>(null);
  const [replayPlaying, setReplayPlaying] = useState(false);

  useEffect(() => {
    if (replay ? !replayPlaying : view.phase !== 'EXECUTING') return;
    const interval = window.setInterval(() => {
      try {
        if (replay) {
          for (let frame = 0; frame < speed && !replay.done; frame += 1) replay.step();
          setView(playerView(replay.engine.snapshot()));
          if (replay.done) setReplayPlaying(false);
        } else {
          let current = session.view();
          for (let frame = 0; frame < speed && current.phase === 'EXECUTING'; frame += 1) current = session.advance();
          setView(current);
        }
      } catch (caught) {
        window.clearInterval(interval);
        if (!(caught instanceof SimulationError)) throw caught;
        setError(caught.message);
        setReplayPlaying(false);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [session, view.phase, replay, replayPlaying, speed]);

  const act = (operation: () => void) => {
    try {
      operation();
      setError('');
    } catch (caught) {
      if (!(caught instanceof SimulationError)) throw caught;
      setError(caught.message);
    } finally {
      setView(session.view());
    }
  };
  const active = view.operators.find((operator) => operator.id === selected);
  const terminal = view.phase === 'COMPLETED' || view.phase === 'FAILED';
  const readOnly = replay !== null;
  const currentEngine = replay?.engine ?? session.engine;
  const reset = (seed: number) => {
    try {
      const next = new GameSession(seed, session.engine.initialWorld);
      setSession(next);
      setView(next.view());
      setReplay(null);
      setReplayPlaying(false);
      setDependency('');
      setSelected('bravo-1');
      setError('');
      setSeedInput(String(seed));
    } catch (caught) {
      if (!(caught instanceof SimulationError)) throw caught;
      setError(caught.message);
    }
  };
  const openReplay = (data: unknown) => {
    try {
      const player = new ReplayPlayer(data);
      setReplay(player);
      setReplayPlaying(false);
      setView(playerView(player.engine.snapshot()));
      setError('');
    } catch (caught) {
      if (!(caught instanceof SimulationError)) throw caught;
      setError(caught.message);
    }
  };
  const seekReplay = (position: number) => {
    if (!replay) return;
    try {
      const player = new ReplayPlayer(replay.data);
      for (let frame = 0; frame < position; frame += 1) player.step();
      setReplay(player);
      setReplayPlaying(false);
      setView(playerView(player.engine.snapshot()));
      setError('');
    } catch (caught) {
      if (!(caught instanceof SimulationError)) throw caught;
      setError(caught.message);
      setReplayPlaying(false);
    }
  };
  const downloadReplay = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportReplay(session.engine), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `blackwood-seed-${session.seed}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const enqueue = () => act(() => {
    const operators = scope === 'HAVOC' ? view.operators.filter((operator) => operator.operational) : view.operators.filter((operator) => operator.id === selected);
    const used: Position[] = [];
    const orders: Omit<OrderInput, 'id'>[] = [];
    for (const operator of operators) {
      let destination = target;
      if (type === 'MOVE' && operators.length > 1) {
        const candidates = Array.from({ length: view.grid.width * view.grid.height }, (_, index) => ({ x: index % view.grid.width, y: Math.floor(index / view.grid.width) }))
          .filter((position) => walkable(view.grid, position) && !used.some((entry) => entry.x === position.x && entry.y === position.y)
            && findPath(view.grid, operator.position, position) !== null)
          .sort((a, b) => (Math.abs(a.x - target.x) + Math.abs(a.y - target.y)) - (Math.abs(b.x - target.x) + Math.abs(b.y - target.y)) || a.y - b.y || a.x - b.x);
        const candidate = candidates[0];
        if (!candidate) throw new SimulationError('INVALID_COMMAND', 'No reachable team destination.');
        destination = candidate;
        used.push(destination);
      }
      const contact = view.intel[0];
      if (type === 'PROTECT' && !contact) throw new SimulationError('INVALID_COMMAND', 'Wait for a radio report before assigning PROTECT.');
      orders.push({
        operatorId: operator.id, type, priority, dependsOn: dependency ? [dependency] : [], policy: { tempo, caution, autonomy },
        target: type === 'WAIT' || type === 'REGROUP' ? { kind: 'NONE' }
          : type === 'PROTECT' && contact ? { kind: 'ENTITY', entityId: contact.entityId } : { kind: 'POSITION', position: destination },
      });
    }
    session.issueMany(orders);
  });

  return (
    <main className="command-shell">
      <header className="shell-header">
        <div><p className="eyebrow">AUTONOMOUS COMMAND STRATEGY</p><h1>TACTICAL COMMAND</h1></div>
        <div className="status" data-testid="mission-phase">{view.phase} / TICK {view.tick}</div>
      </header>
      <div className="mission-brief">
        <strong>OPERATION BLACKWOOD</strong>
        <p>Inspect room A. Locate and safeguard the civilian near search area B. Keep at least two operators operational.</p>
        <small>Fictional 10×10 office annex. Occupancy is uncertain; contacts appear only after radio reports.</small>
      </div>
      <nav className="toolbar" aria-label="Mission controls">
        <button disabled={readOnly || view.phase !== 'PLANNING' || view.orders.length > 0} onClick={() => act(() => session.initialPlan(autonomy, tempo, caution))}>Load sample plan</button>
        <button disabled={readOnly || terminal || view.phase === 'EXECUTING'} onClick={() => act(() => session.control('RESUME'))}>{view.phase === 'PLANNING' ? 'Execute plan' : 'Resume'}</button>
        <button disabled={readOnly || view.phase !== 'EXECUTING'} onClick={() => act(() => session.control('PAUSE'))}>Pause</button>
        <label className="inline-label">Playback speed<select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value="1">1×</option><option value="4">4×</option><option value="10">10×</option></select></label>
        <span>Seed {view.seed} · 100 ms / tick</span>
      </nav>
      {error && <p className="error" role="alert">{error}</p>}
      {view.mission && <section className="objectives" aria-label="Mission objectives">
        <span>{view.mission.inspected ? 'COMPLETE' : 'PENDING'} · Inspect room A</span>
        <span>{view.mission.safeguarded ? 'COMPLETE' : 'PENDING'} · Safeguard civilian</span>
        <span>{view.operators.filter((operator) => operator.operational).length}/3 operational · minimum 2</span>
      </section>}
      {view.mission?.pendingDecision && <section className="decision-panel" aria-label="Critical decision">
        <h2>Command decision</h2><p>{view.mission.pendingDecision.reason}</p>
        <p>Continue the current plan, prioritize the reported civilian, or edit and cancel orders below before resuming.</p>
        <div className="toolbar">
          <button disabled={readOnly} onClick={() => act(() => session.control('RESUME'))}>Continue current plan</button>
          <button disabled={readOnly || !view.intel.some((entry) => entry.identity === 'CIVILIAN' && entry.level === 'IDENTIFIED')} onClick={() => act(() => session.prioritizeCivilian())}>Prioritize civilian</button>
        </div>
      </section>}
      {terminal && <section className="debrief" aria-label="Mission debrief">
        <h2>Mission {view.phase.toLowerCase()}</h2>
        <p>{view.mission?.outcomeReason}</p>
        <p>Seed {view.seed} · {(view.tick / 10).toFixed(1)} logical seconds · {view.events.length} received events</p>
        <p>State hash <code data-testid="final-state-hash">{currentEngine.stateHash()}</code> · Event hash <code>{currentEngine.eventHash()}</code></p>
        <p>Decision causes and rejected actions are shown in the inspector and timeline below.</p>
      </section>}
      <section className="replay-panel" aria-label="Retry and replay">
        <details open={terminal || readOnly}>
        <summary>Retry and replay</summary>
        <div className="toolbar">
          <button disabled={view.phase === 'EXECUTING' && !readOnly} onClick={() => reset(session.seed)}>Retry same seed</button>
          <label className="inline-label">Scenario seed<input type="number" min="0" max="4294967295" value={seedInput} onChange={(event) => setSeedInput(event.target.value)} /></label>
          <button disabled={view.phase === 'EXECUTING' && !readOnly} onClick={() => reset(seedInput.trim() ? Number(seedInput) : NaN)}>New scenario</button>
          <button disabled={readOnly || view.phase === 'EXECUTING'} onClick={downloadReplay}>Save replay</button>
          <button disabled={readOnly || view.phase === 'EXECUTING' || session.engine.stepCount() === 0} onClick={() => openReplay(exportReplay(session.engine))}>Replay recorded run</button>
        </div>
        <small>Retry resets planning with the same initial roster and equipment. Load the sample plan again or create a different one. Sample plans use the selected tempo, caution and autonomy; WIDE continues without a critical pause.</small>
        <label>Import replay<input type="file" accept=".json,application/json" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (file.size > 5_000_000) { setError('Replay file exceeds the 5 MB prototype limit.'); return; }
          try { openReplay(JSON.parse(await file.text())); }
          catch (caught) {
            if (!(caught instanceof SyntaxError) && !(caught instanceof DOMException)) throw caught;
            setError(`Could not read replay: ${caught.message}`);
          }
          event.target.value = '';
        }} /></label>
        {replay && <div>
          <p role="status">{replay.verified ? 'Replay verified: state and event hashes match.' : `Read-only replay · frame ${replay.position}/${replay.data.totalSteps}`}</p>
          <div className="toolbar">
            <button disabled={replay.done} onClick={() => setReplayPlaying(!replayPlaying)}>{replayPlaying ? 'Pause replay' : 'Play replay'}</button>
            <button disabled={replayPlaying || replay.done} onClick={() => seekReplay(replay.position + 1)}>Step replay</button>
            <button onClick={() => seekReplay(0)}>Restart replay</button>
            <button onClick={() => { setReplay(null); setReplayPlaying(false); setView(session.view()); }}>Return to mission</button>
          </div>
          <label>Replay frame<input type="range" min="0" max={replay.data.totalSteps} value={replay.position} disabled={replayPlaying} onChange={(event) => seekReplay(Number(event.target.value))} /></label>
        </div>}
        </details>
      </section>
      <div className="workspace">
        <div>
          <section aria-labelledby="viewport-heading">
            <div className="panel-heading"><h2 id="viewport-heading">Operations viewport</h2><span>SCROLL TO ZOOM · MIDDLE DRAG TO PAN</span></div>
            <GameViewport view={view} selected={selected} onSelect={setSelected} onTarget={setTarget} />
          </section>
          <section className="intel-panel" aria-label="Received intelligence">
            <h2>Received intelligence</h2>
            {view.intel.length === 0 ? <p>No reported contacts.</p> : view.intel.map((entry) => <p key={entry.entityId}>{entry.identity ?? 'Unknown contact'} · {entry.level} · {entry.behavior ?? 'unassessed'} · {entry.position.x},{entry.position.y} · source {entry.sourceOperatorId} / tick {entry.observedAt}</p>)}
          </section>
        </div>
        <aside>
          <section className="order-panel" aria-label="Command planning">
            <h2>Command planning</h2>
            <label>Command scope<select value={scope} onChange={(event) => setScope(event.target.value)}><option value="BRAVO">Bravo 1 — local operator orders</option><option value="HAVOC">Havoc — team-wide intent</option></select></label>
            <div className="roster">{view.operators.map((operator) => <button key={operator.id} aria-pressed={selected === operator.id} onClick={() => setSelected(operator.id)}>{operator.name}<small>{operator.operational ? `${operator.position.x},${operator.position.y}` : 'INCAPACITATED'}</small></button>)}</div>
            {active && <p className="operator-stats">Stress {active.stress} · Fatigue {active.fatigue} · Resources {active.ammo}/{active.reserveAmmo}{active.action && ` · ${active.action.kind}`}</p>}
            <label>Order<select value={type} onChange={(event) => setType(event.target.value as OrderType)}>{['MOVE', 'INSPECT', 'PROTECT', 'INTERACT', 'WAIT', 'REGROUP'].map((value) => <option key={value}>{value}</option>)}</select></label>
            <div className="coordinates">
              <label>Target X<input type="number" min="0" max="9" value={target.x} onChange={(event) => setTarget({ ...target, x: Number(event.target.value) })} /></label>
              <label>Target Y<input type="number" min="0" max="9" value={target.y} onChange={(event) => setTarget({ ...target, y: Number(event.target.value) })} /></label>
            </div>
            <div className="toolbar"><button onClick={() => setTarget(TARGET_ROOM)}>Room A</button><button onClick={() => setTarget(SEARCH_ROOM)}>Search B</button></div>
            <div className="toolbar" aria-label="Policy presets">
              <button onClick={() => { setTempo('METHODICAL'); setCaution('MAXIMUM'); setAutonomy('ADAPTIVE'); }}>Cautious</button>
              <button onClick={() => { setTempo('NORMAL'); setCaution('STANDARD'); setAutonomy('ADAPTIVE'); }}>Balanced</button>
              <button onClick={() => { setTempo('URGENT'); setCaution('HIGH'); setAutonomy('ADAPTIVE'); }}>Urgent</button>
            </div>
            <label>Tempo<select value={tempo} onChange={(event) => setTempo(event.target.value as Tempo)}><option>METHODICAL</option><option>NORMAL</option><option>URGENT</option></select></label>
            <label>Caution<select value={caution} onChange={(event) => setCaution(event.target.value as Caution)}><option>STANDARD</option><option>HIGH</option><option>MAXIMUM</option></select></label>
            <label>Autonomy<select value={autonomy} onChange={(event) => setAutonomy(event.target.value as Autonomy)}><option>RESTRICTED</option><option>ADAPTIVE</option><option>WIDE</option></select></label>
            <label>Priority<input type="number" min="0" max="100" value={priority} onChange={(event) => setPriority(Number(event.target.value))} /></label>
            <label>After order<select value={dependency} onChange={(event) => setDependency(event.target.value)}><option value="">No dependency</option>{view.orders.map((order) => <option key={order.id} value={order.id}>{order.id} / {order.status}</option>)}</select></label>
            <button className="primary" disabled={terminal || readOnly} onClick={enqueue}>Queue {scope === 'HAVOC' ? 'team orders' : 'order'}</button>
          </section>
        </aside>
      </div>
      <section className="orders-panel" aria-label="Order queue"><h2>Order queue</h2>{view.orders.length === 0 ? <p>Select an operator and a tile, then queue an intent.</p> : view.orders.map((order) => <div className="order-row" key={order.id}><span>{order.operatorId} · {order.type} · {order.status}<small>{order.id} · priority {order.priority} · {order.policy.tempo ?? view.policy.tempo}</small></span><button disabled={terminal || readOnly || !unfinished(order)} onClick={() => act(() => session.cancel(order.id))}>Cancel</button></div>)}</section>
      <div className="workspace">
        <section className="trace-panel" aria-label="Decision inspector"><h2>Decision inspector</h2>{view.traces.map((trace) => <div key={trace.operatorId}><p><strong>{trace.operatorId}: {trace.selected}</strong> · tick {trace.tick}</p><p>{trace.reason}</p>{trace.eligible.map((candidate) => <small className="trace-line" key={candidate.action}>{candidate.action}: utility {candidate.utility}</small>)}{trace.rejected.map((candidate) => <small className="trace-line" key={candidate.action}>Rejected {candidate.action}: {candidate.reason}</small>)}</div>)}</section>
        <section className="event-panel" aria-label="Event timeline"><h2>Event timeline</h2><ol>{view.events.slice(-20).reverse().map((event) => <li key={event.id}><small>T{event.tick}</small> {eventText(event)}</li>)}</ol></section>
      </div>
      <footer><p>Command intent. Observe execution. Understand consequences.</p><p>Prototype values are provisional. No manual aiming or firing.</p></footer>
    </main>
  );
}
