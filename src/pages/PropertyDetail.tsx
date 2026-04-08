'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { ArrowLeft, Box, MapPin, Layers, BedDouble, Bath, Maximize2, Play, ExternalLink } from 'lucide-react';
import { computeBuildingDetailStats } from '@/lib/buildingDetailStats';
import PropertyDetailFloorPlan from '@/components/PropertyDetailFloorPlan';

const ease = [0.2, 0.8, 0.2, 1] as const;

const FALLBACK_HERO = 'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&q=80&w=1800';

type BuildingRow = Database['public']['Tables']['buildings']['Row'];
type BuildingDetail = BuildingRow & { available_units?: number; floors?: string | number };
type UnitForDetail = Pick<Database['public']['Tables']['units']['Row'], 'status' | 'bedrooms' | 'bathrooms' | 'area_sqm' | 'floor' | 'price'>;

export default function PropertyDetail() {
    const params = useParams();
    const buildingId = (params?.buildingId as string | undefined) ?? undefined;
    const router = useRouter();
    const [bldg, setBldg] = useState<BuildingDetail | null>(null);
    const [units, setUnits] = useState<UnitForDetail[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const id = buildingId;
        if (!id) return;
        setLoading(true);
        setBldg(null);
        setUnits([]);
        let cancelled = false;
        async function load() {
            try {
                const [bldgRes, unitsRes] = await Promise.all([
                    supabase.from('buildings').select('*').eq('id', id!).single(),
                    supabase.from('units').select('status, bedrooms, bathrooms, area_sqm, floor, price').eq('building_id', id!).is('deleted_at', null),
                ]);
                if (bldgRes.error) throw bldgRes.error;
                if (!cancelled) {
                    setBldg(bldgRes.data);
                    setUnits(unitsRes.data || []);
                }
            } catch {
                if (!cancelled) setBldg(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [buildingId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
                <div className="text-[#C6A664] tracking-[0.3em] uppercase animate-pulse">Loading Assets...</div>
            </div>
        );
    }

    if (!bldg) {
        return (
            <div className="min-h-screen bg-[#0A0A0B] flex flex-col items-center justify-center space-y-4">
                <p className="text-[#94A3B8]">Building not found.</p>
                <button onClick={() => router.push('/')} className="text-[#C6A664] hover:underline uppercase text-[10px] tracking-widest">Back to Marketplace</button>
            </div>
        );
    }

    const stats = computeBuildingDetailStats(units, bldg);
    const { totalUnits, availUnits, availPct, floorsValue, bedroomsValue, bathroomsValue, areaValue, startingPriceDisplay } = stats;
    const heroes = [
        bldg.hero_url ?? undefined,
        FALLBACK_HERO
    ];
    const heroImage = heroes.find((h): h is string => !!h) ?? FALLBACK_HERO;

    const highlights = [
        { icon: Layers, label: 'Floors', value: floorsValue },
        { icon: Box, label: 'Total Units', value: totalUnits },
        { icon: BedDouble, label: 'Bedrooms', value: bedroomsValue },
        { icon: Bath, label: 'Bathrooms', value: bathroomsValue },
        { icon: Maximize2, label: 'Area Range', value: areaValue },
        { icon: MapPin, label: 'Location', value: bldg.location ?? '—' },
    ];

    return (
        <div className="min-h-screen bg-[#0A0A0B] text-[#F5F7FA] overflow-y-auto" style={{ overflowY: 'auto' }}>

            {/* Hero */}
            <div className="relative h-[65vh] overflow-hidden">
                <img src={heroImage} alt={bldg.name} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0B]/50 via-transparent to-[#0A0A0B]" />

                {/* Back Button */}
                <motion.button
                    onClick={() => router.back()}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, ease }}
                    className="absolute top-8 left-8 flex items-center gap-2 glass px-4 py-2.5 rounded-full text-[11px] tracking-widest uppercase text-[#94A3B8] hover:text-[#F5F7FA] transition-colors"
                >
                    <ArrowLeft size={13} />
                    Marketplace
                </motion.button>

                {/* Title overlay */}
                <div className="absolute bottom-12 left-12 right-12">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease, delay: 0.1 }}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-2 h-2 rounded-full animate-pulse-neon" style={{ background: '#39FF14' }} />
                            <span className="text-[10px] tracking-[0.3em] text-[#94A3B8] uppercase">{bldg.location}</span>
                        </div>
                        <h1 className="font-serif-display text-6xl md:text-8xl leading-none text-[#F5F7FA]">{bldg.name}</h1>
                        <p className="text-[#94A3B8] text-lg mt-2 font-light">{bldg.tagline || 'Vertical Living Redefined'}</p>
                    </motion.div>
                </div>
            </div>

            {/* Body */}
            <div className="max-w-6xl mx-auto px-8 pb-24 -mt-2">

                {/* Highlights Grid */}
                <motion.div
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-14"
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease, delay: 0.2 }}
                >
                    {highlights.map(({ icon: Icon, label, value }) => (
                        <div key={label} className="glass rounded-xl p-4 text-center">
                            <Icon size={16} className="mx-auto mb-2 text-[#C6A664]" />
                            <div className="text-[9px] tracking-[0.2em] text-[#94A3B8] uppercase mb-1">{label}</div>
                            <div className="text-sm font-medium text-[#F5F7FA]">{value}</div>
                        </div>
                    ))}
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">

                    {/* Left — Description + Floor Plan */}
                    <motion.div
                        className="lg:col-span-3 space-y-10"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease, delay: 0.3 }}
                    >
                        {/* Description */}
                        <div>
                            <div className="text-[10px] tracking-[0.25em] text-[#C6A664] uppercase mb-4">About the Project</div>
                            <p className="text-[#94A3B8] leading-relaxed text-[15px]">{bldg.description}</p>
                        </div>

                        {/* Floor Plan — from section_plan when present */}
                        <div>
                            <div className="text-[10px] tracking-[0.25em] text-[#C6A664] uppercase mb-4">Floor Plan</div>
                            <PropertyDetailFloorPlan sectionPlan={bldg.section_plan} />
                        </div>
                    </motion.div>

                    {/* Right — Sidebar */}
                    <motion.div
                        className="lg:col-span-2 space-y-5"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, ease, delay: 0.4 }}
                    >
                        {/* Pricing Card */}
                        <div className="glass rounded-2xl p-6" style={{ borderColor: 'rgba(198,166,100,0.25)' }}>
                            <div className="text-[10px] tracking-[0.25em] text-[#94A3B8] uppercase mb-1">Starting From</div>
                            <div className="font-serif-display text-3xl text-[#C6A664] mb-4">
                                {startingPriceDisplay}
                            </div>
                            <div className="flex justify-between text-[11px] text-[#94A3B8] mb-2">
                                <span>Available Units</span>
                                <span className="text-[#39FF14] font-medium">{availUnits} / {totalUnits}</span>
                            </div>
                            <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{ width: `${availPct}%`, background: 'linear-gradient(90deg, #39FF14, #C6A664)' }}
                                />
                            </div>
                        </div>

                        {/* Map Placeholder */}
                        <div className="glass rounded-2xl overflow-hidden h-[200px] relative flex items-center justify-center">
                            <div className="absolute inset-0 opacity-30" style={{
                                backgroundImage: `url(https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/-73.985130,40.758896,13,0/600x400?access_token=pk.placeholder)`,
                                backgroundSize: 'cover', backgroundPosition: 'center',
                            }} />
                            <div className="absolute inset-0 bg-[#0A0A0B]/50" />
                            <div className="relative text-center">
                                <MapPin size={24} className="mx-auto mb-2 text-[#C6A664]" />
                                <div className="text-[11px] tracking-widest text-[#94A3B8] uppercase">{bldg.location}</div>
                            </div>
                        </div>

                        {/* CTA */}
                        {bldg.store_url && (
                            <motion.button
                                onClick={() => window.open(bldg.store_url!, '_blank')}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-4 rounded-xl glass border border-[#C6A664]/30 text-[#C6A664] font-semibold text-[11px] tracking-[0.2em] uppercase flex items-center justify-center gap-2 hover:bg-[#C6A664]/10 transition-colors"
                            >
                                <ExternalLink size={14} />
                                Visit Project Store
                            </motion.button>
                        )}

                        <motion.button
                            onClick={() => router.push(`/engine/${bldg.id}`)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full py-5 rounded-xl text-[#0A0A0B] font-semibold text-[13px] tracking-[0.2em] uppercase relative overflow-hidden group"
                            style={{ background: 'linear-gradient(135deg, #C6A664, #D4BA82)' }}
                        >
                            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer pointer-events-none" />
                            <span className="relative flex items-center justify-center gap-2">
                                <Play size={15} />
                                Enter 3D Experience
                            </span>
                        </motion.button>

                        <p className="text-center text-[10px] tracking-widest text-[#94A3B8] uppercase">
                            Interactive 3D walkthrough · No download required
                        </p>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
