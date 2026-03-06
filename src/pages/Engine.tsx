import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Layers, Lock, CheckCircle,
    Sun, Sunset, Moon, X, BellRing, Sparkles, Loader2
} from 'lucide-react';
import MyxelliaCanvas from '../components/MyxelliaCanvas';
import { useEngineStore } from '../store/engine.store';
import { useAuthStore } from '../store/auth.store';
import { suggestUnits, type UnitSuggestion } from '../lib/ai';
import { supabase } from '../lib/supabase';
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

type LightingMode = 'morning' | 'golden' | 'night';
const LIGHTING_OPTS: { mode: LightingMode; icon: typeof Sun; label: string }[] = [
    { mode: 'morning', icon: Sun, label: 'Morning' },
    { mode: 'golden', icon: Sunset, label: 'Golden Hour' },
    { mode: 'night', icon: Moon, label: 'Night' },
];

export default function Engine() {
    const { buildingId } = useParams();
    const navigate = useNavigate();

    const {
        building, units, loading,
        selectedUnit, hoveredUnit,
        viewMode, lightingMode, unitStatuses, notification,
        fetchBuilding, fetchUnits, setSelectedUnit,
        setHoveredUnit, setViewMode, setLightingMode,
        setUnitStatus, setNotification, requestScreenshot,
    } = useEngineStore();

    const [suggestModalOpen, setSuggestModalOpen] = useState(false);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const [suggestError, setSuggestError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<UnitSuggestion[]>([]);
    const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState(false);

    const { profile } = useAuthStore();
    const isAdmin = profile?.role === 'admin';

    useEffect(() => {
        if (buildingId) {
            fetchBuilding(buildingId);
            fetchUnits(buildingId);
        }
    }, [buildingId, fetchBuilding, fetchUnits]);

    /* Auto-dismiss notification */
    useEffect(() => {
        if (!notification) return;
        const t = setTimeout(() => setNotification(null), 5000);
        return () => clearTimeout(t);
    }, [notification, setNotification]);

    // Group units by floor
    const floors = useMemo(() => {
        const groups: Record<string, UnitRow[]> = {};
        units.forEach((u: UnitRow) => {
            const f = u.floor ?? 1;
            if (!groups[f]) groups[f] = [];
            groups[f].push(u);
        });
        return Object.entries(groups).map(([name, floorUnits]) => ({
            id: `f-${name}`,
            name: `Floor ${name}`,
            units: floorUnits
        })).sort((a, b) => b.name.localeCompare(a.name));
    }, [units]);

    const selectedUnitData = units.find((u: UnitRow) => u.id === selectedUnit);
    const currentStatus = selectedUnit ? (unitStatuses[selectedUnit] ?? 'available') : null;

    const handleReserve = () => {
        if (!selectedUnit) return;
        setUnitStatus(selectedUnit, 'pending');
        if (isAdmin) setNotification(`New Reservation Request — Unit ${selectedUnitData?.unit_number}`);
    };

    const handleApprove = () => {
        if (!selectedUnit) return;
        setUnitStatus(selectedUnit, 'sold');
        setNotification(`Unit ${selectedUnitData?.unit_number} — Marked as Sold`);
    };

    const handleSuggestUnits = async () => {
        if (!buildingId || !building) return;
        setSuggestLoading(true);
        setSuggestError(null);
        setSuggestions([]);
        setSuggestModalOpen(true);
        try {
            const dataUrl = await requestScreenshot();
            const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
            const { suggestions: list } = await suggestUnits(buildingId, [base64]);
            setSuggestions(list || []);
            setConfirmed(new Set((list || []).map((_, i) => i)));
        } catch (e) {
            setSuggestError(e instanceof Error ? e.message : 'Failed to get suggestions');
        } finally {
            setSuggestLoading(false);
        }
    };

    const toggleConfirmed = (index: number) => {
        setConfirmed((prev) => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const handleSaveSuggestedUnits = async () => {
        if (!buildingId || !building) return;
        const toSave = suggestions.filter((_, i) => confirmed.has(i));
        if (toSave.length === 0) {
            setSuggestModalOpen(false);
            return;
        }
        const existingNumbers = new Set(units.map((u: UnitRow) => u.unit_number));
        const newSuggestions = toSave.filter((s) => !existingNumbers.has(s.label));
        if (newSuggestions.length === 0) {
            setSuggestError('All suggested unit numbers already exist. Uncheck duplicates or edit labels.');
            return;
        }
        setSaving(true);
        setSuggestError(null);
        try {
            const defaultPrice = (building as { starting_price?: string }).starting_price || '$1.2M';
            const rows: Database['public']['Tables']['units']['Insert'][] = newSuggestions.map((s) => ({
                building_id: buildingId,
                unit_number: s.label,
                floor: s.floor,
                price: defaultPrice,
                status: 'available',
                mesh_id: `u-${s.label}`,
            }));
            // @ts-expect-error - Supabase client inferrence with extended Database types
            const { error } = await supabase.from('units').insert(rows);
            if (error) throw error;
            await fetchUnits(buildingId);
            setNotification(newSuggestions.length < toSave.length
                ? `Added ${newSuggestions.length} new unit(s); ${toSave.length - newSuggestions.length} already existed.`
                : `Added ${newSuggestions.length} unit(s). Confirm on the left.`);
            setSuggestModalOpen(false);
        } catch (e) {
            setSuggestError(e instanceof Error ? e.message : 'Failed to save units');
        } finally {
            setSaving(false);
        }
    };

    if (loading && !building) {
        return (
            <div className="w-screen h-screen bg-[#0A0A0B] flex items-center justify-center">
                <div className="text-[#C6A664] tracking-[0.4em] uppercase animate-pulse">Synchronizing Engine...</div>
            </div>
        );
    }

    return (
        <div className="w-screen h-screen bg-[#0A0A0B] text-[#F5F7FA] flex overflow-hidden relative">

            {/* ── Admin Notification Toast ── */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        key="notification"
                        initial={{ opacity: 0, y: -20, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -20, x: '-50%' }}
                        transition={{ duration: 0.4, ease }}
                        className="fixed top-6 left-1/2 z-50 glass rounded-xl px-5 py-3.5 flex items-center gap-3 pointer-events-none"
                        style={{ borderColor: 'rgba(198,166,100,0.35)' }}
                    >
                        <BellRing size={15} className="text-[#C6A664] shrink-0" />
                        <span className="text-[12px] tracking-wider text-[#F5F7FA]">{notification}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ───────────────────────────────────
                LEFT SIDEBAR
               ─────────────────────────────────── */}
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
                {/* Header */}
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

                {/* Floor Navigator */}
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
                                                    {unit.price || 'Contact for Price'}
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
                    </div>
                </div>

                {/* Footer Selection Info */}
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
                                    <div className="text-xl font-light text-[#F5F7FA]">{selectedUnitData?.price}</div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {currentStatus === 'available' ? (
                                    <button
                                        onClick={handleReserve}
                                        className="w-full py-4 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] tracking-[0.2em] font-bold uppercase transition-transform active:scale-95 shadow-lg shadow-[#C6A664]/20"
                                    >
                                        Request Reservation
                                    </button>
                                ) : currentStatus === 'pending' && isAdmin ? (
                                    <button
                                        onClick={handleApprove}
                                        className="w-full py-4 rounded-xl border border-[#39FF14]/30 bg-[#39FF14]/10 text-[#39FF14] text-[11px] tracking-[0.2em] font-bold uppercase transition-all hover:bg-[#39FF14]/20"
                                    >
                                        Approve Acquisition
                                    </button>
                                ) : (
                                    <div className="w-full py-4 rounded-xl border border-white/5 bg-white/5 text-[#94A3B8] text-[11px] tracking-[0.2em] font-bold uppercase text-center flex items-center justify-center gap-2">
                                        <Lock size={12} />
                                        Unit Not Available
                                    </div>
                                )}
                                <button
                                    onClick={() => setSelectedUnit(null)}
                                    className="w-full py-3.5 rounded-xl border border-white/5 text-[#94A3B8] text-[10px] tracking-[0.2em] uppercase hover:bg-white/5 transition-colors"
                                >
                                    Dismiss Selection
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* ───────────────────────────────────
                MAIN VIEWPORT (3D)
               ─────────────────────────────────── */}
            <div className="flex-1 relative">
                <AnimatePresence mode="wait">
                    {viewMode === 'exterior' ? (
                        <motion.div
                            key="exterior"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.8 }}
                            className="w-full h-full"
                        >
                            <MyxelliaCanvas />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="interior"
                            initial={{ opacity: 0, scale: 1.1 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.8, ease }}
                            className="w-full h-full relative"
                        >
                            {/* Interior Placeholder UI */}
                            <div className="absolute inset-0 bg-gradient-to-br from-[#141416] to-[#0A0A0B] flex flex-col items-center justify-center">
                                <div className="text-center p-12 glass rounded-3xl border border-white/5 max-w-lg">
                                    <div className="w-16 h-16 rounded-full glass shrink-0 flex items-center justify-center mx-auto mb-8 animate-float">
                                        <Layers size={24} className="text-[#C6A664]" />
                                    </div>
                                    <h4 className="font-serif-display text-4xl text-[#F5F7FA] mb-4">Unit {selectedUnitData?.unit_number} Interior</h4>
                                    <p className="text-[#94A3B8] font-light text-[15px] mb-10 leading-relaxed">
                                        Entering the immersive interior view. Experience the materiality and light of your future sanctuary.
                                    </p>
                                    <button
                                        onClick={() => setViewMode('exterior')}
                                        className="px-8 py-4 rounded-full glass border-white/10 text-[11px] tracking-[0.2em] uppercase hover:border-[#C6A664]/40 hover:text-[#C6A664] transition-all"
                                    >
                                        Return to Exterior
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Visual Overlays ── */}

                {/* HUD: Lighting / Environment */}
                <div className="absolute top-8 right-8 flex flex-col items-end gap-6 z-30">
                    {isAdmin && viewMode === 'exterior' && (
                        <button
                            onClick={handleSuggestUnits}
                            disabled={suggestLoading}
                            className="glass-heavy px-5 py-2.5 rounded-full border border-white/10 flex items-center gap-2 text-[10px] tracking-widest uppercase font-bold text-[#C6A664] hover:bg-[#C6A664]/10 transition-colors disabled:opacity-50"
                        >
                            {suggestLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            Suggest units (AI)
                        </button>
                    )}
                    <div className="glass-heavy p-1.5 rounded-full border border-white/10 flex items-center gap-1 shadow-2xl">
                        {LIGHTING_OPTS.map((opt) => {
                            const Icon = opt.icon;
                            const isActive = lightingMode === opt.mode;
                            return (
                                <button
                                    key={opt.mode}
                                    onClick={() => setLightingMode(opt.mode)}
                                    className={`
                                        relative flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-500
                                        ${isActive ? 'bg-[#C6A664] text-[#0A0A0B]' : 'text-[#94A3B8] hover:text-[#F5F7FA]'}
                                    `}
                                >
                                    <Icon size={14} className={isActive ? 'animate-none' : 'opacity-60'} />
                                    <span className="text-[10px] tracking-widest uppercase font-bold">{opt.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Suggest units modal (admin) */}
                <AnimatePresence>
                    {suggestModalOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
                            onClick={() => !suggestLoading && !saving && setSuggestModalOpen(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="glass-heavy rounded-2xl border border-white/10 p-8 max-w-md w-full max-h-[80vh] overflow-y-auto"
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="font-serif-display text-xl text-[#F5F7FA]">AI unit suggestions</h3>
                                    <button onClick={() => !suggestLoading && !saving && setSuggestModalOpen(false)} className="p-2 rounded-lg hover:bg-white/10 text-[#94A3B8]">
                                        <X size={18} />
                                    </button>
                                </div>
                                {suggestLoading && (
                                    <div className="flex items-center gap-3 text-[#C6A664] py-8">
                                        <Loader2 size={20} className="animate-spin" />
                                        <span className="text-sm">Analyzing building view…</span>
                                    </div>
                                )}
                                {suggestError && (
                                    <p className="text-red-400 text-sm mb-4">{suggestError}</p>
                                )}
                                {!suggestLoading && suggestions.length > 0 && (
                                    <>
                                        <p className="text-[#94A3B8] text-xs tracking-wider uppercase mb-4">Confirm which suggestions to add as units</p>
                                        <ul className="space-y-2 mb-6">
                                            {suggestions.map((s, i) => (
                                                <li key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                                    <input
                                                        type="checkbox"
                                                        checked={confirmed.has(i)}
                                                        onChange={() => toggleConfirmed(i)}
                                                        className="rounded border-[#C6A664]/50 text-[#C6A664]"
                                                    />
                                                    <span className="text-[#F5F7FA] font-medium">Unit {s.label}</span>
                                                    <span className="text-[#94A3B8] text-xs">Floor {s.floor} · {s.position}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={handleSaveSuggestedUnits}
                                                disabled={saving || confirmed.size === 0}
                                                className="flex-1 py-3.5 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] tracking-widest uppercase font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                                Save {confirmed.size} unit(s)
                                            </button>
                                            <button
                                                onClick={() => setSuggestModalOpen(false)}
                                                className="px-5 py-3.5 rounded-xl border border-white/10 text-[#94A3B8] text-[11px] tracking-widest uppercase"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </>
                                )}
                                {!suggestLoading && suggestions.length === 0 && !suggestError && (
                                    <p className="text-[#94A3B8] text-sm py-4">No suggestions returned. Try rotating the view and run again.</p>
                                )}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* HUD: Context Info */}
                <div className="absolute bottom-8 right-8 z-30 pointer-events-none">
                    <div className="glass px-6 py-5 rounded-2xl border border-white/5 text-right">
                        <div className="text-[9px] tracking-[0.3em] text-[#C6A664] uppercase mb-1.5">Project Context</div>
                        <div className="text-lg font-light text-[#F5F7FA]">{building?.location || 'Downtown District'}</div>
                        <div className="text-[10px] tracking-widest text-[#94A3B8] uppercase mt-1">Lat 40.7128° N · Lon 74.0060° W</div>
                    </div>
                </div>

                {/* View Controls Helper */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none hidden md:block">
                    <div className="glass px-8 py-3 rounded-full border border-white/5 flex items-center gap-8">
                        <div className="flex items-center gap-2.5">
                            <div className="w-4 h-4 rounded border border-white/20 flex items-center justify-center text-[8px] text-[#94A3B8]">L</div>
                            <span className="text-[9px] tracking-widest text-[#94A3B8] uppercase">Orbit</span>
                        </div>
                        <div className="w-px h-3 bg-white/10" />
                        <div className="flex items-center gap-2.5">
                            <div className="w-4 h-4 rounded border border-white/20 flex items-center justify-center text-[8px] text-[#94A3B8]">R</div>
                            <span className="text-[9px] tracking-widest text-[#94A3B8] uppercase">Pan</span>
                        </div>
                        <div className="w-px h-3 bg-white/10" />
                        <div className="flex items-center gap-2.5">
                            <div className="w-4 h-4 rounded border border-white/20 flex items-center justify-center text-[8px] text-[#94A3B8]">SC</div>
                            <span className="text-[9px] tracking-widest text-[#94A3B8] uppercase">Zoom</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
