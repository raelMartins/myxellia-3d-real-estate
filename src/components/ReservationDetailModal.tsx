import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, Box, User, Calendar, MapPin, Check, XCircle } from 'lucide-react';
import { formatCentsToCurrency } from '../lib/currency';
import type { ReservationListItem, ReservationStatus } from '../lib/reservations';

const STATUS_LABEL: Record<ReservationStatus, string> = {
    soft_lock: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    expired: 'Expired',
};

interface ReservationDetailModalProps {
    item: ReservationListItem | null;
    open: boolean;
    onClose: () => void;
    isAdmin: boolean;
    onAccept?: (reservationId: string) => Promise<void>;
    onReject?: (reservationId: string) => Promise<void>;
    acceptRejectLoading?: boolean;
}

export default function ReservationDetailModal({
    item,
    open,
    onClose,
    isAdmin,
    onAccept,
    onReject,
    acceptRejectLoading = false,
}: ReservationDetailModalProps) {
    const navigate = useNavigate();
    if (!open) return null;

    const reservation = item?.reservation;
    const unit = item?.unit;
    const buildingName = item?.buildingName ?? null;
    const profile = item?.profile;
    const buildingId = unit?.building_id;
    const canAcceptDeny = isAdmin && reservation?.status === 'soft_lock' && onAccept && onReject;

    const handleViewIn3D = () => {
        if (buildingId && unit?.id) {
            onClose();
            navigate(`/engine/${buildingId}?unitId=${unit.id}`);
        }
    };

    const handleAccept = () => {
        if (reservation?.id && onAccept) onAccept(reservation.id);
    };

    const handleReject = () => {
        if (reservation?.id && onReject) onReject(reservation.id);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-heavy rounded-2xl border border-white/10 w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
            >
                <div className="p-6 pb-4 flex items-center justify-between border-b border-white/5">
                    <span className="text-[10px] tracking-[0.25em] text-[#C6A664] uppercase">Reservation details</span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg text-[#94A3B8] hover:text-[#F5F7FA] hover:bg-white/5 transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                    {reservation && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[10px] tracking-[0.2em] text-[#94A3B8] uppercase">
                                <Calendar size={12} />
                                Request date
                            </div>
                            <p className="text-[#F5F7FA] text-sm">
                                {new Date(reservation.created_at).toLocaleDateString(undefined, {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                })}
                            </p>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] tracking-widest uppercase text-[#94A3B8]">Status</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/10 text-[#F5F7FA]">
                                    {STATUS_LABEL[reservation.status]}
                                </span>
                            </div>
                        </div>
                    )}

                    {unit && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[10px] tracking-[0.2em] text-[#94A3B8] uppercase">
                                <Box size={12} />
                                Unit
                            </div>
                            <div className="glass rounded-xl p-4 space-y-2">
                                <p className="text-[#F5F7FA] font-medium">Unit {unit.unit_number}</p>
                                {buildingName && (
                                    <p className="text-[#94A3B8] text-xs flex items-center gap-1.5">
                                        <MapPin size={10} /> {buildingName}
                                    </p>
                                )}
                                <p className="text-[#94A3B8] text-xs">
                                    {unit.price != null ? formatCentsToCurrency(Number(unit.price)) : 'Contact for price'}
                                    {unit.area_sqm != null && ` · ${unit.area_sqm} m²`}
                                    {(unit.bedrooms != null || unit.bathrooms != null) &&
                                        ` · ${unit.bedrooms ?? '-'} bed · ${unit.bathrooms ?? '-'} bath`}
                                </p>
                            </div>
                        </div>
                    )}

                    {profile && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[10px] tracking-[0.2em] text-[#94A3B8] uppercase">
                                <User size={12} />
                                Client
                            </div>
                            <div className="glass rounded-xl p-4">
                                <p className="text-[#F5F7FA] font-medium">{profile.full_name ?? '—'}</p>
                                {profile.company && (
                                    <p className="text-[#94A3B8] text-xs mt-1">{profile.company}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {!item && (
                        <p className="text-[#94A3B8] text-sm">No reservation selected.</p>
                    )}
                </div>

                <div className="p-6 pt-4 border-t border-white/5 flex flex-col gap-3">
                    {buildingId && unit?.id && (
                        <button
                            type="button"
                            onClick={handleViewIn3D}
                            className="w-full py-3 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] tracking-[0.2em] font-bold uppercase flex items-center justify-center gap-2 hover:bg-[#D4BA82] transition-colors"
                        >
                            <Box size={16} />
                            View in 3D
                        </button>
                    )}

                    {canAcceptDeny && (
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleAccept}
                                disabled={acceptRejectLoading}
                                className="flex-1 py-3 rounded-xl border border-[#39FF14]/40 text-[#39FF14] text-[11px] tracking-[0.2em] font-bold uppercase flex items-center justify-center gap-2 hover:bg-[#39FF14]/10 transition-colors disabled:opacity-50"
                            >
                                <Check size={16} />
                                Accept
                            </button>
                            <button
                                type="button"
                                onClick={handleReject}
                                disabled={acceptRejectLoading}
                                className="flex-1 py-3 rounded-xl border border-red-400/40 text-red-400 text-[11px] tracking-[0.2em] font-bold uppercase flex items-center justify-center gap-2 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                            >
                                <XCircle size={16} />
                                Deny
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
