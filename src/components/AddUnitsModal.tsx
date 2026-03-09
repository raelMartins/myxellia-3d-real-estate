import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import UnitArchitectChoiceCards, { type UnitArchitectPath } from './UnitArchitectChoiceCards';
import UnitArchitectStepProgress from './UnitArchitectStepProgress';
import UnitIdentityForm, { type UnitIdentityValues } from './UnitIdentityForm';
import UnitGeometryStep, { type GeometryData } from './UnitGeometryStep';
import InteriorUploadStep from './InteriorUploadStep';

const CUSTOM_STEPS = ['Unit Identity', 'Geometry Configuration', 'Add Interior (optional)'] as const;

export type UnitCreateResult = { unitId: string; hadInterior: boolean };

interface AddUnitsModalProps {
    open: boolean;
    onClose: () => void;
    onComplete: (identity: UnitIdentityValues, geometry: GeometryData, interiorFile: File | null) => Promise<UnitCreateResult | null>;
    onSuccess?: (result: UnitCreateResult) => void;
    onOpenSectionPlan?: () => void;
}

export default function AddUnitsModal({ open, onClose, onComplete, onSuccess, onOpenSectionPlan }: AddUnitsModalProps) {
    const [path, setPath] = useState<UnitArchitectPath>(null);
    const [step, setStep] = useState(0);
    const [identityData, setIdentityData] = useState<UnitIdentityValues | null>(null);
    const [geometryData, setGeometryData] = useState<GeometryData | null>(null);
    const [interiorFile, setInteriorFile] = useState<File | null>(null);
    const [completing, setCompleting] = useState(false);

    const handleClose = () => {
        setPath(null);
        setStep(0);
        setIdentityData(null);
        setGeometryData(null);
        setInteriorFile(null);
        onClose();
    };

    const handleSelectPath = (p: UnitArchitectPath) => {
        setPath(p);
        if (p === 'custom') setStep(0);
    };

    const handleIdentityNext = (data: UnitIdentityValues) => {
        setIdentityData(data);
        setStep(1);
    };

    const handleGeometryNext = (data: GeometryData) => {
        setGeometryData(data);
        setStep(2);
    };

    const handleGeometryBack = () => setStep(0);
    const handleInteriorBack = () => setStep(1);

    const handleComplete = async () => {
        if (!identityData || !geometryData) return;
        setCompleting(true);
        try {
            const result = await onComplete(identityData, geometryData, interiorFile);
            if (result != null) {
                onSuccess?.(result);
                handleClose();
            }
        } finally {
            setCompleting(false);
        }
    };

    const showStepProgress = path === 'custom' && step >= 0;
    const isSectionPath = path === 'section';

    const modalContent = open ? (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                onClick={handleClose}
            >
                <motion.div
                    initial={{ scale: 0.96, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.96, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={(e) => e.stopPropagation()}
                    className="glass-heavy rounded-2xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
                    style={{ minHeight: 'min(600px, 90vh)' }}
                >
                    <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
                        <h2 className="font-serif-display text-2xl text-[#F5F7FA]">
                            {path == null && 'Add units'}
                            {path === 'custom' && 'Add custom unit'}
                            {path === 'section' && 'Add units by section'}
                        </h2>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="p-2 rounded-lg hover:bg-white/10 text-[#94A3B8] transition-colors"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        {path == null && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="py-4"
                            >
                                <p className="text-center text-[#94A3B8] text-sm tracking-wide mb-8">
                                    Choose how you want to add units to this building.
                                </p>
                                <UnitArchitectChoiceCards onSelect={handleSelectPath} />
                            </motion.div>
                        )}

                        {isSectionPath && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="py-12 text-center"
                            >
                                <p className="text-[#94A3B8] text-sm mb-6">
                                    Draw section polygons on the building plan, then generate units by floor. You can map old unit data to new prisms.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <button
                                        type="button"
                                        onClick={() => { onOpenSectionPlan?.(); onClose(); }}
                                        className="px-8 py-3 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] tracking-[0.2em] font-bold uppercase hover:opacity-90"
                                    >
                                        Open Building Plan
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPath(null)}
                                        className="px-6 py-3 rounded-xl border border-white/10 text-[#94A3B8] text-[11px] tracking-[0.2em] uppercase hover:bg-white/5"
                                    >
                                        Back to choices
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        <AnimatePresence mode="wait">
                            {path === 'custom' && (
                                <motion.div
                                    key={step}
                                    initial={{ opacity: 0, x: step === 1 ? -12 : 12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: step === 1 ? 12 : -12 }}
                                    transition={{ duration: 0.2 }}
                                    className="py-4"
                                >
                                    {showStepProgress && <UnitArchitectStepProgress currentStep={step} steps={CUSTOM_STEPS} />}
                                    {step === 0 && (
                                        <UnitIdentityForm
                                            onNext={handleIdentityNext}
                                            onBack={() => setPath(null)}
                                        />
                                    )}
                                    {step === 1 && (
                                        <UnitGeometryStep
                                            onNext={handleGeometryNext}
                                            onBack={handleGeometryBack}
                                        />
                                    )}
                                    {step === 2 && (
                                        <div className="space-y-6">
                                            {identityData?.unit_number && (
                                                <p className="text-[#C6A664] text-[10px] tracking-wider uppercase">
                                                    Unit {identityData.unit_number}
                                                </p>
                                            )}
                                            <InteriorUploadStep
                                                unitNumber={identityData?.unit_number ?? ''}
                                                file={interiorFile}
                                                onFileChange={setInteriorFile}
                                            />
                                            <div className="flex justify-between pt-4 border-t border-white/10">
                                                <button
                                                    type="button"
                                                    onClick={handleInteriorBack}
                                                    disabled={completing}
                                                    className="px-6 py-3 rounded-xl border border-white/10 text-[#94A3B8] text-[11px] tracking-[0.2em] uppercase hover:bg-white/5 transition-colors disabled:opacity-50"
                                                >
                                                    Back
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleComplete}
                                                    disabled={completing}
                                                    className="px-8 py-3 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] tracking-[0.2em] font-bold uppercase hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    {completing ? <Loader2 size={14} className="animate-spin" /> : null}
                                                    {completing ? 'Creating...' : 'Complete'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    ) : null;

    if (typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
}
