'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

const Engine = dynamic(() => import('@/pages/Engine'), { ssr: false });

function EngineRouteFallback() {
    return (
        <div className="w-screen h-screen bg-[#0A0A0B] flex items-center justify-center">
            <div className="text-[#C6A664] tracking-[0.35em] uppercase animate-pulse text-xs">Loading engine…</div>
        </div>
    );
}

export default function EngineWorldPreviewPage() {
    const params = useParams();
    const raw = params?.worldId;
    const worldId = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] ?? '' : '';
    return (
        <Suspense fallback={<EngineRouteFallback />}>
            <Engine key={worldId ? `world-${worldId}` : 'world-preview'} />
        </Suspense>
    );
}
