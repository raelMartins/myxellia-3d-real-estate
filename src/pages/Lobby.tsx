'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { LogOut, ArrowRight, Activity, Users, TrendingUp, MapPin, Layers, Plus, ImagePlus, CalendarCheck } from 'lucide-react';
import type { Database } from '@/lib/database.types';
import { formatCentsToCurrency, formatCentsToShortCurrency } from '@/lib/currency';

type BuildingRow = Database['public']['Tables']['buildings']['Row'];

const ease = [0.2, 0.8, 0.2, 1] as const;

/* ── Tilt Card Component ── */
function BuildingCard({ building, index }: { building: BuildingRow & { badge?: string; available_units?: number; hero_url?: string | null; starting_price?: string | null }; index: number }) {
    const router = useRouter();
    const cardRef = useRef<HTMLDivElement>(null);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const [hovered, setHovered] = useState(false);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const cx = (e.clientX - rect.left) / rect.width - 0.5;
        const cy = (e.clientY - rect.top) / rect.height - 0.5;
        setTilt({ x: cy * -10, y: cx * 10 });
    };

    const resetTilt = () => {
        setTilt({ x: 0, y: 0 });
        setHovered(false);
    };

    const totalUnits = building.total_units || 0;
    const availUnits = building.available_units || 0;
    const availPct = totalUnits > 0 ? Math.round((availUnits / totalUnits) * 100) : 0;
    const thumbnail = building.thumbnail_url || building.hero_url || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=1400';

    return (
        <motion.div
            ref={cardRef}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: index * 0.12 }}
            style={{
                transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${hovered ? 1.015 : 1})`,
                transition: hovered ? 'transform 0.1s linear' : 'transform 0.5s cubic-bezier(0.2,0.8,0.2,1)',
                transformStyle: 'preserve-3d',
            }}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={resetTilt}
            onClick={() => router.push(`/detail/${building.id}`)}
            className="relative h-[440px] rounded-2xl overflow-hidden cursor-pointer group"
        >
            {/* Background Image */}
            <img
                src={thumbnail}
                alt={building.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B]/20 to-transparent opacity-80" />

            {/* Content Overlay */}
            <div className="absolute inset-0 p-8 flex flex-col justify-end">
                <div style={{ transform: 'translateZ(50px)' }}>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] tracking-[0.25em] text-[#C6A664] uppercase font-bold">
                            {building.badge || 'New Project'}
                        </span>
                    </div>
                    <h3 className="font-serif-display text-4xl text-[#F5F7FA] leading-tight mb-4 group-hover:text-[#C6A664] transition-colors">
                        {building.name}
                    </h3>

                    {/* Status Bar */}
                    <div className="mb-6 space-y-2">
                        <div className="flex justify-between text-[10px] tracking-widest uppercase text-[#94A3B8]">
                            <span>Availability</span>
                            <span>{availUnits} / {totalUnits} Units</span>
                        </div>
                        <div className="h-0.5 w-full bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${availPct}%` }}
                                transition={{ duration: 1, delay: 0.5 }}
                                className="h-full bg-[#C6A664]"
                            />
                        </div>
                    </div>

                    <div className="flex items-end justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] tracking-[0.25em] text-[#C6A664] uppercase font-bold">
                                    {building.starting_price
                                        ? (isNaN(Number(building.starting_price))
                                            ? building.starting_price
                                            : formatCentsToCurrency(Number(building.starting_price)))
                                        : 'Available Now'}
                                </span>
                            </div>
                            <h3 className="font-serif-display text-3xl text-white mb-2 leading-tight">
                                {building.name}
                            </h3>
                            <p className="text-[10px] tracking-widest text-[#94A3B8] uppercase mb-6 flex items-center gap-1.5 font-medium">
                                <MapPin size={10} className="text-[#C6A664]" /> {building.location}
                            </p>
                        </div>

                        <button className="w-12 h-12 rounded-full glass flex items-center justify-center transition-all duration-300 group-hover:bg-[#C6A664]/20 group-hover:border-[#C6A664]/40">
                            <ArrowRight size={18} className="text-[#94A3B8] group-hover:text-[#C6A664] transition-colors" />
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

/* ── Main Lobby ── */
export default function Lobby() {
    const router = useRouter();
    const { profile, signOut } = useAuthStore();
    const isAdmin = profile?.role === 'admin';

    type BuildingWithMeta = BuildingRow & { badge?: string; available_units?: number; hero_url?: string | null; starting_price?: string | null };
    const [buildings, setBuildings] = useState<BuildingWithMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [portfolioValue, setPortfolioValue] = useState<string>('$0');
    const [clientCount, setClientCount] = useState<number>(0);
    const [reservationCount, setReservationCount] = useState<number>(0);

    useEffect(() => {
        async function loadBuildings() {
            try {
                const { data, error } = await supabase.from('buildings').select('*').order('created_at', { ascending: false });
                if (error) throw error;
                const list = (data || []) as BuildingRow[];
                if (profile?.role === 'admin') {
                    const [unitsRes, profilesRes, reservationsRes] = await Promise.all([
                        supabase.from('units').select('building_id, status, price').is('deleted_at', null),
                        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
                        supabase.from('reservations').select('id', { count: 'exact', head: true }),
                    ]);
                    const units = (unitsRes.data || []) as { building_id: string; status: string; price: number | null }[];
                    let totalCents = 0;
                    for (const u of units) {
                        const p = u.price;
                        if (typeof p === 'number' && Number.isFinite(p)) totalCents += p;
                    }
                    setPortfolioValue(formatCentsToShortCurrency(totalCents));
                    setClientCount(profilesRes.count ?? 0);
                    setReservationCount(reservationsRes.count ?? 0);
                    const byBuilding: Record<string, { total: number; available: number }> = {};
                    for (const u of units) {
                        const bid = u.building_id;
                        if (!byBuilding[bid]) byBuilding[bid] = { total: 0, available: 0 };
                        byBuilding[bid].total += 1;
                        if (u.status === 'available') byBuilding[bid].available += 1;
                    }
                    setBuildings(list.map((b) => {
                        const counts = byBuilding[b.id];
                        return {
                            ...b,
                            total_units: counts ? counts.total : b.total_units,
                            available_units: counts ? counts.available : 0,
                        } as BuildingWithMeta;
                    }));
                } else {
                    setBuildings(list as BuildingWithMeta[]);
                }
            } catch {
                setBuildings([]);
            } finally {
                setLoading(false);
            }
        }
        loadBuildings();
    }, [profile?.role]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
                <div className="text-[#C6A664] tracking-[0.3em] uppercase animate-pulse">Establishing Connection...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0A0A0B] text-[#F5F7FA] overflow-y-auto" style={{ overflowY: 'auto' }}>

            {/* Nav */}
            <nav className="fixed top-0 w-full z-50 glass-heavy" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="max-w-7xl mx-auto px-8 h-18 flex items-center justify-between" style={{ height: '72px' }}>
                    <div className="flex items-center gap-5">
                        <span className="font-serif-display text-lg tracking-[0.3em] text-[#F5F7FA]">MYXELLIA</span>
                        <div className="w-px h-4 bg-white/15" />
                        <span className="text-[10px] tracking-[0.25em] text-[#C6A664] uppercase">
                            {isAdmin ? 'Command Center' : 'Marketplace'}
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(isAdmin ? '/admin/reservations' : '/reservations')}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] tracking-widest uppercase font-semibold transition-all duration-200 hover:opacity-90 border border-white/15 text-[#94A3B8] hover:text-[#F5F7FA] hover:border-white/25"
                        >
                            <CalendarCheck size={12} />
                            {isAdmin ? 'Allocations' : 'My Allocations'}
                        </button>
                        {isAdmin && (
                            <>
                                <button
                                    onClick={() => router.push('/skyboxes')}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] tracking-widest uppercase font-semibold transition-all duration-200 hover:opacity-90 border border-white/15 text-[#94A3B8] hover:text-[#F5F7FA] hover:border-white/25"
                                >
                                    <ImagePlus size={12} />
                                    Skyboxes
                                </button>
                                <button
                                    onClick={() => router.push('/deploy')}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] tracking-widest uppercase font-semibold transition-all duration-200 hover:opacity-90"
                                    style={{ background: 'rgba(198,166,100,0.12)', border: '1px solid rgba(198,166,100,0.35)', color: '#C6A664' }}
                                >
                                    <Plus size={12} />
                                    Deploy New Project
                                </button>
                            </>
                        )}
                        <div className="text-right hidden sm:block">
                            <div className="text-sm font-light text-[#F5F7FA]">{profile?.full_name ?? 'Authorized User'}</div>
                            <div className="text-[10px] tracking-widest text-[#94A3B8] uppercase">{profile?.role ?? 'client'}</div>
                        </div>
                        <button
                            onClick={() => signOut()}
                            className="w-9 h-9 rounded-full glass flex items-center justify-center hover:border-white/25 transition-all duration-200"
                        >
                            <LogOut size={15} className="text-[#94A3B8]" />
                        </button>
                    </div>
                </div>
            </nav>

            {/* Content */}
            <main className="max-w-7xl mx-auto px-8 pt-28 pb-20">

                {/* Admin Stats */}
                {isAdmin && (
                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease }}
                    >
                        <div className="glass rounded-xl p-6 border border-white/5">
                            <div className="flex items-center gap-3 text-[#94A3B8] text-[10px] tracking-[0.2em] uppercase mb-2">
                                <TrendingUp size={12} className="text-[#C6A664]" />
                                Portfolio Value
                            </div>
                            <div className="text-2xl font-light text-[#F5F7FA]">{portfolioValue}</div>
                        </div>
                        <div className="glass rounded-xl p-6 border border-white/5">
                            <div className="flex items-center gap-3 text-[#94A3B8] text-[10px] tracking-[0.2em] uppercase mb-2">
                                <Activity size={12} className="text-[#C6A664]" />
                                Allocation Requests
                            </div>
                            <div className="text-2xl font-light text-[#F5F7FA]">{reservationCount}</div>
                        </div>
                        <div className="glass rounded-xl p-6 border border-white/5">
                            <div className="flex items-center gap-3 text-[#94A3B8] text-[10px] tracking-[0.2em] uppercase mb-2">
                                <Users size={12} className="text-[#C6A664]" />
                                Global Buyers
                            </div>
                            <div className="text-2xl font-light text-[#F5F7FA]">{clientCount}</div>
                        </div>
                    </motion.div>
                )}

                {/* Hero section */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, ease }}
                    className="mb-12"
                >
                    <div className="flex items-center gap-2 text-[10px] tracking-[0.25em] text-[#94A3B8] uppercase mb-4">
                        <Layers size={11} />
                        {buildings.length} Active Projects
                    </div>
                    <h1 className="font-serif-display text-5xl md:text-7xl text-[#F5F7FA] leading-[1.05] mb-4">
                        Discover<br />
                        <span className="text-[#C6A664]">Liquid Architecture</span>
                    </h1>
                    <p className="max-w-xl text-[#94A3B8] text-[15px] leading-relaxed font-light">
                        Explore our curated selection of high-definition 3D properties. Designed with precision, presented with luxury.
                    </p>
                </motion.div>

                {/* Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                    {buildings.map((b, i) => (
                        <BuildingCard key={b.id} building={b} index={i} />
                    ))}
                    {buildings.length === 0 && (
                        <div className="col-span-full py-20 text-center glass rounded-2xl border border-white/5">
                            <p className="text-[#94A3B8] text-sm">No projects deployed yet.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
