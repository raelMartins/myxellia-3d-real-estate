'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import { fetchSkyboxCollectionById } from '@/lib/skyboxCollections';
import { orderedSlots } from '@/lib/skyboxEnvResolve';
import { useAuthStore } from '@/store/auth.store';
import SkyboxPreviewCanvas from '@/components/SkyboxPreviewCanvas';

export default function SkyboxPreview() {
    const params = useParams();
    const id = (params?.id as string | undefined) ?? undefined;
    const router = useRouter();
    const [collectionLabel, setCollectionLabel] = useState<string>('');
    const [slotId, setSlotId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const getToken = () => useAuthStore.getState().session?.access_token ?? undefined;

    const [slotsVersion, setSlotsVersion] = useState<{ label: string; slots: { id: string; file_url: string; label: string }[] } | null>(null);

    useEffect(() => {
        if (!id) {
            setError('Missing collection id');
            return;
        }
        let cancelled = false;
        fetchSkyboxCollectionById(id, getToken).then((row) => {
            if (cancelled) return;
            if (row) {
                const slots = orderedSlots(row.skybox_collection_slots ?? null);
                setCollectionLabel(row.label);
                setSlotsVersion({ label: row.label, slots: slots.map((s) => ({ id: s.id, file_url: s.file_url, label: s.label })) });
                setSlotId(slots[0]?.id ?? null);
            } else {
                setError('Sky collection not found');
            }
            setLoaded(true);
        });
        return () => { cancelled = true; };
    }, [id]);

    const envUrl = useMemo(() => {
        if (!slotsVersion?.slots.length) return null;
        const hit = slotId ? slotsVersion.slots.find((s) => s.id === slotId) : null;
        return (hit ?? slotsVersion.slots[0])?.file_url ?? null;
    }, [slotsVersion, slotId]);

    if (error) {
        return (
            <div className="min-h-screen bg-[#0A0A0B] flex flex-col items-center justify-center gap-6 p-8">
                <p className="text-red-400/90 text-sm">{error}</p>
                <button
                    onClick={() => router.push('/skyboxes')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-[#94A3B8] hover:text-[#F5F7FA] text-xs uppercase tracking-wider"
                >
                    <ArrowLeft size={14} /> Back to Skyboxes
                </button>
            </div>
        );
    }

    if (!loaded || !envUrl) {
        return (
            <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
                <div className="text-[#C6A664] tracking-[0.2em] uppercase text-sm animate-pulse">Loading…</div>
            </div>
        );
    }

    const slotTabs = slotsVersion?.slots ?? [];

    return (
        <div className="fixed inset-0 w-full h-full bg-[#0A0A0B]">
            <div className="absolute top-6 left-6 right-6 z-20 flex flex-wrap items-center gap-3">
                <button
                    onClick={() => router.push('/skyboxes')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full glass border border-white/10 text-[11px] tracking-widest uppercase text-[#94A3B8] hover:text-[#F5F7FA] hover:border-[#C6A664]/30 transition-colors shrink-0"
                >
                    <ArrowLeft size={14} /> Skyboxes
                </button>
                <span className="text-[12px] text-[#F5F7FA] font-light truncate max-w-[200px]">{collectionLabel}</span>
                {slotTabs.length > 1 && (
                    <div className="flex flex-wrap gap-1.5 ml-auto">
                        {slotTabs.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setSlotId(s.id)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] tracking-wider uppercase border transition-colors ${
                                    (slotId ?? slotTabs[0]?.id) === s.id
                                        ? 'border-[#C6A664]/50 bg-[#C6A664]/15 text-[#C6A664]'
                                        : 'border-white/10 text-[#94A3B8] hover:text-[#F5F7FA]'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="absolute inset-0 pt-20">
                <ErrorBoundary
                    fallback={
                        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-[#0A0A0B]">
                            <p className="text-red-400/90 text-sm text-center max-w-md px-4">Failed to load sky. The file may be unsupported or the URL may be invalid.</p>
                            <button
                                onClick={() => router.push('/skyboxes')}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-[#94A3B8] hover:text-[#F5F7FA] text-xs uppercase tracking-wider"
                            >
                                <ArrowLeft size={14} /> Back to Skyboxes
                            </button>
                        </div>
                    }
                >
                    <SkyboxPreviewCanvas envUrl={envUrl} />
                </ErrorBoundary>
            </div>
        </div>
    );
}
