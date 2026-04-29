import type { Scenario } from './types.ts';

interface HUDProps {
  scenarios: Scenario[];
  scenarioIdx: number;
  stepIdx: number;
  stepCount: number;
  playing: boolean;
  speed: number;
  onScenarioChange: (idx: number) => void;
  onSpeedChange: (speed: number) => void;
  onPlayToggle: () => void;
  onReset: () => void;
}

export function HUD({
  scenarios,
  scenarioIdx,
  stepIdx,
  stepCount,
  playing,
  speed,
  onScenarioChange,
  onSpeedChange,
  onPlayToggle,
  onReset,
}: HUDProps) {
  return (
    <header className="ec-hud">
      <div className="ec-hud-left">
        <span className="ec-hud-dot" />
        <strong>electric-cherry</strong>
        <span className="ec-hud-sub">agent + MCP server + Electron app, in one frame</span>
      </div>
      <div className="ec-hud-right">
        <label>
          scenario
          <select
            value={scenarioIdx}
            onChange={(e) => onScenarioChange(Number(e.target.value))}
          >
            {scenarios.map((s, i) => (
              <option key={s.id} value={i}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          speed
          <select value={speed} onChange={(e) => onSpeedChange(Number(e.target.value))}>
            <option value={0.65}>slow</option>
            <option value={1}>normal</option>
            <option value={1.7}>fast</option>
          </select>
        </label>
        <span className="ec-step-counter">{stepIdx} / {stepCount}</span>
        <span className="ec-controls">
          <button title="reset and replay" onClick={onReset}>↺</button>
          <button title={playing ? 'pause' : 'play'} onClick={onPlayToggle} className="ec-btn-play">
            {playing ? '⏸ pause' : '▶ play'}
          </button>
        </span>
      </div>
    </header>
  );
}
