import { useRef } from 'react';
import { usePlayer } from './usePlayer.ts';
import { HUD } from './HUD.tsx';
import { ChatPanel } from './ChatPanel.tsx';
import { ToolsPalette } from './ToolsPalette.tsx';
import { ApplicationPane } from './ApplicationPane.tsx';
import { Callouts } from './Callouts.tsx';
import { DataflowLayer } from './DataflowLayer.tsx';
import { StatusLine } from './StatusLine.tsx';
import { WireLog } from './WireLog.tsx';
import './DebugDemo.css';

/**
 * The debugging demo. Composes a chat panel (the agent), a tools palette
 * (electric-cherry's MCP tools), and a mock application split into renderer
 * and main halves. Plays scripted scenarios driven by usePlayer.
 */
export function DebugDemo() {
  const stageRef = useRef<HTMLDivElement>(null);
  const { state, actions, scenarios, stepCount } = usePlayer();

  return (
    <div className="ec-demo">
      <HUD
        scenarios={scenarios}
        scenarioIdx={state.scenarioIdx}
        stepIdx={state.stepIdx}
        stepCount={stepCount}
        playing={state.playing}
        speed={state.speed}
        onScenarioChange={actions.loadScenario}
        onSpeedChange={actions.setSpeed}
        onPlayToggle={() => (state.playing ? actions.pause() : actions.play())}
        onReset={() => actions.loadScenario(state.scenarioIdx)}
      />

      <div className="ec-stage" ref={stageRef}>
        <ChatPanel
          bubbles={state.bubbles}
          textareaValue={state.textareaValue}
          textareaDisabled={state.textareaDisabled}
          textareaPlaceholder={state.textareaPlaceholder}
          onTextareaChange={actions.setTextareaValue}
          onSubmit={actions.submitFromTextarea}
        />
        <ToolsPalette
          highlighted={state.highlightedTool}
          onToolClick={actions.triggerToolClick}
        />
        <ApplicationPane renderer={state.rendererState} main={state.mainState} />
        <Callouts callouts={state.callouts} stageRef={stageRef} />
        <DataflowLayer
          stageRef={stageRef}
          packets={state.flowPackets}
          onPacketComplete={actions.removeFlowPacket}
        />
      </div>

      <StatusLine text={state.status} />
      <WireLog rows={state.wireRows} />
    </div>
  );
}
