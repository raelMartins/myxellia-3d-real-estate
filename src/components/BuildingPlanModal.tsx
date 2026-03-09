import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import UnitArchitectStepProgress from './UnitArchitectStepProgress';
import BuildingPlanEditor from './BuildingPlanEditor';
import SectionFloorsConfig, { type NewUnitSlot } from './SectionFloorsConfig';
import MigrationReconcileView from './MigrationReconcileView';
import type { SectionPlan } from '../lib/database.types';
import type { UnitRow } from '../lib/database.types';

const STEPS_BASE = ['Bird\'s Eye Plan', 'Floors & Height'] as const;

export type BuildingPlanApplyPayload = {
    plan: SectionPlan;
    newSlots: NewUnitSlot[];
    mapping: Record<number, string | null>;
};

interface BuildingPlanModalProps {
    open: boolean;
    onClose: () => void;
    buildingId: string;
    building: { section_plan?: SectionPlan | null } | null;
    oldUnits: UnitRow[];
    onApply: (payload: BuildingPlanApplyPayload) => Promise<void>;
}

export default function BuildingPlanModal({ open, onClose, buildingId, building, oldUnits, onApply }: BuildingPlanModalProps) {
    const [step, setStep] = useState(0);
    const [plan, setPlan] = useState<SectionPlan | null>(building?.section_plan ?? null);
    const [newSlots, setNewSlots] = useState<NewUnitSlot[]>([]);
    const [mapping, setMapping] = useState<Record<number, string | null>>({});
    const [applying, setApplying] = useState(false);

    const hasMigration = oldUnits.length > 0;
    const steps = hasMigration ? [...STEPS_BASE, 'Data Reconciliation', 'Apply'] : [...STEPS_BASE, 'Apply'];
    const migrationStepIndex = 2;
    const applyStepIndex = hasMigration ? 3 : 2;

    const handlePlanChange = useCallback((p: SectionPlan) => setPlan(p), []);

    const handleSlotsFromFloors = useCallback((slots: NewUnitSlot[]) => {
        setNewSlots(slots);
        setMapping({});
        setStep(hasMigration ? migrationStepIndex : applyStepIndex);
    }, [hasMigration, migrationStepIndex, applyStepIndex]);

    const handleApply = useCallback(async () => {
        if (!plan || plan.sections.length === 0 || newSlots.length === 0) return;
        setApplying(true);
        try {
            await onApply({ plan, newSlots, mapping });
            onClose();
        } finally {
            setApplying(false);
        }
    }, [plan, newSlots, mapping, onApply, onClose]);

    if (!open) return null;

    const content = (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.96, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.96, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="glass-heavy rounded-2xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
                    style={{ minHeight: 'min(560px, 90vh)' }}
                >
                    <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
                        <h2 className="font-serif-display text-2xl text-[#F5F7FA]">
                            {building?.section_plan ? 'Update Building Plan' : 'Add Building Plan'}
                        </h2>
                        <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-[#94A3B8]" aria-label="Close">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <UnitArchitectStepProgress currentStep={step} steps={steps} />
                        <AnimatePresence mode="wait">
                            {step === 0 && (
                                <motion.div key="plan" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
                                    <BuildingPlanEditor initialPlan={plan} onPlanChange={handlePlanChange} />
                                    <div className="flex justify-end mt-6">
                                        <button
                                            type="button"
                                            onClick={() => plan && plan.sections.length > 0 && setStep(1)}
                                            disabled={!plan || plan.sections.length === 0}
                                            className="px-8 py-3 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] tracking-[0.2em] font-bold uppercase disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                            {step === 1 && (
                                <motion.div key="floors" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
                                    {plan && (
                                        <SectionFloorsConfig
                                            plan={plan}
                                            onSlotsChange={handleSlotsFromFloors}
                                        />
                                    )}
                                    <button type="button" onClick={() => setStep(0)} className="mt-4 px-6 py-3 rounded-xl border border-white/10 text-[#94A3B8] text-[11px] uppercase">
                                        Back
                                    </button>
                                </motion.div>
                            )}
                            {step === migrationStepIndex && hasMigration && (
                                <motion.div key="migration" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
                                    <MigrationReconcileView
                                        oldUnits={oldUnits}
                                        newSlots={newSlots}
                                        mapping={mapping}
                                        onMappingChange={(i, id) => setMapping((m) => ({ ...m, [i]: id }))}
                                    />
                                    <div className="flex justify-between mt-6">
                                        <button type="button" onClick={() => setStep(1)} className="px-6 py-3 rounded-xl border border-white/10 text-[#94A3B8] text-[11px] uppercase">Back</button>
                                        <button type="button" onClick={handleApply} disabled={applying} className="px-8 py-3 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] font-bold uppercase flex items-center gap-2 disabled:opacity-50">
                                            {applying ? <Loader2 size={14} className="animate-spin" /> : null}
                                            {applying ? 'Applying...' : 'Apply'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                            {step === applyStepIndex && (
                                <motion.div key="apply" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
                                    <p className="text-[#94A3B8] text-sm mb-4">
                                        {newSlots.length} unit(s) will be created. {hasMigration ? 'Mapped old unit data will be copied; unmapped units will be archived.' : ''}
                                    </p>
                                    <div className="flex justify-between">
                                        <button type="button" onClick={() => setStep(hasMigration ? migrationStepIndex : 1)} className="px-6 py-3 rounded-xl border border-white/10 text-[#94A3B8] text-[11px] uppercase">Back</button>
                                        <button type="button" onClick={handleApply} disabled={applying} className="px-8 py-3 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] font-bold uppercase flex items-center gap-2 disabled:opacity-50">
                                            {applying ? <Loader2 size={14} className="animate-spin" /> : null}
                                            {applying ? 'Applying...' : 'Apply'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(content, document.body);
}
