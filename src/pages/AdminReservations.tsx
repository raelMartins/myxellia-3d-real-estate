'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2, Calendar, Box, User } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { fetchReservations, updateReservationStatus, type ReservationListItem, type ReservationStatus } from '@/lib/reservations';
import { formatCentsToCurrency } from '@/lib/currency';
import ReservationDetailModal from '@/components/ReservationDetailModal';

const TABS: { id: ReservationStatus | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'soft_lock', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
];

export default function AdminReservations() {
    const router = useRouter();
    const { profile } = useAuthStore();
    const isAdmin = profile?.role === 'admin';

    const [tab, setTab] = useState<ReservationStatus | 'all'>('all');
    const [list, setList] = useState<ReservationListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [detailItem, setDetailItem] = useState<ReservationListItem | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [acceptRejectLoading, setAcceptRejectLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const status = tab === 'all' ? undefined : tab;
        const data = await fetchReservations({ admin: true, status });
        setList(data);
        setLoading(false);
    }, [tab]);

    useEffect(() => {
        if (!isAdmin) {
            router.replace('/');
            return;
        }
        load();
    }, [isAdmin, router, load]);

    const handleRowClick = (item: ReservationListItem) => {
        setDetailItem(item);
        setModalOpen(true);
    };

    const handleAccept = async (reservationId: string) => {
        setAcceptRejectLoading(true);
        const { error } = await updateReservationStatus(reservationId, 'approved');
        setAcceptRejectLoading(false);
        if (error) return;
        await load();
        if (detailItem?.reservation.id === reservationId) {
            setDetailItem((prev) =>
                prev ? { ...prev, reservation: { ...prev.reservation, status: 'approved' } } : null
            );
        }
    };

    const handleReject = async (reservationId: string) => {
        setAcceptRejectLoading(true);
        const { error } = await updateReservationStatus(reservationId, 'rejected');
        setAcceptRejectLoading(false);
        if (error) return;
        await load();
        if (detailItem?.reservation.id === reservationId) {
            setDetailItem((prev) =>
                prev ? { ...prev, reservation: { ...prev.reservation, status: 'rejected' } } : null
            );
        }
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
                        Marketplace
                    </button>
                    <h1 className="font-serif-display text-xl tracking-tight">Allocations</h1>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-6 py-8">
                <div className="flex gap-2 mb-8 border-b border-white/5 pb-2">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`px-4 py-2 rounded-lg text-[10px] tracking-[0.2em] uppercase font-medium transition-colors ${
                                tab === t.id
                                    ? 'bg-[#C6A664]/20 text-[#C6A664] border border-[#C6A664]/40'
                                    : 'text-[#94A3B8] hover:text-[#F5F7FA] border border-transparent'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={24} className="text-[#C6A664] animate-spin" />
                    </div>
                ) : list.length === 0 ? (
                    <div className="glass rounded-2xl border border-white/5 p-12 text-center">
                        <p className="text-[#94A3B8] text-sm">No allocations in this tab.</p>
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
                                    <div className="flex items-center gap-2 text-[#94A3B8] text-sm truncate">
                                        <User size={14} className="shrink-0" />
                                        {item.profile?.full_name ?? item.profile?.company ?? '—'}
                                    </div>
                                    <div className="flex items-center gap-2 text-[#94A3B8] text-xs">
                                        <Calendar size={12} />
                                        {new Date(item.reservation.created_at).toLocaleDateString()}
                                    </div>
                                    <div className="ml-auto">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/10 text-[#F5F7FA]">
                                            {item.reservation.status === 'soft_lock'
                                                ? 'Pending'
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
                    isAdmin={true}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    acceptRejectLoading={acceptRejectLoading}
                />
            </AnimatePresence>
        </div>
    );
}
