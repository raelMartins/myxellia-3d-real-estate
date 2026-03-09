import { useState } from 'react';
import type { SectionPlan } from '../lib/database.types';

export type NewUnitSlot = {
    sectionId: string;
    sectionLabel: string;
    floorIndex: number;
    footprint: [number, number][];
    floorHeight: number;
    yPosition: number;
};

interface SectionFloorsConfigProps {
    plan: SectionPlan;
    defaultFloors?: number;
    defaultFloorHeight?: number;
    onSlotsChange: (slots: NewUnitSlot[]) => void;
}

export default function SectionFloorsConfig({
    plan,
    defaultFloors = 3,
    defaultFloorHeight = 2.5,
    onSlotsChange,
}: SectionFloorsConfigProps) {
    const [applyAllFloors, setApplyAllFloors] = useState(defaultFloors);
    const [applyAllHeight, setApplyAllHeight] = useState(defaultFloorHeight);
    const [perSection, setPerSection] = useState<Record<string, { floors: number; floorHeight: number }>>({});

    const getFloors = (sectionId: string) => perSection[sectionId]?.floors ?? applyAllFloors;
    const getHeight = (sectionId: string) => perSection[sectionId]?.floorHeight ?? applyAllHeight;

    const updatePerSection = (sectionId: string, floors: number, floorHeight: number) => {
        setPerSection((prev) => ({ ...prev, [sectionId]: { floors, floorHeight } }));
    };

    const buildSlots = (): NewUnitSlot[] => {
        const out: NewUnitSlot[] = [];
        plan.sections.forEach((section) => {
            const floors = getFloors(section.id);
            const floorHeight = getHeight(section.id);
            for (let f = 0; f < floors; f++) {
                out.push({
                    sectionId: section.id,
                    sectionLabel: section.label,
                    floorIndex: f,
                    footprint: section.footprint,
                    floorHeight,
                    yPosition: f * floorHeight,
                });
            }
        });
        return out;
    };

    const handleApplyAll = () => {
        const slots = buildSlots();
        onSlotsChange(slots);
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 max-w-md">
                <div>
                    <label className="block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5">Apply to all: Floors</label>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={applyAllFloors}
                        onChange={(e) => setApplyAllFloors(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA]"
                    />
                </div>
                <div>
                    <label className="block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5">Apply to all: Floor height</label>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={applyAllHeight}
                        onChange={(e) => setApplyAllHeight(Math.max(0.1, parseFloat(e.target.value) || 2.5))}
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA]"
                    />
                </div>
            </div>
            <div className="space-y-3">
                <div className="text-[9px] tracking-[0.2em] text-[#94A3B8] uppercase">Per section override</div>
                {plan.sections.map((section) => (
                    <div key={section.id} className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-xs font-medium text-[#F5F7FA] min-w-[100px]">{section.label}</span>
                        <div className="flex items-center gap-2">
                            <label className="text-[9px] text-[#94A3B8]">Floors</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={getFloors(section.id)}
                                onChange={(e) => {
                                    const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                                    updatePerSection(section.id, v, getHeight(section.id));
                                }}
                                className="w-16 rounded bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-[#F5F7FA]"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-[9px] text-[#94A3B8]">Height</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={getHeight(section.id)}
                                onChange={(e) => {
                                    const v = Math.max(0.1, parseFloat(e.target.value) || 2.5);
                                    updatePerSection(section.id, getFloors(section.id), v);
                                }}
                                className="w-20 rounded bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-[#F5F7FA]"
                            />
                        </div>
                    </div>
                ))}
            </div>
            <button
                type="button"
                onClick={handleApplyAll}
                className="px-6 py-3 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] tracking-[0.2em] font-bold uppercase hover:opacity-90"
            >
                Preview & continue
            </button>
        </div>
    );
}
