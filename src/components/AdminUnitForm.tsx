'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { CurrencyInput } from './CurrencyInput';
import AdminUnitFormBoxSize from './AdminUnitFormBoxSize';
import CustomSelect from './CustomSelect';
import NumberInput from './NumberInput';
import type { Database } from '@/lib/database.types';

type UnitRow = Database['public']['Tables']['units']['Row'];
type UnitUpdate = Database['public']['Tables']['units']['Update'];

const VIEW_OPTIONS = ['City', 'Garden', 'Pool', 'Sea', 'Skyline', 'Park', 'Other'];

interface AdminUnitFormProps {
    unit: UnitRow;
    onSaved: () => void;
    onError: (message: string) => void;
    /** When true, 3D box dimensions are controlled only via the building plan flow — no size fields or PATCH size. */
    geometryLocked?: boolean;
    /** Beige / brown studio panel (no world mesh listings). */
    studioListingStyle?: boolean;
}

export default function AdminUnitForm({
    unit,
    onSaved,
    onError,
    geometryLocked = false,
    studioListingStyle = false,
}: AdminUnitFormProps) {
    const [saving, setSaving] = useState(false);
    const [unitNumber, setUnitNumber] = useState(unit.unit_number);
    const [displayName, setDisplayName] = useState(unit.display_name ?? '');
    const [floor, setFloor] = useState(unit.floor);
    const [price, setPrice] = useState<number | null>(unit.price != null ? Number(unit.price) : null);
    const [areaSqm, setAreaSqm] = useState(() => (unit.area_sqm != null ? Number(unit.area_sqm) : 0));
    const [bedrooms, setBedrooms] = useState(() => (unit.bedrooms != null ? Number(unit.bedrooms) : 0));
    const [bathrooms, setBathrooms] = useState(() => (unit.bathrooms != null ? Number(unit.bathrooms) : 0));
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
        setAreaSqm(unit.area_sqm != null ? Number(unit.area_sqm) : 0);
        setBedrooms(unit.bedrooms != null ? Number(unit.bedrooms) : 0);
        setBathrooms(unit.bathrooms != null ? Number(unit.bathrooms) : 0);
        setViewType(unit.view_type ?? '');
        setAmenities(unit.amenities ?? '');
        setPerks(unit.perks ?? '');
        const [sx, sy, sz] = parseSize(unit.size);
        setSizeX(sx);
        setSizeY(sy);
        setSizeZ(sz);
    }, [unit.id, unit.unit_number, unit.display_name, unit.floor, unit.price, unit.area_sqm,
        unit.bedrooms, unit.bathrooms, unit.view_type, unit.amenities, unit.perks, unit.size]);

    const S = studioListingStyle;
    const lbl = S
        ? 'block text-[10px] tracking-[0.2em] text-[#715852]/75 uppercase mb-1.5'
        : 'block text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5';
    const field = S
        ? 'w-full rounded-lg bg-white/45 border border-[rgba(113,88,82,0.28)] px-3 py-2.5 text-sm text-[#715852] placeholder-[#715852]/45'
        : 'w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-[#F5F7FA] placeholder-[#94A3B8]/50';
    const studioSelectBtn =
        '!border-[rgba(113,88,82,0.28)] !bg-white/45 !text-[#715852] !shadow-none hover:!border-[rgba(113,88,82,0.42)] [&_svg]:!text-[#715852]';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        onError('');
        const payload: UnitUpdate = {
            unit_number: unitNumber.trim() || unit.unit_number,
            display_name: displayName.trim() || null,
            floor: Number(floor) || 1,
            price: price,
            area_sqm: areaSqm === 0 ? null : areaSqm,
            bedrooms: unit.bedrooms == null && bedrooms === 0 ? null : bedrooms,
            bathrooms: unit.bathrooms == null && bathrooms === 0 ? null : bathrooms,
            view_type: viewType.trim() || null,
            amenities: amenities.trim() || null,
            perks: perks.trim() || null,
            internal_model_url: unit.internal_model_url ?? null,
            ...(!geometryLocked && {
                size: [Number(sizeX) || 3, Number(sizeY) || 2, Number(sizeZ) || 3],
            }),
        };
        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
                <label className={lbl}>Unit number</label>
                <input type="text" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} className={field} placeholder="e.g. 101" />
            </div>
            <div>
                <label className={lbl}>Display name (optional)</label>
                <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={field}
                    placeholder="e.g. Skyline Penthouse"
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={lbl}>Floor</label>
                    <NumberInput min={1} value={floor} onChange={setFloor} className={field} />
                </div>
                <div>
                    <label className={lbl}>Price</label>
                    <CurrencyInput
                        value={price}
                        onChange={setPrice}
                        className={`${field} py-2.5`}
                        studioListingStyle={S}
                    />
                </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <label className={lbl}>Area (m²)</label>
                    <NumberInput
                        allowDecimal
                        min={0}
                        value={areaSqm}
                        onChange={setAreaSqm}
                        hideZeroAsEmpty
                        className={field}
                    />
                </div>
                <div>
                    <label className={lbl}>Beds</label>
                    <NumberInput min={0} value={bedrooms} onChange={setBedrooms} hideZeroAsEmpty className={field} />
                </div>
                <div>
                    <label className={lbl}>Baths</label>
                    <NumberInput min={0} value={bathrooms} onChange={setBathrooms} hideZeroAsEmpty className={field} />
                </div>
            </div>
            <div>
                <label className={lbl}>View</label>
                <CustomSelect
                    value={viewType || ''}
                    onChange={setViewType}
                    placeholder="Select view"
                    options={[
                        { value: '', label: 'Select view' },
                        ...VIEW_OPTIONS.map((v) => ({ value: v, label: v })),
                    ]}
                    className="w-full"
                    buttonClassName={S ? `py-2.5 text-sm ${studioSelectBtn}` : 'py-2.5 text-sm'}
                />
            </div>
            <div>
                <label className={lbl}>Amenities</label>
                <textarea
                    value={amenities}
                    onChange={(e) => setAmenities(e.target.value)}
                    rows={2}
                    className={`${field} resize-none`}
                    placeholder="e.g. Gym, Pool, Concierge"
                />
            </div>
            <div>
                <label className={lbl}>Perks</label>
                <textarea
                    value={perks}
                    onChange={(e) => setPerks(e.target.value)}
                    rows={2}
                    className={`${field} resize-none`}
                    placeholder="e.g. 2 parking spots, storage"
                />
            </div>
            {!geometryLocked && (
                <AdminUnitFormBoxSize
                    value={[sizeX, sizeY, sizeZ]}
                    onChange={([x, y, z]) => {
                        setSizeX(x);
                        setSizeY(y);
                        setSizeZ(z);
                    }}
                    studioListingStyle={S}
                />
            )}
            <button
                type="submit"
                disabled={saving}
                className={
                    S
                        ? 'w-full py-3.5 rounded-lg text-[11px] tracking-[0.15em] font-bold uppercase flex items-center justify-center gap-2 disabled:opacity-50 text-[#F5F0EB]'
                        : 'w-full py-3.5 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] tracking-[0.2em] font-bold uppercase flex items-center justify-center gap-2 disabled:opacity-50'
                }
                style={S ? { background: '#715852' } : undefined}
            >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Save unit info
            </button>
        </form>
    );
}
