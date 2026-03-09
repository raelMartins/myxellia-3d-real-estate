import { useRef, useCallback } from 'react';
import { isSimplePolygon, type Point2 } from '../lib/polygonUtils';

const CANVAS_SIZE = 280;
const GRID_STEP = 0.25;
const VERTEX_R = 0.02;

interface PolygonCanvasProps {
    vertices: Point2[];
    onVerticesChange: (vertices: Point2[]) => void;
}

export default function PolygonCanvas({ vertices, onVerticesChange }: PolygonCanvasProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const draggingRef = useRef<number | null>(null);

    const toSvg = useCallback((p: Point2) => ({ x: p[0], y: -p[1] }), []);
    const fromSvg = useCallback((x: number, y: number): Point2 => [x, -y], []);

    const handlePointerDown = (e: React.PointerEvent, index: number) => {
        e.preventDefault();
        (e.target as SVGElement).setPointerCapture(e.pointerId);
        draggingRef.current = index;
    };

    const handlePointerMove = useCallback(
        (e: React.PointerEvent) => {
            const i = draggingRef.current;
            if (i == null || !svgRef.current) return;
            const svg = svgRef.current;
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgPt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
            const newPt: Point2 = fromSvg(svgPt.x, svgPt.y);
            const next = vertices.map((v, k) => (k === i ? newPt : v));
            if (isSimplePolygon(next)) onVerticesChange(next);
        },
        [vertices, onVerticesChange, fromSvg]
    );

    const handlePointerUp = (e: React.PointerEvent) => {
        (e.target as SVGElement).releasePointerCapture(e.pointerId);
        draggingRef.current = null;
    };

    const gridLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let t = -0.5; t <= 0.5; t += GRID_STEP) {
        gridLines.push({ x1: t, y1: 0.5, x2: t, y2: -0.5 });
        gridLines.push({ x1: -0.5, y1: -t, x2: 0.5, y2: -t });
    }

    const pathD =
        vertices.length >= 2
            ? vertices
                  .map((v, i) => {
                      const { x, y } = toSvg(v);
                      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  })
                  .join(' ') + ' Z'
            : '';

    return (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden" style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
            <svg
                ref={svgRef}
                viewBox="-0.55 -0.55 1.1 1.1"
                preserveAspectRatio="xMidYMid meet"
                className="w-full h-full cursor-crosshair"
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                <g stroke="rgba(255,255,255,0.08)" strokeWidth="0.01">
                    {gridLines.map((line, i) => (
                        <line key={i} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
                    ))}
                </g>
                <rect x="-0.5" y="-0.5" width="1" height="1" fill="none" stroke="rgba(198,166,100,0.3)" strokeWidth="0.02" />
                <path d={pathD} fill="rgba(198,166,100,0.12)" stroke="#C6A664" strokeWidth="0.007" strokeLinejoin="round" />
                {vertices.map((v, i) => {
                    const { x, y } = toSvg(v);
                    return (
                        <circle
                            key={i}
                            cx={x}
                            cy={y}
                            r={VERTEX_R}
                            fill="#C6A664"
                            stroke="#0A0A0B"
                            strokeWidth="0.005"
                            className="cursor-grab active:cursor-grabbing"
                            onPointerDown={(e) => handlePointerDown(e, i)}
                        />
                    );
                })}
            </svg>
        </div>
    );
}
