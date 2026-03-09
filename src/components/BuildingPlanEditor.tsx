import { useState, useCallback } from 'react';
import { regularPolygonVertices, type Point2 } from '../lib/polygonUtils';
import type { SectionPlan, SectionPlanSection } from '../lib/database.types';
import BirdEyeCanvas from './BirdEyeCanvas';
import SectionListSidebar from './SectionListSidebar';

const DEFAULT_BASE_WIDTH = 20;
const DEFAULT_BASE_DEPTH = 20;

interface BuildingPlanEditorProps {
    initialPlan: SectionPlan | null;
    onPlanChange: (plan: SectionPlan) => void;
}

function verticesToNormalized(pts: Point2[]): Point2[] {
    return pts.map(([x, y]) => [0.5 + 0.4 * x, 0.5 + 0.4 * y] as Point2);
}

export default function BuildingPlanEditor({ initialPlan, onPlanChange }: BuildingPlanEditorProps) {
    const [baseWidth, setBaseWidth] = useState(initialPlan?.baseWidth ?? DEFAULT_BASE_WIDTH);
    const [baseDepth, setBaseDepth] = useState(initialPlan?.baseDepth ?? DEFAULT_BASE_DEPTH);
    const [sections, setSections] = useState<SectionPlanSection[]>(initialPlan?.sections ?? []);
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

    const notify = useCallback(() => {
        onPlanChange({ baseWidth, baseDepth, sections });
    }, [baseWidth, baseDepth, sections, onPlanChange]);

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
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
                <p className="text-[9px] tracking-wider text-[#94A3B8] uppercase">Top-down view · Select a section to drag vertices</p>
                <BirdEyeCanvas
                    sections={sections}
                    selectedSectionId={selectedSectionId}
                    onSelectSection={setSelectedSectionId}
                    onVerticesChange={handleVerticesChange}
                />
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
    );
}
