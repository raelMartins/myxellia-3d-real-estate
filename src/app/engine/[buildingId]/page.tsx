'use client';

import dynamic from 'next/dynamic';

const Engine = dynamic(() => import('@/pages/Engine'), { ssr: false });

export default function EnginePage() {
  return <Engine />;
}
