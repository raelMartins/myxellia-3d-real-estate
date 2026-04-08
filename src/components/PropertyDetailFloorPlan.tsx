'use client';

import type { SectionPlan } from '@/lib/database.types';

export default function PropertyDetailFloorPlan({ sectionPlan }: { sectionPlan: SectionPlan | null | undefined }) {
    return (
        <div className="glass rounded-2xl overflow-hidden h-[280px] flex items-center justify-center relative">
            <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(198,166,100,0.3) 0%, transparent 70%)',
            }} />
            {sectionPlan?.sections?.length ? (
                <svg width="340" height="220" viewBox="-0.05 -0.05 1.1 1.1" preserveAspectRatio="xMidYMid meet" className="w-full h-full" fill="none">
                    <rect x={0} y={0} width={1} height={1} stroke="#C6A664" strokeWidth="0.007" fill="none" />
                    {sectionPlan.sections.map((sec, idx) => {
                        const pts = sec.footprint;
                        const pathD = pts.length >= 2 ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${1 - p[1]}`).join(' ') + ' Z' : '';
                        const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
                        const cy = 1 - (pts.reduce((a, p) => a + p[1], 0) / pts.length);
                        return (
                            <g key={idx}>
                                <path d={pathD} stroke="#C6A664" strokeWidth="0.005" fill="rgba(198,166,100,0.08)" />
                                <text x={cx} y={cy} fill="#C6A664" fontSize="0.028" textAnchor="middle" dominantBaseline="middle" opacity={0.9}>{sec.label}</text>
                            </g>
                        );
                    })}
                </svg>
            ) : (
                <svg width="340" height="220" viewBox="0 0 340 220" fill="none" className="opacity-50">
                    <rect x="20" y="20" width="300" height="180" rx="2" stroke="#C6A664" strokeWidth="1.5" fill="none" />
                    <rect x="20" y="20" width="120" height="80" stroke="#C6A664" strokeWidth="1" fill="none" opacity={0.6} />
                    <rect x="140" y="20" width="80" height="80" stroke="#C6A664" strokeWidth="1" fill="none" opacity={0.6} />
                    <rect x="220" y="20" width="100" height="80" stroke="#C6A664" strokeWidth="1" fill="none" opacity={0.6} />
                    <rect x="20" y="100" width="180" height="100" stroke="#C6A664" strokeWidth="1" fill="none" opacity={0.6} />
                    <rect x="200" y="100" width="120" height="100" stroke="#C6A664" strokeWidth="1" fill="none" opacity={0.6} />
                    <text x="65" y="65" fill="#C6A664" fontSize="9" textAnchor="middle" opacity={0.7}>Living Room</text>
                    <text x="180" y="65" fill="#C6A664" fontSize="9" textAnchor="middle" opacity={0.7}>Kitchen</text>
                    <text x="268" y="65" fill="#C6A664" fontSize="9" textAnchor="middle" opacity={0.7}>Master Suite</text>
                    <text x="108" y="155" fill="#C6A664" fontSize="9" textAnchor="middle" opacity={0.7}>Terrace</text>
                    <text x="258" y="155" fill="#C6A664" fontSize="9" textAnchor="middle" opacity={0.7}>Bedroom 2</text>
                </svg>
            )}
            <div className="absolute bottom-4 right-4 text-[9px] tracking-widest text-[#94A3B8] uppercase">Schematic · Not to Scale</div>
        </div>
    );
}
