'use client';

import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { SkyboxRow } from '@/lib/skybox';

interface DeleteSkyboxModalProps {
    skybox: SkyboxRow | null;
    open: boolean;
    onClose: () => void;
    onDeleted: () => void;
    deleteSkybox: (id: string) => Promise<boolean>;
}

export default function DeleteSkyboxModal({
    skybox,
    open,
    onClose,
    onDeleted,
    deleteSkybox,
}: DeleteSkyboxModalProps) {
    const [confirmLabel, setConfirmLabel] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!open || !skybox) return null;

    const match = confirmLabel.trim().toLowerCase() === skybox.label.trim().toLowerCase();
    const handleDelete = async () => {
        if (!match) return;
        setError(null);
        setDeleting(true);
        try {
            const ok = await deleteSkybox(skybox.id);
            if (ok) {
                setConfirmLabel('');
                onDeleted();
                onClose();
            } else {
                setError('Failed to delete.');
            }
        } finally {
            setDeleting(false);
        }
    };

    const handleClose = () => {
        if (!deleting) {
            setConfirmLabel('');
            setError(null);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={handleClose}>
            <div
                className="glass rounded-2xl border border-white/10 p-6 w-full max-w-md shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-serif-display text-lg text-[#F5F7FA]">Delete skybox</h3>
                    <button type="button" onClick={handleClose} disabled={deleting} className="p-2 rounded-lg hover:bg-white/10 text-[#94A3B8] disabled:opacity-50">
                        <X size={18} />
                    </button>
                </div>
                <p className="text-[#94A3B8] text-[13px] mb-4">
                    This cannot be undone. Type <strong className="text-[#F5F7FA]">{skybox.label}</strong> to confirm.
                </p>
                <input
                    type="text"
                    value={confirmLabel}
                    onChange={(e) => setConfirmLabel(e.target.value)}
                    placeholder="Skybox label"
                    className="w-full glass rounded-xl px-4 py-3 text-[14px] text-[#F5F7FA] placeholder:text-[#94A3B8]/50 focus:outline-none border border-white/10 mb-4"
                />
                {error && <p className="text-red-400 text-[12px] mb-3">{error}</p>}
                <div className="flex gap-3 justify-end">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={deleting}
                        className="px-4 py-2.5 rounded-xl text-[12px] tracking-wider uppercase text-[#94A3B8] hover:bg-white/10 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={!match || deleting}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] tracking-wider uppercase font-medium bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 disabled:opacity-50 disabled:pointer-events-none"
                    >
                        <Trash2 size={14} />
                        {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}
