import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import UnitArchitectChoiceCards, { type UnitArchitectPath } from './UnitArchitectChoiceCards';
import UnitArchitectStepProgress from './UnitArchitectStepProgress';
import UnitIdentityForm, { type UnitIdentityValues } from './UnitIdentityForm';

interface AddUnitsModalProps {
    open: boolean;
    onClose: () => void;
}

export default function AddUnitsModal({ open, onClose }: AddUnitsModalProps) {
    const [path, setPath] = useState<UnitArchitectPath>(null);
    const [step, setStep] = useState(0);
    const [identityData, setIdentityData] = useState<UnitIdentityValues | null>(null);

    const handleClose = () => {
        setPath(null);
        setStep(0);
        setIdentityData(null);
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

    const handleGeometryBack = () => setStep(0);

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
                                <p className="text-[#94A3B8] text-sm">
                                    Add Units By Section will be available in a later update. Use Add Custom Unit for now.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setPath(null)}
                                    className="mt-6 px-6 py-3 rounded-xl border border-[#C6A664]/40 text-[#C6A664] text-[11px] tracking-[0.2em] uppercase hover:bg-[#C6A664]/10 transition-colors"
                                >
                                    Back to choices
                                </button>
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
                                    {showStepProgress && <UnitArchitectStepProgress currentStep={step} />}
                                    {step === 0 && (
                                        <UnitIdentityForm
                                            onNext={handleIdentityNext}
                                            onBack={() => setPath(null)}
                                        />
                                    )}
                                    {step === 1 && (
                                        <div className="space-y-6">
                                            {identityData?.unit_number && (
                                                <p className="text-[#C6A664] text-[10px] tracking-wider uppercase text-center">
                                                    Unit {identityData.unit_number}
                                                </p>
                                            )}
                                            <p className="text-[#94A3B8] text-sm text-center py-8">
                                                Geometry Configuration — polygon and dimensions — will be implemented in the next prompt.
                                            </p>
                                            <div className="flex justify-between pt-4 border-t border-white/10">
                                                <button
                                                    type="button"
                                                    onClick={handleGeometryBack}
                                                    className="px-6 py-3 rounded-xl border border-white/10 text-[#94A3B8] text-[11px] tracking-[0.2em] uppercase hover:bg-white/5 transition-colors"
                                                >
                                                    Back
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
