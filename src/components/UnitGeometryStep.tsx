'use client';

import { useState, useEffect } from 'react';
import { regularPolygonVertices, type Point2 } from '@/lib/polygonUtils';
import PolygonCanvas from './PolygonCanvas';
import GeometryConfigForm, { type GeometryFormValues } from './GeometryConfigForm';

export type GeometryData = {
    width: number;
    height: number;
    depth: number;
    footprint: Point2[];
};

interface UnitGeometryStepProps {
    onNext: (data: GeometryData) => void;
    onBack: () => void;
}

const DEFAULT_SIDES = 4;
const DEFAULT_WIDTH = 3;
const DEFAULT_HEIGHT = 2.5;
const DEFAULT_DEPTH = 3;

export default function UnitGeometryStep({ onNext, onBack }: UnitGeometryStepProps) {
    const [sides, setSides] = useState(DEFAULT_SIDES);
    const [width, setWidth] = useState(DEFAULT_WIDTH);
    const [height, setHeight] = useState(DEFAULT_HEIGHT);
    const [depth, setDepth] = useState(DEFAULT_DEPTH);
    const [vertices, setVertices] = useState<Point2[]>(() => regularPolygonVertices(DEFAULT_SIDES));
    const [errors, setErrors] = useState<Partial<Record<keyof GeometryFormValues, string>>>({});

    useEffect(() => {
        const n = sides >= 3 ? sides : DEFAULT_SIDES;
        setVertices(regularPolygonVertices(n));
    }, [sides]);

    const handleNext = () => {
        const err: typeof errors = {};
        const s = sides >= 3 ? sides : 0;
        if (s < 3) err.sides = 'Enter at least 3 sides';
        if (!(width > 0)) err.width = 'Width is required';
        if (!(height > 0)) err.height = 'Height is required';
        if (!(depth > 0)) err.depth = 'Depth is required';
        setErrors(err);
        if (Object.keys(err).length > 0) return;
        onNext({
            width,
            height,
            depth,
            footprint: [...vertices],
        });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div>
                <GeometryConfigForm
                    sides={sides}
                    width={width}
                    height={height}
                    depth={depth}
                    onSidesChange={setSides}
                    onWidthChange={setWidth}
                    onHeightChange={setHeight}
                    onDepthChange={setDepth}
                    errors={errors}
                />
            </div>
            <div className="flex flex-col items-center gap-4">
                <p className="text-[9px] tracking-[0.2em] text-[#94A3B8] uppercase">Footprint · drag vertices</p>
                <PolygonCanvas vertices={vertices} onVerticesChange={setVertices} />
            </div>
            <div className="md:col-span-2 flex justify-between pt-4 border-t border-white/10">
                <button
                    type="button"
                    onClick={onBack}
                    className="px-6 py-3 rounded-xl border border-white/10 text-[#94A3B8] text-[11px] tracking-[0.2em] uppercase hover:bg-white/5 transition-colors"
                >
                    Back
                </button>
                <button
                    type="button"
                    onClick={handleNext}
                    className="px-8 py-3 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] tracking-[0.2em] font-bold uppercase hover:opacity-90 transition-opacity"
                >
                    Next
                </button>
            </div>
        </div>
    );
}
