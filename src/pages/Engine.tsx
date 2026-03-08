import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Sunset, Moon, BellRing, Sparkles, Loader2 } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import MyxelliaCanvas from '../components/MyxelliaCanvas';
import EngineSidebar from '../components/EngineSidebar';
import EngineInteriorView from '../components/EngineInteriorView';
import SuggestUnitsModal from '../components/SuggestUnitsModal';
import InteriorUploadModal from '../components/InteriorUploadModal';
import EngineViewControls from '../components/EngineViewControls';
import EngineContextCard from '../components/EngineContextCard';
import SetDefaultSkyboxButton from '../components/SetDefaultSkyboxButton';
import { useEngineStore } from '../store/engine.store';
import { useAuthStore } from '../store/auth.store';
import { suggestUnits, type UnitSuggestion } from '../lib/ai';
import { fetchSkyboxEnvironments } from '../lib/skybox';
import type { Database } from '../lib/database.types';
import type { InteriorHotspot } from '../lib/database.types';

type UnitRow = Database['public']['Tables']['units']['Row'];
const ease = [0.2, 0.8, 0.2, 1] as const;
type LightingMode = 'morning' | 'golden' | 'night';
const LIGHTING_OPTS: { mode: LightingMode; icon: typeof Sun; label: string }[] = [
    { mode: 'morning', icon: Sun, label: 'Morning' },
    { mode: 'golden', icon: Sunset, label: 'Golden Hour' },
    { mode: 'night', icon: Moon, label: 'Night' },
];

function EngineErrorFallback({ resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
    const navigate = useNavigate();
    const { buildingId } = useParams();
    return (
        <div className="w-screen h-screen bg-[#0A0A0B] flex flex-col items-center justify-center gap-6 p-8">
            <p className="text-red-400/90 text-sm text-center max-w-md">Something went wrong loading the engine.</p>
            <div className="flex gap-4">
                <button onClick={resetErrorBoundary} className="px-4 py-2 rounded-lg bg-white/10 text-[#F5F7FA] text-xs uppercase tracking-wider">Try again</button>
                <button onClick={() => navigate(buildingId ? `/detail/${buildingId}` : '/')} className="px-4 py-2 rounded-lg bg-[#C6A664]/20 text-[#C6A664] text-xs uppercase tracking-wider">Back to project</button>
            </div>
        </div>
    );
}

export default function Engine() {
    const { buildingId } = useParams();
    const {
        building, units, loading,
        selectedUnit, viewMode, lightingMode, unitStatuses, notification,
        skyboxEnvironments, selectedSkyboxUrl,
        fetchBuilding, fetchUnits, setSelectedUnit, setViewMode, setLightingMode,
        setUnitStatus, setNotification, requestScreenshot, setUnitPositionHandler, setUnitSizeHandler,
        setSkyboxEnvironments, setSelectedSkyboxUrl,
        resetEngine,
    } = useEngineStore();

    const [suggestModalOpen, setSuggestModalOpen] = useState(false);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const [suggestError, setSuggestError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<UnitSuggestion[]>([]);
    const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState(false);
    const [unitFormError, setUnitFormError] = useState<string | null>(null);
    const [interiorModalOpen, setInteriorModalOpen] = useState(false);

    const { profile } = useAuthStore();
    const isAdmin = profile?.role === 'admin';

    useEffect(() => {
        if (buildingId) {
            fetchBuilding(buildingId);
            fetchUnits(buildingId);
        }
        return () => { resetEngine(); };
    }, [buildingId, fetchBuilding, fetchUnits, resetEngine]);
    useEffect(() => {
        const token = () => useAuthStore.getState().session?.access_token ?? undefined;
        fetchSkyboxEnvironments(token).then(setSkyboxEnvironments);
    }, [setSkyboxEnvironments]);
    useEffect(() => {
        if (building?.id) setSelectedSkyboxUrl(building.generated_env_url ?? null);
    }, [building?.id, setSelectedSkyboxUrl]);
    useEffect(() => {
        if (!notification) return;
        const t = setTimeout(() => setNotification(null), 5000);
        return () => clearTimeout(t);
    }, [notification, setNotification]);
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
        setNotification(`Reservation requested — Unit ${selectedUnitData?.unit_number}`);
    };

    const handleUnitSaved = () => {
        if (buildingId) fetchUnits(buildingId);
        setNotification('Unit info saved.');
        setUnitFormError(null);
    };
    const handleInteriorUploaded = () => {
        if (buildingId) fetchUnits(buildingId);
        setNotification('Interior view added.');
        setUnitFormError(null);
    };
    const handleSaveHotspots = async (unitId: string, hotspots: InteriorHotspot[]) => {
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const token = useAuthStore.getState().session?.access_token;
        if (!url || !key || !token || !buildingId) return;
        const res = await fetch(`${url}/rest/v1/units?id=eq.${unitId}`, {
            method: 'PATCH',
            headers: { 'apikey': key, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ hotspots }),
        });
        if (!res.ok) return;
        await fetchUnits(buildingId);
        setNotification('Hotspots updated.');
    };

    const handleAddUnit = async (unitNumber: string, floor: number) => {
        if (!buildingId || !building) return;
        const trimmed = unitNumber.trim();
        if (!trimmed) return;
        const existing = units.some((u: UnitRow) => u.unit_number === trimmed);
        if (existing) {
            setUnitFormError(`Unit ${trimmed} already exists.`);
            return;
        }
        const rawPrice = (building as { starting_price?: string }).starting_price;
        const defaultPrice = rawPrice && !isNaN(Number(rawPrice)) ? Number(rawPrice) : 120000000;
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const token = useAuthStore.getState().session?.access_token;
        if (!url || !key || !token) {
            setUnitFormError('Missing Supabase config or session. Please sign in.');
            return;
        }
        const res = await fetch(`${url}/rest/v1/units`, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
                building_id: buildingId,
                unit_number: trimmed,
                floor,
                price: defaultPrice,
                status: 'available',
                mesh_id: `u-${trimmed}`,
            }),
        });
        if (!res.ok) {
            const errText = await res.text();
            setUnitFormError(errText || 'Failed to add unit');
            return;
        }
        setUnitFormError(null);
        await fetchUnits(buildingId);
        setNotification(`Unit ${trimmed} added.`);
    };

    const handleDeleteUnit = async (unitId: string) => {
        if (!buildingId) return;
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const token = useAuthStore.getState().session?.access_token;
        if (!url || !key || !token) {
            setUnitFormError('Missing Supabase config or session. Please sign in.');
            return;
        }
        const res = await fetch(`${url}/rest/v1/units?id=eq.${unitId}`, {
            method: 'PATCH',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ deleted_at: new Date().toISOString() }),
        });
        if (!res.ok) {
            const errText = await res.text();
            setUnitFormError(errText || 'Failed to delete unit');
            return;
        }
        if (selectedUnit === unitId) setSelectedUnit(null);
        setUnitFormError(null);
        await fetchUnits(buildingId);
        setNotification('Unit removed.');
    };

    const handleUpdateUnitPosition = async (unitId: string, position: [number, number, number]) => {
        const { buildingId: bid } = useEngineStore.getState();
        if (!bid) return;
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const token = useAuthStore.getState().session?.access_token;
        if (!url || !key || !token) return;
        const res = await fetch(`${url}/rest/v1/units?id=eq.${unitId}`, {
            method: 'PATCH',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ position }),
        });
        if (!res.ok) return;
        await useEngineStore.getState().fetchUnits(bid);
        setNotification('Unit position updated.');
    };

    const handleUpdateUnitSize = async (unitId: string, size: [number, number, number]) => {
        const { buildingId: bid } = useEngineStore.getState();
        if (!bid) return;
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const token = useAuthStore.getState().session?.access_token;
        if (!url || !key || !token) return;
        const res = await fetch(`${url}/rest/v1/units?id=eq.${unitId}`, {
            method: 'PATCH',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ size }),
        });
        if (!res.ok) return;
        await useEngineStore.getState().fetchUnits(bid);
        setNotification('Unit size updated.');
    };

    useEffect(() => {
        setUnitPositionHandler(handleUpdateUnitPosition);
        setUnitSizeHandler(handleUpdateUnitSize);
        return () => {
            setUnitPositionHandler(null);
            setUnitSizeHandler(null);
        };
    }, [setUnitPositionHandler, setUnitSizeHandler]);

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
            const rawStartingPrice = (building as { starting_price?: string }).starting_price;
            const defaultPrice = rawStartingPrice && !isNaN(Number(rawStartingPrice))
                ? Number(rawStartingPrice)
                : 120000000;
            const rows: Database['public']['Tables']['units']['Insert'][] = newSuggestions.map((s) => ({
                building_id: buildingId,
                unit_number: s.label,
                floor: s.floor,
                price: defaultPrice,
                status: 'available',
                mesh_id: `u-${s.label}`,
            }));
            const url = import.meta.env.VITE_SUPABASE_URL;
            const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const token = useAuthStore.getState().session?.access_token;
            if (!url || !key || !token) throw new Error('Missing Supabase config or session. Please sign in.');
            const res = await fetch(`${url}/rest/v1/units`, {
                method: 'POST',
                headers: {
                    'apikey': key,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(rows)
            });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || `Units insert failed: ${res.status}`);
            }
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
        <ErrorBoundary FallbackComponent={EngineErrorFallback}>
            <div className="w-screen h-screen bg-[#0A0A0B] text-[#F5F7FA] overflow-hidden relative">
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

            <div className="absolute inset-0">
                <div className="w-full h-full">
                    <MyxelliaCanvas />
                </div>
                <AnimatePresence>
                    {viewMode === 'interior' && (
                        <motion.div
                            key="interior-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="absolute inset-0 pointer-events-none"
                        >
                            <EngineInteriorView
                                unit={selectedUnitData}
                                isAdmin={!!isAdmin}
                                onBackToExterior={() => setViewMode('exterior')}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="absolute top-8 right-8 flex flex-col items-end gap-6 z-30">
                    {isAdmin && viewMode === 'exterior' && (
                        <button onClick={handleSuggestUnits} disabled={suggestLoading} className="glass-heavy px-5 py-2.5 rounded-full border border-white/10 flex items-center gap-2 text-[10px] tracking-widest uppercase font-bold text-[#C6A664] hover:bg-[#C6A664]/10 transition-colors disabled:opacity-50">
                            {suggestLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            Suggest units (AI)
                        </button>
                    )}
                    {viewMode === 'exterior' && (
                        <>
                            {skyboxEnvironments.length > 0 && (
                                <div className="glass-heavy px-3 py-2 rounded-full border border-white/10 shadow-2xl flex items-center gap-2">
                                    <select
                                        value={selectedSkyboxUrl ?? ''}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setSelectedSkyboxUrl(v === '' ? null : v);
                                        }}
                                        className="bg-transparent text-[10px] tracking-widest uppercase font-bold text-[#F5F7FA] focus:outline-none cursor-pointer max-w-[180px]"
                                    >
                                        <option value="">Default skybox</option>
                                        <option value="__none__">No skybox</option>
                                        {skyboxEnvironments.map((s) => (
                                            <option key={s.id} value={s.file_url}>{s.label}</option>
                                        ))}
                                    </select>
                                    {isAdmin && selectedSkyboxUrl && selectedSkyboxUrl !== '__none__' && buildingId && (
                                        <SetDefaultSkyboxButton
                                            buildingId={buildingId}
                                            url={selectedSkyboxUrl}
                                            onSaved={() => { if (buildingId) fetchBuilding(buildingId); setNotification('Default skybox updated.'); }}
                                        />
                                    )}
                                </div>
                            )}
                            <div className="glass-heavy p-1.5 rounded-full border border-white/10 flex items-center gap-1 shadow-2xl">
                                {LIGHTING_OPTS.map((opt) => {
                                    const Icon = opt.icon;
                                    const isActive = lightingMode === opt.mode;
                                    return (
                                        <button key={opt.mode} onClick={() => setLightingMode(opt.mode)} className={`relative flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-500 ${isActive ? 'bg-[#C6A664] text-[#0A0A0B]' : 'text-[#94A3B8] hover:text-[#F5F7FA]'}`}>
                                            <Icon size={14} className={isActive ? 'animate-none' : 'opacity-60'} />
                                            <span className="text-[10px] tracking-widest uppercase font-bold">{opt.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                <SuggestUnitsModal open={suggestModalOpen} loading={suggestLoading} saving={saving} error={suggestError} suggestions={suggestions} confirmed={confirmed} onClose={() => !suggestLoading && !saving && setSuggestModalOpen(false)} onToggle={toggleConfirmed} onSave={handleSaveSuggestedUnits} />
                <InteriorUploadModal
                    open={interiorModalOpen}
                    onClose={() => setInteriorModalOpen(false)}
                    unit={selectedUnitData ?? null}
                    onUploaded={handleInteriorUploaded}
                    onError={setUnitFormError}
                />

                <EngineContextCard location={building?.location} />
                <EngineViewControls />
            </div>

            <EngineSidebar
                floors={floors}
                selectedUnitData={selectedUnitData}
                currentStatus={currentStatus}
                unitFormError={unitFormError}
                isAdmin={!!isAdmin}
                onReserve={handleReserve}
                onUnitSaved={handleUnitSaved}
                onAddUnit={handleAddUnit}
                onDeleteUnit={handleDeleteUnit}
                setUnitFormError={setUnitFormError}
                onInteriorUploaded={handleInteriorUploaded}
                onViewInterior={() => setViewMode('interior')}
                onSaveHotspots={handleSaveHotspots}
                onOpenInteriorModal={() => setInteriorModalOpen(true)}
            />
            </div>
        </ErrorBoundary>
    );
}
