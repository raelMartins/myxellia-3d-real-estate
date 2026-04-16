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

export default function EnginePage() {
  const params = useParams();
  const raw = params?.buildingId;
  const buildingId = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] ?? '' : '';
  /** Suspense: Engine uses useSearchParams(). Remount key: WebGL + R3F tear down per building. */
  return (
    <Suspense fallback={<EngineRouteFallback />}>
      <Engine key={buildingId || 'engine'} />
    </Suspense>
  );
}
