'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle } from 'lucide-react';
import type { UnitSuggestion } from '@/lib/ai';

interface SuggestUnitsModalProps {
    open: boolean;
    loading: boolean;
    saving: boolean;
    error: string | null;
    suggestions: UnitSuggestion[];
    confirmed: Set<number>;
    onClose: () => void;
    onToggle: (index: number) => void;
    onSave: () => void;
}

export default function SuggestUnitsModal({
    open, loading, saving, error, suggestions, confirmed,
    onClose, onToggle, onSave
}: SuggestUnitsModalProps) {
    if (!open) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
                onClick={() => !loading && !saving && onClose()}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="glass-heavy rounded-2xl border border-white/10 p-8 max-w-md w-full max-h-[80vh] overflow-y-auto"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-serif-display text-xl text-[#F5F7FA]">AI unit suggestions</h3>
                        <button onClick={() => !loading && !saving && onClose()} className="p-2 rounded-lg hover:bg-white/10 text-[#94A3B8]">
                            <X size={18} />
                        </button>
                    </div>
                    {loading && (
                        <div className="flex items-center gap-3 text-[#C6A664] py-8">
                            <Loader2 size={20} className="animate-spin" />
                            <span className="text-sm">Analyzing building view…</span>
                        </div>
                    )}
                    {error && (
                        <p className="text-red-400 text-sm mb-4">{error}</p>
                    )}
                    {!loading && suggestions.length > 0 && (
                        <>
                            <p className="text-[#94A3B8] text-xs tracking-wider uppercase mb-4">Confirm which suggestions to add as units</p>
                            <ul className="space-y-2 mb-6">
                                {suggestions.map((s, i) => (
                                    <li key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                        <input
                                            type="checkbox"
                                            checked={confirmed.has(i)}
                                            onChange={() => onToggle(i)}
                                            className="rounded border-[#C6A664]/50 text-[#C6A664]"
                                        />
                                        <span className="text-[#F5F7FA] font-medium">Unit {s.label}</span>
                                        <span className="text-[#94A3B8] text-xs">Floor {s.floor} · {s.position}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="flex gap-3">
                                <button
                                    onClick={onSave}
                                    disabled={saving || confirmed.size === 0}
                                    className="flex-1 py-3.5 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] tracking-widest uppercase font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                    Save {confirmed.size} unit(s)
                                </button>
                                <button
                                    onClick={onClose}
                                    className="px-5 py-3.5 rounded-xl border border-white/10 text-[#94A3B8] text-[11px] tracking-widest uppercase"
                                >
                                    Cancel
                                </button>
                            </div>
                        </>
                    )}
                    {!loading && suggestions.length === 0 && !error && (
                        <p className="text-[#94A3B8] text-sm py-4">No suggestions returned. Try rotating the view and run again.</p>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
