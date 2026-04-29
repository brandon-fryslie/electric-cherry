import { useEffect } from 'react';
import type { ConnectionFlash, ConnectionId } from './types.ts';

/** System map: persistent topology diagram showing how an agent connects
 *  to an Electron app via electric-cherry. Three branches:
 *
 *      [ agent ]  --MCP-->  [ 🍒 cherry ]  --CDP-->  [ renderer ]
 *                                       \\--V8 -->  [ main ]
 *
 *  When the orchestrator emits a flash for a connection, that branch's
 *  arrow pulses the protocol's color via a CSS keyframe and auto-removes
 *  when its 700ms animation completes. The diagram itself never moves —
 *  the visual narrative is "this is the system; here is traffic flowing
 *  through it" rather than transient particles.
 *
 *  Ported from the original vanilla-JS demo's routing diagram. */

interface Props {
  flashes: ReadonlyArray<ConnectionFlash>;
  onFlashComplete: (id: number) => void;
}

const FLASH_MS = 700;

interface ArrowSpec {
  connection: ConnectionId;
  /** Optional label drawn above the arrow line (e.g. "MCP", "CDP", "V8"). */
  label: string;
}

export function SystemMap({ flashes, onFlashComplete }: Props) {
  return (
    <div className="ec-sysmap" aria-label="Routing topology">
      <Node className="ec-sysmap-node-agent" title="agent" sub="MCP client" />
      <Arrow spec={{ connection: 'agent-cherry', label: 'MCP' }}
             flashes={flashes}
             onFlashComplete={onFlashComplete} />
      <Node className="ec-sysmap-node-cherry" title="🍒 electric-cherry" sub="tool → protocol" emphasis />
      <div className="ec-sysmap-branches">
        <div className="ec-sysmap-branch">
          <Arrow spec={{ connection: 'cherry-cdp', label: 'CDP' }}
                 flashes={flashes}
                 onFlashComplete={onFlashComplete} />
          <Node className="ec-sysmap-node-cdp" title="renderer" sub="Chrome DevTools Protocol" />
        </div>
        <div className="ec-sysmap-branch">
          <Arrow spec={{ connection: 'cherry-v8', label: 'V8' }}
                 flashes={flashes}
                 onFlashComplete={onFlashComplete} />
          <Node className="ec-sysmap-node-main" title="main process" sub="V8 Inspector" />
        </div>
      </div>
    </div>
  );
}

function Node({
  className,
  title,
  sub,
  emphasis = false,
}: {
  className: string;
  title: string;
  sub: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`ec-sysmap-node ${className} ${emphasis ? 'ec-sysmap-node-emphasis' : ''}`.trim()}>
      <span className="ec-sysmap-node-title">{title}</span>
      <span className="ec-sysmap-node-sub">{sub}</span>
    </div>
  );
}

function Arrow({
  spec,
  flashes,
  onFlashComplete,
}: {
  spec: ArrowSpec;
  flashes: ReadonlyArray<ConnectionFlash>;
  onFlashComplete: (id: number) => void;
}) {
  const flashesForArrow = flashes.filter((f) => f.connection === spec.connection);
  return (
    <div className={`ec-sysmap-arrow ec-sysmap-arrow-${spec.connection}`}>
      <span className="ec-sysmap-arrow-label">{spec.label}</span>
      <svg
        className="ec-sysmap-arrow-svg"
        viewBox="0 0 100 16"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* Permanent base arrow: line + arrowhead. */}
        <path d="M 0 8 L 92 8" className="ec-arrow-base" />
        <path d="M 84 3 L 92 8 L 84 13" className="ec-arrow-base" fill="none" />
        {/* Active flash overlays — each self-removes after FLASH_MS. */}
        {flashesForArrow.map((f) => (
          <FlashOverlay key={f.id} protocol={f.protocol} onDone={() => onFlashComplete(f.id)} />
        ))}
      </svg>
    </div>
  );
}

function FlashOverlay({
  protocol,
  onDone,
}: {
  protocol: ConnectionFlash['protocol'];
  onDone: () => void;
}) {
  useEffect(() => {
    const id = window.setTimeout(onDone, FLASH_MS);
    return () => window.clearTimeout(id);
  }, [onDone]);
  return (
    <g className={`ec-arrow-flash ec-arrow-${protocol}`}>
      <path d="M 0 8 L 92 8" />
      <path d="M 84 3 L 92 8 L 84 13" fill="none" />
    </g>
  );
}
