import { useEffect } from 'react';
import type { ConnectionFlash, ConnectionId } from './types.ts';

/** System map: persistent architectural diagram showing how an MCP agent
 *  connects to an Electron application via electric-cherry. The agent on
 *  the left speaks MCP/JSON-RPC; cherry routes each tool call to either
 *  Chrome DevTools Protocol (renderer) or V8 Inspector (main process)
 *  inside the same Electron app, drawn as a containing box.
 *
 *  When the orchestrator emits a flash for a connection, that branch's
 *  arrow pulses the protocol's color via @keyframes ec-arrow-flash and
 *  auto-removes when its 700ms animation completes. Multiple overlapping
 *  flashes layer naturally; the diagram itself never moves. */

interface Props {
  flashes: ReadonlyArray<ConnectionFlash>;
  onFlashComplete: (id: number) => void;
}

const FLASH_MS = 700;

export function SystemMap({ flashes, onFlashComplete }: Props) {
  return (
    <div className="ec-sysmap" aria-label="electric-cherry routing topology">
      <svg
        className="ec-sysmap-svg"
        viewBox="0 0 1200 280"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="ec-node-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
          </linearGradient>
          <linearGradient id="ec-cherry-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(179,146,240,0.18)" />
            <stop offset="100%" stopColor="rgba(110,84,168,0.08)" />
          </linearGradient>
          <radialGradient id="ec-cherry-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(179,146,240,0.35)" />
            <stop offset="100%" stopColor="rgba(179,146,240,0)" />
          </radialGradient>
        </defs>

        {/* Electron application container — dashed box around renderer + main
            to communicate that they are halves of one OS process. */}
        <g className="ec-sysmap-electron">
          <rect
            x="700"
            y="30"
            width="480"
            height="220"
            rx="10"
            className="ec-sysmap-electron-rect"
          />
          <text x="720" y="56" className="ec-sysmap-electron-label">
            Electron application
          </text>
          <text x="720" y="70" className="ec-sysmap-electron-sub">
            one OS process · two V8 isolates
          </text>
        </g>

        {/* Cherry glow halo (purely decorative; sits behind the cherry node). */}
        <circle cx="510" cy="140" r="170" fill="url(#ec-cherry-glow)" />

        {/* Agent node */}
        <Node
          x={30}
          y={100}
          w={210}
          h={90}
          title="agent"
          sub="MCP client"
          icon="◇"
        />

        {/* Cherry — the protagonist, slightly larger with emphasized fill. */}
        <Node
          x={400}
          y={80}
          w={220}
          h={130}
          title="electric-cherry"
          sub="MCP server · routes tools to protocols"
          icon="🍒"
          emphasis
        />

        {/* Renderer pane (inside Electron container). */}
        <Node
          x={730}
          y={92}
          w={430}
          h={66}
          title="renderer"
          sub="Chrome DevTools Protocol · wss://localhost:9222"
          icon="◈"
        />

        {/* Main process pane (inside Electron container). */}
        <Node
          x={730}
          y={170}
          w={430}
          h={66}
          title="main process"
          sub="V8 Inspector · ws://localhost:9229"
          icon="◇"
        />

        {/* Connections, drawn after nodes so the lines visually attach to
            node edges rather than being painted under them. Flash overlays
            render last (on top of base) per connection. */}
        <Connection
          d="M 240 145 L 400 145"
          midX={320}
          midY={132}
          label="MCP · JSON-RPC over stdio"
          connection="agent-cherry"
          flashes={flashes}
          onFlashComplete={onFlashComplete}
        />
        <Connection
          d="M 620 115 C 670 115 680 125 730 125"
          midX={675}
          midY={107}
          label="CDP"
          connection="cherry-cdp"
          flashes={flashes}
          onFlashComplete={onFlashComplete}
        />
        <Connection
          d="M 620 175 C 670 175 680 203 730 203"
          midX={675}
          midY={222}
          label="V8 Inspector"
          connection="cherry-v8"
          flashes={flashes}
          onFlashComplete={onFlashComplete}
        />
      </svg>
    </div>
  );
}

function Node({
  x,
  y,
  w,
  h,
  title,
  sub,
  icon,
  emphasis = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
  icon: string;
  emphasis?: boolean;
}) {
  const cls = ['ec-sysmap-node', emphasis && 'ec-sysmap-node-emphasis']
    .filter(Boolean)
    .join(' ');
  return (
    <g className={cls}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="6"
        className="ec-sysmap-node-rect"
        fill={emphasis ? 'url(#ec-cherry-fill)' : 'url(#ec-node-fill)'}
      />
      <text x={x + 16} y={y + 30} className="ec-sysmap-node-icon">
        {icon}
      </text>
      <text x={x + 44} y={y + 30} className="ec-sysmap-node-title">
        {title}
      </text>
      <text x={x + 16} y={y + 52} className="ec-sysmap-node-sub">
        {sub}
      </text>
    </g>
  );
}

function Connection({
  d,
  midX,
  midY,
  label,
  connection,
  flashes,
  onFlashComplete,
}: {
  d: string;
  midX: number;
  midY: number;
  label: string;
  connection: ConnectionId;
  flashes: ReadonlyArray<ConnectionFlash>;
  onFlashComplete: (id: number) => void;
}) {
  const flashesForConn = flashes.filter((f) => f.connection === connection);
  return (
    <g className="ec-sysmap-conn">
      <path d={d} className="ec-arrow-base" />
      <ArrowHead d={d} className="ec-arrow-base" />
      <text x={midX} y={midY} className="ec-sysmap-conn-label">
        {label}
      </text>
      {flashesForConn.map((f) => (
        <FlashOverlay
          key={f.id}
          d={d}
          protocol={f.protocol}
          onDone={() => onFlashComplete(f.id)}
        />
      ))}
    </g>
  );
}

function FlashOverlay({
  d,
  protocol,
  onDone,
}: {
  d: string;
  protocol: ConnectionFlash['protocol'];
  onDone: () => void;
}) {
  useEffect(() => {
    const id = window.setTimeout(onDone, FLASH_MS);
    return () => window.clearTimeout(id);
  }, [onDone]);
  return (
    <g className={`ec-arrow-flash ec-arrow-${protocol}`}>
      <path d={d} />
      <ArrowHead d={d} />
    </g>
  );
}

/** Tiny right-pointing arrowhead positioned at the path's end. The end point
 *  is parsed out of the d-string — paths in this file all terminate with
 *  "L x y" or "C cx1 cy1 cx2 cy2 x y", so the last two numbers are the end. */
function ArrowHead({ d, className }: { d: string; className?: string }) {
  const nums = d.match(/-?[\d.]+/g);
  if (!nums || nums.length < 2) return null;
  const x = parseFloat(nums[nums.length - 2]);
  const y = parseFloat(nums[nums.length - 1]);
  const headD = `M ${x - 8} ${y - 5} L ${x} ${y} L ${x - 8} ${y + 5}`;
  return <path d={headD} className={className} fill="none" />;
}
