'use client';

import { useRef, useCallback } from 'react';
import { isSimplePolygon, type Point2 } from '@/lib/polygonUtils';
import type { SectionPlanSection } from '@/lib/database.types';

const DEFAULT_SIZE = 320;
const PAD = 0.02;

interface BirdEyeCanvasProps {
    sections: SectionPlanSection[];
    selectedSectionId: string | null;
    onSelectSection: (id: string | null) => void;
    onVerticesChange: (sectionId: string, vertices: Point2[]) => void;
    /** When true, use transparent background for overlay on 3D view */
    overlay?: boolean;
    /** Square size or explicit width/height for overlay (matches 3D view aspect) */
    size?: number;
    width?: number;
    height?: number;
}

export default function BirdEyeCanvas({
    sections,
    selectedSectionId,
    onSelectSection,
    onVerticesChange,
    overlay = false,
    size = DEFAULT_SIZE,
    width: widthProp,
    height: heightProp,
}: BirdEyeCanvasProps) {
    const w = widthProp ?? size;
    const h = heightProp ?? size;
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
            onVerticesChange(d.sectionId, next);
        },
        [sections, onVerticesChange, fromSvg]
    );

    const handlePointerUp = (e: React.PointerEvent) => {
        (e.target as SVGElement).releasePointerCapture(e.pointerId);
        draggingRef.current = null;
    };

    const strokeColor = overlay ? 'rgba(198,166,100,0.4)' : '#C6A664';
    const rectFill = overlay ? 'none' : 'rgba(10,10,11,0.5)';
    const rectStroke = overlay ? 'rgba(198,166,100,0.35)' : '#C6A664';
    const aspectRatio = overlay ? 'none' : 'xMidYMid meet';
    const viewBox = overlay ? '-0.005 -0.005 1.01 1.01' : `${-PAD} ${-PAD} ${1 + 2 * PAD} ${1 + 2 * PAD}`;

    return (
        <div
            className={overlay ? 'absolute inset-0 overflow-hidden pointer-events-none [&>*]:pointer-events-auto' : 'border-[0.5px] border-white/10 bg-white/5 overflow-hidden'}
            style={{ width: w, height: h }}
        >
            <svg
                ref={svgRef}
                viewBox={viewBox}
                preserveAspectRatio={aspectRatio}
                className="w-full h-full cursor-crosshair block"
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                <rect x={0} y={0} width={1} height={1} fill={rectFill} stroke={rectStroke} strokeWidth="0.01" />
                <g stroke="rgba(198,166,100,0.12)" strokeWidth="0.004">
                    {[0.25, 0.5, 0.75].map((t) => (
                        <line key={`v-${t}`} x1={t} y1={0} x2={t} y2={1} />
                    ))}
                    {[0.25, 0.5, 0.75].map((t) => (
                        <line key={`h-${t}`} x1={0} y1={t} x2={1} y2={t} />
                    ))}
                </g>
                {sections.length === 0 && !overlay && (
                    <text
                        x="0.5"
                        y="0.5"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="rgba(148,163,184,0.7)"
                        fontSize="0.055"
                        className="pointer-events-none select-none"
                    >
                        Add a section in the sidebar to draw the plan
                    </text>
                )}
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
                                fill={selected ? 'rgba(198,166,100,0.2)' : 'rgba(198,166,100,0.1)'}
                                stroke={strokeColor}
                                strokeWidth="0.006"
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
                                            r={0.01}
                                            fill="#C6A664"
                                            stroke="#0A0A0B"
                                            strokeWidth="0.004"
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
