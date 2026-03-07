import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Lock, Plus, Trash2 } from 'lucide-react';
import AdminUnitForm from './AdminUnitForm';
import { useEngineStore } from '../store/engine.store';
import { formatCentsToCurrency } from '../lib/currency';
import type { Database } from '../lib/database.types';

type UnitRow = Database['public']['Tables']['units']['Row'];

const ease = [0.2, 0.8, 0.2, 1] as const;
const STATUS_DOT: Record<string, string> = {
    available: 'status-available',
    pending: 'status-pending',
    sold: 'status-sold',
};
const STATUS_LABEL: Record<string, string> = {
    available: 'Available',
    pending: 'Pending',
    sold: 'Sold',
};

interface EngineSidebarProps {
    floors: { id: string; name: string; units: UnitRow[] }[];
    selectedUnitData: UnitRow | undefined;
    currentStatus: string | null;
    unitFormError: string | null;
    isAdmin: boolean;
    onReserve: () => void;
    onUnitSaved: () => void;
    onAddUnit: (unitNumber: string, floor: number) => Promise<void>;
    onDeleteUnit: (unitId: string) => Promise<void>;
    setUnitFormError: (msg: string | null) => void;
}

export default function EngineSidebar({
    floors,
    selectedUnitData,
    currentStatus,
    unitFormError,
    isAdmin,
    onReserve,
    onUnitSaved,
    onAddUnit,
    onDeleteUnit,
    setUnitFormError,
}: EngineSidebarProps) {
    const { buildingId } = useParams();
    const navigate = useNavigate();
    const {
        building, units, selectedUnit, hoveredUnit, unitStatuses,
        setSelectedUnit, setHoveredUnit,
    } = useEngineStore();
    const [addUnitNumber, setAddUnitNumber] = useState('');
    const [addFloor, setAddFloor] = useState(1);
    const [addSubmitting, setAddSubmitting] = useState(false);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);

    return (
        <motion.div
            initial={{ x: -60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease }}
            className="w-80 h-full flex flex-col z-20 relative shrink-0"
            style={{
                background: 'rgba(15, 15, 18, 0.72)',
                backdropFilter: 'saturate(180%) blur(28px)',
                WebkitBackdropFilter: 'saturate(180%) blur(28px)',
                borderRight: '1px solid rgba(255,255,255,0.07)',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.04), 20px 0 60px rgba(0,0,0,0.5)',
            }}
        >
            <div className="p-8 pb-6">
                <button
                    onClick={() => navigate(`/detail/${buildingId}`)}
                    className="flex items-center gap-2 text-[10px] tracking-[0.25em] text-[#94A3B8] uppercase hover:text-[#C6A664] transition-colors mb-6 group"
                >
                    <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Summary
                </button>
                <h2 className="font-serif-display text-4xl tracking-tight text-[#F5F7FA] leading-none mb-2">
                    {building?.name || 'Project'}
                </h2>
                <div className="flex items-center gap-2 mb-8">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-pulse-neon" />
                    <span className="text-[9px] tracking-[0.3em] text-[#94A3B8] uppercase">Interactive Engine</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 custom-scrollbar">
                <div className="space-y-10 pb-12">
                    {floors.map((floor) => (
                        <div key={floor.id} className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-px flex-1 bg-white/5" />
                                <h4 className="text-[10px] tracking-[0.3em] uppercase text-[#C6A664] font-medium whitespace-nowrap">
                                    {floor.name}
                                </h4>
                                <div className="h-px flex-1 bg-white/5" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {floor.units.map((unit) => {
                                    const status = unitStatuses[unit.id] ?? 'available';
                                    const isSelected = selectedUnit === unit.id;
                                    const isHovered = hoveredUnit === unit.id;
                                    return (
                                        <button
                                            key={unit.id}
                                            onClick={() => setSelectedUnit(unit.id)}
                                            onMouseEnter={() => setHoveredUnit(unit.id)}
                                            onMouseLeave={() => setHoveredUnit(null)}
                                            className={`
                                                relative p-4 rounded-xl text-left transition-all duration-300
                                                ${isSelected ? 'glass-heavy border-[#C6A664]/40 bg-white/5 ring-1 ring-[#C6A664]/20' : 'glass border-white/5 hover:border-white/15'}
                                            `}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`text-xs font-medium ${isSelected ? 'text-[#F5F7FA]' : 'text-[#94A3B8]'}`}>
                                                    {unit.unit_number}
                                                </span>
                                                <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
                                            </div>
                                            <div className="text-[10px] tracking-wider text-[#94A3B8]/60 font-light truncate">
                                                {unit.price ? formatCentsToCurrency(Number(unit.price)) : 'Contact for Price'}
                                            </div>
                                            {(isSelected || isHovered) && (
                                                <motion.div
                                                    layoutId="glow"
                                                    className="absolute inset-0 rounded-xl pointer-events-none"
                                                    style={{ boxShadow: '0 0 20px rgba(198,166,100,0.1)' }}
                                                />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    {floors.length === 0 && (
                        <div className="text-center py-10">
                            <p className="text-[#94A3B8] text-[10px] tracking-widest uppercase">Inventory Loading...</p>
                        </div>
                    )}
                    {isAdmin && (
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <h4 className="text-[10px] tracking-[0.3em] uppercase text-[#C6A664] font-medium">Add unit</h4>
                            <div className="grid grid-cols-[1fr,72px] gap-2">
                                <input
                                    type="text"
                                    placeholder="Unit number"
                                    value={addUnitNumber}
                                    onChange={(e) => setAddUnitNumber(e.target.value)}
                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-[#F5F7FA] placeholder:text-[#64748B] focus:border-[#C6A664]/50 focus:outline-none"
                                />
                                <input
                                    type="number"
                                    min={1}
                                    value={addFloor}
                                    onChange={(e) => setAddFloor(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-[#F5F7FA] focus:border-[#C6A664]/50 focus:outline-none"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={async () => {
                                    setAddSubmitting(true);
                                    setUnitFormError(null);
                                    await onAddUnit(addUnitNumber, addFloor);
                                    setAddUnitNumber('');
                                    setAddSubmitting(false);
                                }}
                                disabled={!addUnitNumber.trim() || addSubmitting}
                                className="w-full py-2.5 rounded-xl border border-[#C6A664]/40 text-[#C6A664] text-[10px] tracking-[0.2em] uppercase font-medium flex items-center justify-center gap-2 hover:bg-[#C6A664]/10 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                            >
                                <Plus size={12} />
                                Add unit box
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <AnimatePresence mode="wait">
                {selectedUnit && (
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        className="p-8 pt-6 border-t border-white/5 glass-heavy"
                    >
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <div className="text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5">Selected Inventory</div>
                                <h4 className="text-2xl font-serif-display text-[#F5F7FA]">Unit {selectedUnitData?.unit_number}</h4>
                            </div>
                            <div className="text-right">
                                <div className={`text-[10px] tracking-widest uppercase mb-1.5 ${STATUS_DOT[currentStatus ?? 'available']}`}>
                                    {STATUS_LABEL[currentStatus ?? 'available']}
                                </div>
                                <div className="text-xl font-light text-[#F5F7FA]">
                                    {selectedUnitData?.price ? formatCentsToCurrency(Number(selectedUnitData.price)) : ''}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {isAdmin && selectedUnitData ? (
                                <>
                                    <div className="max-h-[50vh] overflow-y-auto custom-scrollbar pr-1 -mr-1">
                                        <AdminUnitForm
                                            unit={selectedUnitData}
                                            onSaved={onUnitSaved}
                                            onError={setUnitFormError}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!selectedUnitData?.id || !window.confirm(`Remove unit ${selectedUnitData.unit_number}? This cannot be undone.`)) return;
                                            setDeleteSubmitting(true);
                                            setUnitFormError(null);
                                            await onDeleteUnit(selectedUnitData.id);
                                            setDeleteSubmitting(false);
                                        }}
                                        disabled={deleteSubmitting}
                                        className="w-full mt-3 py-2.5 rounded-xl border border-red-500/40 text-red-400 text-[10px] tracking-[0.2em] uppercase font-medium flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                    >
                                        <Trash2 size={12} />
                                        Delete unit box
                                    </button>
                                    {unitFormError && (
                                        <p className="text-red-400 text-xs mt-2">{unitFormError}</p>
                                    )}
                                </>
                            ) : !isAdmin ? (
                                <>
                                    {currentStatus === 'available' ? (
                                        <button
                                            onClick={onReserve}
                                            className="w-full py-4 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] tracking-[0.2em] font-bold uppercase transition-transform active:scale-95 shadow-lg shadow-[#C6A664]/20"
                                        >
                                            Request Reservation
                                        </button>
                                    ) : (
                                        <div className="w-full py-4 rounded-xl border border-white/5 bg-white/5 text-[#94A3B8] text-[11px] tracking-[0.2em] font-bold uppercase text-center flex items-center justify-center gap-2">
                                            <Lock size={12} />
                                            Unit Not Available
                                        </div>
                                    )}
                                </>
                            ) : null}
                            <button
                                onClick={() => { setSelectedUnit(null); setUnitFormError(null); }}
                                className="w-full py-3.5 rounded-xl border border-white/5 text-[#94A3B8] text-[10px] tracking-[0.2em] uppercase hover:bg-white/5 transition-colors"
                            >
                                Dismiss Selection
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
