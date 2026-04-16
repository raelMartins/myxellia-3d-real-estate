'use client';

import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { regularPolygonVertices, type Point2 } from '@/lib/polygonUtils';
import PolygonCanvas from './PolygonCanvas';
import GeometryConfigForm, { type GeometryFormValues } from './GeometryConfigForm';

const PLAN_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp,image/gif';

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
    const planInputId = useId();
    const planFileInputRef = useRef<HTMLInputElement>(null);
    const planObjectUrlRef = useRef<string | null>(null);

    const [sides, setSides] = useState(DEFAULT_SIDES);
    const [width, setWidth] = useState(DEFAULT_WIDTH);
    const [height, setHeight] = useState(DEFAULT_HEIGHT);
    const [depth, setDepth] = useState(DEFAULT_DEPTH);
    const [vertices, setVertices] = useState<Point2[]>(() => regularPolygonVertices(DEFAULT_SIDES));
    const [errors, setErrors] = useState<Partial<Record<keyof GeometryFormValues, string>>>({});
    const [planObjectUrl, setPlanObjectUrl] = useState<string | null>(null);

    const revokePlanUrl = useCallback(() => {
        if (planObjectUrlRef.current) {
            URL.revokeObjectURL(planObjectUrlRef.current);
            planObjectUrlRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            revokePlanUrl();
        };
    }, [revokePlanUrl]);

    const handleSidesChange = useCallback(
        (n: number) => {
            setSides(n);
            if (!planObjectUrl) {
                const effective = n >= 3 ? n : DEFAULT_SIDES;
                setVertices(regularPolygonVertices(effective));
            }
        },
        [planObjectUrl]
    );

    const handlePlanFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !file.type.startsWith('image/')) return;
        revokePlanUrl();
        const url = URL.createObjectURL(file);
        planObjectUrlRef.current = url;
        setPlanObjectUrl(url);
    };

    const handleRemovePlan = () => {
        revokePlanUrl();
        setPlanObjectUrl(null);
        const n = sides >= 3 ? sides : DEFAULT_SIDES;
        setVertices(regularPolygonVertices(n));
    };

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
                    onSidesChange={handleSidesChange}
                    onWidthChange={setWidth}
                    onHeightChange={setHeight}
                    onDepthChange={setDepth}
                    errors={errors}
                    sidesDisabled={!!planObjectUrl}
                />
            </div>
            <div className="flex flex-col items-center gap-4 w-full max-w-[320px] mx-auto md:mx-0 md:max-w-none">
                <p className="text-[9px] tracking-[0.2em] text-[#94A3B8] uppercase">Footprint · drag vertices</p>
                <PolygonCanvas
                    vertices={vertices}
                    onVerticesChange={setVertices}
                    backgroundImageHref={planObjectUrl}
                />
                <input
                    ref={planFileInputRef}
                    id={planInputId}
                    type="file"
                    accept={PLAN_ACCEPT}
                    className="sr-only"
                    onChange={handlePlanFileChange}
                />
                <div className="flex flex-col items-center gap-2 w-full">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => planFileInputRef.current?.click()}
                            className="px-4 py-2 rounded-lg border border-white/15 text-[#F5F7FA] text-[10px] tracking-[0.15em] uppercase hover:bg-white/5 transition-colors"
                        >
                            {planObjectUrl ? 'Replace floor plan' : 'Upload floor plan'}
                        </button>
                        {planObjectUrl ? (
                            <button
                                type="button"
                                onClick={handleRemovePlan}
                                className="px-4 py-2 rounded-lg border border-white/10 text-[#94A3B8] text-[10px] tracking-[0.15em] uppercase hover:bg-white/5 transition-colors"
                            >
                                Remove plan
                            </button>
                        ) : null}
                    </div>
                    <p className="text-center text-[10px] text-[#94A3B8]/90 leading-relaxed px-1">
                        Optional: add a plan image to trace the footprint. The image stays in your browser only and is not saved with the unit.
                    </p>
                </div>
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
