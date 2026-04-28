'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { Center, Environment, ContactShadows, OrbitControls } from '@react-three/drei';
import { ArrowLeft, Box, Loader2, Trash2, ImagePlus, Eye, Pencil, Upload, X } from 'lucide-react';
import {
    fetchWorldEnvironments,
    uploadGroundModelFile,
    createWorldEnvironment,
    deleteWorldEnvironment,
    patchWorldEnvironmentLabel,
    SCATTER_MODEL_INPUT_ACCEPT,
    isAcceptedScatterExtension,
    type WorldEnvironmentWithSky,
} from '@/lib/worldEnvironments';
import {
    fetchSurroundCatalogAssets,
    uploadSurroundCatalogFile,
    createSurroundCatalogAsset,
    deleteSurroundCatalogAsset,
} from '@/lib/surroundCatalog';
import type { SurroundCatalogAssetRow } from '@/lib/database.types';
import { ModelLoader } from '@/engine/components/BuildingModel';
import {
    fetchSkyboxCollections,
    createCollectionWithHdrFiles,
    type SkyboxCollectionWithSlots,
} from '@/lib/skyboxCollections';
import { useAuthStore } from '@/store/auth.store';
import CustomSelect from '@/components/CustomSelect';
import { extensionFromFileName, isAcceptedModel3dExtension, MODEL_3D_INPUT_ACCEPT } from '@/lib/model3dFormats';
const HDR_ACCEPT = '.hdr,.hdri';

export default function WorldEnvironments() {
    const router = useRouter();
    const getToken = () => useAuthStore.getState().session?.access_token ?? undefined;

    const [list, setList] = useState<WorldEnvironmentWithSky[]>([]);
    const [collections, setCollections] = useState<SkyboxCollectionWithSlots[]>([]);
    const [loading, setLoading] = useState(true);
    const [label, setLabel] = useState('');
    const [skyboxCollectionId, setSkyboxCollectionId] = useState<string>('');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const groundInputRef = useRef<HTMLInputElement>(null);
    const hdrInputRef = useRef<HTMLInputElement>(null);
    const [newCollectionLabel, setNewCollectionLabel] = useState('');
    const [editingLabelWorldId, setEditingLabelWorldId] = useState<string | null>(null);
    const [editingLabelDraft, setEditingLabelDraft] = useState('');
    const [renameSaving, setRenameSaving] = useState(false);
    const [renameError, setRenameError] = useState<string | null>(null);
    const [surroundCatalog, setSurroundCatalog] = useState<SurroundCatalogAssetRow[]>([]);
    const [catPreviewFile, setCatPreviewFile] = useState<File | null>(null);
    const [catPreviewUrl, setCatPreviewUrl] = useState<string | null>(null);
    const [catDraftLabel, setCatDraftLabel] = useState('');
    const [catUploading, setCatUploading] = useState(false);
    const [catDeletingId, setCatDeletingId] = useState<string | null>(null);
    const catInputRef = useRef<HTMLInputElement>(null);
    const [groundPreviewFile, setGroundPreviewFile] = useState<File | null>(null);
    const [groundPreviewUrl, setGroundPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const [worlds, cols, cat] = await Promise.all([
                fetchWorldEnvironments(getToken),
                fetchSkyboxCollections(getToken),
                fetchSurroundCatalogAssets(getToken),
            ]);
            if (!cancelled) {
                setList(worlds);
                setCollections(cols);
                setSurroundCatalog(cat);
            }
        };
        load().finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        return () => {
            if (catPreviewUrl) URL.revokeObjectURL(catPreviewUrl);
            if (groundPreviewUrl) URL.revokeObjectURL(groundPreviewUrl);
        };
    }, [catPreviewUrl, groundPreviewUrl]);

    const clearCatPreview = useCallback(() => {
        setCatPreviewFile(null);
        setCatDraftLabel('');
        if (catPreviewUrl) URL.revokeObjectURL(catPreviewUrl);
        setCatPreviewUrl(null);
        if (catInputRef.current) catInputRef.current.value = '';
    }, [catPreviewUrl]);

    const onCatFileChosen = (file: File | null) => {
        if (!file) return;
        const ext = extensionFromFileName(file.name);
        if (!isAcceptedScatterExtension(ext)) {
            setError('Use .glb, .gltf, .fbx, or .obj (same as building models).');
            return;
        }
        setError(null);
        setCatPreviewFile(file);
        if (catPreviewUrl) URL.revokeObjectURL(catPreviewUrl);
        setCatPreviewUrl(URL.createObjectURL(file));
        setCatDraftLabel((prev) => prev.trim() || file.name.replace(/\.[^.]+$/, '') || 'Surround prop');
    };

    const clearGroundPreview = useCallback(() => {
        setGroundPreviewFile(null);
        if (groundPreviewUrl) URL.revokeObjectURL(groundPreviewUrl);
        setGroundPreviewUrl(null);
        if (groundInputRef.current) groundInputRef.current.value = '';
    }, [groundPreviewUrl]);

    const onGroundFileChosen = (file: File) => {
        if (!isAcceptedModel3dExtension(extensionFromFileName(file.name))) {
            setError('Ground model must be .glb, .gltf, .fbx, or .obj (same as building uploads).');
            return;
        }
        if (!skyboxCollectionId) {
            setError('Choose a sky collection (with at least one HDR) for this environment.');
            return;
        }
        const col = collections.find((c) => c.id === skyboxCollectionId);
        const n = col?.skybox_collection_slots?.length ?? 0;
        if (!col || n < 1) {
            setError('Selected sky collection has no HDR slots yet.');
            return;
        }
        setError(null);
        setGroundPreviewFile(file);
        if (groundPreviewUrl) URL.revokeObjectURL(groundPreviewUrl);
        setGroundPreviewUrl(URL.createObjectURL(file));
    };

    const confirmGroundEnvironment = async () => {
        const file = groundPreviewFile;
        if (!file) return;
        if (!skyboxCollectionId) {
            setError('Choose a sky collection (with at least one HDR) for this environment.');
            return;
        }
        const col = collections.find((c) => c.id === skyboxCollectionId);
        const n = col?.skybox_collection_slots?.length ?? 0;
        if (!col || n < 1) {
            setError('Selected sky collection has no HDR slots yet.');
            return;
        }
        setError(null);
        setUploading(true);
        try {
            const groundUpload = await uploadGroundModelFile(file, getToken);
            if (!groundUpload.ok) {
                setError(groundUpload.message);
                return;
            }
            const groundUrl = groundUpload.url;
            const row = await createWorldEnvironment(
                {
                    label: label || file.name.replace(/\.[^.]+$/, ''),
                    ground_model_url: groundUrl,
                    skybox_collection_id: skyboxCollectionId,
                },
                getToken
            );
            if (row) {
                setList((prev) => [row, ...prev]);
                setLabel('');
                clearGroundPreview();
            } else {
                setError('Could not create environment row.');
            }
        } finally {
            setUploading(false);
        }
    };

    const handleHdrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files?.length) return;
        setError(null);
        setUploading(true);
        try {
            const arr = Array.from(files);
            const collLabel = newCollectionLabel.trim() || arr[0].name.replace(/\.[^.]+$/, '') || 'Sky collection';
            const payload = arr.map((file, i) => ({
                file,
                label: file.name.replace(/\.[^.]+$/, '') || `Slot ${i + 1}`,
            }));
            const row = await createCollectionWithHdrFiles(collLabel, payload, getToken);
            if (row) {
                setCollections((prev) => [row, ...prev]);
                setSkyboxCollectionId(row.id);
                setNewCollectionLabel('');
            } else {
                setError('HDR upload failed.');
            }
        } finally {
            setUploading(false);
            if (hdrInputRef.current) hdrInputRef.current.value = '';
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this world environment? Buildings using it will have the link cleared.')) return;
        const ok = await deleteWorldEnvironment(id, getToken);
        if (ok) {
            setList((prev) => prev.filter((w) => w.id !== id));
            if (editingLabelWorldId === id) {
                setEditingLabelWorldId(null);
                setEditingLabelDraft('');
            }
        }
    };

    const cancelRename = () => {
        setEditingLabelWorldId(null);
        setEditingLabelDraft('');
        setRenameError(null);
    };

    const saveRename = async (id: string) => {
        setRenameError(null);
        setRenameSaving(true);
        try {
            const updated = await patchWorldEnvironmentLabel(id, editingLabelDraft, getToken);
            if (updated) {
                setList((prev) => prev.map((row) => (row.id === id ? updated : row)));
                cancelRename();
            } else {
                setRenameError('Could not update name.');
            }
        } finally {
            setRenameSaving(false);
        }
    };

    const confirmCatalogUpload = async () => {
        if (!catPreviewFile) return;
        setError(null);
        setCatUploading(true);
        try {
            const fileUrl = await uploadSurroundCatalogFile(catPreviewFile, getToken);
            if (!fileUrl) {
                setError('Upload failed (check format and network).');
                return;
            }
            const label = catDraftLabel.trim() || catPreviewFile.name.replace(/\.[^.]+$/, '') || 'Surround prop';
            const outcome = await createSurroundCatalogAsset({ label, file_url: fileUrl }, getToken);
            if (!outcome.ok) {
                setError(outcome.message);
                return;
            }
            setSurroundCatalog((prev) => [outcome.row, ...prev]);
            clearCatPreview();
        } finally {
            setCatUploading(false);
        }
    };

    const handleDeleteCatalogAsset = async (id: string) => {
        if (!confirm('Remove this prop from the surround library? Worlds using it will clear the selection.')) return;
        setError(null);
        setCatDeletingId(id);
        try {
            const ok = await deleteSurroundCatalogAsset(id, getToken);
            if (!ok) {
                setError('Could not delete library item.');
                return;
            }
            setSurroundCatalog((prev) => prev.filter((a) => a.id !== id));
        } finally {
            setCatDeletingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-[#0A0A0B] text-[#F5F7FA]">
            <nav className="sticky top-0 z-40 flex items-center justify-between px-8 py-5 border-b border-white/6 bg-[#0A0A0B]/95 backdrop-blur-md">
                <button
                    type="button"
                    onClick={() => router.push('/')}
                    className="flex items-center gap-2 text-[#94A3B8] hover:text-[#C6A664] text-[10px] tracking-widest uppercase transition-colors"
                >
                    <ArrowLeft size={14} /> Marketplace
                </button>
                <span className="font-serif-display text-sm tracking-[0.25em] text-[#F5F7FA]">MYXELLIA</span>
            </nav>

            <main className="max-w-5xl mx-auto px-8 py-12">
                <div className="mb-10">
                    <h1 className="font-serif-display text-4xl text-[#F5F7FA] mb-2">World environments</h1>
                    <p className="text-[#94A3B8] text-[14px]">
                        Pair a ground or surroundings 3D model (GLB, GLTF, FBX, or OBJ) with an HDR sky collection. Reuse them across projects in the engine.
                    </p>
                </div>

                <div className="glass rounded-2xl border border-white/10 p-8 mb-12 space-y-6">
                    <h2 className="text-[11px] tracking-[0.25em] uppercase text-[#C6A664] font-bold">Create environment</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-[10px] tracking-widest text-[#94A3B8] uppercase mb-2">Label</label>
                            <input
                                type="text"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder="e.g. Coastal plateau"
                                className="w-full glass rounded-lg px-3 py-2.5 text-[13px] text-[#F5F7FA] placeholder:text-[#94A3B8]/50 focus:outline-none border border-white/10"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] tracking-widest text-[#94A3B8] uppercase mb-2">Sky collection</label>
                            <CustomSelect
                                value={skyboxCollectionId}
                                onChange={setSkyboxCollectionId}
                                placeholder="Select collection…"
                                className="w-full"
                                buttonClassName="w-full rounded-lg px-3 py-2.5 text-[13px] text-[#F5F7FA] focus:outline-none border border-white/10 bg-white/[0.06]"
                                options={[
                                    { value: '', label: 'Select collection…' },
                                    ...collections.map((c) => ({
                                        value: c.id,
                                        label: `${c.label} (${c.skybox_collection_slots?.length ?? 0} HDR)`,
                                    })),
                                ]}
                            />
                        </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-4">
                        <div>
                            <label className="block text-[10px] tracking-widest text-[#94A3B8] uppercase mb-2">Upload new collection (multi HDR)</label>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                                <input
                                    type="text"
                                    value={newCollectionLabel}
                                    onChange={(e) => setNewCollectionLabel(e.target.value)}
                                    placeholder="Collection name (e.g. Summer)"
                                    className="w-full sm:w-48 glass rounded-lg px-3 py-2 text-[12px] text-[#F5F7FA] placeholder:text-[#94A3B8]/50 focus:outline-none border border-white/10"
                                />
                                <input
                                    ref={hdrInputRef}
                                    type="file"
                                    accept={HDR_ACCEPT}
                                    multiple
                                    className="hidden"
                                    onChange={handleHdrUpload}
                                />
                                <button
                                    type="button"
                                    onClick={() => hdrInputRef.current?.click()}
                                    disabled={uploading}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-[11px] tracking-wider uppercase text-[#94A3B8] hover:text-[#F5F7FA] disabled:opacity-50"
                                >
                                    <ImagePlus size={14} /> New HDRs
                                </button>
                            </div>
                            <p className="text-[10px] text-[#94A3B8]/70 mt-1">Select multiple files at once; order becomes time-of-day order (first = default).</p>
                        </div>
                        <div className="min-w-0 flex-1 sm:flex-initial">
                            <label className="block text-[10px] tracking-widest text-[#94A3B8] uppercase mb-2">Ground model</label>
                            <input
                                ref={groundInputRef}
                                type="file"
                                accept={MODEL_3D_INPUT_ACCEPT}
                                className="hidden"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) onGroundFileChosen(f);
                                    e.target.value = '';
                                }}
                            />
                            <div className="flex flex-wrap gap-2 items-center">
                                <button
                                    type="button"
                                    onClick={() => groundInputRef.current?.click()}
                                    disabled={uploading || !skyboxCollectionId}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#C6A664]/40 text-[#C6A664] text-[11px] tracking-wider uppercase font-medium hover:bg-[#C6A664]/10 disabled:opacity-50 transition-colors"
                                >
                                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Box size={14} />}
                                    Choose ground model
                                </button>
                                {groundPreviewFile && (
                                    <button
                                        type="button"
                                        onClick={clearGroundPreview}
                                        disabled={uploading}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-[10px] tracking-wider uppercase text-[#94A3B8] hover:bg-white/5 disabled:opacity-50"
                                    >
                                        <X size={14} /> Clear preview
                                    </button>
                                )}
                            </div>
                            <p className="text-[10px] text-[#94A3B8]/70 mt-1">
                                .glb, .gltf, .fbx, or .obj — preview loads locally; confirm when ready (same as building deploy).
                            </p>
                            {groundPreviewUrl && groundPreviewFile && (
                                <div className="mt-4 space-y-3">
                                    <div className="relative w-full max-w-lg rounded-xl overflow-hidden border border-white/10 bg-black/40" style={{ height: 300 }}>
                                        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 text-[9px] tracking-[0.2em] text-[#C6A664] uppercase font-bold">
                                            <Eye size={10} /> 3D preview
                                        </div>
                                        <Canvas camera={{ position: [5, 5, 5], fov: 45 }} shadows>
                                            <color attach="background" args={['#0A0A0B']} />
                                            <ambientLight intensity={0.5} />
                                            <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
                                            <Center top>
                                                <ModelLoader url={groundPreviewUrl} extension={groundPreviewFile.name.split('.').pop()} />
                                            </Center>
                                            <Environment preset="city" />
                                            <ContactShadows opacity={0.4} scale={20} blur={2.4} />
                                            <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
                                        </Canvas>
                                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 text-[9px] tracking-widest text-[#94A3B8]/60 uppercase pointer-events-none">
                                            Drag to rotate · Scroll to zoom
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={uploading}
                                        onClick={() => void confirmGroundEnvironment()}
                                        className="px-5 py-2.5 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[10px] tracking-[0.2em] font-bold uppercase disabled:opacity-50"
                                    >
                                        {uploading ? 'Working…' : 'Create environment'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="glass rounded-2xl border border-white/10 p-8 mb-12 space-y-5">
                    <h2 className="text-[11px] tracking-[0.25em] uppercase text-[#C6A664] font-bold">Surround asset library</h2>
                    <p className="text-[12px] text-[#94A3B8] leading-relaxed">
                        Shared props (grass, rocks, trees, etc.) — {SCATTER_MODEL_INPUT_ACCEPT}. Preview confirms the file
                        loads before you add it. In the engine scene panel, pick a prop and spacing (packed, spread, or
                        sparse) for each world so copies scatter around the exposed base.
                    </p>
                    <input
                        ref={catInputRef}
                        type="file"
                        accept={SCATTER_MODEL_INPUT_ACCEPT}
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) onCatFileChosen(f);
                            e.target.value = '';
                        }}
                    />
                    <div className="flex flex-wrap gap-3 items-center">
                        <button
                            type="button"
                            disabled={catUploading}
                            onClick={() => catInputRef.current?.click()}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/15 text-[11px] tracking-wider uppercase text-[#94A3B8] hover:text-[#F5F7FA] disabled:opacity-50"
                        >
                            {catUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                            Choose file
                        </button>
                        {catPreviewFile && (
                            <button
                                type="button"
                                onClick={clearCatPreview}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-[10px] tracking-wider uppercase text-[#94A3B8] hover:bg-white/5"
                            >
                                <X size={14} /> Clear preview
                            </button>
                        )}
                    </div>
                    {catPreviewUrl && catPreviewFile && (
                        <div className="space-y-3">
                            <div className="relative w-full max-w-md rounded-xl overflow-hidden border border-white/10 bg-black/40" style={{ height: 220 }}>
                                <div className="absolute top-2 left-2 z-10 text-[9px] tracking-[0.2em] text-[#C6A664] uppercase font-bold flex items-center gap-1">
                                    <Eye size={10} /> Preview
                                </div>
                                <Canvas camera={{ position: [4, 4, 4], fov: 45 }} shadows>
                                    <color attach="background" args={['#0A0A0B']} />
                                    <ambientLight intensity={0.5} />
                                    <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
                                    <Center top>
                                        <ModelLoader url={catPreviewUrl} extension={catPreviewFile.name.split('.').pop()} />
                                    </Center>
                                    <Environment preset="city" />
                                    <ContactShadows opacity={0.4} scale={20} blur={2.4} />
                                    <OrbitControls makeDefault autoRotate autoRotateSpeed={0.45} />
                                </Canvas>
                            </div>
                            <div>
                                <label className="block text-[10px] tracking-widest text-[#94A3B8] uppercase mb-1.5">Label</label>
                                <input
                                    type="text"
                                    value={catDraftLabel}
                                    onChange={(e) => setCatDraftLabel(e.target.value)}
                                    className="w-full max-w-md glass rounded-lg px-3 py-2 text-[13px] text-[#F5F7FA] border border-white/10 focus:outline-none"
                                    placeholder="Name in library"
                                />
                            </div>
                            <button
                                type="button"
                                disabled={catUploading}
                                onClick={() => void confirmCatalogUpload()}
                                className="px-5 py-2.5 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[10px] tracking-[0.2em] font-bold uppercase disabled:opacity-50"
                            >
                                {catUploading ? 'Uploading…' : 'Confirm upload to library'}
                            </button>
                        </div>
                    )}
                    {surroundCatalog.length > 0 && (
                        <ul className="divide-y divide-white/10 border border-white/10 rounded-xl overflow-hidden">
                            {surroundCatalog.map((a) => (
                                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-white/[0.03]">
                                    <span className="text-[13px] text-[#F5F7FA] truncate">{a.label}</span>
                                    <button
                                        type="button"
                                        disabled={catDeletingId === a.id}
                                        onClick={() => void handleDeleteCatalogAsset(a.id)}
                                        className="shrink-0 p-1.5 rounded-lg text-[#94A3B8] hover:text-red-400 hover:bg-white/5 disabled:opacity-40"
                                        aria-label={`Delete ${a.label}`}
                                    >
                                        {catDeletingId === a.id ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <Trash2 size={14} />
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {error && <p className="text-red-400 text-[12px] mb-6">{error}</p>}

                {loading ? (
                    <div className="flex items-center justify-center py-24 text-[#94A3B8] text-sm">
                        <Loader2 size={20} className="animate-spin mr-2" /> Loading…
                    </div>
                ) : list.length === 0 ? (
                    <div className="glass rounded-2xl border border-white/5 p-16 text-center">
                        <p className="text-[#94A3B8] mb-2">No world environments yet.</p>
                        <p className="text-[12px] text-[#94A3B8]/80">Pick a sky collection and upload a ground model above.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        {list.map((w, i) => (
                            <motion.div
                                key={w.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: i * 0.04 }}
                                className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 hover:border-[#C6A664]/40 transition-all duration-200"
                            >
                                <div className="aspect-[4/3] bg-black/50 flex items-center justify-center">
                                    <span className="text-[12px] tracking-widest text-[#94A3B8] uppercase">World</span>
                                </div>
                                <div className="p-6">
                                    {editingLabelWorldId === w.id ? (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                value={editingLabelDraft}
                                                onChange={(e) => setEditingLabelDraft(e.target.value)}
                                                disabled={renameSaving}
                                                className="w-full glass rounded-lg px-3 py-2 text-[14px] text-[#F5F7FA] placeholder:text-[#94A3B8]/50 focus:outline-none border border-white/10 disabled:opacity-60"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Escape') cancelRename();
                                                    if (e.key === 'Enter') void saveRename(w.id);
                                                }}
                                            />
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    disabled={renameSaving}
                                                    onClick={() => void saveRename(w.id)}
                                                    className="px-3 py-1.5 rounded-lg text-[11px] tracking-wider uppercase bg-[#C6A664]/20 text-[#C6A664] border border-[#C6A664]/40 hover:bg-[#C6A664]/30 disabled:opacity-50"
                                                >
                                                    {renameSaving ? 'Saving…' : 'Save'}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={renameSaving}
                                                    onClick={cancelRename}
                                                    className="px-3 py-1.5 rounded-lg text-[11px] tracking-wider uppercase text-[#94A3B8] border border-white/10 hover:bg-white/5 disabled:opacity-50"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                            {renameError && <p className="text-red-400 text-[12px]">{renameError}</p>}
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-2 min-w-0">
                                            <span className="text-[16px] text-[#F5F7FA] font-medium truncate flex-1 min-w-0">
                                                {w.label}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setRenameError(null);
                                                    setEditingLabelWorldId(w.id);
                                                    setEditingLabelDraft(w.label);
                                                }}
                                                className="shrink-0 p-1.5 rounded-lg text-[#94A3B8] hover:text-[#C6A664] hover:bg-white/5 transition-colors"
                                                aria-label={`Rename ${w.label}`}
                                            >
                                                <Pencil size={15} strokeWidth={1.5} />
                                            </button>
                                        </div>
                                    )}
                                    <span className="text-[11px] text-[#94A3B8] mt-2 block line-clamp-2 break-all">{w.ground_model_url}</span>

                                    <p className="text-[10px] text-[#94A3B8]/80 mt-4 pt-4 border-t border-white/10 leading-relaxed">
                                        Surround props come from the shared library above. Preview this world in the engine and
                                        use the right Scene panel to choose a prop and spacing for the surround ring.
                                    </p>
                                </div>
                                <div className="px-6 pb-6 pt-0 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/engine/world/${w.id}`)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] tracking-wider uppercase text-[#C6A664] hover:bg-[#C6A664]/10 border border-[#C6A664]/35 transition-colors"
                                    >
                                        <Eye size={14} /> Preview in engine
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(w.id)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] tracking-wider uppercase text-red-400/90 hover:bg-red-500/10 border border-red-500/20 transition-colors"
                                    >
                                        <Trash2 size={14} /> Delete
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
