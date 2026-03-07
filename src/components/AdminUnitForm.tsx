import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { CurrencyInput } from './CurrencyInput';
import AdminUnitFormBoxSize from './AdminUnitFormBoxSize';
import type { Database } from '../lib/database.types';

type UnitRow = Database['public']['Tables']['units']['Row'];
type UnitUpdate = Database['public']['Tables']['units']['Update'];

const VIEW_OPTIONS = ['City', 'Garden', 'Pool', 'Sea', 'Skyline', 'Park', 'Other'];

interface AdminUnitFormProps {
    unit: UnitRow;
    onSaved: () => void;
    onError: (message: string) => void;
}

export default function AdminUnitForm({ unit, onSaved, onError }: AdminUnitFormProps) {
    const [saving, setSaving] = useState(false);
    const [unitNumber, setUnitNumber] = useState(unit.unit_number);
    const [displayName, setDisplayName] = useState(unit.display_name ?? '');
    const [floor, setFloor] = useState(unit.floor);
    const [price, setPrice] = useState<number | null>(unit.price != null ? Number(unit.price) : null);
    const [areaSqm, setAreaSqm] = useState(unit.area_sqm ?? '');
    const [bedrooms, setBedrooms] = useState(unit.bedrooms ?? '');
    const [bathrooms, setBathrooms] = useState(unit.bathrooms ?? '');
    const [viewType, setViewType] = useState(unit.view_type ?? '');
    const [amenities, setAmenities] = useState(unit.amenities ?? '');
    const [perks, setPerks] = useState(unit.perks ?? '');
    const parseSize = (s: [number, number, number] | null | undefined) => {
        if (Array.isArray(s) && s.length >= 3) return [Number(s[0]), Number(s[1]), Number(s[2])];
        return [3, 2, 3];
    };
    const [sizeX, setSizeX] = useState(() => parseSize(unit.size)[0]);
    const [sizeY, setSizeY] = useState(() => parseSize(unit.size)[1]);
    const [sizeZ, setSizeZ] = useState(() => parseSize(unit.size)[2]);

    useEffect(() => {
        setUnitNumber(unit.unit_number);
        setDisplayName(unit.display_name ?? '');
        setFloor(unit.floor);
        setPrice(unit.price != null ? Number(unit.price) : null);
        setAreaSqm(unit.area_sqm != null ? String(unit.area_sqm) : '');
        setBedrooms(unit.bedrooms != null ? String(unit.bedrooms) : '');
        setBathrooms(unit.bathrooms != null ? String(unit.bathrooms) : '');
        setViewType(unit.view_type ?? '');
        setAmenities(unit.amenities ?? '');
        setPerks(unit.perks ?? '');
        const [sx, sy, sz] = parseSize(unit.size);
        setSizeX(sx);
        setSizeY(sy);
        setSizeZ(sz);
    }, [unit.id, unit.unit_number, unit.display_name, unit.floor, unit.price, unit.area_sqm,
        unit.bedrooms, unit.bathrooms, unit.view_type, unit.amenities, unit.perks, unit.size]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        onError('');
        const payload: UnitUpdate = {
            unit_number: unitNumber.trim() || unit.unit_number,
            display_name: displayName.trim() || null,
            floor: Number(floor) || 1,
            price: price,
            area_sqm: areaSqm ? Number(areaSqm) : null,
            bedrooms: bedrooms ? Number(bedrooms) : null,
            bathrooms: bathrooms ? Number(bathrooms) : null,
            view_type: viewType.trim() || null,
            amenities: amenities.trim() || null,
            perks: perks.trim() || null,
            internal_model_url: unit.internal_model_url ?? null,
            size: [Number(sizeX) || 3, Number(sizeY) || 2, Number(sizeZ) || 3],
        };
        const baseUrl = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const token = useAuthStore.getState().session?.access_token;
        if (!baseUrl || !key || !token) {
            setSaving(false);
            onError('Missing Supabase config or session. Please sign in.');
            return;
        }
        const res = await fetch(`${baseUrl}/rest/v1/units?id=eq.${unit.id}`, {
            method: 'PATCH',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
            },
            body: JSON.stringify(payload),
        });
        setSaving(false);
        if (!res.ok) {
            onError(await res.text() || 'Failed to update unit');
            return;
        }
        onSaved();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5">Unit number</label>
                <input
                    type="text"
                    value={unitNumber}
                    onChange={(e) => setUnitNumber(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA] placeholder-[#94A3B8]/50"
                    placeholder="e.g. 101"
                />
            </div>
            <div>
                <label className="block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5">Display name (optional)</label>
                <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA] placeholder-[#94A3B8]/50"
                    placeholder="e.g. Skyline Penthouse"
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5">Floor</label>
                    <input
                        type="number"
                        min={1}
                        value={floor}
                        onChange={(e) => setFloor(Number(e.target.value) || 1)}
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA]"
                    />
                </div>
                <div>
                    <label className="block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5">Price</label>
                    <CurrencyInput
                        value={price}
                        onChange={setPrice}
                        className="w-full rounded-lg bg-white/5 border border-white/10 py-2.5 text-sm text-[#F5F7FA]"
                    />
                </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <label className="block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5">Area (m²)</label>
                    <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={areaSqm}
                        onChange={(e) => setAreaSqm(e.target.value)}
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA]"
                    />
                </div>
                <div>
                    <label className="block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5">Beds</label>
                    <input
                        type="number"
                        min={0}
                        value={bedrooms}
                        onChange={(e) => setBedrooms(e.target.value)}
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA]"
                    />
                </div>
                <div>
                    <label className="block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5">Baths</label>
                    <input
                        type="number"
                        min={0}
                        value={bathrooms}
                        onChange={(e) => setBathrooms(e.target.value)}
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA]"
                    />
                </div>
            </div>
            <div>
                <label className="block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5">View</label>
                <select
                    value={viewType || ''}
                    onChange={(e) => setViewType(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA]"
                >
                    <option value="">Select view</option>
                    {VIEW_OPTIONS.map((v) => (
                        <option key={v} value={v}>{v}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5">Amenities</label>
                <textarea
                    value={amenities}
                    onChange={(e) => setAmenities(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA] placeholder-[#94A3B8]/50 resize-none"
                    placeholder="e.g. Gym, Pool, Concierge"
                />
            </div>
            <div>
                <label className="block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5">Perks</label>
                <textarea
                    value={perks}
                    onChange={(e) => setPerks(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA] placeholder-[#94A3B8]/50 resize-none"
                    placeholder="e.g. 2 parking spots, storage"
                />
            </div>
            <AdminUnitFormBoxSize value={[sizeX, sizeY, sizeZ]} onChange={([x, y, z]) => { setSizeX(x); setSizeY(y); setSizeZ(z); }} />
            <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] tracking-[0.2em] font-bold uppercase flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Save unit info
            </button>
        </form>
    );
}
