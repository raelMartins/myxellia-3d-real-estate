import { useRef, useCallback } from 'react';
import { isSimplePolygon, polygonPairsIntersect, type Point2 } from '../lib/polygonUtils';
import type { SectionPlanSection } from '../lib/database.types';

const CANVAS_SIZE = 320;
const PAD = 0.02;

interface BirdEyeCanvasProps {
    sections: SectionPlanSection[];
    selectedSectionId: string | null;
    onSelectSection: (id: string | null) => void;
    onVerticesChange: (sectionId: string, vertices: Point2[]) => void;
}

export default function BirdEyeCanvas({
    sections,
    selectedSectionId,
    onSelectSection,
    onVerticesChange,
}: BirdEyeCanvasProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const draggingRef = useRef<{ sectionId: string; vertexIndex: number } | null>(null);

    const toSvg = useCallback((p: Point2) => ({ x: p[0], y: 1 - p[1] }), []);
    const fromSvg = useCallback((x: number, y: number): Point2 => [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, 1 - y))], []);

    const handlePointerDown = (e: React.PointerEvent, sectionId: string, vertexIndex: number) => {
        e.preventDefault();
        (e.target as SVGElement).setPointerCapture(e.pointerId);
        draggingRef.current = { sectionId, vertexIndex };
    };

    const handlePointerMove = useCallback(
        (e: React.PointerEvent) => {
            const d = draggingRef.current;
            if (!d || !svgRef.current) return;
            const svg = svgRef.current;
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgPt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
            const newPt = fromSvg(svgPt.x, svgPt.y);
            const section = sections.find((s) => s.id === d.sectionId);
            if (!section) return;
            const next = section.footprint.map((v, i) => (i === d.vertexIndex ? newPt : v));
            if (!isSimplePolygon(next)) return;
            const others = sections.filter((s) => s.id !== d.sectionId);
            if (others.some((o) => polygonPairsIntersect(next, o.footprint))) return;
            onVerticesChange(d.sectionId, next);
        },
        [sections, onVerticesChange, fromSvg]
    );

    const handlePointerUp = (e: React.PointerEvent) => {
        (e.target as SVGElement).releasePointerCapture(e.pointerId);
        draggingRef.current = null;
    };

    return (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden" style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
            <svg
                ref={svgRef}
                viewBox={`${-PAD} ${-PAD} ${1 + 2 * PAD} ${1 + 2 * PAD}`}
                preserveAspectRatio="xMidYMid meet"
                className="w-full h-full cursor-crosshair"
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                <rect x={0} y={0} width={1} height={1} fill="rgba(10,10,11,0.5)" stroke="#C6A664" strokeWidth="0.02" />
                {sections.map((section) => {
                    const pts = section.footprint;
                    const selected = section.id === selectedSectionId;
                    const pathD =
                        pts.length >= 2
                            ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toSvg(p).x} ${toSvg(p).y}`).join(' ') + ' Z'
                            : '';
                    return (
                        <g key={section.id}>
                            <path
                                d={pathD}
                                fill={selected ? 'rgba(198,166,100,0.15)' : 'rgba(198,166,100,0.08)'}
                                stroke="#C6A664"
                                strokeWidth="0.018"
                                strokeLinejoin="round"
                                onClick={(e) => { e.stopPropagation(); onSelectSection(section.id); }}
                                style={{ cursor: 'pointer' }}
                            />
                            {selected &&
                                pts.map((p, i) => {
                                    const { x, y } = toSvg(p);
                                    return (
                                        <circle
                                            key={i}
                                            cx={x}
                                            cy={y}
                                            r={0.03}
                                            fill="#C6A664"
                                            stroke="#0A0A0B"
                                            strokeWidth="0.012"
                                            className="cursor-grab active:cursor-grabbing"
                                            onPointerDown={(ev) => handlePointerDown(ev, section.id, i)}
                                        />
                                    );
                                })}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
