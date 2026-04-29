import { useEffect, useState, type RefObject } from 'react';
import type { FlowPacket } from './types.ts';

interface Props {
  stageRef: RefObject<HTMLDivElement | null>;
  packets: ReadonlyArray<FlowPacket>;
  onPacketComplete: (id: number) => void;
}

const DURATION_MS = 750;

export function DataflowLayer({ stageRef, packets, onPacketComplete }: Props) {
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => {
      const r = stage.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [stageRef]);

  if (!size.w || !size.h) return null;

  return (
    <svg
      className="ec-dataflow"
      viewBox={`0 0 ${size.w} ${size.h}`}
      width={size.w}
      height={size.h}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {packets.map((p) => (
        <Packet
          key={p.id}
          packet={p}
          stageRef={stageRef}
          onDone={onPacketComplete}
        />
      ))}
    </svg>
  );
}

function Packet({
  packet,
  stageRef,
  onDone,
}: {
  packet: FlowPacket;
  stageRef: RefObject<HTMLDivElement | null>;
  onDone: (id: number) => void;
}) {
  const [d, setD] = useState<string | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      onDone(packet.id);
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    const sourceEl = stage.querySelector(packet.sourceSelector);
    const targetEl = stage.querySelector(packet.targetSelector);
    if (!sourceEl || !targetEl) {
      onDone(packet.id);
      return;
    }
    const sr = sourceEl.getBoundingClientRect();
    const tr = targetEl.getBoundingClientRect();
    const sx = sr.left + sr.width / 2 - stageRect.left;
    const sy = sr.top + sr.height / 2 - stageRect.top;
    const tx = tr.left + tr.width / 2 - stageRect.left;
    const ty = tr.top + tr.height / 2 - stageRect.top;
    // Quadratic curve: control point lifted above the midpoint by an amount
    // proportional to horizontal distance, so longer hops arc higher and read
    // as deliberate motion rather than a straight line.
    const cx = (sx + tx) / 2;
    const cy = Math.min(sy, ty) - Math.max(20, Math.abs(tx - sx) * 0.18);
    setD(`M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`);

    const id = window.setTimeout(() => onDone(packet.id), DURATION_MS);
    return () => window.clearTimeout(id);
  }, [packet, stageRef, onDone]);

  if (!d) return null;
  const stroke = packet.protocol === 'cdp' ? '#58a6ff' : '#ffab70';

  return (
    <g className="ec-flow-packet">
      <path
        d={d}
        stroke={stroke}
        strokeOpacity="0.32"
        strokeWidth="1.2"
        fill="none"
        strokeDasharray="2 4"
      />
      <circle r="4" fill={stroke}>
        <animateMotion
          dur={`${DURATION_MS}ms`}
          path={d}
          fill="freeze"
          calcMode="spline"
          keySplines="0.4 0 0.2 1"
          keyTimes="0;1"
        />
      </circle>
    </g>
  );
}
