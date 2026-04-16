'use client';

import { useState, useEffect, useRef } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import {
    fetchSkyboxCollections,
    createCollectionWithHdrFiles,
    type SkyboxCollectionWithSlots,
} from '@/lib/skyboxCollections';
import { useAuthStore } from '@/store/auth.store';

const HDR_ACCEPT = '.hdr,.hdri';

interface SkyboxSelectorProps {
    selectedId: string | null;
    onSelect: (collection: SkyboxCollectionWithSlots | null) => void;
    className?: string;
}

export default function SkyboxSelector({ selectedId, onSelect, className = '' }: SkyboxSelectorProps) {
    const [list, setList] = useState<SkyboxCollectionWithSlots[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [collectionLabel, setCollectionLabel] = useState('');
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const getToken = () => useAuthStore.getState().session?.access_token ?? undefined;

    useEffect(() => {
        let cancelled = false;
        fetchSkyboxCollections(getToken).then((data) => {
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
            const nameStem = file.name.replace(/\.[^.]+$/, '').slice(0, 80);
            const collLabel = collectionLabel.trim() || nameStem || 'Sky collection';
            const row = await createCollectionWithHdrFiles(
                collLabel,
                [{ file, label: nameStem || 'Slot 1' }],
                getToken
            );
            if (row) {
                setList((prev) => [row, ...prev]);
                onSelect(row);
            } else {
                setUploadError('Upload failed.');
            }
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (loading) {
        return (
            <div className={`flex items-center gap-2 text-[#94A3B8] text-[12px] ${className}`}>
                <Loader2 size={14} className="animate-spin" /> Loading sky collections…
            </div>
        );
    }

    return (
        <div className={className}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[200px] overflow-y-auto pr-2">
                {list.map((s) => {
                    const isSelected = selectedId === s.id;
                    const n = s.skybox_collection_slots?.length ?? 0;
                    return (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => onSelect(isSelected ? null : s)}
                            className={`text-left rounded-xl p-3 border transition-all ${
                                isSelected
                                    ? 'border-[#C6A664] bg-[#C6A664]/10'
                                    : 'border-white/10 bg-white/5 hover:border-white/20'
                            }`}
                        >
                            <div className="w-full aspect-video rounded-lg bg-black/40 flex items-center justify-center mb-2">
                                <span className="text-[10px] text-[#94A3B8] uppercase">{n} HDR{n === 1 ? '' : 's'}</span>
                            </div>
                            <span className="text-[12px] text-[#F5F7FA] truncate block">{s.label}</span>
                        </button>
                    );
                })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                    type="text"
                    value={collectionLabel}
                    onChange={(e) => setCollectionLabel(e.target.value)}
                    placeholder="New collection name"
                    className="flex-1 min-w-[120px] glass rounded-lg px-3 py-2 text-[12px] text-[#F5F7FA] placeholder:text-[#94A3B8]/50 focus:outline-none"
                />
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={HDR_ACCEPT}
                    className="hidden"
                    onChange={handleFile}
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#C6A664]/30 text-[#C6A664] text-[11px] tracking-wider uppercase disabled:opacity-50"
                >
                    {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
                    {uploading ? 'Uploading…' : 'Upload HDR'}
                </button>
            </div>
            {uploadError && <p className="mt-2 text-red-400 text-[11px]">{uploadError}</p>}
        </div>
    );
}
