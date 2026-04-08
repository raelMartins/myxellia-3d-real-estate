'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import { fetchSkyboxById } from '@/lib/skybox';
import { useAuthStore } from '@/store/auth.store';
import SkyboxPreviewCanvas from '@/components/SkyboxPreviewCanvas';

export default function SkyboxPreview() {
    const params = useParams();
    const id = (params?.id as string | undefined) ?? undefined;
    const router = useRouter();
    const [envUrl, setEnvUrl] = useState<string | null>(null);
    const [label, setLabel] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const getToken = () => useAuthStore.getState().session?.access_token ?? undefined;

    useEffect(() => {
        if (!id) {
            setError('Missing skybox id');
            return;
        }
        let cancelled = false;
        fetchSkyboxById(id, getToken).then((row) => {
            if (cancelled) return;
            if (row) {
                setEnvUrl(row.file_url);
                setLabel(row.label);
            } else {
                setError('Skybox not found');
            }
        });
        return () => { cancelled = true; };
    }, [id]);

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

    if (!envUrl) {
        return (
            <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
                <div className="text-[#C6A664] tracking-[0.2em] uppercase text-sm animate-pulse">Loading…</div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 w-full h-full bg-[#0A0A0B]">
            <div className="absolute top-6 left-6 z-20 flex items-center gap-4">
                <button
                    onClick={() => router.push('/skyboxes')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full glass border border-white/10 text-[11px] tracking-widest uppercase text-[#94A3B8] hover:text-[#F5F7FA] hover:border-[#C6A664]/30 transition-colors"
                >
                    <ArrowLeft size={14} /> Back
                </button>
                <span className="text-[12px] text-[#F5F7FA] font-light truncate max-w-[200px]">{label}</span>
            </div>
            <div className="absolute inset-0">
                <ErrorBoundary
                    fallback={
                        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-[#0A0A0B]">
                            <p className="text-red-400/90 text-sm text-center max-w-md px-4">Failed to load skybox. The file may be unsupported or the URL may be invalid.</p>
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
