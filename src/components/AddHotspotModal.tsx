import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface AddHotspotModalProps {
    open: boolean;
    position: [number, number, number] | null;
    onSave: (data: { title: string; material: string; description: string }) => void;
    onCancel: () => void;
}

export default function AddHotspotModal({ open, position, onSave, onCancel }: AddHotspotModalProps) {
    const [title, setTitle] = useState('');
    const [material, setMaterial] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (open) {
            setTitle('');
            setMaterial('');
            setDescription('');
        }
    }, [open]);

    if (!open) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSave({ title: title.trim(), material: material.trim(), description: description.trim() });
    };

    const posStr = position ? `${position[0].toFixed(2)}, ${position[1].toFixed(2)}, ${position[2].toFixed(2)}` : '';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                onClick={onCancel}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="glass-heavy rounded-2xl border border-white/10 p-6 w-full max-w-sm"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-serif-display text-lg text-[#F5F7FA]">Add hotspot</h3>
                        <button type="button" onClick={onCancel} className="p-2 rounded-lg hover:bg-white/10 text-[#94A3B8]">
                            <X size={18} />
                        </button>
                    </div>
                    <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-3">Position: {posStr}</p>
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                            <label className="block text-[9px] tracking-[0.2em] text-[#C6A664] uppercase mb-1">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[#F5F7FA]"
                                placeholder="e.g. Countertops"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[9px] tracking-[0.2em] text-[#C6A664] uppercase mb-1">Material (optional)</label>
                            <input
                                type="text"
                                value={material}
                                onChange={(e) => setMaterial(e.target.value)}
                                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[#F5F7FA]"
                                placeholder="e.g. Carrara Marble"
                            />
                        </div>
                        <div>
                            <label className="block text-[9px] tracking-[0.2em] text-[#C6A664] uppercase mb-1">Description (optional)</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[#F5F7FA] resize-none"
                                placeholder="Short description"
                            />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-white/10 text-[#94A3B8] text-[10px] tracking-widest uppercase">
                                Cancel
                            </button>
                            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[10px] tracking-widest uppercase font-bold">
                                Save hotspot
                            </button>
                        </div>
                    </form>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
