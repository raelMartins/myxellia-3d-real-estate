'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, ImagePlus, Loader2, Trash2, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import {
    fetchSkyboxCollections,
    createCollectionWithHdrFiles,
    deleteSkyboxCollection,
    uploadSlotToCollection,
    deleteSkyboxCollectionSlot,
    reorderCollectionSlots,
    patchSkyboxCollectionSlotLabel,
    type SkyboxCollectionWithSlots,
} from '@/lib/skyboxCollections';
import { orderedSlots } from '@/lib/skyboxEnvResolve';
import { useAuthStore } from '@/store/auth.store';
import DeleteSkyboxModal from '@/components/DeleteSkyboxModal';

const HDR_ACCEPT = '.hdr,.hdri';

export default function Skyboxes() {
    const router = useRouter();
    const [list, setList] = useState<SkyboxCollectionWithSlots[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [newCollLabel, setNewCollLabel] = useState('');
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<SkyboxCollectionWithSlots | null>(null);
    const multiFileRef = useRef<HTMLInputElement>(null);
    const getToken = () => useAuthStore.getState().session?.access_token ?? undefined;

    const refresh = () => fetchSkyboxCollections(getToken).then(setList);

    useEffect(() => {
        let cancelled = false;
        fetchSkyboxCollections(getToken).then((data) => {
            if (!cancelled) setList(data);
        }).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const handleMultiFileCreate = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files?.length) return;
        setUploadError(null);
        setUploading(true);
        try {
            const arr = Array.from(files);
            const label = newCollLabel.trim() || arr[0].name.replace(/\.[^.]+$/, '') || 'Sky collection';
            const payload = arr.map((file, i) => ({
                file,
                label: file.name.replace(/\.[^.]+$/, '') || `Slot ${i + 1}`,
            }));
            const row = await createCollectionWithHdrFiles(label, payload, getToken);
            if (row) await refresh();
            else setUploadError('Upload failed.');
            setNewCollLabel('');
        } finally {
            setUploading(false);
            if (multiFileRef.current) multiFileRef.current.value = '';
        }
    };

    const moveSlot = async (collectionId: string, slots: ReturnType<typeof orderedSlots>, index: number, dir: -1 | 1) => {
        const j = index + dir;
        if (j < 0 || j >= slots.length) return;
        const next = [...slots];
        const t = next[index];
        next[index] = next[j];
        next[j] = t;
        const ok = await reorderCollectionSlots(
            collectionId,
            next.map((s) => s.id),
            getToken
        );
        if (ok) await refresh();
    };

    const handleAddSlot = async (collectionId: string, file: File) => {
        setUploading(true);
        try {
            const stem = file.name.replace(/\.[^.]+$/, '').slice(0, 80);
            const row = await uploadSlotToCollection(collectionId, file, stem || 'HDR', getToken);
            if (row) await refresh();
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteSlot = async (slotId: string) => {
        if (!confirm('Remove this HDR slot from the collection?')) return;
        const ok = await deleteSkyboxCollectionSlot(slotId, getToken);
        if (ok) await refresh();
    };

    const handleRenameSlot = async (slotId: string, label: string) => {
        await patchSkyboxCollectionSlotLabel(slotId, label, getToken);
        await refresh();
    };

    return (
        <div className="min-h-screen bg-[#0A0A0B] text-[#F5F7FA]">
            <nav className="sticky top-0 z-40 flex items-center justify-between px-8 py-5 border-b border-white/6 bg-[#0A0A0B]/95 backdrop-blur-md">
                <button
                    onClick={() => router.push('/')}
                    className="flex items-center gap-2 text-[#94A3B8] hover:text-[#C6A664] text-[10px] tracking-widest uppercase transition-colors"
                >
                    <ArrowLeft size={14} /> Marketplace
                </button>
                <span className="font-serif-display text-sm tracking-[0.25em] text-[#F5F7FA]">MYXELLIA</span>
            </nav>

            <main className="max-w-5xl mx-auto px-8 py-12">
                <div className="flex items-end justify-between gap-6 mb-10 flex-wrap">
                    <div>
                        <h1 className="font-serif-display text-4xl text-[#F5F7FA] mb-2">Sky collections</h1>
                        <p className="text-[#94A3B8] text-[14px]">
                            Upload multiple HDRIs per collection (times of day). First slot is the default lighting. Shared across all projects.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <input
                            type="text"
                            value={newCollLabel}
                            onChange={(e) => setNewCollLabel(e.target.value)}
                            placeholder="Collection name (e.g. Summer)"
                            className="w-48 glass rounded-lg px-3 py-2.5 text-[12px] text-[#F5F7FA] placeholder:text-[#94A3B8]/50 focus:outline-none border border-white/10"
                        />
                        <input ref={multiFileRef} type="file" accept={HDR_ACCEPT} multiple className="hidden" onChange={handleMultiFileCreate} />
                        <button
                            type="button"
                            onClick={() => multiFileRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#C6A664]/40 text-[#C6A664] text-[11px] tracking-wider uppercase font-medium hover:bg-[#C6A664]/10 disabled:opacity-50 transition-colors"
                        >
                            {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                            {uploading ? 'Uploading…' : 'New collection (HDRs)'}
                        </button>
                    </div>
                </div>

                {uploadError && <p className="mb-4 text-red-400 text-[12px]">{uploadError}</p>}

                {loading ? (
                    <div className="flex items-center justify-center py-24 text-[#94A3B8] text-sm">
                        <Loader2 size={20} className="animate-spin mr-2" /> Loading…
                    </div>
                ) : list.length === 0 ? (
                    <div className="glass rounded-2xl border border-white/5 p-16 text-center">
                        <p className="text-[#94A3B8] mb-4">No sky collections yet.</p>
                        <p className="text-[12px] text-[#94A3B8]/80">Choose a name and upload one or more HDR files to create a collection.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {list.map((c, i) => (
                            <CollectionCard
                                key={c.id}
                                collection={c}
                                index={i}
                                onPreview={() => router.push(`/skyboxes/preview/${c.id}`)}
                                onDelete={() => setDeleteTarget(c)}
                                onMoveSlot={(idx, dir) => void moveSlot(c.id, orderedSlots(c.skybox_collection_slots ?? null), idx, dir)}
                                onAddSlotFile={(file) => void handleAddSlot(c.id, file)}
                                onDeleteSlot={(id) => void handleDeleteSlot(id)}
                                onRenameSlot={(id, label) => void handleRenameSlot(id, label)}
                                uploading={uploading}
                            />
                        ))}
                    </div>
                )}

                <DeleteSkyboxModal
                    skybox={deleteTarget ? { id: deleteTarget.id, label: deleteTarget.label } : null}
                    open={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onDeleted={() => void refresh()}
                    deleteSkybox={(id) => deleteSkyboxCollection(id, getToken)}
                    title="Delete sky collection"
                    noun="Collection name"
                />
            </main>
        </div>
    );
}

function CollectionCard({
    collection: c,
    index: i,
    onPreview,
    onDelete,
    onMoveSlot,
    onAddSlotFile,
    onDeleteSlot,
    onRenameSlot,
    uploading,
}: {
    collection: SkyboxCollectionWithSlots;
    index: number;
    onPreview: () => void;
    onDelete: () => void;
    onMoveSlot: (index: number, dir: -1 | 1) => void;
    onAddSlotFile: (file: File) => void;
    onDeleteSlot: (slotId: string) => void;
    onRenameSlot: (slotId: string, label: string) => void;
    uploading: boolean;
}) {
    const addSlotInputRef = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(true);
    const slots = orderedSlots(c.skybox_collection_slots ?? null);
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.03 }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden"
        >
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/6">
                <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-2 text-left min-w-0 flex-1">
                    {open ? <ChevronDown size={18} className="text-[#94A3B8] shrink-0" /> : <ChevronRight size={18} className="text-[#94A3B8] shrink-0" />}
                    <span className="text-[16px] text-[#F5F7FA] font-medium truncate">{c.label}</span>
                    <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider shrink-0">{slots.length} slot{slots.length === 1 ? '' : 's'}</span>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onPreview}
                        className="px-3 py-1.5 rounded-lg text-[10px] tracking-wider uppercase text-[#C6A664] border border-[#C6A664]/35 hover:bg-[#C6A664]/10"
                    >
                        Preview
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        className="p-2 rounded-lg text-red-400/90 hover:bg-red-500/10 border border-red-500/20"
                        aria-label="Delete collection"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
            {open && (
                <div className="px-5 py-4 space-y-3">
                    {slots.map((slot, idx) => (
                        <div
                            key={slot.id}
                            className="flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2"
                        >
                            <GripVertical size={14} className="text-[#94A3B8]/50 shrink-0" aria-hidden />
                            <button
                                type="button"
                                disabled={idx === 0 || uploading}
                                onClick={() => onMoveSlot(idx, -1)}
                                className="text-[10px] uppercase text-[#94A3B8] hover:text-[#F5F7FA] disabled:opacity-30"
                            >
                                Up
                            </button>
                            <button
                                type="button"
                                disabled={idx === slots.length - 1 || uploading}
                                onClick={() => onMoveSlot(idx, 1)}
                                className="text-[10px] uppercase text-[#94A3B8] hover:text-[#F5F7FA] disabled:opacity-30"
                            >
                                Down
                            </button>
                            <input
                                defaultValue={slot.label}
                                key={slot.id + slot.label}
                                onBlur={(e) => {
                                    const v = e.target.value.trim();
                                    if (v && v !== slot.label) onRenameSlot(slot.id, v);
                                }}
                                className="flex-1 min-w-[100px] bg-transparent border border-white/10 rounded-lg px-2 py-1 text-[12px] text-[#F5F7FA]"
                            />
                            {idx === 0 && (
                                <span className="text-[9px] uppercase tracking-wider text-[#C6A664]/90">default</span>
                            )}
                            <button
                                type="button"
                                onClick={() => onDeleteSlot(slot.id)}
                                className="ml-auto text-[10px] uppercase text-red-400/80 hover:text-red-400"
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                    <div className="flex items-center gap-2 pt-1">
                        <input
                            ref={addSlotInputRef}
                            type="file"
                            accept={HDR_ACCEPT}
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) onAddSlotFile(f);
                                e.target.value = '';
                            }}
                        />
                        <button
                            type="button"
                            disabled={uploading}
                            onClick={() => addSlotInputRef.current?.click()}
                            className="text-[10px] tracking-wider uppercase text-[#C6A664] border border-[#C6A664]/30 rounded-lg px-3 py-2 hover:bg-[#C6A664]/10 disabled:opacity-50"
                        >
                            + Add HDR slot
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
