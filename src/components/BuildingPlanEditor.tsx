import { useState, useCallback } from 'react';
import { regularPolygonVertices, type Point2 } from '../lib/polygonUtils';
import type { SectionPlan, SectionPlanSection } from '../lib/database.types';
import BirdEyeCanvas from './BirdEyeCanvas';
import BuildingPlanTopDownView, { type PlanViewSize } from './BuildingPlanTopDownView';
import SectionListSidebar from './SectionListSidebar';

const DEFAULT_BASE_WIDTH = 20;
const DEFAULT_BASE_DEPTH = 20;
const DEFAULT_PLAN_VIEW: PlanViewSize = { width: 480, height: 480 };

interface BuildingPlanEditorProps {
    initialPlan: SectionPlan | null;
    onPlanChange: (plan: SectionPlan) => void;
    modelUrl?: string | null;
    modelExtension?: string;
}

function verticesToNormalized(pts: Point2[]): Point2[] {
    return pts.map(([x, y]) => [0.5 + 0.4 * x, 0.5 + 0.4 * y] as Point2);
}

export default function BuildingPlanEditor({ initialPlan, onPlanChange, modelUrl = null, modelExtension }: BuildingPlanEditorProps) {
    const [baseWidth, setBaseWidth] = useState(initialPlan?.baseWidth ?? DEFAULT_BASE_WIDTH);
    const [baseDepth, setBaseDepth] = useState(initialPlan?.baseDepth ?? DEFAULT_BASE_DEPTH);
    const [sections, setSections] = useState<SectionPlanSection[]>(initialPlan?.sections ?? []);
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
    const [planViewSize, setPlanViewSize] = useState<PlanViewSize>(DEFAULT_PLAN_VIEW);
    const [fitTrigger, setFitTrigger] = useState(0);

    const handleAddSection = useCallback(
        (sides: number) => {
            const id = `section-${Date.now()}`;
            const verts = verticesToNormalized(regularPolygonVertices(sides));
            const label = `Section ${sections.length + 1}`;
            const next = [...sections, { id, label, footprint: verts }];
            setSections(next);
            setSelectedSectionId(id);
            onPlanChange({ baseWidth, baseDepth, sections: next });
        },
        [sections, baseWidth, baseDepth, onPlanChange]
    );

    const handleUpdateLabel = useCallback(
        (id: string, label: string) => {
            const next = sections.map((s) => (s.id === id ? { ...s, label } : s));
            setSections(next);
            onPlanChange({ baseWidth, baseDepth, sections: next });
        },
        [sections, baseWidth, baseDepth, onPlanChange]
    );

    const handleDeleteSection = useCallback(
        (id: string) => {
            const next = sections.filter((s) => s.id !== id);
            setSections(next);
            if (selectedSectionId === id) setSelectedSectionId(null);
            onPlanChange({ baseWidth, baseDepth, sections: next });
        },
        [sections, baseWidth, baseDepth, selectedSectionId, onPlanChange]
    );

    const handleVerticesChange = useCallback(
        (sectionId: string, vertices: Point2[]) => {
            const next = sections.map((s) => (s.id === sectionId ? { ...s, footprint: vertices } : s));
            setSections(next);
            onPlanChange({ baseWidth, baseDepth, sections: next });
        },
        [sections, baseWidth, baseDepth, onPlanChange]
    );

    return (
        <div className="flex gap-6 min-h-0 flex-1">
            <div className="flex-[2] min-w-0 flex flex-col items-center shrink-0">
                <div className="relative" style={{ width: planViewSize.width, height: planViewSize.height }}>
                    <BuildingPlanTopDownView
                        modelUrl={modelUrl ?? null}
                        modelExtension={modelExtension}
                        onSizeChange={setPlanViewSize}
                        fitTrigger={fitTrigger}
                    />
                    <BirdEyeCanvas
                        sections={sections}
                        selectedSectionId={selectedSectionId}
                        onSelectSection={setSelectedSectionId}
                        onVerticesChange={handleVerticesChange}
                        overlay
                        width={planViewSize.width}
                        height={planViewSize.height}
                    />
                </div>
                <div className="flex items-center justify-between gap-2 w-full mt-2" style={{ maxWidth: planViewSize.width }}>
                    <p className="text-[9px] tracking-wider text-[#94A3B8] uppercase">Top-down view · Draw sections on the plan</p>
                    {modelUrl && (
                        <button
                            type="button"
                            onClick={() => setFitTrigger((t) => t + 1)}
                            className="shrink-0 px-3 py-1.5 rounded-lg border border-white/10 text-[9px] tracking-widest uppercase text-[#C6A664] hover:bg-white/5 transition-colors"
                        >
                            Fit Model
                        </button>
                    )}
                </div>
            </div>
            <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar space-y-6 pr-1">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5">Base width</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={baseWidth}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                if (!Number.isNaN(v) && v > 0) {
                                    setBaseWidth(v);
                                    onPlanChange({ baseWidth: v, baseDepth, sections });
                                }
                            }}
                            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA]"
                        />
                    </div>
                    <div>
                        <label className="block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5">Base depth</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={baseDepth}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                if (!Number.isNaN(v) && v > 0) {
                                    setBaseDepth(v);
                                    onPlanChange({ baseWidth, baseDepth: v, sections });
                                }
                            }}
                            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA]"
                        />
                    </div>
                </div>
                <SectionListSidebar
                    sections={sections}
                    selectedSectionId={selectedSectionId}
                    onSelectSection={setSelectedSectionId}
                    onUpdateLabel={handleUpdateLabel}
                    onDeleteSection={handleDeleteSection}
                    onAddSection={handleAddSection}
                />
            </div>
        </div>
    );
}
