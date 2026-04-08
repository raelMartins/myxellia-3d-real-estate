'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2, Calendar, Box } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { fetchReservations, type ReservationListItem } from '@/lib/reservations';
import { formatCentsToCurrency } from '@/lib/currency';
import ReservationDetailModal from '@/components/ReservationDetailModal';

export default function MyReservations() {
    const router = useRouter();
    const { profile, session } = useAuthStore();
    const userId = session?.user?.id ?? null;

    const [list, setList] = useState<ReservationListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [detailItem, setDetailItem] = useState<ReservationListItem | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const load = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        const data = await fetchReservations({ userId });
        setList(data);
        setLoading(false);
    }, [userId]);

    useEffect(() => {
        if (!userId) return;
        load();
    }, [userId, load]);

    const handleRowClick = (item: ReservationListItem) => {
        setDetailItem(item);
        setModalOpen(true);
    };

    return (
        <div className="min-h-screen bg-[#0A0A0B] text-[#F5F7FA]">
            <nav className="border-b border-white/5 glass-heavy">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2 text-[10px] tracking-[0.25em] text-[#94A3B8] uppercase hover:text-[#C6A664] transition-colors"
                    >
                        <ArrowLeft size={14} />
                        Back
                    </button>
                    <h1 className="font-serif-display text-xl tracking-tight">My Allocations</h1>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-6 py-8">
                {!profile ? (
                    <div className="glass rounded-2xl border border-white/5 p-12 text-center">
                        <p className="text-[#94A3B8] text-sm">Sign in to view your allocations.</p>
                    </div>
                ) : loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={24} className="text-[#C6A664] animate-spin" />
                    </div>
                ) : list.length === 0 ? (
                    <div className="glass rounded-2xl border border-white/5 p-12 text-center">
                        <p className="text-[#94A3B8] text-sm">You have no allocations yet.</p>
                        <button
                            onClick={() => router.push('/')}
                            className="mt-4 px-4 py-2 rounded-lg text-[#C6A664] text-[10px] tracking-widest uppercase border border-[#C6A664]/40 hover:bg-[#C6A664]/10 transition-colors"
                        >
                            Browse properties
                        </button>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        <AnimatePresence mode="popLayout">
                            {list.map((item) => (
                                <motion.li
                                    key={item.reservation.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => handleRowClick(item)}
                                    className="glass rounded-xl border border-white/5 p-4 flex flex-wrap items-center gap-4 cursor-pointer hover:border-[#C6A664]/30 transition-colors"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Box size={16} className="text-[#C6A664] shrink-0" />
                                        <span className="font-medium truncate">
                                            Unit {item.unit?.unit_number ?? '—'}
                                        </span>
                                    </div>
                                    <div className="text-[#94A3B8] text-sm truncate">
                                        {item.buildingName ?? '—'}
                                    </div>
                                    <div className="flex items-center gap-2 text-[#94A3B8] text-xs">
                                        <Calendar size={12} />
                                        {new Date(item.reservation.created_at).toLocaleDateString()}
                                    </div>
                                    <div className="ml-auto flex items-center gap-2">
                                        {item.reservation.status === 'soft_lock' && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                                Pending
                                            </span>
                                        )}
                                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/10 text-[#F5F7FA]">
                                            {item.reservation.status === 'soft_lock'
                                                ? 'Requested'
                                                : item.reservation.status}
                                        </span>
                                    </div>
                                    {item.unit?.price != null && (
                                        <span className="text-[10px] text-[#94A3B8]">
                                            {formatCentsToCurrency(Number(item.unit.price))}
                                        </span>
                                    )}
                                </motion.li>
                            ))}
                        </AnimatePresence>
                    </ul>
                )}
            </main>

            <AnimatePresence>
                <ReservationDetailModal
                    item={detailItem}
                    open={modalOpen}
                    onClose={() => setModalOpen(false)}
                    isAdmin={false}
                />
            </AnimatePresence>
        </div>
    );
}
