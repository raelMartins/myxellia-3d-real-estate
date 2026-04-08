'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { fetchSkyboxEnvironments, uploadSkyboxEnvironment, deleteSkyboxEnvironment, type SkyboxRow } from '@/lib/skybox';
import { useAuthStore } from '@/store/auth.store';
import DeleteSkyboxModal from '@/components/DeleteSkyboxModal';

const HDR_ACCEPT = '.hdr,.hdri';

export default function Skyboxes() {
    const router = useRouter();
    const [list, setList] = useState<SkyboxRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadLabel, setUploadLabel] = useState('');
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [deleteModalSkybox, setDeleteModalSkybox] = useState<SkyboxRow | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const getToken = () => useAuthStore.getState().session?.access_token ?? undefined;

    useEffect(() => {
        let cancelled = false;
        fetchSkyboxEnvironments(getToken).then((data) => {
            if (!cancelled) setList(data);
        }).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadError(null);
        setUploading(true);
        try {
            const row = await uploadSkyboxEnvironment(file, uploadLabel || file.name, getToken);
            if (row) {
                setList((prev) => [row, ...prev]);
            } else {
                setUploadError('Upload failed.');
            }
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = (id: string) => deleteSkyboxEnvironment(id, getToken);
    const handleDeleted = () => setList((prev) => prev.filter((s) => s.id !== deleteModalSkybox?.id));

    return (
        <div className="min-h-screen bg-[#0A0A0B] text-[#F5F7FA]">
            <nav className="sticky top-0 z-40 flex items-center justify-between px-8 py-5 border-b border-white/6 bg-[#0A0A0B]/95 backdrop-blur-md">
                <button
                    onClick={() => router.push('/')}
                    className="flex items-center gap-2 text-[#94A3B8] hover:text-[#C6A664] text-[10px] tracking-widest uppercase transition-colors"
                >
                    <ArrowLeft size={14} /> Back to Command Center
                </button>
                <span className="font-serif-display text-sm tracking-[0.25em] text-[#F5F7FA]">MYXELLIA</span>
            </nav>

            <main className="max-w-5xl mx-auto px-8 py-12">
                <div className="flex items-end justify-between gap-6 mb-10">
                    <div>
                        <h1 className="font-serif-display text-4xl text-[#F5F7FA] mb-2">Skybox Environments</h1>
                        <p className="text-[#94A3B8] text-[14px]">Upload HDR skyboxes and preview them. They are shared across all projects.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <input
                            type="text"
                            value={uploadLabel}
                            onChange={(e) => setUploadLabel(e.target.value)}
                            placeholder="Label (e.g. Sunset Beach)"
                            className="w-48 glass rounded-lg px-3 py-2.5 text-[12px] text-[#F5F7FA] placeholder:text-[#94A3B8]/50 focus:outline-none border border-white/10"
                        />
                        <input ref={fileInputRef} type="file" accept={HDR_ACCEPT} className="hidden" onChange={handleFile} />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#C6A664]/40 text-[#C6A664] text-[11px] tracking-wider uppercase font-medium hover:bg-[#C6A664]/10 disabled:opacity-50 transition-colors"
                        >
                            {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                            {uploading ? 'Uploading…' : 'Upload HDR'}
                        </button>
                    </div>
                </div>

                {uploadError && <p className="mb-4 text-red-400 text-[12px]">{uploadError}</p>}

                {loading ? (
                    <div className="flex items-center justify-center py-24 text-[#94A3B8] text-sm">
                        <Loader2 size={20} className="animate-spin mr-2" /> Loading skyboxes…
                    </div>
                ) : list.length === 0 ? (
                    <div className="glass rounded-2xl border border-white/5 p-16 text-center">
                        <p className="text-[#94A3B8] mb-4">No skyboxes yet.</p>
                        <p className="text-[12px] text-[#94A3B8]/80">Upload an HDR file above to add one, or add one when deploying a new project.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        {list.map((s, i) => (
                            <motion.div
                                key={s.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: i * 0.04 }}
                                className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 hover:border-[#C6A664]/40 hover:bg-white/10 transition-all duration-200 group"
                            >
                                <button
                                    type="button"
                                    onClick={() => router.push(`/skyboxes/preview/${s.id}`)}
                                    className="w-full text-left block"
                                >
                                    <div className="aspect-[4/3] bg-black/50 flex items-center justify-center">
                                        <span className="text-[12px] tracking-widest text-[#94A3B8] uppercase group-hover:text-[#C6A664]/80 transition-colors">HDR</span>
                                    </div>
                                    <div className="p-6">
                                        <span className="text-[16px] text-[#F5F7FA] font-medium truncate block">{s.label}</span>
                                        <span className="text-[11px] text-[#94A3B8] uppercase tracking-wider mt-2 block">Click to preview</span>
                                    </div>
                                </button>
                                <div className="px-6 pb-6 pt-0">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setDeleteModalSkybox(s); }}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] tracking-wider uppercase text-red-400/90 hover:bg-red-500/10 border border-red-500/20 transition-colors"
                                    >
                                        <Trash2 size={14} /> Delete
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                <DeleteSkyboxModal
                    skybox={deleteModalSkybox}
                    open={!!deleteModalSkybox}
                    onClose={() => setDeleteModalSkybox(null)}
                    onDeleted={handleDeleted}
                    deleteSkybox={handleDelete}
                />
            </main>
        </div>
    );
}
