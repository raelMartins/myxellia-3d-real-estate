'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import InteriorModelUpload from './InteriorModelUpload';
import type { Database } from '@/lib/database.types';

type UnitRow = Database['public']['Tables']['units']['Row'];

interface InteriorUploadModalProps {
    open: boolean;
    onClose: () => void;
    unit: UnitRow | null;
    onUploaded: () => void;
    onError: (message: string) => void;
}

export default function InteriorUploadModal({
    open, onClose, unit, onUploaded, onError,
}: InteriorUploadModalProps) {
    const [previewVisible, setPreviewVisible] = useState(false);

    if (!open) return null;

    const handleUploaded = () => {
        onUploaded();
        onClose();
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-md"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.96, opacity: 0 }}
                    animate={{
                        scale: 1,
                        opacity: 1,
                        height: previewVisible ? '80vh' : 'min(340px, 80vh)',
                    }}
                    exit={{ scale: 0.96, opacity: 0 }}
                    transition={{ height: { type: 'tween', duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } }}
                    onClick={(e) => e.stopPropagation()}
                    className="glass-heavy rounded-2xl border border-white/10 flex flex-col w-full max-w-[750px] max-h-[80vh] overflow-hidden shadow-2xl"
                >
                    <div className="flex items-center justify-between shrink-0 px-6 py-5 border-b border-white/5">
                        <h3 className="font-serif-display text-xl text-[#F5F7FA]">
                            {unit ? `Interior view · Unit ${unit.unit_number}` : 'Add interior view'}
                        </h3>
                        <button type="button" onClick={onClose} className="p-2.5 rounded-xl hover:bg-white/10 text-[#94A3B8] transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden p-6 flex flex-col">
                        {unit ? (
                            <InteriorModelUpload
                                unitId={unit.id}
                                unitNumber={unit.unit_number}
                                onUploaded={handleUploaded}
                                onError={onError}
                                previewHeight={320}
                                onPreviewVisible={setPreviewVisible}
                                previewFillsSpace
                            />
                        ) : (
                            <p className="text-[#94A3B8] text-sm">Select a unit first.</p>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
